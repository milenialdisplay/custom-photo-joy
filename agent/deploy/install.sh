#!/usr/bin/env bash
# Run this ONCE on the Dell after copying the agent/ folder to ~/agent.
#   cd ~/agent && bash deploy/install.sh
set -e

echo "==> System packages"
sudo apt update
sudo apt install -y \
  cups hplip hplip-gui imagemagick \
  python3-pip python3-venv \
  xrdp timeshift \
  network-manager dnsmasq-base \
  avahi-utils nmap \
  qrencode python3-weasyprint

echo "==> CUPS + printing group"
sudo systemctl enable --now cups
sudo usermod -aG lpadmin "$USER"

echo "==> xrdp (remote desktop from Windows)"
sudo systemctl enable --now xrdp
sudo ufw allow 3389/tcp 2>/dev/null || true
sudo ufw allow 8080/tcp 2>/dev/null || true

echo "==> Python venv for the agent"
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install fastapi uvicorn python-multipart pillow

echo "==> systemd unit (installed, NOT enabled — toggle controls that)"
sudo cp deploy/dpoto-agent.service /etc/systemd/system/dpoto-agent.service
sudo systemctl daemon-reload

echo "==> mode toggle scripts"
sudo install -m 0755 deploy/mode-new    /usr/local/bin/mode-new
sudo install -m 0755 deploy/mode-old    /usr/local/bin/mode-old
sudo install -m 0755 deploy/mode-status /usr/local/bin/mode-status
echo "old" | sudo tee /etc/dpoto-mode >/dev/null

cat <<EOF

✅ Install complete.

Next: provision this booth with a unique location ID.
  sudo bash deploy/provision.sh <location-id>      # e.g. mall-a-l2

The provisioning script will:
  • turn this Dell into a Wi-Fi access point
  • auto-discover the attached printer and install drivers
  • generate a printable QR sticker for the booth

Optional, before provisioning:
  sudo timeshift --create --comments "pre-printer-agent" --tags D
EOF
