# BYO Supabase Setup

You're using your own Supabase project (not Lovable Cloud). Follow these steps once after creating your Supabase project at https://supabase.com.

## 1. Secrets (already configured in Lovable)

- `BYO_SUPABASE_URL` — e.g. `https://abcd1234.supabase.co`
- `BYO_SUPABASE_PUBLISHABLE_KEY` — anon/public key (safe in browser)
- `BYO_SUPABASE_SERVICE_ROLE_KEY` — server-only (bucket creation)

## 2. Run this SQL in your Supabase SQL Editor

Open Supabase Dashboard → SQL Editor → New query → paste → Run:

```sql
-- ───────── tables ─────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  bucket_name text unique not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.event_photos (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  event_name   text not null,
  storage_path text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_event_photos_event on public.event_photos(event_id, created_at desc);

-- ───────── Data API grants (REQUIRED) ─────────
grant select on public.events to anon, authenticated;
grant select, insert on public.event_photos to anon, authenticated;
grant all on public.events, public.event_photos to service_role;

-- ───────── RLS on tables ─────────
alter table public.events enable row level security;
alter table public.event_photos enable row level security;

drop policy if exists "events readable" on public.events;
create policy "events readable" on public.events for select using (true);

drop policy if exists "photos readable" on public.event_photos;
create policy "photos readable" on public.event_photos for select using (true);

drop policy if exists "photos insertable" on public.event_photos;
create policy "photos insertable" on public.event_photos for insert with check (true);

-- ───────── Storage RLS — guests can upload/read in any registered event bucket ─────────
drop policy if exists "event bucket read" on storage.objects;
create policy "event bucket read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in (select bucket_name from public.events));

drop policy if exists "event bucket insert" on storage.objects;
create policy "event bucket insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id in (select bucket_name from public.events));
```

## 3. Test the connection

After running the SQL above:
1. Open `/printer` in your app.
2. Create an event (e.g. "Sarah Wedding") — this provisions the bucket `sarah-wedding.dpotopoto.com`.
3. Pick a photo and click **Upload to event** — file goes straight to your Supabase Storage, metadata to `event_photos`.
4. Verify in Supabase Dashboard → Storage → `sarah-wedding.dpotopoto.com` bucket, and → Table Editor → `event_photos`.

## Notes

- Bucket names with dots are valid in Supabase Storage but unusual; if you prefer `sarah-wedding-dpotopoto`, edit the format string in `src/lib/events.functions.ts`.
- Buckets are created **public-read** so gallery URLs work without signing. Switch to private if you want signed URLs.
- Per-photo size limit: 25 MB (also in `events.functions.ts`).
