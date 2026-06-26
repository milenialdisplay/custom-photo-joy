## Goal

Keep the original `03 / Print` card untouched. Rebrand the kiosk-related entry points to **04 / Event** and replace the homepage `// Hardware Module` block with a new `// Event Module` section. Both lead to a new `/event` page.

## Changes

### 1. New route: `src/routes/event.tsx`
- URL: `/event`
- `head()` with title "Event — dpotopoto.com" and matching description / og tags.
- Hero "04 / Event — Memorable Moment" with the four value props:
  - Create or upload your own frame for your event
  - Use anyone's smartphone, tablet, or laptop to snap photos or upload favorites
  - One device as a photobooth, or share a QR code so any guest can use the frame
  - Share digitally or print — guest's choice
- Reuses existing visual language (metal panel, neon mint, scanlines, kiosk hero image) so the page stays on-brand.
- Includes `SiteNav`, `SiteFooter`, `BackToHome`.
- CTAs: "Start an Event" → `/frame`, "Open Printer Booth" → `/printer`.

### 2. Homepage `src/routes/index.tsx`
- Leave the `03 / Print` Services card untouched.
- Replace the `// Hardware Module` section with a new **`// Event Module`** block titled `04 / Event — Memorable Moment`, same metal-panel layout and image, copy reflecting the four bullets above.
- CTA button "Explore Event Mode" → `<Link to="/event">`.

### 3. Top nav `src/components/site/SiteNav.tsx`
- Rename the `/kiosk` link to `/event` pointing at `/event`.

### 4. Redirect old `/kiosk` URL
- Replace `src/routes/kiosk.tsx` body with `beforeLoad: () => { throw redirect({ to: "/event" }) }` so old links still work.

## Out of scope
- No changes to `/printer`, `/frame`, `/snap`, agent code, or Supabase logic.
- No visual redesign of `03 / Print`.
