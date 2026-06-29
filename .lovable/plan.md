## Problem

In the live preview, the user logo renders with `object-contain` (fits inside the drag rect without stretching). In the export pipeline (`src/lib/studio-export.ts`), the logo is drawn with `ctx.drawImage(logo, x, y, w, h)` which stretches it to fill the rect exactly. Any non-square rect or non-matching aspect ratio produces a visibly squished/stretched logo in the exported JPEG.

## Fix

Change the logo draw block in `src/lib/studio-export.ts` (section "6) logo") so the logo is fit inside the rect with its original aspect ratio preserved and centered — mirroring `object-contain` from the preview.

Replacement logic:

```ts
if (state.logoUrl) {
  const logo = await loadImage(state.logoUrl);
  const r = state.logoRect;
  const boxX = r.x * width;
  const boxY = r.y * height;
  const boxW = r.w * width;
  const boxH = r.h * height;
  const ir = logo.width / logo.height;
  const br = boxW / boxH;
  let dw = boxW;
  let dh = boxH;
  if (ir > br) {
    // image wider than box → constrain by width
    dh = boxW / ir;
  } else {
    dw = boxH * ir;
  }
  const dx = boxX + (boxW - dw) / 2;
  const dy = boxY + (boxH - dh) / 2;
  ctx.save();
  ctx.globalAlpha = state.logoOpacity;
  ctx.drawImage(logo, dx, dy, dw, dh);
  ctx.restore();
}
```

No other files change. Preview behavior already correct.

## Out of scope

- Logo drag rect shape and controls — unchanged.
- Brand pill, captions, frame, slots — unchanged.
