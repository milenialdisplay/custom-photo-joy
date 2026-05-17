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

from . import policy, printer
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
    if copies < 1 or copies > 3:
        raise HTTPException(400, "copies must be 1..3")
    if paper_size not in {"2R", "4R", "A5", "A6", "Square"}:
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
