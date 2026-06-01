# Plan: Dell Wyse — preserve old setup, add new print agent, toggle between them

You'll end up with:
- A **full snapshot** of the Dell as it is today, so you can roll back anytime.
- **Remote desktop** from your Windows PC (clipboard copy-paste works).
- The **HP M451** printer wired up to CUPS.
- The **print agent** installed but NOT auto-starting — controlled by a simple toggle.
- Two commands: `mode-old` and `mode-new` to switch between the original auto-starting app and the new print-agent setup.

Nothing destructive. The old software stays installed and intact the entire time.

---

## Step 1 — Find out what "old" actually is

Before we touch anything, we inventory what auto-starts today so the toggle knows what to turn on/off.

Commands you'll run over SSH (I'll guide live):
- `systemctl list-unit-files --state=enabled` — system services that boot
- `ls ~/.config/autostart/ 2>/dev/null` — desktop apps that auto-launch
- `cat /etc/xdg/autostart/*.desktop | grep -E 'Name|Exec'` — system-wide desktop autostart
- `crontab -l` and `sudo crontab -l` — scheduled jobs

Output tells us exactly which unit(s) to flip in the toggle.

## Step 2 — Take a full system snapshot (Timeshift)

Insurance policy. One-time setup, then a snapshot named `pre-printer-agent`.

```
sudo apt install -y timeshift
sudo timeshift --create --comments "pre-printer-agent" --tags D
sudo timeshift --list
```

If anything later goes wrong: `sudo timeshift --restore` rolls the whole OS back to today. Old software returns exactly as it was.

## Step 3 — Install xrdp (remote desktop from your PC)

```
sudo apt install -y xrdp
sudo systemctl enable --now xrdp
sudo ufw allow 3389/tcp   # only if a firewall is active
```

Then on Windows: **Start → "Remote Desktop Connection" → 192.168.18.41 → log in as `elenajaya`**. Clipboard copy-paste works both directions out of the box.

WinSCP stays for bulk file transfer. xrdp is for actually using the Dell.

## Step 4 — Set up the HP M451n printer

```
sudo apt install -y cups hplip
sudo systemctl enable --now cups
sudo usermod -aG lpadmin elenajaya
sudo hp-setup -i <PRINTER_IP>   # you'll supply the IP
lpstat -p -d                    # confirm it shows up
echo "hello dpotopoto" | lp     # test print
```

If the printer name CUPS assigns isn't `HP_M451`, we'll edit `agent/config.json` to match.

## Step 5 — Deploy the print agent (installed, NOT auto-starting yet)

Copy the `agent/` folder from this repo to `~/agent` on the Dell via WinSCP. Then:

```
sudo apt install -y imagemagick python3-pip python3-venv
cd ~/agent
python3 -m venv .venv
.venv/bin/pip install fastapi uvicorn python-multipart pillow
```

Create a systemd unit `/etc/systemd/system/dpoto-agent.service` that runs uvicorn on port 8080 — but **do not enable it yet**. The toggle controls that.

## Step 6 — The toggle (this is the main feature you asked for)

Two scripts in `/usr/local/bin/`:

**`mode-old`** — restore original boot behavior:
- `sudo systemctl disable --now dpoto-agent`
- re-enable whatever auto-starting service/app we found in Step 1
- prints "✅ OLD MODE active — reboot to confirm"

**`mode-new`** — print-agent mode:
- `sudo systemctl disable --now <old-app>` (stops the original app from grabbing the screen/resources)
- `sudo systemctl enable --now dpoto-agent`
- prints "✅ NEW MODE active — agent at http://192.168.18.41:8080"

`mode-status` — shows which mode is currently active.

After step 6, switching is literally: SSH in, type `mode-old` or `mode-new`, reboot if needed. No reinstalls, no data loss, both setups coexist permanently.

## Step 7 — Verify

- Run `mode-new` → from your phone visit `http://192.168.18.41:8080/console` → submit the bundled test chart → paper comes out.
- Run `mode-old` → reboot → confirm the original app starts as before.
- Run `mode-new` again → back to print-agent mode.

---

## Technical notes (for reference)

- Timeshift uses rsync snapshots; doesn't need a separate partition on ext4.
- xrdp on Ubuntu 22.04+ works with the default GNOME session; if you hit a black screen we'll switch the session to Xorg in `/etc/xrdp/startwm.sh`.
- The agent service runs as user `elenajaya` so CUPS permissions and `~/agent` paths just work.
- If the "old" auto-starting app is a graphical kiosk (e.g. Chromium in kiosk mode), it lives in `~/.config/autostart/` and the toggle just renames the `.desktop` file with a `.disabled` suffix instead of touching systemd.
- All changes are reversible: uninstalling is `apt remove xrdp dpoto-agent`, deleting `~/agent`, and `timeshift --restore` if you want to nuke everything.

## What I need from you to proceed

1. Approve this plan (click Implement).
2. Be at the SSH prompt — Step 1's inventory commands need to run on the Dell so the toggle is wired to the right service.
3. Have the HP M451's IP address ready for Step 4.
