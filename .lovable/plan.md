## Goal
Replace the dark "DPOTOPOTO.COM — TRIAL" band at the bottom of LIVE_PREVIEW with the same `BrandLogo` wordmark used in the top-left of the page (Fredoka font), wrapped in a tight black pill so it stays readable over white/light frames.

## Changes

### `src/routes/frame.tsx` (preview stage, lines ~391–400)
- Delete the `{trial && (...)}` watermark band entirely.
- Replace the existing bottom-left `BrandLogo` block with a single branding mark:
  - Position: same bottom-left corner (`absolute bottom-[5%] left-[4%] z-10 pointer-events-none`).
  - Wrap `<BrandLogo variant="dark" className="text-[10px] md:text-xs" />` in a `<span>` with `bg-black/90 px-2 py-1 rounded-sm inline-flex items-center` so the black box hugs the text (padding only slightly larger than the glyphs).
  - `variant="dark"` keeps the text white on the black pill.
- Smaller size than the page header logo (header uses `text-xl`+); preview uses ~`text-[10px] md:text-xs` so it reads as a branding mark, not a title.

### `src/lib/studio-export.ts` (export canvas parity)
- Remove the trial watermark band branch (`if (state.trial) { ... }`) so exports match the preview.
- Keep the existing brand mark draw, but draw a black rounded rectangle behind it sized to the brand image dimensions plus ~6% horizontal / ~30% vertical padding, then draw the brand image on top at full opacity. Use a smaller `brandWidth` (≈12% of canvas width instead of 20%) to match the smaller on-screen size.
- Leave `state.trial` in the type for now (no behavioral effect) to avoid touching all call sites; mark it as deprecated in a comment.

## Out of scope
- No changes to the top-left header logo.
- No changes to the `trial` toggle UI in the export panel — it simply becomes a no-op visual; can be removed in a follow-up if desired.
- No changes to event/composite renderer (`event-render.ts`).
