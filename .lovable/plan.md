## Goal
1. Move the bottom-left `dpotopoto.com` brand pill to sit ~5–7px from the left and bottom edges (both LIVE_PREVIEW and exported JPEG).
2. Add a short info note explaining that uploading a custom frame snaps the canvas to the frame's own ratio (square / portrait / landscape), overriding the ratio chosen earlier.

## Answer to the user's question
Yes — the custom frame is already drawn to fill the whole canvas (no per-frame drag handles in either the preview or `studio-export.ts`). On upload, `onPickCustomFrame` snaps `ratio` to the uploaded image's aspect (`snapToRatio`) and the frame image stretches to the full preview/export. So no drag tool is needed for the custom frame — the ratio change you're seeing is intentional, and the new hint below will make that clear.

## Changes

### `src/routes/frame.tsx`
- Brand pill position (bottom-left of LIVE_PREVIEW): replace the current percentage offsets (`bottom-[5%] left-[4%]`) with fixed pixel offsets `bottom-[6px] left-[6px]` so it hugs the edge regardless of canvas size.
- Add a one-line hint in the **02 FRAME** panel, just under the "+ upload" custom-frame control:
  - Copy: `"Custom frame sets the ratio — your canvas will match the uploaded frame's shape."`
  - Style: same muted mono caption style used elsewhere in that panel (`font-mono text-[10px] text-primary/60`).

### `src/lib/studio-export.ts`
- Brand pill draw (currently `boxX = width * 0.04`, `boxY = height - … - height * 0.04`): change to a fixed pixel inset. Use `EDGE_PX = 6` so `boxX = EDGE_PX` and `boxY = height - boxH - EDGE_PX`. Keeps parity with the on-screen 6px inset across both A4/A5 export sizes.
- No changes to pill sizing, padding, font, or color.

## Out of scope
- No changes to ratio-snap logic, frame upload flow, or export pipeline beyond pill positioning.
- No drag handles for custom frames (intentionally not added — frame already fills the page).
- No changes to the top-left header logo.
