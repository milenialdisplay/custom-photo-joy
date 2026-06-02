# Test `/printer` on real hardware (Dell + HP M451 via USB)

## Answers to your questions first

**"Is Dell Wyse's Wi-Fi the booth Wi-Fi?"** — Yes. `agent/deploy/provision.sh` turns the Dell into its own Wi-Fi access point (SSID `dpotopoto-<location>`, e.g. `dpotopoto-mall-a-l2`). Phones connect directly to the Dell. No public Wi-Fi, no router, no internet needed. That is the booth Wi-Fi.

**"Can the M451 use USB instead of Ethernet?"** — Yes. CUPS + HPLIP support the HP LaserJet Pro 400 M451 over USB. No router, no Ethernet, no IP config. Plug USB cable Dell ↔ M451, install the driver, done. This is actually simpler and more reliable than network for a single-printer booth — strongly recommended.

---

## What needs to change in code

The current `/printer` page hardcodes `http://${hostname}:8765` and the systemd unit runs the agent on port `8080`. Two small fixes:

1. **Port mismatch** — `src/routes/printer.tsx` uses `:8765`, but `agent/deploy/dpoto-agent.service` starts uvicorn on `:8080`. Change the page to `:8080` (or add an env override). Without this the phone will never reach the agent.
2. **"Upload & print" before payment** — already done. Pay button is disabled ("Pay now (soon)"), Upload & print is the active path. No change needed; this matches what you asked for.

Optional but recommended:
3. **Agent URL override** — accept `?agent=http://192.168.x.x:8080` query param + remember in `localStorage`, so you can test the same lovable preview from a laptop on the same Wi-Fi without rebuilding. Useful for debugging.

No other code changes. Component (`ConnectIndicator`, `FileRow`, `PrintQueueStrip`, `useBoothConfig`) and pricing already work.

---

## Setup steps on the Dell (one-time)

```text
1. Plug HP M451 into Dell via USB. Power both on.
2. Copy the agent/ folder to the Dell (~/agent) via WinSCP or USB stick.
3. SSH (or open terminal): cd ~/agent && bash deploy/install.sh
     installs CUPS, HPLIP, ImageMagick, the Python venv, systemd unit, mode toggle.
4. Add the USB printer to CUPS:
     hp-setup -i             # interactive — auto-detects USB, downloads .ppd
     # or headless:
     sudo lpadmin -p HP_M451 -E -v "usb://HP/LaserJet%20Pro%20400%20M451dn" -m everywhere
     lpstat -p HP_M451       # should say "idle. enabled."
     echo "test" | lp -d HP_M451   # prints a blank-ish test page
5. Provision booth Wi-Fi (Dell becomes the AP):
     sudo bash deploy/provision.sh mall-a-l2
     # script sets SSID dpotopoto-mall-a-l2 and prints a QR sticker
6. Start the agent in NEW mode (auto-start on boot):
     mode-new
     # → http://<dell-ip>:8080  (on the booth Wi-Fi the IP is usually 10.42.0.1)
7. Verify from the Dell itself:
     curl http://localhost:8080/health      # → {"ok": true, ...}
     curl http://localhost:8080/api/config  # → location_label, prices, printer_name
```

## Test from your phone

```text
1. Phone Wi-Fi → join "dpotopoto-mall-a-l2" (the Dell's network).
2. Browser → open the lovable preview URL OR (recommended) the Dell-hosted copy at
   http://10.42.0.1:8080/printer  (after fix #3 below).
3. /printer page should show:
     • orange "Connect printer" → flips to green "Printer ready · HP_M451"
     • "Printing at: <location_label>" pulled from agent config
4. Tap "+ Select files to print" → pick 1-2 JPGs from camera roll.
5. Pick A4 or A5 per file. Tap "Upload & print".
6. Paper comes out of the M451. Queue strip shows the job pulsing green, then idle.
```

## Gotcha: HTTPS preview vs HTTP agent (mixed content)

The lovable preview is served over HTTPS. The Dell agent is HTTP on a LAN IP. Browsers block HTTPS → HTTP fetches ("mixed content"). Two clean options:

- **A. Host the React app on the Dell too** (recommended for booth). Add a tiny static-file mount to `agent/main.py` so it serves the built `dist/` from `/`. Phone visits `http://10.42.0.1:8080/printer` directly — pure HTTP, no mixed content, no internet needed. I'll wire this in the build step.
- **B. Keep using lovable preview** — only works on `http://localhost` (dev) or if the Dell has a trusted cert. Fine for laptop dev, not realistic for booth.

We'll do A for the actual booth, but A and B both work for verifying the flow.

---

## Plan of changes I'll make in build mode

1. `src/routes/printer.tsx` — change `:8765` → `:8080`; add `?agent=` query param + `localStorage("dpotopoto.agentUrl")` override; same fix in `ConnectIndicator` and `PrintQueueStrip` consumers (they already accept `agentUrl` as a prop, just the page builds it).
2. `agent/main.py` — mount the built React `dist/` at `/` so the Dell serves the page over HTTP on the same port. (Confirm `agent/main.py` already has a FastAPI app; add `app.mount("/", StaticFiles(directory="dist", html=True))` after API routes.)
3. `agent/deploy/install.sh` — add `apt install -y hplip-gui` and a one-liner hint to run `hp-setup -i` after install (USB printer setup).
4. `agent/README.md` (or a new `TESTING.md`) — copy of the "Setup steps" + "Test from your phone" sections above so it stays in the repo.

## Out of scope (deferred until after `/kiosk`)

- Midtrans/Lemon Squeezy payment integration. The "Pay now" button stays disabled.
- Operator console at `/operator`.
- ICC color profile tuning (M451 isn't a photo printer; default driver is fine for the test).

## When you can test

As soon as you approve this plan and I make the 4 changes above (~5 minutes of edits, then you re-run `install.sh` and `mode-new` on the Dell), you can do the phone → Dell → M451 round-trip. No payment, no internet, no router — just USB + Dell AP.
