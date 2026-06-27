
# Event System — Plan v3 (scope-clarified)

Host-driven event flow with custom frames, guest capture, public album, optional offline print-booth handoff. Uses your BYO Supabase project.

> **Scope guard:** The existing `/frame` Frame Studio (multi-slot, presets, patterns, captions, logo, trial watermark) is **NOT changed**. All new frame work lives in a brand-new file under `/event/$slug/frame`.

---

## 1. Locked decisions

| Topic | Decision |
|---|---|
| Payments | Dev **"Mark as paid"** button now + stub `createCheckoutSession(provider)` ready for Midtrans / Lemon Squeezy / InstaQRIS. Real SDKs wired later. |
| Tiers | **≤100** and **100+** |
| Album access | 4-digit PIN on `events.access_pin`, cached in `localStorage` per device. |
| Off-site prints | **Booth-only.** Two QR posters: `?booth=1` (printable at venue, can queue prints) + plain share QR. |
| Per-guest print cap | **1 print per guest per event.** localStorage flag + server RPC `consume_print_credit`. Confirm copy: *"Do you want to print this photo? You can only print 1 photo per event."* |
| Per-guest upload cap | **35 confirmed photos per guest.** Shown on guest panel. |
| Host dashboard | `/event/$slug/dashboard`: `prints used / total`, photos uploaded count. |

### Pricing

| Tier | A — Digital only | B — Digital + Prints |
|---|---|---|
| ≤100 guests | Rp 50,000 | Rp 500,000 (100 prints incl.) |
| 100+ guests | Rp 100,000 | Add-on packs: **20 prints = Rp 100,000** |

Footnote: *"We also offer freeflow prints — please contact us."*

---

## 2. Host flow — `/event`

Single-page wizard (replaces current uploader).

1. Event name, date, tier
2. Package A or B (if B + 100+, add-on print packs stepper ×20)
3. Auto-generated 4-digit access PIN (regenerate option)
4. Live pricing summary
5. Payment buttons (Midtrans / Lemon Squeezy / InstaQRIS stubs) + **Mark as paid (dev)**
6. On paid → insert `events` row + create bucket `{slug}.dpotopoto.com` + set `paid_at`
7. Post-paid panel: Customize frame · Host dashboard · Album

---

## 3. Frame studio — `/event/$slug/frame` (NEW, separate from `/frame`)

> Brand-new file `src/routes/event.$slug.frame.tsx`. Does **not** touch `/frame` or `src/routes/frame.tsx`.

- **Upload your own frame**: flat JPG/PNG, no transparent hole. Frame drawn full-canvas; photo composited **on top** (same model as `studio-export.ts`).
- **Single photo slot only** (vs. 1-6 in main `/frame`):
  - One draggable/resizable rectangle over the frame preview (reuses `useDraggable`).
  - Aspect ratio selector (1:1 / 2:3 / 3:2).
  - Host positions/sizes the slot once; same slot used for every guest photo.
- **Save** uploads to `{bucket}/_frames/`:
  - `active.{ext}` — frame image
  - `slot.json` — `{x, y, w, h, ratio}` normalized 0..1
  - URLs written to `events.frame_url` and `events.frame_slot` (jsonb)
- **Guest render** mirrors `drawCover` from `studio-export.ts`: draw frame → `drawCover` photo into saved slot rect.
- **QR posters** (`qrcode.react`, downloadable PNGs):
  - Booth QR → `/e/$slug/capture?booth=1`
  - Share QR → `/e/$slug`

Excluded from this fork (kept only in `/frame`): multi-slot, layout presets, pattern overlays, captions, logo, trial watermark.

---

## 4. Guest flow — `/e/$slug/capture`

Public route, PIN-gated, 404 if `paid_at IS NULL`.
- Reuses `CameraCapture.tsx` with frame overlay + slot rectangle highlight.
- Capture or upload from device.
- Composite via canvas (frame + `drawCover` photo into slot).
- Confirm screen: *Looks good / Retake / Re-upload*.
- On confirm:
  1. Upload composited JPEG → `event_photos` insert
  2. If `?booth=1` AND not yet printed AND `print_credits_remaining > 0` AND package B → print prompt → RPC `consume_print_credit` → POST blob to local agent (`localStorage.agentUrl`) → set `printed:{slug}=true`
