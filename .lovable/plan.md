
# Connect BYO Supabase + Event Photo Uploads

## 1. Connect your own Supabase project

You'll create the project yourself at supabase.com (free tier is fine to start) and paste three values into Lovable secrets:

- `VITE_SUPABASE_URL` — e.g. `https://abcd1234.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the "anon/publishable" key (safe in browser)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used by a server function to create per-event buckets

I'll add a small `src/integrations/supabase/client.ts` that reads the two `VITE_*` vars, plus a server-only `client.server.ts` that uses the service-role key. No Lovable Cloud, no monthly Lovable storage credits — you pay Supabase directly.

## 2. Database schema (one migration you'll run in Supabase SQL editor)

```sql
-- events: one row per booth event
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,           -- url-safe, used in bucket name
  name        text not null,                  -- e.g. "Sarah & Tom Wedding"
  bucket_name text unique not null,           -- "{slug}.dpotopoto.com"
  created_at  timestamptz not null default now()
);

-- event_photos: metadata for each uploaded photo
create table public.event_photos (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  event_name  text not null,                  -- denormalized for easy gallery query
  storage_path text not null,                 -- "<bucket>/<filename>"
  created_at  timestamptz not null default now()
);

-- Data API grants
grant select on public.events to anon, authenticated;
grant select, insert on public.event_photos to anon, authenticated;
grant all on public.events, public.event_photos to service_role;

-- RLS: anyone with the event link can read events and read/insert photos for it
alter table public.events enable row level security;
alter table public.event_photos enable row level security;
create policy "events readable" on public.events for select using (true);
create policy "photos readable" on public.event_photos for select using (true);
create policy "photos insertable" on public.event_photos for insert with check (true);
```

Storage RLS on `storage.objects` will mirror this: anyone can `INSERT`/`SELECT` into any bucket whose name matches a row in `public.events`.

## 3. Per-event bucket creation

Buckets named with dots (`sarah-wedding.dpotopoto.com`) are legal in Supabase Storage. Bucket creation requires the service-role key, so it runs in a server function:

- `createEvent({ name })` → slugifies the name, inserts `events` row, calls Supabase Storage admin API to create the bucket `{slug}.dpotopoto.com` as public-read, returns `{ eventId, slug, bucketName }`.

UI: a small "New event" form on `/printer` (or a new `/event/new` route — your call, I'll default to a card on `/printer`).

## 4. Guest upload flow

On `/printer` (and later the event gallery page), the existing file picker becomes:

1. Guest picks files (already wired).
2. For each file, upload directly from the browser to `supabase.storage.from(bucketName).upload(filename, file)` using the publishable key.
3. On success, `insert` a row into `event_photos` with `{ event_id, event_name, storage_path }`.
4. Show the public URL in the gallery instantly.

No file ever passes through Lovable — bandwidth + storage are 100% on your Supabase project.

## 5. What I will NOT change

- Print pipeline, agent, queue, pricing UI — untouched.
- Existing `/snap`, `/frame`, `/kiosk` routes — untouched.
- No Lovable Cloud will be enabled.

## Technical details

- Files touched: `src/integrations/supabase/client.ts` (new), `src/integrations/supabase/client.server.ts` (new), `src/lib/events.functions.ts` (new — `createEvent` server fn using service-role), `src/lib/events.ts` (new — browser upload helpers), `src/routes/printer.tsx` (add event selector + wire uploads).
- One Supabase migration file you'll paste into the SQL editor (I'll save it to `supabase/migrations/` as a reference).
- Slug rule: lowercase, hyphens, ASCII only, max 40 chars; collisions get `-2`, `-3`, etc.

## Open question I'm assuming a default for

- **Where event creation lives**: I'll put it as a "Create event" card at the top of `/printer`. If you'd rather have a dedicated `/events/new` page or host-only auth gate later, say so and I'll adjust.

After you approve, switch me to build mode and I'll implement.
