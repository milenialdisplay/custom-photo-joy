"""FastAPI entrypoint for the dpotopoto print agent.

Run with:
    python -m uvicorn agent.main:app --host 0.0.0.0 --port 8080
"""
from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Form, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import discovery, policy, printer
from .queue import JobQueue

ROOT = Path(__file__).parent
CONFIG = json.loads((ROOT / "config.json").read_text())

app = FastAPI(title="dpotopoto print agent", version=CONFIG["agent_version"])

# LAN-only: allow any origin so phones on the venue Wi-Fi can hit us.
# Don't expose this agent to the public internet.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

queue = JobQueue(
    db_path=ROOT / "queue.sqlite",
    config=CONFIG,
)
queue.start_worker()


# ───────────────────────────── endpoints ─────────────────────────────


@app.get("/health")
def health():
    return {
        "agent": f"dpoto-agent {CONFIG['agent_version']}",
        "printer": printer.status(CONFIG["printer_name"]),
        "queue_depth": queue.depth(),
    }


@app.get("/queue")
def list_queue():
    return queue.list_recent(limit=50)


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = queue.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job


@app.post("/print")
async def submit_print(
    file: UploadFile = File(...),
    paper_size: str = Form(...),
    paper_preset: str = Form("default"),
    copies: int = Form(1),
    guest_id: str = Form(...),
    guest_name: str = Form(...),
    guest_color: str = Form(...),
):
    # Validate
    max_copies = int(CONFIG.get("max_copies_per_job", 10))
    if copies < 1 or copies > max_copies:
        return JSONResponse(
            {"error": "copies_out_of_range", "max": max_copies},
            status_code=400,
        )
    if paper_size not in {"2R", "4R", "A5", "A6", "Square", "A4"}:
        raise HTTPException(400, "invalid paper_size")

    # Printer availability
    if printer.status(CONFIG["printer_name"]) == "offline":
        return JSONResponse({"error": "printer_offline"}, status_code=503)

    # Fair-use
    violation = policy.check(queue, guest_id, CONFIG)
    if violation:
        return JSONResponse(violation, status_code=429)

    # Stash upload
    job_id = uuid.uuid4().hex[:12]
    upload_dir = ROOT / "uploads"
    upload_dir.mkdir(exist_ok=True)
    dest = upload_dir / f"{job_id}_{file.filename}"
    dest.write_bytes(await file.read())

    position, eta = queue.enqueue(
        job_id=job_id,
        file_path=str(dest),
        paper_size=paper_size,
        paper_preset=paper_preset,
        copies=copies,
        guest_id=guest_id,
        guest_name=guest_name,
        guest_color=guest_color,
    )

    return {"job_id": job_id, "position": position, "eta_seconds": eta}


# ───────────────────────────── operator console ─────────────────────────────


CONSOLE_HTML = """<!doctype html>
<html><head><meta charset="utf-8"><title>dpoto agent — console</title>
<style>
  body { background:#0a0a0f; color:#e8e8e8; font-family: ui-monospace, monospace; padding: 24px; }
  h1 { color: #73ffb8; letter-spacing: .2em; text-transform: uppercase; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  td, th { border-bottom: 1px solid #222; padding: 8px; text-align: left; font-size: 12px; }
  .tag { display:inline-block; width: 14px; height: 14px; border:1px solid #555; vertical-align: middle; }
  button { background: transparent; border: 1px solid #444; color: #ccc; padding: 4px 10px; font-family: inherit; cursor:pointer; }
  button:hover { border-color: #73ffb8; color: #73ffb8; }
  .pill { padding: 2px 8px; border: 1px solid #444; font-size: 10px; text-transform: uppercase; letter-spacing: .15em; }
</style></head>
<body>
  <h1>// dpotopoto print agent console</h1>
  <div id="status"></div>
  <h1 style="margin-top:24px">// queue</h1>
  <table id="qtbl"><thead><tr><th>#</th><th>tag</th><th>guest</th><th>size</th><th>status</th><th>actions</th></tr></thead><tbody></tbody></table>
  <h1 style="margin-top:24px">// calibration</h1>
  <p>Print the bundled test chart, then edit <code>presets/*.json</code> on disk. Changes hot-reload.</p>
  <button onclick="fetch('/calibrate', {method:'POST'}).then(()=>alert('test chart sent'))">Print test chart</button>
<script>
async function tick() {
  const [h, q] = await Promise.all([
    fetch('/health').then(r=>r.json()),
    fetch('/queue').then(r=>r.json()),
  ]);
  document.getElementById('status').innerHTML =
    `<span class="pill">agent: ${h.agent}</span> ` +
    `<span class="pill">printer: ${h.printer}</span> ` +
    `<span class="pill">queue: ${h.queue_depth}</span>`;
  const tbody = document.querySelector('#qtbl tbody');
  tbody.innerHTML = q.map((j,i) => `
    <tr>
      <td>${i+1}</td>
      <td><span class="tag" style="background:${j.guest_color}"></span></td>
      <td>${j.guest_name}</td>
      <td>${j.paper_size}</td>
      <td>${j.status}</td>
      <td>
        <button onclick="cancelJob('${j.job_id}')">cancel</button>
      </td>
    </tr>`).join('');
}
async function cancelJob(id) {
  await fetch('/jobs/' + id, { method: 'DELETE' });
  tick();
}
setInterval(tick, 2000); tick();
</script>
</body></html>
"""


