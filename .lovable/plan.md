## Homepage revision plan (revised)

### 1. Preserve original
- Copy current `src/routes/index.tsx` → `src/routes/index.original.tsx.bak` as backup (not picked up by router due to extension).

### 2. Hero (`src/routes/index.tsx`)
- `// System Initialized` → `// Personal Photobooth`
- H1: `YOUR PHONE IS A NEON BOOTH.` → `MAKE YOUR PHONE A PRIVATE PHOTOBOOTH.` (keep "PRIVATE" as the neon highlight word)
- Paragraph → "Turn any screen into a professional capture station. Instant prints, branded frames, pure arcade energy — for any personal, business and social activities, schools, parties, weddings, and brand events."
- CTAs: replace `Start Free Trial` (→ `/snap`) with `Start Free Demo` linking `/frame`. Remove the `Try a Demo Booth` button.

### 3. Modules grid ("// Modules — Three ways to snap")
Reduce to 3 cards, in this order:
- `01 / Frame` — "Design Booth" — existing Frame description, `serviceFrame` image → `/frame`
- `02 / Printer` — "Printing Booth" — "Print up to 5R at any printing booth. Pay per print. No subscription." — `servicePrint` → `/printer`
- `03 / Event` — "Memorable Moment" — "Create your own frame, let any guest snap from their own phone, and share or print on the spot. One QR code turns the whole room into your photo crew." — `kioskUnit` image → `/event`

(Removes the old standalone `01 / Capture` card.)

### 4. Kiosk image section (kept, trimmed)
Keep the existing full-width section with the `kioskUnit` metal-panel image. Remove the `// Event Module` tag, the `04 / Event — Memorable Moment` heading, and the intro paragraph. Keep only the 4-item bullet list to the right of (or below) the image:
- Create or upload your own event frame
- Snap from any smartphone, tablet, or laptop
- Single booth device OR shared QR for every guest
- Share digitally or send to the printer queue

This sits between the modules grid and the footer.

### 5. Remove pricing from homepage
- Remove the `<PricingGrid />` call and the "Printer Booth and Kiosk Mode…" note from the homepage.
- Keep `PricingGrid` exported from `index.tsx` so `/pricing` continues to work unchanged.
- Pricing on `/printer` and `/event` pages is untouched.

### 6. Footer (`src/components/site/SiteFooter.tsx`)
- Remove `SYSTEM_v.03`, Instagram, and TikTok links.
- Replace `Support` with `Contact Us` (placeholder `href="#"` — WhatsApp link to be added later).

### Notes
- No backend / business-logic changes. `/snap` route stays but is no longer linked from the homepage.
- Backup file makes restoring the previous homepage a one-file copy.
