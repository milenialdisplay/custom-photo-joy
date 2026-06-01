# Printer Booth — Phase 1: One Booth, Built for Many

## The model (so future-you isn't stuck)

Each "booth" = **1 Dell Wyse + 1 laser printer** running as a self-contained **offline Wi-Fi vending machine**. No internet at the booth. No cloud. The user's phone joins the booth's Wi-Fi, opens dpotopoto (PWA cached on their phone), prints, walks away.

```text
   ┌─────────── BOOTH (e.g. "Mall-A-L2") ────────────┐
   │                                                 │
   │   Dell Wyse  ──USB──►  HP M451 (or any laser)   │
   │     │                                           │
   │     ├─ Wi-Fi AP   SSID: dpotopoto-mall-a-l2     │
   │     │             PSK : printed on QR sticker   │
   │     ├─ Agent      http://10.42.0.1:8765         │
   │     └─ Location ID: "mall-a-l2"                 │
   │                                                 │
   │   📱 QR sticker on the booth:                   │
   │      → joins Wi-Fi + opens app + locks location │
   └─────────────────────────────────────────────────┘
```

Every booth looks identical except for **location_id**, **SSID**, **PSK**. That's the only thing the admin changes per unit. The app code, the agent code, the install script — same everywhere.

## Why this shape

- **No internet at booth** = no SIM, no router, no monthly fee, no "the Wi-Fi went down" support call.
- **Dell-as-AP** = printer doesn't need its own Wi-Fi; works with any USB laser regardless of brand. M451, Canon, Brother — same flow.
- **QR does everything** = one scan joins the Wi-Fi *and* opens the right app screen. User never types an SSID, never picks a location from a list, never picks the wrong printer.
- **Location ID baked in at provisioning** = no admin screen, no pairing flow, no auth. The sticker IS the registration.

## Phase 1 scope (this build)

Build the **single-booth setup screen + provisioning script**. One Dell, one printer, end-to-end working. Multi-booth requires literally zero new code — only running the provisioning script again with a different location_id.

### What gets built

**1. Dell side — `agent/deploy/provision.sh`** (run once per booth, by admin, over SSH)
- Prompts admin for: `LOCATION_ID` (e.g. `mall-a-l2`), `WIFI_PSK` (8-char random, suggested)
- Configures Dell as Wi-Fi AP via NetworkManager: SSID `dpotopoto-<location_id>`, gateway `10.42.0.1`, DHCP for clients
- Runs `hp-setup -i` discovery (existing plan) to auto-find and install the USB/LAN printer
- Writes `agent/config.json` with `{ location_id, printer_name, ssid, psk }`
- Generates a printable **QR sticker PDF** (`booth-<location_id>.pdf`) containing:
  - Wi-Fi join QR (`WIFI:T:WPA;S:...;P:...;;` — phones auto-join on scan)
  - App-open QR (`http://10.42.0.1:8765/print?loc=<location_id>`)
  - Combined as one QR if possible, else two side-by-side
- Enables `dpoto-agent.service` (already in earlier plan)

**2. Agent — adds to existing `agent/main.py`**
- `GET /print?loc=<id>` — serves the cached PWA shell, injects `location_id` so the UI locks to this booth
- `GET /api/location` — returns `{ location_id, printer_name }` for the UI header
- `POST /api/print` — accepts file/image, enqueues via CUPS, returns job id
- `GET /api/jobs/:id` — poll status
- Reuses discovery endpoints from earlier plan for the **admin-only** setup screen below

**3. App — `src/routes/printer.setup.tsx`** (admin-facing, runs from admin's laptop on the booth's Wi-Fi during provisioning)
- Step 1: "Connected to booth?" → pings `http://10.42.0.1:8765/health`
- Step 2: "Discover printer" → calls agent `/discover`, lets admin pick if multiple
- Step 3: "Configure" → POSTs choice to agent `/printer/configure`
- Step 4: "Test print" → sends test page, polls job
- Step 5: "Done — print the sticker" → shows the PDF the provision script generated, instructions to laminate + stick on booth
- Single linear wizard, no auth (LAN-only, no internet exposure)

**4. App — `src/routes/print.tsx`** (end-user flow, opened by QR)
- Reads `?loc=` from URL, shows "Printing at: Mall A, Level 2"
- Upload-or-camera → preview → Print → progress → "Take your print from the tray ↓"
- Pure client-side; talks only to `http://10.42.0.1:8765` (same origin as the QR URL, so no CORS, no mixed-content)

### Out of scope (deferred, but doesn't block scaling)

- Payment / credits (drop in later as a step before `POST /api/print`)
- Multi-printer-per-booth (architecture supports it; UI assumes one)
- Remote monitoring of booths (would need internet — separate decision later)
- Admin dashboard listing all booths — not needed; each booth is independent

## File changes (technical)

Agent (`agent/`):
- `deploy/provision.sh` — NEW; orchestrates AP setup + printer install + QR PDF generation (uses `qrencode` + `wkhtmltopdf` or `weasyprint`)
- `deploy/install.sh` — add `network-manager`, `dnsmasq`, `qrencode`, `weasyprint`, `avahi-utils`, `nmap`, `hplip`
- `main.py` — add `/print`, `/api/location`, `/api/print`, `/api/jobs/:id`, `/discover`, `/printer/configure`, `/printer/test`
- `config.json` — schema: `{ location_id, location_label, printer_name, ssid }`
- `discovery.py` — NEW; mDNS + nmap helpers
- `README.md` — "How to provision a new booth in 5 minutes"

App (`src/`):
- `routes/printer.setup.tsx` — NEW; admin wizard
- `routes/print.tsx` — NEW; end-user print flow
- `routes/printer.tsx` — add Setup link
- No backend/Lovable Cloud needed for Phase 1 (everything runs on the Dell)

## Provisioning a new booth (the admin flow this enables)

```text
1. Plug Dell + printer at the new location, power on
2. SSH into Dell (over a temp Ethernet/USB-tether, one time)
3. Run:  sudo ./provision.sh mall-b-l1
4. Script prints: "Done. Open booth-mall-b-l1.pdf and laminate the sticker."
5. Stick the QR on the booth
6. Walk away. Booth is live.
```

Repeat for booth #2, #50, #500 — same script, different ID. No code change, no app deploy, no admin screen in the cloud, no central database.

## Open question worth confirming before I build

Confirm: **one printer per booth always** (Phase 1 assumes this). If a single booth ever needs 2 printers (e.g. color + B&W), the QR/URL flow would need a printer picker on the user screen — small change, but better to know now.