@app.get("/console", response_class=HTMLResponse)
def console():
    return CONSOLE_HTML


@app.delete("/jobs/{job_id}")
def cancel_job(job_id: str):
    ok = queue.cancel(job_id)
    return {"cancelled": ok}


@app.post("/calibrate")
def calibrate():
    """Send the bundled test chart through the pipeline to the printer."""
    chart = ROOT / "test-chart.png"
    if not chart.exists():
        raise HTTPException(404, "test-chart.png not found")
    job_id = "cal_" + uuid.uuid4().hex[:8]
    queue.enqueue(
        job_id=job_id,
        file_path=str(chart),
        paper_size="4R",
        paper_preset="default",
        copies=1,
        guest_id="operator",
        guest_name="CALIBRATION",
        guest_color="#73ffb8",
    )
    return {"job_id": job_id, "queued_at": time.time()}


# ════════════════════════ booth: discovery & setup ════════════════════════
# Admin-only endpoints, used by /printer/setup wizard. LAN-only.


@app.get("/api/location")
def api_location():
    return {
        "location_id": CONFIG.get("location_id", "unset"),
        "location_label": CONFIG.get("location_label", "Unset Booth"),
        "ssid": CONFIG.get("ssid", ""),
        "printer_name": CONFIG.get("printer_name", ""),
        "default_paper_size": CONFIG.get("default_paper_size", "A6"),
        "agent_version": CONFIG.get("agent_version", "0.0.0"),
    }


@app.get("/api/config")
def api_config():
    """Adjustable per-booth config consumed by the /print web page.

    Operators edit prices_idr + limits in config.json on the Dell —
    no web redeploy needed. Defaults are sensible if a field is missing.
    """
    prices = CONFIG.get("prices_idr") or {}
    return {
        "location_id": CONFIG.get("location_id", "unset"),
        "location_label": CONFIG.get("location_label", "Unset Booth"),
        "printer_name": CONFIG.get("printer_name", ""),
        "prices_idr": {
            "A4": int(prices.get("A4", 15000)),
            "A5": int(prices.get("A5", 5000)),
        },
        "max_copies_per_job": int(CONFIG.get("max_copies_per_job", 10)),
        "max_files_per_order": int(CONFIG.get("max_files_per_order", 10)),
    }


@app.get("/discover")
def api_discover():
    """Scan LAN for printers (mDNS + nmap port 9100). Returns candidates."""
    candidates = discovery.discover()
    return {"candidates": candidates, "installed": discovery.lpstat_printers()}


class ConfigureBody(BaseModel):
    ip: str | None = None
    printer_name: str | None = None  # if already installed, just adopt by name
    default_paper_size: str | None = None


VALID_SIZES = {"A4", "A5"}


