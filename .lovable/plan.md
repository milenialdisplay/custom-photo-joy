## What the error tells us

The Dell's `~/agent/printer.py` has `from __future__ import annotations` at **line 63**. That import is only legal at the very top of a file. This means the file got **appended to**, not replaced — there's an older copy of `printer.py` sitting above the new one (probably ~62 lines of old content, then the new file pasted underneath).

The repo's `printer.py` is clean and only ~62 lines total, so the fix is to overwrite the Dell's file completely, not edit it.

## Plan

1. **Overwrite `~/agent/printer.py` on the Dell** with a single clean copy (the version in the repo, which already includes the `"A4": "A4"` mapping). Use `cat > ~/agent/printer.py << 'PYEOF' … PYEOF` so the whole file is replaced atomically — no risk of appending again.

2. **Verify the file is exactly one copy**, not two stacked:
   ```bash
   wc -l ~/agent/printer.py          # expect ~62
   grep -c "from __future__" ~/agent/printer.py   # expect 1
   ```

3. **Re-run the import smoke test from `~`** (parent of the `agent/` package):
   ```bash
   cd ~ && python3 -c "from agent import pipeline, printer, main; print('imports OK')"
   ```

4. **Restart and verify health**:
   ```bash
   sudo systemctl restart dpoto-agent
   sleep 2
   curl http://localhost:8080/health
   ```

5. **If health still fails**, read the fresh traceback:
   ```bash
   sudo journalctl -u dpoto-agent -n 40 --no-pager
   ```
   and apply the same "fully overwrite, don't append" fix to whichever file is named in the new traceback (most likely `pipeline.py` has the same problem).

## Why this keeps happening

When `nano` opens an existing file and you paste a heredoc-style block, the paste is **inserted** at the cursor — it doesn't replace the file. So every "fix" so far has stacked a new copy on top of the old one. The `cat > file << 'PYEOF'` approach replaces the whole file in one shot and avoids nano entirely, which is why I'll use that in step 1.

## Expected result

- `printer.py` is exactly one clean copy (~62 lines, one `from __future__` line at the top).
- Import smoke test prints `imports OK`.
- `dpoto-agent` starts.
- `curl http://localhost:8080/health` returns the JSON status.