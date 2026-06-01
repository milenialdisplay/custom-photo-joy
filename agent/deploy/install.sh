#!/usr/bin/env bash
# Run this ONCE on the Dell after copying the agent/ folder to ~/agent.
#   cd ~/agent && bash deploy/install.sh
set -e

echo "==> System packages"
sudo apt update
sudo apt install -y cups hplip imagemagick python3-pip python3-venv xrdp timeshift

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

Next steps (in order):
  1. sudo timeshift --create --comments "pre-printer-agent" --tags D
  2. sudo hp-setup -i <PRINTER_IP>          # configure the HP M451
  3. echo "hello" | lp                       # test print
  4. Edit /usr/local/bin/mode-new and mode-old:
        OLD_UNIT / OLD_AUTOSTART  →  the auto-starting app you want to toggle off
  5. mode-new        # switch to print-agent mode
     mode-old        # switch back to original setup
     mode-status     # see which mode is active
EOF