@app.post("/printer/configure")
def api_configure(body: ConfigureBody):
    """Install HP driver for the chosen IP, then persist printer_name + default size."""
    name = body.printer_name
    log = ""
    if body.ip and not name:
        ok, log = discovery.install_hp(body.ip)
        if not ok:
            return JSONResponse({"error": "hp_setup_failed", "log": log}, status_code=500)
        installed = discovery.lpstat_printers()
        name = installed[-1] if installed else None
    if not name:
        return JSONResponse({"error": "no_printer_resolved", "log": log}, status_code=400)

    CONFIG["printer_name"] = name
    if body.default_paper_size:
        if body.default_paper_size not in VALID_SIZES:
            return JSONResponse({"error": "invalid_paper_size"}, status_code=400)
        CONFIG["default_paper_size"] = body.default_paper_size
    (ROOT / "config.json").write_text(json.dumps(CONFIG, indent=2) + "\n")
    return {
        "ok": True,
        "printer_name": name,
        "default_paper_size": CONFIG.get("default_paper_size", "A5"),
        "log": log[-2000:],
    }


@app.post("/printer/test")
def api_test_print():
    """Enqueue the bundled test chart and return the job id for polling."""
    chart = ROOT / "test-chart.png"
    if not chart.exists():
        # Fallback: render a tiny placeholder so the wizard always works.
        try:
            from PIL import Image, ImageDraw
            img = Image.new("RGB", (1200, 1800), "white")
            d = ImageDraw.Draw(img)
            d.rectangle([40, 40, 1160, 1760], outline="black", width=8)
            d.text((80, 80), f"dpotopoto test\n{CONFIG.get('location_label','')}",
                   fill="black")
            img.save(chart)
        except Exception as e:
            raise HTTPException(500, f"no test chart and PIL failed: {e}")

    size = CONFIG.get("default_paper_size", "A5")
    if size not in VALID_SIZES:
        size = "A5"
    job_id = "test_" + uuid.uuid4().hex[:8]
    queue.enqueue(
        job_id=job_id, file_path=str(chart),
        paper_size=size, paper_preset="default", copies=1,
        guest_id="setup-wizard", guest_name="SETUP TEST", guest_color="#1b8c5f",
    )
    return {"job_id": job_id, "paper_size": size}


# ════════════════════════ booth: end-user print page ════════════════════════
# Served from the Dell so phones on the offline booth Wi-Fi can use it
# without any internet round-trip. Plain HTML + vanilla JS.


@app.get("/booth", response_class=HTMLResponse)
def booth_page(loc: str = ""):
    label = CONFIG.get("location_label", "Booth")
    return BOOTH_HTML.replace("__LOCATION_LABEL__", label).replace("__LOC__", loc or CONFIG.get("location_id", ""))


