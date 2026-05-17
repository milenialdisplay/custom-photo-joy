"""Color pipeline: sRGB → printer ICC → tone curve → 300 DPI → TIFF.

Shells out to ImageMagick (`magick`). Falls back to plain copy if ICC
profiles are missing — useful for first-boot smoke tests.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

PAPER_PX_AT_300 = {
    # width x height in pixels at 300 DPI
    "2R":     (1050, 1500),    # 3.5" x 5"
    "4R":     (1200, 1800),    # 4"   x 6"
    "A5":     (1748, 2480),
    "A6":     (1240, 1748),
    "Square": (1800, 1800),    # 6"   x 6"
}


def _load_preset(name: str) -> dict[str, Any]:
    p = Path(__file__).parent / "presets" / f"{name}.json"
    if not p.exists():
        p = Path(__file__).parent / "presets" / "default.json"
    return json.loads(p.read_text())


def run(*, input_path: str, paper_size: str, preset: str, config: dict[str, Any]) -> str:
    """Process the image and return the path to a print-ready TIFF."""
    out_dir = Path(__file__).parent / "tmp"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / (Path(input_path).stem + ".tif")

    px = PAPER_PX_AT_300.get(paper_size, (1200, 1800))
    tone = _load_preset(preset)

    cmd = ["magick", input_path]

    # ICC color management (only if profiles present)
    src_icc = Path(__file__).parent / config.get("icc_source", "profiles/sRGB.icc")
    dst_icc = Path(__file__).parent / config.get("icc_printer", "profiles/HP_M451.icc")
    if src_icc.exists() and dst_icc.exists():
        cmd += ["-profile", str(src_icc), "-profile", str(dst_icc)]

    # Tone curve
    if "gamma" in tone:
        cmd += ["-gamma", str(tone["gamma"])]
    if "shadow_lift" in tone or "highlight_roll" in tone:
        low = tone.get("shadow_lift", 0)
        high = 100 - tone.get("highlight_roll", 0)
        cmd += ["-level", f"{low}%,{high}%"]
    if tone.get("sat_boost"):
        cmd += ["-modulate", f"100,{100 + tone['sat_boost']},100"]
    if tone.get("warm_shift"):
        # crude warm shift: nudge hue slightly
        cmd += ["-modulate", f"100,100,{100 + tone['warm_shift']}"]
    if tone.get("unsharp"):
        cmd += ["-unsharp", tone["unsharp"]]

    # Resize to paper, set DPI
    cmd += [
        "-resize", f"{px[0]}x{px[1]}^",
        "-gravity", "center",
        "-extent", f"{px[0]}x{px[1]}",
        "-density", "300",
        "-units", "PixelsPerInch",
        str(out),
    ]

    if shutil.which("magick") is None:
        # Dev fallback: just copy through.
        shutil.copy(input_path, out)
        return str(out)

    subprocess.run(cmd, check=True, capture_output=True)
    return str(out)
