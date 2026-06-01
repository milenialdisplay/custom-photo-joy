#!/usr/bin/env bash
# Provision THIS Dell as a self-contained dpotopoto print booth.
#
# Usage:   sudo bash deploy/provision.sh <location-id> [--label "Mall A, Level 2"]
# Example: sudo bash deploy/provision.sh mall-a-l2 --label "Mall A · Level 2"
#
# Idempotent: re-running with the same location-id rotates the Wi-Fi password
# and regenerates the sticker PDF, but keeps the printer config intact.
set -e

if [[ $EUID -ne 0 ]]; then
  echo "Re-running with sudo..."
  exec sudo bash "$0" "$@"
fi

LOC="${1:-}"
LABEL=""
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --label) LABEL="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ -z "$LOC" || ! "$LOC" =~ ^[a-z0-9-]+$ ]]; then
  echo "ERROR: location-id required, lowercase letters/digits/dashes only."
  echo "Usage: sudo bash deploy/provision.sh <location-id> [--label \"...\"]"
  exit 1
fi
LABEL="${LABEL:-$LOC}"

SSID="dpotopoto-${LOC}"
PSK="$(tr -dc 'A-HJ-NP-Z2-9' </dev/urandom | head -c 10)"  # 10 chars, no ambiguous
GATEWAY="10.42.0.1"
AGENT_PORT="8080"
AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${AGENT_DIR}/booth-stickers"
mkdir -p "$OUT_DIR"

echo "==> Booth ID:   $LOC"
echo "==> SSID:       $SSID"
echo "==> PSK:        $PSK"
echo "==> Gateway IP: $GATEWAY"

# ── 1. Wi-Fi access point via NetworkManager ───────────────────────────────
echo "==> Configuring Wi-Fi AP via NetworkManager"
WIFI_DEV="$(nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="wifi"{print $1; exit}')"
if [[ -z "$WIFI_DEV" ]]; then
  echo "WARN: no Wi-Fi adapter found. Skipping AP setup."
else
  nmcli connection delete "dpoto-booth" 2>/dev/null || true
  nmcli connection add type wifi ifname "$WIFI_DEV" con-name "dpoto-booth" \
        autoconnect yes ssid "$SSID"
  nmcli connection modify "dpoto-booth" \
        802-11-wireless.mode ap \
        802-11-wireless.band bg \
        ipv4.method shared ipv4.addresses "${GATEWAY}/24" \
        wifi-sec.key-mgmt wpa-psk \
        wifi-sec.psk "$PSK"
  nmcli connection up "dpoto-booth" || echo "WARN: could not bring up AP now; will retry on next boot."
fi

# ── 2. Printer discovery + driver install ──────────────────────────────────
echo "==> Discovering printer on LAN/USB"
PRINTER_NAME=""
if lpstat -p 2>/dev/null | grep -q "^printer"; then
  PRINTER_NAME="$(lpstat -p | awk '/^printer/{print $2; exit}')"
  echo "    Found existing CUPS printer: $PRINTER_NAME"
else
  echo "    Running hp-setup -i (interactive)..."
  hp-setup -i || echo "WARN: hp-setup returned non-zero; check CUPS manually."
  PRINTER_NAME="$(lpstat -p 2>/dev/null | awk '/^printer/{print $2; exit}')"
fi
PRINTER_NAME="${PRINTER_NAME:-HP_M451}"
echo "==> Printer: $PRINTER_NAME"

# ── 3. Write agent/config.json ─────────────────────────────────────────────
echo "==> Writing config.json"
python3 - "$AGENT_DIR/config.json" "$LOC" "$LABEL" "$SSID" "$PRINTER_NAME" <<'PY'
import json, sys
path, loc, label, ssid, pname = sys.argv[1:6]
cfg = json.loads(open(path).read())
cfg.update({
    "location_id": loc,
    "location_label": label,
    "ssid": ssid,
    "printer_name": pname,
})
open(path, "w").write(json.dumps(cfg, indent=2) + "\n")
PY

# ── 4. Enable + start agent ────────────────────────────────────────────────
echo "==> Enabling dpoto-agent.service"
systemctl daemon-reload
systemctl enable --now dpoto-agent.service || \
  echo "WARN: service not started; run 'systemctl status dpoto-agent' to debug."

