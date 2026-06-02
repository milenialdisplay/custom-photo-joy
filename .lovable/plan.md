
## Problem

`bash deploy/install.sh` aborted on Ubuntu 24.04 (noble) with:

```
E: Package 'python3-weasyprint' has no installation candidate
```

Because the script uses `set -e`, everything after the failing `apt install` was skipped — no venv, no systemd unit copy, no `mode-new` / `mode-old` / `mode-status` toggles. That's why `mode-new: command not found` and `:8080` has nothing listening.

`weasyprint` is only used by `deploy/provision.sh` to render the booth QR sticker PDF. It's a pure-Python package and installs cleanly via pip — we don't need the apt package.

## Fix

**Edit `agent/deploy/install.sh`:**

1. Remove `python3-weasyprint` from the `apt install` list (line 14). Also add `libpango-1.0-0 libpangoft2-1.0-0` — weasyprint's native runtime deps on noble.
2. Add `weasyprint` to the pip install line (line 29) so it lands in `~/agent/.venv` alongside fastapi/uvicorn/pillow.

That's the entire code change. Everything else in the script is already correct.

## What you'll do on the Dell after I make the change

```bash
cd ~/agent
git pull          # or re-upload the agent/ folder via WinSCP
bash deploy/install.sh
```

This time it should run all the way to `✅ Install complete.` and create `/usr/local/bin/mode-new`. Then:

```bash
mode-new
curl http://localhost:8080/health
```

Expected: JSON response. If it says `"printer":"missing"`, the queue name in `~/agent/config.json` (`HP_M451`) doesn't match what `lpstat -p` shows — fix one or the other and `sudo systemctl restart dpoto-agent.service`.

## Note on `provision.sh`

I won't touch `provision.sh` in this change — it imports `weasyprint` from Python, and once it's in the venv this will still work as long as `provision.sh` invokes Python through `~/agent/.venv/bin/python` (or you run it after activating the venv). If `provision.sh` calls system `python3` directly, that's a separate follow-up fix — let me know if you hit that when you get to the provisioning step.
