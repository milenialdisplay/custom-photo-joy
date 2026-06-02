# Testing the dpotopoto print booth (real hardware)

Hardware: **Dell Wyse** (acts as Wi-Fi access point + print server)
+ **HP LaserJet Pro 400 M451** connected by **USB** (no Ethernet, no router).
Phones join the Dell's own Wi-Fi — no public Wi-Fi, no internet.

---

## 1. One-time Dell setup

```bash
# 1.1  Plug HP M451 → Dell via USB. Power both on.

# 1.2  Copy this agent/ folder to ~/agent on the Dell (WinSCP or USB stick).

# 1.3  Install everything (CUPS, HPLIP, Python venv, systemd unit, mode toggle):
cd ~/agent
bash deploy/install.sh

# 1.4  Add the USB printer to CUPS. Easiest is the interactive wizard:
hp-setup -i
#   - choose "USB" when asked
#   - it auto-detects the M451, downloads the .ppd, installs as "HP_M451"
# Headless alternative:
#   sudo lpadmin -p HP_M451 -E -v "usb://HP/LaserJet%20Pro%20400%20M451dn" -m everywhere

# 1.5  Smoke-test the printer from the Dell itself:
lpstat -p HP_M451                 # → "printer HP_M451 is idle. enabled..."
echo "dpotopoto test" | lp -d HP_M451   # one page comes out

# 1.6  Turn the Dell into the booth Wi-Fi access point:
sudo bash deploy/provision.sh mall-a-l2
#   - SSID becomes "dpotopoto-mall-a-l2"
#   - script prints a QR sticker (PNG) you can print and tape to the booth
#   - default booth-AP IP is 10.42.0.1

# 1.7  Start the print agent in NEW mode (auto-starts on every boot):
mode-new
#   → agent listening on http://<dell-ip>:8080

# 1.8  Verify the agent locally on the Dell:
curl http://localhost:8080/health        # {"agent":"dpoto-agent ...", "printer":"ready", ...}
curl http://localhost:8080/api/config    # location_label, prices, printer_name
```

If `printer` in `/health` says `offline`, CUPS does not see the printer.
Re-run `hp-setup -i` and check `lpstat -p HP_M451`.

---

## 2. Test from your phone (3 options, pick one)

### Option A — Built-in booth page on the Dell (simplest, works offline)

The agent already serves a minimal HTML print page at `/booth`.

1. Phone Wi-Fi → join **dpotopoto-mall-a-l2** (the Dell's network).
2. Open browser → `http://10.42.0.1:8080/booth`
3. Pick a photo → choose size → tap "Send to printer". Paper comes out.

Use this to confirm the printer + agent + Wi-Fi chain works end-to-end
before touching the React app.

### Option B — Lovable preview, agent override (debugging from laptop/phone)

The lovable preview is HTTPS, the agent is HTTP → browsers normally block
HTTP-from-HTTPS ("mixed content"). This works only on `localhost` or with
a trusted cert, so it is a dev-only path.

1. On the same Wi-Fi as the Dell, open the preview URL with an `?agent=`
   query parameter pointing at the Dell:
   ```
   https://<lovable-preview>/printer?agent=http://10.42.0.1:8080
   ```
2. The URL is saved to `localStorage`, so subsequent visits reuse it.
   Clear it with `localStorage.removeItem("dpotopoto.agentUrl")`.
3. If the indicator stays orange, the browser is blocking mixed content.
   Use Option A or C instead.

### Option C — Full React app served from the Dell (recommended for the real booth)

This is how the booth ships: the React app and the agent are served on the
same HTTP origin, so there is no mixed-content block and no internet needed.

1. In the lovable repo (your laptop):
   ```bash
   bun run build
   ```
   Output goes to `dist/`.
2. Copy `dist/*` into `~/agent/web/` on the Dell:
   ```bash
   scp -r dist/* elenajaya@<dell-ip>:~/agent/web/
   ```
3. Restart the agent so the static mount picks it up:
   ```bash
   sudo systemctl restart dpoto-agent.service
   ```
4. Phone → join `dpotopoto-mall-a-l2` → open
   `http://10.42.0.1:8080/app/printer`
5. Indicator should flip green ("Printer ready · HP_M451"). Pick files,
   choose A4/A5, tap **Upload & print**. Paper comes out. The queue strip
   pulses green while printing.

---

## 3. Adjusting prices and limits

Edit `~/agent/config.json` on the Dell:

```json
"prices_idr": { "A4": 15000, "A5": 5000 },
"max_files_per_order": 10,
"max_copies_per_job": 10
```

Then restart: `sudo systemctl restart dpoto-agent.service`.
The `/printer` page picks up the new values on next page load via
`GET /api/config`.

---

## 4. Troubleshooting

| Symptom | Fix |
|---|---|
| Indicator stays orange on phone | Phone not on Dell's Wi-Fi, or wrong IP. Check `ip addr` on Dell, re-open `http://<ip>:8080/health`. |
| `/health` says `printer: offline` | CUPS lost the printer. `sudo systemctl restart cups`, then re-run `hp-setup -i`. |
| Paper does not come out, agent says success | Check CUPS queue: `lpstat -W not-completed`. Cancel stuck jobs: `cancel -a HP_M451`. |
| Mixed-content error in lovable preview | Use Option A or C — Option B only works on localhost. |
| `mode-new` says service failed | `journalctl -u dpoto-agent.service -n 50` to see the Python traceback. |

---

## 5. What is **not** tested here

- Midtrans / Lemon Squeezy payment. The **Pay now** button is disabled
  on purpose. Print works directly via **Upload & print** until payment
  ships (after `/kiosk` is done).
- ICC color tuning. The M451 is a laser, not a photo printer — default
  driver is fine for now.
