# d'poto / Snapbooth — Build Plan

## Design system (locked first)
Neon arcade kiosk with industrial/skeuomorphic touches.

- **Palette**: bg `#0A0A0F`, surface `#1A1A24`, foreground `#F0F0FF`, primary neon mint `#73FFB8`, secondary cyan `#00F0FF`, alert red, plus **brushed-metal gradient** for kiosk hardware feel (linear gradients `#2A2A35 → #14141C → #2A2A35` with subtle inner highlights).
- **Fonts**: Space Grotesk (display) + JetBrains Mono (mono labels, prices, system text).
- **Motifs**: scanline overlays, pulse glow on primary CTAs, flicker on hero text, `LIVE` badges, mono labels like `// System Initialized`, `01 / Capture`. Buttons feel like hardware switches (inset shadows, top highlight, bottom shadow), kiosk panels have rivets and bezels.
- All tokens defined once in `src/styles.css`; every component uses semantic tokens (no raw colors).

## Build order (4 phases)

### Phase 1 — Marketing + design system (this step)
1. Establish design tokens, fonts, scanline/glow/flicker utilities in `src/styles.css`.
2. Build `/` landing page mirroring the chosen prototype (hero, 3 services, kiosk pitch, pricing, footer) — but with industrial buttons and brushed-metal accents on the kiosk section.
3. Add routes for `/pricing`, `/kiosk` (SEO-friendly separate pages).
4. Generate hero/service/kiosk images via image-gen (replace placeholders).
5. EN/ID language toggle stub (copy stored as constants, switched client-side).

### Phase 2 — Frame Studio (core creative engine, shared by all booths)
1. `/studio` — layered canvas editor: base photo → frame (hue slider) → logo (drag, resize, opacity) → caption (font, size, color, **caption background box** with drag/resize and fill-color/opacity sliders).
2. Output presets: web (1080×1080/1350/1920) + print @300dpi (2R, 4R, **A5 1594×2362**, A6, square).
3. Export JPEG via `canvas.toBlob`. Trial export appends `d'poto.com` watermark bar at the bottom of the frame (not over the photo).
4. Skip-frame option: user can export the raw photo with no frame/logo/caption.

### Phase 3 — Photo Booth + Printer Booth (guest-facing)
1. `/booth` — `getUserMedia` capture (front/back, single or 4-strip), countdown, retake, send to Studio.
2. Device picker (webcam, action cam, DSLR-via-capture-card all show up as cameras).
3. Skip-frame allowed.
4. `/print` — upload file → pick size → kiosk-only (gated to kiosk session); pay-per-print, no trial.
5. Native `navigator.share` + per-platform deep links (WhatsApp/Telegram/X/FB/LINE/Email/Copy). One file at a time.

### Phase 4 — Kiosk mode, Auth, Payments
1. `/kiosk/:code` — portrait + landscape, standby attract loop (3-slide intro + QR + ads), phone-as-remote pairing via Lovable Cloud Realtime channel.
2. Big-screen flow: monitor = stage, phone = remote, control messages only (no media streamed).
3. Enable Lovable Cloud → email/Google auth (hosts only).
4. Tables: `profiles`, `user_roles` (host/admin), `events`, `kiosks`, `download_credits`, `prints`, `assets` (logos).
5. Trial logic: 7 days **or** 20 exports — watermark forced. Printer + Kiosk excluded from trial.
6. Payments: **Midtrans** (IDR) + **Lemon Squeezy** (USD) webhooks → credit packs:
   - Pro: 49K IDR / $4.99 → 50 downloads, manual logo per export, 50% off for first 1000 users.
   - Business: 149K IDR / $12.99 per event → 200 downloads + 1K IDR / $0.10 per extra, up to 3 saved logos reusable across the event.
   - Kiosk plan: same as Business initially (separate SKU for future repricing); per-kiosk-owner pricing override field.
   - Printer: pay-per-print only (IDR 10K for A5/5R or 2R/4R), suppressed when nearby printer exists.

## Technical notes
- Stack: TanStack Start + React 19 + Tailwind v4 (already set up). Routes in `src/routes/`. Server logic via `createServerFn`. Realtime via Lovable Cloud (Supabase) channels keyed `kiosk:{code}`.
- Guest photos never persist — browser memory only. Host logos + frames + standby ads in Lovable Cloud storage. Event galleries (future) on Cloudflare R2.
- Webhook routes under `src/routes/api/public/` with HMAC signature verification.
- Payments enabled later (Phase 4) since both Midtrans and Lemon Squeezy are user-specified — will use bring-your-own-key via `secrets` tool, not the built-in seamless integrations.

## Open items resolved
- Trial: 7d or 20 exports, watermark bar at bottom of frame, photo/frame booth only ✓
- Pricing per your spec ✓
- Printer: pay-per-print, kiosk-only ✓
- Logos: 1 per export (Free/Pro), up to 3 reusable (Business) ✓
- Visual direction: Neon arcade kiosk + industrial/metallic ✓

## What I'll build first when you approve
Phase 1 only: design tokens, landing page, pricing/kiosk routes, hero imagery. You'll see and approve the look before I build the booth functionality.