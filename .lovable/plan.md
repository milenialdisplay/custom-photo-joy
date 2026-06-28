## Goals

1. Pull caption sliders right up under LIVE_PREVIEW on mobile by reordering and shrinking the 05 Caption controls.
2. Bigger font size range (10–350 px instead of 1–15 %).
3. Independent drag for the caption background box (does not affect text size or position).
4. Support up to 3 captions, each with its own text, font, color, size, rect, background color, background opacity, and background rect. New captions stack on top of older ones.
5. Add the Preview toggle next to QUICK_CONTROLS that hides all edit affordances (dashed borders, drag handles, slot upload chrome) for a clean composition.
6. Cosmetic cleanups in 05 Caption (remove the "drag box + drag corner on preview" hint, move the Fill slider next to the bg color swatch, etc.).

## UI Changes — `src/routes/frame.tsx`

### Preview toggle
- New `previewMode` state.
- In the QUICK_CONTROLS header row (currently just a label), render a small square button on the right:
  - Label: `preview` (or eye icon glyph).
  - Inactive: same outline style as the panel buttons.
  - Active: darker fill (`bg-primary/25 text-primary`), persistent until clicked again.
- When `previewMode === true`:
  - `PhotoSlot` hides its dashed border, edge/corner handles, slot number badge, and the upload/camera UI when empty (renders just the photo or empty white area).
  - `DraggableBox` (used for logo and each caption + each caption-bg) hides its dashed border, "drag"/"resize" pills, and corner handle.
  - The "drag slots · corner = resize · click slot to upload" hint above the footer is hidden.
- Pass `previewMode` into `PhotoSlot` and `DraggableBox` as a prop.

### 05 Caption panel — restructure

Replace the single-caption state with an array `captions: Caption[]` (max length 3). Each entry:

```ts
type Caption = {
  id: string;
  text: string;
  font: string;       // default "Space Grotesk"
  color: string;      // default "#F0F0FF"
  sizePx: number;     // 10..350, default 45
  rect: Rect;         // text rect
  bgColor: string;    // default "#0A0A0F"
  bgOpacity: number;  // 0..1, default 0.6
  bgRect: Rect;       // SEPARATE from text rect
};
```

Migrate existing single-caption state into `captions[0]` on init; remove the old standalone caption fields.

Panel header row:
- Title `05 · Caption` on the left.
- `+ add caption` button on the right, disabled when `captions.length >= 3`.
- New captions are inserted at index 0 (top of list in UI). Their default `rect.y` and `bgRect.y` are placed above any existing caption rects (e.g. previous top minus its height minus 0.02, clamped to ≥ 0) so they don't immediately overlap.

For each caption, render a compact sub-card (collapsed sections share the same font / color / size / bg controls). Layout per caption, top-to-bottom:

1. **Size slider** — first, so it sits closest to LIVE_PREVIEW on mobile. Range `10`–`350`, step `1`, value displayed as `Size NNNpx`.
2. **Caption background row** — second row: bg color swatch on the left, Fill slider to its right (no separate "caption_background" label needed, just `bg`).
3. **Text + color + small remove** — row with: text input (flex-1), small square color picker (~28×28) to its right (font color for the text), and a tiny `×` to delete this caption (hidden if only 1 caption left).
4. **Font + (placeholder for spacing)** — font select shrunk to ~60% width on its own row. The Size slider already lives at the top, so nothing else needed here.
5. Remove the standalone "drag box + drag corner on preview" hint.

Notes:
- The Size slider stores `sizePx`. The on-screen preview computes font-size as `sizePx * (stageWidth / exportWidth)` so a 350 px caption at 300 DPI A4 looks correctly scaled in the preview. Simplest implementation: render with `fontSize: \`calc(${sizePx} * 100cqw / ${preset.w})\`` inside the existing `containerType: inline-size` wrapper, which already scales by the slot's container width — switch to using the stage as the container reference by giving the **stage** `containerType: inline-size` and dropping it from `DraggableBox`. Export math becomes `fontPx = sizePx` (no relative multiplier).
- For backward compatibility the old `captionSize` field is removed from `ExportState`.

### LIVE_PREVIEW rendering

For each caption render:
- A `DraggableBox` bound to `bgRect` with the background fill (color + opacity) inside it. No text.
- A separate `DraggableBox` bound to `rect` with the text inside it.

Both boxes drag and resize independently. Text size depends only on `sizePx`, never on box dimensions.

When `previewMode` is on, both boxes drop their dashed borders/handles and just render fill/text.

### Above-footer hint and Reset row

Hide the entire "drag slots · corner = resize · click slot to upload" + Reset_Layout row when `previewMode` is on (keep Reset reachable elsewhere — leave it visible on desktop sidebar if needed, otherwise simply hide both during preview).

## Export Changes — `src/lib/studio-export.ts`

- `ExportState`:
  - Remove `caption`, `captionFont`, `captionSize`, `captionColor`, `captionRect`, `captionBg`, `captionBgOpacity`.
  - Add `captions: Caption[]` (same shape as in the UI).
- Replace the existing single-caption draw block with a loop:
  1. For each caption, if `text.trim()`:
     - Fill `bgRect` with `bgColor` at `bgOpacity`.
     - Draw text centered inside `rect` using `fontPx = sizePx`, color `color`, font `font`.
- Brand pill and trial watermark logic unchanged.

## Out of Scope

- Custom-frame drag-to-stretch: confirmed unnecessary — custom frames already fill the canvas and snap ratio. No changes.
- No new packages, no router/route changes.
- Pricing, payments, agent, Supabase wiring — untouched.
