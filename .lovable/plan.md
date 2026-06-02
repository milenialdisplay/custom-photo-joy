# Always fit prints to paper size (A4 / A5)

**Goal:** Any uploaded image — tiny or huge — prints filling the chosen paper. Small images upscale (accepting some blur), large images downscale to a sane DPI.

## Behavior

For each job, compute the target pixel size from `paper_size`:

| Paper | 240 DPI (upscale target) | 300 DPI (downscale target) |
|-------|--------------------------|----------------------------|
| A4    | 1984 × 2806              | 2480 × 3508                |
| A5    | 1400 × 1984              | 1748 × 2480                |
| A6    | 992  × 1400              | 1240 × 1748                |

Rule:
- If the source image is **smaller** than the 300 DPI target on **either** axis → resize **up** to the 240 DPI target (blurry but full-page, as you asked).
- If the source image is **larger or equal** → resize **down** to the 300 DPI target (crisp).
- Preserve aspect ratio; fill the sheet with **center-crop** (`-resize ^ -gravity center -extent`). This is what you already do in the slow path — extend that to the fast path too.
- Output as JPEG q=92 (small file → fast RIP → ~10s start time you already saw).

## Changes

### 1. `agent/pipeline.py`
- Add an `A4` entry to `PAPER_PX_AT_300` (currently missing — that's why A4 jobs may also have been falling back to default).
- Add a parallel `PAPER_PX_AT_240` table for the upscale target.
- New helper `target_size(paper_size, source_w, source_h)` that picks the 240 or 300 table based on the comparison above and returns `(w, h, dpi)`.
- **Remove the "skip ImageMagick entirely" fast path.** Always run ImageMagick, but with a minimal command when no tone preset / ICC is in play: just `magick input -resize WxH^ -gravity center -extent WxH -density DPI -quality 92 output.jpg`. This is ~1–2s on the Dell and produces a small JPEG — still well under 10s end-to-end.
- Keep the LZW TIFF branch only when ICC profiles are installed.

### 2. `agent/printer.py`
- Drop `-o fit-to-page` from the `lp` call. The file we send is now already the exact paper size, so `fit-to-page` would only re-scale and soften it. Keep `-o media=...`.

### 3. `agent/config.json`
- Add `"upscale_dpi": 240` and `"print_dpi": 300` so the thresholds are tunable per booth without code edits.

### 4. `agent/deploy/README.md`
- Short note: "All prints are auto-fit to the chosen paper. Small images are upscaled to 240 DPI (slightly soft); large images are downscaled to 300 DPI (crisp)."

## Out of scope
- No frontend changes.
- No change to ICC / tone-preset behavior — only the resize/output stage.
- No new paper sizes; just adding A4 to the existing table.

## Expected result
- 370 KB small photo → printed full A4 (slightly blurry, as requested), still <10s to first paper.
- 3.7 MB large photo → printed full A4 crisp, ~10–15s to first paper.
- A5 jobs behave the same way at A5 dimensions.