- Guest panel shows: *"X / 35 photos saved · Print used: yes/no"*

---

## 5. Host dashboard — `/event/$slug/dashboard`

Prints `used / total` (realtime), photos uploaded count, album thumbs, PIN, both QR posters, bucket name, "Buy 20 more prints" CTA.

---

## 6. Public album — `/e/$slug`

PIN gate → grid from public URLs + realtime updates.

---

## 7. Supabase SQL migration — **YOU run this in Supabase dashboard**

When the code is ready I'll append this SQL to `docs/BYO_SUPABASE_SETUP.md`. You then go to **Supabase dashboard → SQL Editor → New query → paste → Run** (same place you ran the original setup). No CLI needed.

```sql
alter table public.events
  add column event_date date,
  add column guest_tier text check (guest_tier in ('t100','t100plus')),
  add column package text check (package in ('A','B')),
  add column price_idr int,
  add column print_credits int default 0,
  add column print_credits_remaining int default 0,
  add column paid_at timestamptz,
  add column frame_url text,
  add column frame_slot jsonb,
  add column access_pin text;

create policy "public read paid events" on public.events
  for select to anon using (paid_at is not null);

create policy "public read photos of paid events" on public.event_photos
  for select to anon using (
    exists (select 1 from public.events e where e.id = event_id and e.paid_at is not null)
  );

create policy "anon insert photos to paid events" on public.event_photos
  for insert to anon with check (
    exists (select 1 from public.events e where e.id = event_id and e.paid_at is not null)
  );

create or replace function public.consume_print_credit(_event_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update public.events set print_credits_remaining = print_credits_remaining - 1
   where id = _event_id and print_credits_remaining > 0
  returning true into ok;
  return coalesce(ok,false);
end$$;
grant execute on function public.consume_print_credit(uuid) to anon, authenticated;
```

---

## 8. Files (**my** to-do — you don't do anything here)

**New:**
- `src/routes/event.tsx` — wizard (replaces current uploader UI)
- `src/routes/event.$slug.frame.tsx` — single-slot frame editor + QR generator (NEW, not a fork of existing files)
- `src/routes/event.$slug.dashboard.tsx` — host counters
- `src/routes/e.$slug.tsx` — PIN-gated album
- `src/routes/e.$slug.capture.tsx` — guest capture/upload + confirm
- `src/components/event/` — `EventWizard.tsx`, `PricingMatrix.tsx`, `PaymentButtons.tsx`, `PinGate.tsx`, `FrameUploader.tsx`, `SingleSlotEditor.tsx`, `EventQR.tsx`, `HostCounters.tsx`, `GuestPanel.tsx`
- `src/lib/event-pricing.ts` — pure pricing helpers
- `src/lib/event-render.ts` — single-slot composite (frame + `drawCover` photo)

**Modified:**
- `src/lib/events.functions.ts` — `createPaidEvent`, `markEventPaid` (dev), `getPublicEvent`, `getEventAlbum`, `createCheckoutSession` (stub), `addPrintCredits`, `saveEventFrame`
- `src/lib/events.ts` — `verifyPin`, `uploadCompositedPhoto`, `consumePrintCredit`, `submitToBooth(agentUrl, blob)`
- `docs/BYO_SUPABASE_SETUP.md` — append section 7 SQL
- `package.json` — add `qrcode.react`

**Untouched (explicit):** `src/routes/frame.tsx`, `src/routes/printer.tsx`, `src/routes/snap.tsx`, all `agent/*`, the existing `/frame` studio export pipeline, the printer booth UI.

---

## 9. Build order

1. Append SQL to migration doc → you run it in Supabase
2. Host wizard + dev mark-as-paid + payment stub fn
3. Single-slot frame editor + QR posters
4. Guest capture + PIN gate + album
5. Host dashboard with live counters
6. Booth handoff (`?booth=1` → POST to agent)

Awaiting your approval before any code changes.
