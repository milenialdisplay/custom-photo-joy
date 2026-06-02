## Plan

1. Replace the Dell’s `~/agent/pipeline.py` with the current fit-to-paper version.
   - Your `head -1` output proves that file is still the older one (`"""Color pipeline: sRGB → printer ICC → tone curve → 300 DPI → TIFF.`), not the new auto-fit version.
   - Because `agent.main` imports `queue`, and `queue` imports `pipeline`, any syntax/runtime issue there kills the service before port `8080` opens.

2. Validate the three critical files on the Dell before restarting.
   - Confirm `config.json` parses.
   - Confirm Python can import `agent.pipeline`, `agent.printer`, and `agent.main` cleanly.
   - This catches paste mistakes immediately instead of debugging through `systemctl`.

3. Restart the service and verify health.
   - Restart `dpoto-agent`.
   - Check `curl http://localhost:8080/health`.
   - If it still fails, read the latest `journalctl` traceback and fix the exact line reported.

4. Complete the A4 print path after startup is back.
   - Add the missing A4 CUPS media mapping in `printer.py` so A4 jobs don’t silently fall back to another size.
   - Keep `fit-to-page` removed so the already-sized output is not rescaled again.

5. Confirm the intended sizing behavior with a real print.
   - Small image: upscale to A4 at 240 DPI, full page, slightly soft.
   - Large image: resize to A4 at 300 DPI, full page, sharper.

## Technical details

- Current startup dependency chain:
```text
systemd -> uvicorn -> agent.main -> agent.queue -> agent.pipeline
```
- The smoking gun is the mismatched first line:
  - `printer.py` is already the corrected file.
  - `pipeline.py` on the Dell is still the old/stale file.
- `config.json` already looks structurally fine from your output.
- There is also one functional gap to finish after recovery: `printer.py` currently maps `2R`, `4R`, `A5`, `A6`, `Square`, but not `A4`.

## Expected result

- `dpoto-agent` starts normally.
- `curl http://localhost:8080/health` responds again.
- A4 prints fill the page automatically: smaller sources upscale, larger sources downscale.