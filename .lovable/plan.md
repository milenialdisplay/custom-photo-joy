## Goal

Make three landing-page entry points navigate to their matching existing routes, so the homepage actually leads into the demo flow.

## Changes (all in `src/routes/index.tsx`)

1. **Hero "Start Free Trial" button** → link to `/camera-test` (same destination as the adjacent "Try a Demo Booth"). Wrap the `<NeonButton size="lg" glow>` in a `<Link to="/camera-test">`.

2. **Services section — make cards linkable.** The current `{ tag, title, desc, img, alt }[]` array renders plain `<article>` elements. Extend each item with an optional `href` and render the card inside a `<Link>` when present (keep hover styles, just make the whole tile a navigation target):
   - `01 / Capture — Photo Booth` → `/camera-test`
   - `02 / Edit — Frame Booth` → `/studio` (the designing page)
   - `03 / Print — Printer Booth` → no link (route doesn't exist yet); leave as a plain article.

3. Use `<Link to="...">` from `@tanstack/react-router` (already imported).

## Out of scope

- No new routes, no styling overhaul, no changes to `/camera-test` or `/studio` behavior.
- Printer Booth stays non-interactive until a target route exists.

## Verification

- Click each CTA on `/` and confirm navigation: Start Free Trial → /camera-test, Try a Demo Booth → /camera-test, Photo Booth card → /camera-test, Frame Booth card → /studio.
