## Problem
On phones the Frame Studio layout puts the HUE / Saturation sliders far below the live preview, so users lose visual context while adjusting tint. Also the slot-hint row feels too high in the page.

## Changes

1. **Reorder FrameStrip on mobile**
   - Inside `FrameStrip`, wrap the left column (frame tiles + upload) and right column (tints + sliders) in a single grid that uses `order-2` on the left column and `order-1` on the right column for small screens.
   - On `md` and up keep the existing left/right order.
   - This places the 7 tint swatches, Hue slider, and Saturation slider directly above the frame tiles on phones.

2. **Move slot-hint row above the footer**
   - Relocate the existing `<div>` containing `drag slots · corner = resize · click slot to upload` + `Reset_Layout` from its current position (just under quick controls) to immediately before `<SiteFooter />`.
   - Keep the same styling so it sits as a full-width hint bar just above the footer on all viewports.

No state, handlers, or export logic changes.