BOOTH_HTML = r"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>dpotopoto · print</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, system-ui, sans-serif;
         background:#f5f3ee; color:#0a0a0f; min-height:100dvh; padding: 18px; }
  .brand { font-size: 10px; letter-spacing:.3em; text-transform:uppercase; color:#1b8c5f; font-weight:700; }
  h1 { font-size: 28px; margin: 4px 0 2px; letter-spacing:-.02em; }
  .loc { font-family: ui-monospace,monospace; font-size: 12px; color:#666; margin-bottom: 24px; }
  .card { background:#fff; border:1.5px solid #0a0a0f; padding: 18px; margin-bottom: 14px; }
  label.drop { display:block; border:2px dashed #999; padding: 32px 16px; text-align:center;
               cursor:pointer; background:#fafafa; }
  label.drop.has { border-color:#1b8c5f; background:#e8f5ec; }
  label.drop span { font-size: 13px; color:#666; }
  input[type=file] { display:none; }
  img.preview { max-width:100%; max-height: 280px; display:block; margin: 12px auto; }
  .row { display:flex; gap:8px; align-items:center; margin: 10px 0; }
  .row label { font-size: 11px; letter-spacing:.2em; text-transform:uppercase; color:#666; min-width: 70px; }
  select, button { font: inherit; padding: 10px 12px; border:1.5px solid #0a0a0f; background:#fff; }
  button.primary { background:#0a0a0f; color:#fff; width:100%; padding: 16px; font-weight:700;
                   letter-spacing:.1em; text-transform:uppercase; font-size: 13px; }
  button.primary:disabled { opacity:.4; }
  .status { font-family: ui-monospace,monospace; font-size: 13px; }
  .pill { display:inline-block; padding: 4px 10px; border:1px solid #0a0a0f; font-size: 10px;
          letter-spacing:.2em; text-transform:uppercase; margin-right:6px; }
  .err { color:#a33; font-size: 13px; margin-top: 8px; }
  .done { background:#1b8c5f; color:#fff; padding: 14px; text-align:center; font-weight:700;
          letter-spacing:.1em; text-transform:uppercase; }
</style></head>
<body>
  <div class="brand">// dpotopoto</div>
  <h1>__LOCATION_LABEL__</h1>
  <div class="loc">printing here · id: __LOC__</div>

  <div class="card" id="connCard">
    <div class="status" id="conn">checking printer…</div>
  </div>

  <div class="card">
    <label class="drop" id="drop">
      <input type="file" id="file" accept="image/*" capture="environment">
      <strong>Tap to pick a photo</strong><br>
      <span>or take one with the camera</span>
    </label>
    <img id="preview" class="preview" hidden>
    <div class="row">
      <label>Size</label>
      <select id="size">
        <option>4R</option><option>2R</option><option>A5</option><option>A6</option><option>Square</option>
      </select>
    </div>
    <div class="row">
      <label>Copies</label>
      <select id="copies"><option>1</option><option>2</option><option>3</option></select>
    </div>
  </div>

  <button class="primary" id="send" disabled>Send to printer</button>
  <div class="err" id="err"></div>
  <div id="result"></div>

<script>
const $ = id => document.getElementById(id);
const fileInput = $('file'), drop = $('drop'), preview = $('preview'), send = $('send');
let chosen = null;

fileInput.addEventListener('change', e => {
  chosen = e.target.files[0];
  if (!chosen) return;
  drop.classList.add('has');
  preview.src = URL.createObjectURL(chosen);
  preview.hidden = false;
  send.disabled = false;
});

async function poll() {
  try {
    const h = await fetch('/health',{cache:'no-store'}).then(r=>r.json());
    $('conn').innerHTML =
      `<span class="pill">printer: ${h.printer}</span>` +
      `<span class="pill">queue: ${h.queue_depth}</span>`;
  } catch { $('conn').textContent = 'agent unreachable — rejoin Wi-Fi'; }
}
poll(); setInterval(poll, 4000);

send.addEventListener('click', async () => {
  if (!chosen) return;
  send.disabled = true; $('err').textContent = '';
  const fd = new FormData();
  fd.append('file', chosen);
  fd.append('paper_size', $('size').value);
  fd.append('paper_preset', 'default');
  fd.append('copies', $('copies').value);
  fd.append('guest_id', 'booth-' + (localStorage.dpotoBooth ||= Math.random().toString(36).slice(2,10)));
  fd.append('guest_name', 'Booth Guest');
  fd.append('guest_color', '#1b8c5f');
  let res;
  try {
    res = await fetch('/print', {method:'POST', body:fd}).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || ('HTTP '+r.status));
      return r.json();
    });
  } catch (e) {
    $('err').textContent = 'Failed: ' + e.message; send.disabled = false; return;
  }
  $('result').innerHTML = '<div class="card status">Queued · position ' + res.position +
    ' · ETA ~' + res.eta_seconds + 's<br><span id="jobst">waiting…</span></div>';
  const jid = res.job_id;
  const iv = setInterval(async () => {
    const j = await fetch('/jobs/' + jid).then(r=>r.json());
    $('jobst').textContent = j.status + (j.position ? ' · pos ' + j.position : '');
    if (j.status === 'done') {
      clearInterval(iv);
      $('result').innerHTML = '<div class="done">✓ Printed — pick it up from the tray</div>';
      send.disabled = false; chosen = null;
      preview.hidden = true; drop.classList.remove('has');
    } else if (j.status === 'failed') {
      clearInterval(iv);
      $('result').innerHTML = '<div class="err">Print failed: ' + (j.error||'unknown') + '</div>';
      send.disabled = false;
    }
  }, 1500);
});
</script>
</body></html>
"""


# ════════════════════════ static React app (optional) ════════════════════════
# If a built React app exists at agent/web/ (copy of `dist/` from the lovable
# project), serve it at /app so phones on the booth Wi-Fi can use the full
# /printer UI without any internet. Same-origin HTTP, no mixed-content block.
# To enable: run `bun run build` in the lovable repo, then copy dist/* into
# agent/web/ on the Dell. The mount is skipped if the folder is empty.
WEB_DIR = ROOT / "web"
if WEB_DIR.exists() and any(WEB_DIR.iterdir()):
    app.mount("/app", StaticFiles(directory=str(WEB_DIR), html=True), name="web")

