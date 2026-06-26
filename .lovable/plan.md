## Goal

Two clean destinations, reachable from both the homepage cards and the top nav:

- **/printer** (top-nav `/printer` + homepage `03 / PRINT`) → the original printer booth, no Supabase/event UI.
- **/event** (top-nav `/event` + homepage `// Event Module — 04 / Event`) → the Supabase event-upload tool (EventPanel + photo uploads).

## Changes

### 1. `src/routes/printer.tsx` — strip event UI
Restore to the pre-Supabase printer booth:
- Remove imports: `EventPanel`, `uploadFilesToEvent`, `EventRow`.
- Remove state: `event`, `uploading`.
- Remove function: `uploadToEvent()`.
- Remove the `<EventPanel … />` block above the file picker.
- Remove the "Upload to event" `NeonButton`, leaving:
  - `Pay now (soon)` (ghost, disabled)
  - `Upload & print` (glow, primary)
- Keep `toast` (still used by print error/success).

Everything else — header, ConnectIndicator, file picker, FileRow list, totals, PrintQueueStrip, pricing hint — stays untouched.

### 2. `src/routes/event.tsx` — become the Supabase event page
Replace the current marketing landing with the working upload tool:
- Keep `SiteNav`, `BackToHome`, `SiteFooter`, and a short branded header (`// 04 / EVENT — Memorable Moment`) with a one-line tagline.
- Mount `<EventPanel selected={event} onSelect={setEvent} />` (state in the page).
- Multi-file picker (`image/*,application/pdf`, max 10) with a list of chosen filenames + remove button.
- Single primary `NeonButton` "Upload to {event.name}" calling `uploadFilesToEvent(event, files)`; disabled until an event is selected and at least one file is picked. Uses `toast` for feedback.
- Empty-state hint when no event is selected: "Create or pick an event above to start uploading."
- `EventPanel` already handles the Supabase-not-configured warning.

No printer, pricing, queue, or payment UI on this page.

### 3. `src/routes/index.tsx` — confirm card links
Verify and adjust only if mismatched:
- `03 / Print` Services card → `/printer`.
- `// Event Module` block (`04 / Event — Memorable Moment`) → `/event`. Keep copy and any "Open Printer Booth" cross-link as-is.

### 4. `src/components/site/SiteNav.tsx` — confirm nav links
Verify the top nav has:
- `/printer` → printer booth
- `/event` → event upload tool

Adjust labels/links only if they currently point elsewhere.

### 5. No backend / agent / schema changes
- `agent/*`, `src/lib/events.*`, `src/components/print/EventPanel.tsx`, Supabase clients, and `docs/BYO_SUPABASE_SETUP.md` unchanged.
- `/kiosk` keeps its redirect to `/event`.

## Files touched

- `src/routes/printer.tsx` — remove EventPanel + uploadToEvent state/button
- `src/routes/event.tsx` — replace marketing page with EventPanel + upload UI
- `src/routes/index.tsx` — verify `03 / Print` → `/printer`, `04 / Event` → `/event`
- `src/components/site/SiteNav.tsx` — verify `/printer` and `/event` nav links