# ── 5. Generate the QR sticker PDF ─────────────────────────────────────────
echo "==> Generating sticker PDF"
WIFI_QR="WIFI:T:WPA;S:${SSID};P:${PSK};;"
APP_URL="http://${GATEWAY}:${AGENT_PORT}/booth?loc=${LOC}"

WIFI_PNG="${OUT_DIR}/wifi-${LOC}.png"
APP_PNG="${OUT_DIR}/app-${LOC}.png"
qrencode -s 10 -m 2 -o "$WIFI_PNG" "$WIFI_QR"
qrencode -s 10 -m 2 -o "$APP_PNG"  "$APP_URL"

PDF_PATH="${OUT_DIR}/booth-${LOC}.pdf"
python3 - "$PDF_PATH" "$LABEL" "$LOC" "$SSID" "$PSK" "$APP_URL" \
         "$WIFI_PNG" "$APP_PNG" <<'PY'
import sys, base64, pathlib
out, label, loc, ssid, psk, app_url, wifi_png, app_png = sys.argv[1:9]
def b64(p): return base64.b64encode(pathlib.Path(p).read_bytes()).decode()
html = f"""<!doctype html><html><head><meta charset='utf-8'>
<style>
  @page {{ size: A5; margin: 12mm; }}
  body {{ font-family: -apple-system, sans-serif; color:#0a0a0f; margin:0; }}
  .brand {{ font-size: 11pt; letter-spacing:.3em; text-transform:uppercase;
           color:#1b8c5f; font-weight:700; }}
  h1 {{ font-size: 26pt; margin: 4pt 0 2pt; letter-spacing:-.02em; }}
  .loc {{ font-size: 11pt; color:#555; margin-bottom: 14pt; font-family: ui-monospace,monospace; }}
  .row {{ display:flex; gap: 8mm; margin-top: 6mm; }}
  .card {{ flex:1; border:1.5pt solid #0a0a0f; padding: 6mm; text-align:center; }}
  .card h2 {{ font-size: 10pt; letter-spacing:.25em; text-transform:uppercase;
             margin: 0 0 4mm; color:#0a0a0f; }}
  .card img {{ width: 60mm; height: 60mm; }}
  .card .hint {{ font-size: 9pt; color:#555; margin-top: 3mm; }}
  .creds {{ font-family: ui-monospace,monospace; font-size: 10pt;
            border-top: 1pt dashed #999; padding-top: 4mm; margin-top: 8mm; }}
  .creds b {{ display: inline-block; min-width: 18mm; color:#999; font-weight:400; }}
</style></head><body>
<div class="brand">// dpotopoto · booth</div>
<h1>{label}</h1>
<div class="loc">id: {loc}</div>
<div class="row">
  <div class="card">
    <h2>① Join Wi-Fi</h2>
    <img src="data:image/png;base64,{b64(wifi_png)}"/>
    <div class="hint">Camera → tap notification</div>
  </div>
  <div class="card">
    <h2>② Open & Print</h2>
    <img src="data:image/png;base64,{b64(app_png)}"/>
    <div class="hint">Then upload your photo</div>
  </div>
</div>
<div class="creds">
  <div><b>Wi-Fi</b> {ssid}</div>
  <div><b>Pass</b> {psk}</div>
  <div><b>URL</b> {app_url}</div>
</div>
</body></html>"""
try:
    from weasyprint import HTML
    HTML(string=html).write_pdf(out)
    print(f"PDF written: {out}")
except ImportError:
    pathlib.Path(out.replace(".pdf", ".html")).write_text(html)
    print(f"weasyprint missing — wrote HTML instead: {out.replace('.pdf','.html')}")
PY

cat <<EOF

══════════════════════════════════════════════════
 ✅ Booth provisioned: $LOC
══════════════════════════════════════════════════
   SSID    : $SSID
   PSK     : $PSK
   Gateway : $GATEWAY
   App URL : $APP_URL

 ▸ Sticker PDF:  $PDF_PATH

 Next:
   1. Print the sticker (A5), laminate, stick on the booth.
   2. Test on your phone: join "$SSID" → scan the App QR.
   3. Optional admin checks: open the same URL on your laptop
      and use the /printer/setup wizard.
══════════════════════════════════════════════════
EOF
