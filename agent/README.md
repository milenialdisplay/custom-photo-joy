# dpotopoto Print Agent

LAN-only print agent for the dpotopoto Printer Booth. Runs on the Dell Wyse
(or any Linux box) next to an HP LaserJet M451n. Phones on the same Wi-Fi
POST jobs to this agent; the agent queues them FIFO, applies the color
pipeline, and sends them to CUPS one at a time.

No cloud, no internet required for the print path. The web app talks
directly to `http://<dell-ip>:8080`.

## What it does

- Accepts jobs over HTTP from any device on the LAN
- Enforces fair-use limits (per-guest cooldown, per-event quota, max queue depth)
- One worker thread, one job at a time = no print collisions
- Color pipeline: sRGB → printer ICC → tone curve → 300 DPI → TIFF → `lp`
- Tracks rolling average print time for live ETAs
- Bundled operator console at `/console` for reorder / cancel / pause / calibrate

## Hardware

- Dell Wyse (or any Linux box with Python 3.10+)
- HP LaserJet Pro 400 M451n (or any CUPS-supported printer)
- Wired Ethernet between Dell and printer (or printer on same LAN)
- Wi-Fi for guest phones

## Install

```bash
sudo apt update
sudo apt install -y cups hplip imagemagick python3-pip
sudo systemctl enable --now cups

# Discover the printer on the LAN
sudo hp-setup -i

# Confirm it shows up
lpstat -p -d

# Python deps
pip install fastapi uvicorn python-multipart pillow
```

Drop your ICC profiles into `profiles/`:

- `sRGB.icc` — sRGB source profile (ships with most ICC bundles)
- `HP_M451.icc` — printer profile from HP's support site

## Run

```bash
python -m uvicorn agent.main:app --host 0.0.0.0 --port 8080
```

In the web app at `/printer`, set the agent base URL to `http://<dell-ip>:8080`.

## Contract

```
POST /print  (multipart/form-data)
  file, paper_size, paper_preset, copies (1-3),
  guest_id, guest_name, guest_color
  → 200 { job_id, position, eta_seconds }
  → 429 { error: "cooldown"|"quota_exceeded"|"queue_full", retry_after }
  → 503 { error: "printer_offline" }

GET /jobs/{id}  → { status, position, eta_seconds, guest_color, error? }
GET /queue      → [{ job_id, guest_name, guest_color, status, paper_size, submitted_at }]
GET /health     → { agent, printer, queue_depth }
GET /console    → operator HTML UI
```

## Tuning color

1. Print `test-chart.png` from the operator console.
2. Compare to on-screen.
3. Edit the preset JSON in `presets/` — `gamma`, `shadow_lift`, `highlight_roll`,
   `sat_boost`, `warm_shift`. Hot-reload on save.
4. Reprint, repeat.

For deeper calibration: build your own ICC with Argyll CMS + a colorimeter,
drop it into `profiles/`, and reference it from the preset.

## Files

- `main.py` — FastAPI app, endpoints, operator console
- `queue.py` — SQLite-backed FIFO + worker thread
- `pipeline.py` — ImageMagick color pipeline
- `printer.py` — CUPS `lp` wrapper
- `policy.py` — fair-use limits (cooldown / quota / max depth)
- `presets/` — paper tone curves (editable JSON)
- `profiles/` — ICC profiles (you provide)
- `config.json` — agent config
- `test-chart.png` — calibration chart
