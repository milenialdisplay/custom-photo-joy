## Goal

Rework the `/frame` page (`src/routes/frame.tsx`) layout so the **quick controls row** sits directly under `LIVE_PREVIEW`, and the frame picker UI only appears when the user clicks **02 FRAME**. Preserve a working backup of the current page before making changes.

## 0. Backup current working version

- Copy `src/routes/frame.tsx` → `src/routes/frame.original.tsx.bak` (the `.bak` extension keeps it out of the router, identical to how `index.original.tsx.bak` is preserved).
- If the revision misbehaves, restoring is a single-file copy back over `frame.tsx`.

## 1. Promote quick controls under LIVE_PREVIEW

- Move the existing `quick_controls` grid (currently `lg:hidden`, lines ~411–433) to render **immediately below** the preview stage, before any frame UI.
- Remove the `lg:hidden` gate so all 6 buttons (`01 LAYOUT`, `02 FRAME`, `03 PATTERN`, `04 LOGO`, `05 CAPTION`, `06 EXPORT`) show on desktop too.
- Rename state `activeMobilePanel` → `activePanel` since it now drives both viewports.

## 2. Move "drag slots / Reset_Layout" hint row

- Move the row at lines 401–409 (`drag slots · corner = resize · click slot to upload` + `Reset_Layout`) so it renders **right after** the quick-controls grid.

## 3. Gate `FrameStrip` behind "02 FRAME"

- Wrap `<FrameStrip />` in `activePanel === "frame" && (...)` so it only appears when the user taps **02 FRAME**, positioned below the quick controls + reset row.

## 4. Restructure `FrameStrip` into a two-column layout

```text
┌────────────────────────────────────────────────────────────┐
│ frames · tap to preview · upload your own   1 frame · 7 tints│
├──────────────────────────┬─────────────────────────────────┤
│ [white ratio frame tile] │ [7 tint swatches grid]          │
│ [+ Upload tile]          │ [Hue slider]                    │
│                          │ [Saturation slider]             │
└──────────────────────────┴─────────────────────────────────┘
```

- Replace the current vertical stack (frames row → tint row) with `grid grid-cols-1 md:grid-cols-2 gap-4`.
- Left column: existing frame tile(s) + `+ Upload` tile.
- Right column: 7 tint swatches in `grid grid-cols-7 gap-2`, then `<Slider>` for Hue (0–360) and Saturation (0–100).
- Extend `FrameStrip` props with `onHueChange` / `onSatChange`; pass `setFrameHue` / `setFrameSat` from `StudioPage`. Reuse the existing `Slider` component (move its declaration above `FrameStrip` if scoping requires it).

## 5. Remove the now-duplicate "02 · Frame" aside panel

- Delete the entire right-side `<Panel title="02 · Frame" ...>` block (lines 470–495), including its `Upload_Custom_Frame` button and Hue/Saturation sliders.
- Other panels (`01 Ratio & Layout`, `03 Pattern`, `04 Logo`, `05 Caption`, `06 Export`) and their `activePanel` keys stay unchanged.

## 6. Preserve behavior

- All state (`frameId`, `frameHue`, `frameSat`, `customFrame`, etc.) and handlers unchanged.
- `activePanel` defaults to `"layout"` so the FrameStrip stays hidden on initial load.
- No export pipeline, asset, or other route changes.
