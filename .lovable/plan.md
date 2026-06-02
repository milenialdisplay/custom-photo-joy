## Goal

Wire up clean `/snap`, `/frame`, `/printer`, `/kiosk` URLs, update the header nav to match, and rebuild `/printer` as the simple guest print page per the earlier ASCII spec.

## 1. New route aliases

Create three new route files that render the existing components, so the URLs match the spec:

- `src/routes/snap.tsx` → renders the same component as `camera-test.tsx` (Photo Booth / "01 / Capture")
- `src/routes/frame.tsx` → renders the same component as `studio.tsx` (Frame Booth / "02 / Edit")
- `/kiosk` already exists, keep as-is
- `/printer` already exists, will be rewritten (see step 3)

Old routes `/camera-test` and `/studio` stay as redirects to `/snap` and `/frame` so nothing breaks.

## 2. Header nav (`SiteNav.tsx`)

Replace current links (Studio / Kiosk_Mode / Pricing / System: Live) with:

```
dpotopoto.com    /snap    /frame    /printer    /kiosk            EN/ID
```

- Logo `dpotopoto.com` links to `/`
- Four mono uppercase links to `/snap`, `/frame`, `/printer`, `/kiosk`
- EN/ID toggle stays on the right
- Remove "← Back to main page" from product sub-pages (printer, studio, camera-test, kiosk)

## 3. Update landing page card links (`src/routes/index.tsx`)

In the "Three ways to snap" section:
- Photo Booth card → `/snap` (was `/camera-test`)
- Frame Booth card → `/frame` (was `/studio`)
- Printer Booth card → `/printer` (already correct)

Hero CTAs also updated to `/snap`.

## 4. Rebuild `/printer` as the guest print page

Replace the current complex operator console at `src/routes/printer.tsx` with the simple guest UI from the ASCII spec:

```
┌─────────────────────────────────────────────┐
│ Printing at: Mall A · L2     [Connect printer] │  ← orange when offline, green when ready
│                                              │
│  [ Select files to print ]                   │
│  ┌──────────────────────────────────────┐   │
│  │ photo1.jpg     [A5 ▾]   Rp 5.000   ✕ │   │
│  │ photo2.jpg     [A4 ▾]   Rp 15.000  ✕ │   │
│  └──────────────────────────────────────┘   │
│  Total: Rp 20.000                            │
│  [ Pay now ]   [ Upload & print ]            │
│                                              │
│  Queue: ▓ printing  ░ next  ░ next           │
└─────────────────────────────────────────────┘
```

Reuses existing components: `ConnectIndicator`, `FileRow`, `PrintQueueStrip`, `useBoothConfig`, and pricing from `src/lib/pricing.ts` (A4 = Rp 15,000, A5 = Rp 5,000).

The old operator-console page is removed (and `/print` route deleted) — `/printer` becomes the single guest URL.

## 5. Payment deferred

"Pay now" button is wired as a placeholder (disabled or shows "Coming soon"); we add Midtrans/Lemon Squeezy after `/kiosk` is done, per your note.

## Out of scope this round

- `/kiosk` content changes
- Real payment integration
- Operator console (removed; can come back at `/operator` later if needed)
