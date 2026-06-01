# Dell deployment

Copy this whole `agent/` folder to `~/agent` on the Dell (via WinSCP), then SSH in and run:

```
cd ~/agent
bash deploy/install.sh
```

That installs: CUPS, hplip, ImageMagick, xrdp (remote desktop), Timeshift (snapshots),
the agent's Python venv, the systemd unit, and the `mode-old` / `mode-new` / `mode-status` toggle.

## Files

| File | Purpose |
|---|---|
| `install.sh` | One-shot installer. Idempotent — safe to re-run. |
| `dpoto-agent.service` | systemd unit. Installed disabled — the toggle enables it. |
| `mode-new` | Stop the old auto-start app, start the print agent on boot. |
| `mode-old` | Stop the print agent, restore the old auto-start app on boot. |
| `mode-status` | Show which mode is active and printer status. |

## Wiring the toggle to your "old" app

After `install.sh`, edit `/usr/local/bin/mode-new` and `/usr/local/bin/mode-old`
and set the two variables at the top to match what `systemctl list-unit-files --state=enabled`
and `ls ~/.config/autostart/` showed in Step 1:

```bash
OLD_UNIT="kiosk-browser.service"                           # or "" if none
OLD_AUTOSTART="/home/elenajaya/.config/autostart/kiosk.desktop"   # or ""
```

Both files must use identical values.

## Daily use

```
mode-new       # → http://<dell-ip>:8080/console
mode-old       # reboot afterwards to confirm
mode-status
```

## Rollback (nuclear option)

```
sudo timeshift --list
sudo timeshift --restore --snapshot 'YYYY-MM-DD_HH-MM-SS'
```
