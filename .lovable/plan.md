## Goal

Stand up the Printer Booth end-to-end on a **LAN-only, no-internet-required** topology with a **fair multi-user queue**: any guest can submit at any time from their phone, jobs print FIFO, each guest sees their position and gets notified when their print is ready.

Topology: Browser (phone/tablet) → local Python agent on Dell Wyse → CUPS → HP M451n. App and agent share one contract from day 1 so color tuning and queue UX can iterate against real prints immediately.

## Part A — App changes (in this repo)

### 1. New route `src/routes/printer.tsx`
Styled to match `/kiosk` and `/studio`. Sections:

- **Hero**: "Printer Booth — wired, local, no cloud." CTAs: "Send Print" + "Open Operator Console".
- **Guest identity card** (first visit): name + color tag (4 swatches: pink/cyan/yellow/lime). Saved to `localStorage` as `{ guest_id (uuid), guest_name, guest_color }`. Reused on every submission.
- **Connection panel**:
  - Agent base URL input (default `http://192.168.1.50:8080`), saved to `localStorage`.
  - Live status pills: "Agent: Online/Offline", "Printer: Ready/Error", "Queue: N waiting" — polls `GET {agent}/queue` every 3s.
- **Send Print form**:
  - File source: "Use latest Studio export" or upload.
  - Paper size: 2R / 4R / A5 / A6 / Square.
  - Paper preset: "Glossy 200gsm" / "Matte 120gsm" / "Default".
  - Copies (1–3, capped low to keep queue fair).
  - "Send" → `POST {agent}/print` with guest fields + file.
- **My job tracker** (appears after submit): big card showing `#3 in line — ~45s`, your color tag, status (`queued → printing → ready!`). Polls `GET {agent}/jobs/{id}` every 2s. On `done`, switches to "✅ Ready at the printer — look for {color} tag".
- **Public queue view** (collapsed by default): list of waiting jobs as color dots + first names, so guests see fairness.
- **429 handling**: cooldown / quota / queue-full toasts with retry timer.
- **Operator console link**: opens `{agent}/console` in new tab.

### 2. Connect Services card 03 in `src/routes/index.tsx`
Change card 03's `href` from `undefined` to `"/printer"`. One-line edit.

### 3. `head()` metadata on `/printer`
Unique title, description, og tags per route conventions.

### 4. Studio export tweak (`src/lib/studio-export.ts`)
Bake a small **guest tag strip** (name + color square) into the bottom 24px of the exported JPEG — so stacked prints are identifiable at pickup. Toggleable via a "Tag my print" checkbox on `/printer` (on by default).

### 5. Out of scope for app side (this iteration)
- No cloud job persistence — queue lives in agent SQLite.
- No agent auth — LAN-trusted. Future: bearer token.
- No multi-printer routing.

## Part B — Python agent skeleton (`/agent` folder; deployed manually to Dell)

Added to repo for source control. Dell runs `python -m uvicorn agent.main:app`. Not bundled with the web app.

### Files
- `agent/main.py` — FastAPI app with endpoints:
  - `GET /health` → `{ agent, printer: "ready"|"error"|"offline", queue_depth }`
  - `POST /print` — multipart: `file, paper_size, paper_preset, copies, guest_id, guest_name, guest_color`. Validates, enforces cooldown + quota + max-queue, enqueues. Returns `{ job_id, position, eta_seconds }`.
  - `GET /jobs/{id}` → `{ status, position, eta_seconds, guest_color }`.
  - `GET /queue` → list of `{ job_id, guest_name, guest_color, status, paper_size, submitted_at }` (last 50).
  - `GET /console` → HTML operator UI (drag-to-reorder, cancel, pause/resume, calibration, stats).
- `agent/queue.py` — SQLite-backed FIFO. Single worker thread pulls `queued` → marks `printing` → runs pipeline → `lp` → marks `done`/`failed`. One job at a time. Tracks `avg_print_seconds` rolling average for ETA.
- `agent/pipeline.py` — color pipeline:
  1. sRGB → printer ICC (`magick -profile sRGB.icc -profile HP_M451.icc`).
  2. Apply preset tone curve JSON (`-modulate`, `-level`, `-unsharp`).
  3. Resize/fit to paper size at 300 DPI.
  4. Output TIFF to `/tmp/jobs/{id}.tif`.
- `agent/printer.py` — `lp -d HP_M451 -o media={size} -n {copies}`. Polls CUPS until job completes or times out (60s).
- `agent/policy.py` — fair-use rules: per-guest cooldown (default 60s), per-guest event quota (default 5), max queue depth (default 20). Config in `agent/config.json`.
- `agent/presets/` — `glossy_200.json`, `matte_120.json`, `default.json`. Hand-editable tone curves.
- `agent/profiles/` — placeholder; user drops `HP_M451.icc` + `sRGB.icc`.
- `agent/test-chart.png` — bundled calibration chart.
- `agent/README.md` — install + setup steps:
  ```
  sudo apt install cups hplip imagemagick python3-pip
  hp-setup -i  # discover printer over LAN
  pip install fastapi uvicorn python-multipart pillow
  python -m uvicorn agent.main:app --host 0.0.0.0 --port 8080
  ```

### Contract (locked between app and agent)

```
POST /print  (multipart/form-data)
  file, paper_size, paper_preset, copies (1-3),
  guest_id, guest_name, guest_color
  → 200 { job_id, position, eta_seconds }
  → 429 { error: "cooldown"|"quota_exceeded"|"queue_full", retry_after }
  → 503 { error: "printer_offline" }

GET /jobs/{id}  → { status: "queued"|"printing"|"done"|"failed",
                    position, eta_seconds, guest_color, error? }

GET /queue      → [{ job_id, guest_name, guest_color, status,
                     paper_size, submitted_at }]

GET /health     → { agent, printer, queue_depth }
```

### Failure handling
- Paper jam / out of paper → printer status = `error`, worker pauses, all waiting guests see "Printer being refilled".
- Print timeout >60s → retry once, then `failed`, skip to next.
- Operator can cancel/reorder/skip any job from console.

## Verification

- App: `/` → click card 03 → `/printer` loads. Identity card prompts on first visit.
- App: submit with no agent → clean offline toast. With agent → "You're #1 — ~15s" card appears.
- Agent: `curl http://dell.local:8080/health` returns ok. Submit two jobs back-to-back from two phones → both queue, both print sequentially, each phone updates independently.
- Cooldown: submit twice within 60s → second returns 429.
- Color: print bundled test chart → tweak `default.json` from `/console` → reprint → compare.

## Future (not in this plan)

- Optional cloud fallback (Supabase Realtime) for events without LAN.
- Ambient "now printing" display screen for the booth.
- Per-event analytics dashboard.
- Agent bearer-token auth.
- Build-your-own ICC with Argyll workflow.
