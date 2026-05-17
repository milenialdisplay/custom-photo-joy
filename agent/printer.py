"""Thin CUPS wrapper around `lp` and `lpstat`."""
from __future__ import annotations

import shutil
import subprocess
import time
from typing import Literal


def status(printer_name: str) -> Literal["ready", "error", "offline"]:
    if shutil.which("lpstat") is None:
        return "offline"
    try:
        r = subprocess.run(
            ["lpstat", "-p", printer_name], capture_output=True, text=True, timeout=3
        )
        out = (r.stdout + r.stderr).lower()
        if "not exist" in out or r.returncode != 0:
            return "offline"
        if "disabled" in out or "rejecting" in out:
            return "error"
        return "ready"
    except Exception:
        return "offline"


def print_file(
    path: str,
    *,
    printer_name: str,
    paper_size: str,
    copies: int,
    timeout_s: int = 60,
) -> str:
    """Submit to CUPS and wait for the CUPS job to drop off the queue."""
    media = {
        "2R": "Custom.3.5x5in",
        "4R": "Custom.4x6in",
        "A5": "A5",
        "A6": "A6",
        "Square": "Custom.6x6in",
    }.get(paper_size, "A6")

    if shutil.which("lp") is None:
        # Dev fallback — pretend success after a tiny delay.
        time.sleep(0.5)
        return "dev-no-cups"

    r = subprocess.run(
        ["lp", "-d", printer_name, "-n", str(copies), "-o", f"media={media}", path],
        capture_output=True, text=True, check=True, timeout=10,
    )
    # lp prints "request id is HP_M451-123 (1 file(s))"
    request_id = r.stdout.strip().split(" ")[3] if "request id" in r.stdout else ""

    # Poll lpstat until our job disappears or we time out
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        q = subprocess.run(["lpstat", "-W", "not-completed"], capture_output=True, text=True)
        if request_id and request_id not in q.stdout:
            return request_id
        time.sleep(1)
    raise TimeoutError(f"print job {request_id} did not complete within {timeout_s}s")
