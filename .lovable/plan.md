# dpotopoto.com — Phase 0 + Phases A–G

All assets received. No backend yet (Cloud + Midtrans deferred to Phase H/I).

## Assets in place

```text
src/assets/brand/dpotopoto-{black,white}.png
src/assets/frames/frame-{1x1,2x3,3x2}.jpg
src/assets/patterns/{leave-01,leave-02,love-01,love-02,ball-01,bee-01,graphic-01}.png
```

## Phase 0 — Brand swap (dpotopoto.com)

- New `<BrandLogo variant="auto" | "light" | "dark" />` — picks black PNG on light bg, white PNG on dark bg.
- Replace text mark in `SiteNav` and `SiteFooter` with the logo.
- Update titles/meta across `/`, `/pricing`, `/kiosk`, `/studio` from "d'poto" → "dpotopoto.com".
- Favicon → black PNG.
- Studio trial watermark text → "dpotopoto.com — TRIAL".

## What ships in this build (testable)

1. `/studio` → pick ratio (1:1 / 2:3 / 3:2).
2. Pick layout (1, 2, 3, or 4 photo slots) — each slot **draggable + resizable**, min 350×350 canvas px, 8px edge snap.
3. Upload a JPEG into each slot (click or drag-drop).
4. Pick one of 3 white frames → tint with **Hue + Saturation** sliders (multiply blend).
5. Optional pattern overlay (7 PNG presets), opacity slider, drawn between frame and photos.
6. Logo (drag/resize/opacity) + caption (font, color, size, draggable bg box).
7. Upload custom flat frame → auto-snaps to nearest preset ratio.
8. Export JPEG at web or print @300dpi. Trial watermark toggle.

## Layer order (locked)

```text
background → frame (white JPEG × hue/sat multiply tint)
          → pattern overlay (optional, opacity slider)
          → photos in slots (drawn LAST — always on top)
          → logo → caption → trial watermark band
```

## Phases A–G (one build, in order)

- **A — Flat frame model.** Rewrite `src/lib/frames.ts`: `{ id, name, src, ratio, kind }`. Drop SVG hole concept. Add `RATIOS` constant + ratio picker.
- **B — Frame asset library.** Wire the 3 JPEGs into the manifest.
- **C — Slot layouts.** `src/lib/layouts.ts` with 12 presets: `LAYOUTS[ratio][count]` normalized 0–1. 1 full, 2 side/stacked, 3 row or 1+2, 4 as 2×2.
- **D — Draggable + resizable photo slots.** Reuse `useRectController`. Per-slot file input. `object-fit: cover`. Min 350×350 canvas px. Edge snap 8px. Overlap allowed. "Reset layout" button.
- **E — Frame tint.** Hue (0–360°) + Saturation (0–100%) sliders. `multiply` blend with `hsl(h, s%, 50%)`.
- **F — Pattern overlay.** `src/lib/patterns.ts` manifest. Studio panel "05 · Pattern": grid + "None", opacity slider, tile-repeat toggle (default off → stretched).
- **G — Custom frame upload.** Read dimensions → snap to nearest preset ratio → register as `kind: "custom"`, session-only.

## Files touched

```text
NEW   src/components/site/BrandLogo.tsx
NEW   src/lib/layouts.ts
NEW   src/lib/patterns.ts
NEW   src/components/studio/PhotoSlot.tsx
NEW   src/components/studio/RatioPicker.tsx
NEW   src/components/studio/LayoutPicker.tsx
NEW   src/components/studio/PatternPanel.tsx
EDIT  src/lib/frames.ts             (image-based manifest)
EDIT  src/lib/studio-export.ts      (new layer order, multi-slot)
EDIT  src/routes/studio.tsx         (slots, ratio, layout, pattern panels)
EDIT  src/components/site/SiteNav.tsx + SiteFooter.tsx   (BrandLogo)
EDIT  src/routes/__root.tsx         (title, favicon)
EDIT  src/routes/{index,pricing,kiosk}.tsx (meta updates)
```

## Out of scope

- Phase H — Lovable Cloud + auth (sign-in for paying users, saved frames/logos).
- Phase I — Midtrans (you sign up at midtrans.com, paste sandbox keys when ready; I wire checkout + webhook).
- `/booth` camera capture wiring to slots.

Approve and I'll build the whole thing in one pass and ping you to test.