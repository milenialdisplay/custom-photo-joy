
## What went wrong this time (and will repeat without these fixes)

You hit three avoidable problems on the Dell. All three are bugs in the repo, not in your steps:

1. **systemd unit had the wrong `WorkingDirectory`.** The unit shipped with `WorkingDirectory=/home/elenajaya/agent`, but the start command is `python -m uvicorn agent.main:app`. That command needs the working directory to be the *parent* of the `agent/` package (i.e. `/home/elenajaya`), otherwise Python's relative imports inside `agent/queue.py` blow up with `ImportError: attempted relative import with no known parent package`. You fixed this live with `sed`; we'll bake the fix into the repo.
2. **`agent/config.json` ships with `printer_name: "HP_M451"`** — a placeholder that won't match any real CUPS queue. Every fresh booth shows `printer: offline` until someone hand-edits it.
3. **`install.sh` doesn't auto-detect the printer queue name**, so even if CUPS already has the printer set up, the agent still reports offline until you run `provision.sh` (or manually edit the config).

## Fixes (small, surgical)

### 1. `agent/deploy/dpoto-agent.service`
Change one line:
```
WorkingDirectory=/home/elenajaya/agent     →     WorkingDirectory=/home/elenajaya
```
That makes `python -m uvicorn agent.main:app` resolve the `agent` package correctly, matching what you fixed by hand.

### 2. `agent/config.json`
Change the placeholder default so it's obviously a placeholder and won't accidentally match nothing in silence:
```
"printer_name": "HP_M451"   →   "printer_name": ""
```
Empty string + a small change in `printer.py::status()` (treat empty as `offline` without calling `lpstat`) keeps behavior safe and the health endpoint still returns cleanly.

### 3. `agent/deploy/install.sh` — add a printer auto-detect step
After the venv + systemd unit install, add a block that:
- Runs `lpstat -p` and picks the first printer queue, if any
- If `config.json` still has an empty or placeholder `printer_name`, writes the discovered name into it
- Prints what it detected (or a clear "no printer yet — run `hp-setup` or `provision.sh`" hint)

This means: on a Dell where you've *already* added the printer in CUPS, `bash deploy/install.sh` alone gets you to `printer: ready`. No editing files.

### 4. `agent/deploy/README.md`
Add a short "What `install.sh` does for you" section listing the three things above, plus a one-liner for the future-you flow:

```
# On a fresh Dell:
cd ~/agent
bash deploy/install.sh                       # installs, auto-detects printer
sudo systemctl enable --now dpoto-agent      # start on boot
curl http://localhost:8080/health            # expect printer: "ready"

# If printer name needs changing later:
~/agent/deploy/set-printer.sh <queue-name>   # new helper, see below
sudo systemctl restart dpoto-agent
```

### 5. New helper: `agent/deploy/set-printer.sh`
A tiny script that takes one argument (the CUPS queue name from `lpstat -p`), writes it into `config.json`, and restarts the service. Saves the `sed` dance next time.

## What I won't touch
- `provision.sh` — it already auto-detects the printer and writes config correctly. The new install-time detection is just a faster path for the common case where you've set the printer up manually in CUPS first.
- `printer.py` business logic — only the `status()` early-return for empty name.
- Any frontend code — the UI already handles `offline` / `ready` correctly via `ConnectIndicator`.

## After you approve

I'll make the edits above, then you can on the Dell:

```bash
cd ~/agent
git pull        # or re-upload via WinSCP
sudo cp deploy/dpoto-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart dpoto-agent
curl http://localhost:8080/health
```

For the *next* Dell, the whole flow is just `bash deploy/install.sh` → set up the printer in CUPS (or run `provision.sh`) → done.
