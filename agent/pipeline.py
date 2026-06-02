"""Color pipeline: source image → fit-to-paper → JPEG (or LZW TIFF when ICC).

Always resizes to the chosen paper size so prints fill the sheet.
- Source larger than 300 DPI target → downscale to 300 DPI (crisp).
- Source smaller → upscale to 240 DPI (slightly soft, full-page).

Shells out to ImageMagick (`magick`). Falls back to plain copy if magick
is missing (dev only).
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

# Width × height in pixels at 300 DPI (crisp / downscale target).
PAPER_PX_AT_300 = {
    "2R":     (1050, 1500),    # 3.5" × 5"
    "4R":     (1200, 1800),    # 4"   × 6"
    "A4":     (2480, 3508),
    "A5":     (1748, 2480),
    "A6":     (1240, 1748),
    "Square": (1800, 1800),    # 6"   × 6"
}

# Width × height in pixels at 240 DPI (upscale target for small images).
PAPER_PX_AT_240 = {
    "2R":     (840,  1200),
    "4R":     (960,  1440),
    "A4":     (1984, 2806),
    "A5":     (1400, 1984),
    "A6":     (992,  1400),
    "Square": (1440, 1440),
}


def _load_preset(name: str) -> dict[str, Any]:
    p = Path(__file__).parent / "presets" / f"{name}.json"
    if not p.exists():
        p = Path(__file__).parent / "presets" / "default.json"
    return json.loads(p.read_text())


def _source_size(input_path: str) -> tuple[int, int]:
    """Return (w, h) of the source image, or (0, 0) if it can't be read."""
    if shutil.which("magick") is None:
        return (0, 0)
    try:
        r = subprocess.run(
            ["magick", "identify", "-format", "%w %h", input_path],
            capture_output=True, text=True, check=True, timeout=10,
        )
        w, h = r.stdout.strip().split()
        return int(w), int(h)
    except Exception:
        return (0, 0)


def _target_size(paper_size: str, src_w: int, src_h: int) -> tuple[int, int, int]:
    """Pick output (w, h, dpi) based on source dimensions vs the 300-DPI target.

    If the source is smaller than the 300-DPI target on either axis, upscale
    to the 240-DPI target instead (full-page, slightly soft). Otherwise
    downscale to 300 DPI (crisp).
    """
    crisp = PAPER_PX_AT_300.get(paper_size, PAPER_PX_AT_300["A5"])
    soft = PAPER_PX_AT_240.get(paper_size, PAPER_PX_AT_240["A5"])
    if src_w <= 0 or src_h <= 0:
        return (crisp[0], crisp[1], 300)
    if src_w < crisp[0] or src_h < crisp[1]:
        return (soft[0], soft[1], 240)
    return (crisp[0], crisp[1], 300)


def run(*, input_path: str, paper_size: str, preset: str, config: dict[str, Any]) -> str:
    """Process the image and return the path to a print-ready file."""
    out_dir = Path(__file__).parent / "tmp"
    out_dir.mkdir(exist_ok=True)

    src_w, src_h = _source_size(input_path)
    w, h, dpi = _target_size(paper_size, src_w, src_h)
    tone = _load_preset(preset)

    src_icc = Path(__file__).parent / config.get("icc_source", "profiles/sRGB.icc")
    dst_icc = Path(__file__).parent / config.get("icc_printer", "profiles/HP_M451.icc")
    use_icc = src_icc.exists() and dst_icc.exists()

    # JPEG when no color management needed (small file, fast RIP).
    # LZW TIFF when ICC profiles are in play (preserve color fidelity).
    ext = "tif" if use_icc else "jpg"
    out = out_dir / (Path(input_path).stem + f".{ext}")

    cmd = ["magick", input_path]

    if use_icc:
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
        cmd += ["-modulate", f"100,100,{100 + tone['warm_shift']}"]
    if tone.get("unsharp"):
        cmd += ["-unsharp", tone["unsharp"]]

    # Fit-to-paper: scale to cover, then center-crop to exact paper pixels.
    cmd += [
        "-resize", f"{w}x{h}^",
        "-gravity", "center",
        "-extent", f"{w}x{h}",
        "-density", str(dpi),
        "-units", "PixelsPerInch",
    ]

    if use_icc:
        cmd += ["-compress", "lzw"]
    else:
        cmd += ["-quality", str(config.get("jpeg_quality", 92))]

    cmd += [str(out)]

    if shutil.which("magick") is None:
        # Dev fallback: just copy through.
        shutil.copy(input_path, out)
        return str(out)

    subprocess.run(cmd, check=True, capture_output=True)
    return str(out)
