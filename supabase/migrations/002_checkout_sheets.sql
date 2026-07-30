-- Checkout sheet photos: one optional photo per entry, plus expiring
-- links for sharing a week's sheets with the safety officer.
-- Run once in the Supabase SQL editor.

-- 1. The photo lives in storage; the entry keeps only its object path.
alter table entries add column if not exists photo_path text;

-- 2. Links that let someone view one week's sheets without the app password.
create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

alter table share_links enable row level security;

drop policy if exists "anon full access" on share_links;
create policy "anon full access" on share_links
  for all using (true) with check (true);

-- 3. Private bucket for the photos. Not public: images are reached through
--    short-lived signed URLs rather than guessable permanent addresses.
insert into storage.buckets (id, name, public, file_size_limit)
values ('checkout-sheets', 'checkout-sheets', false, 10485760)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- The app authenticates with the shared password at its own layer, so the
-- anon role is allowed to work with objects in this one bucket.
drop policy if exists "checkout sheets read" on storage.objects;
create policy "checkout sheets read" on storage.objects
  for select using (bucket_id = 'checkout-sheets');

drop policy if exists "checkout sheets insert" on storage.objects;
create policy "checkout sheets insert" on storage.objects
  for insert with check (bucket_id = 'checkout-sheets');

drop policy if exists "checkout sheets update" on storage.objects;
create policy "checkout sheets update" on storage.objects
  for update using (bucket_id = 'checkout-sheets');

drop policy if exists "checkout sheets delete" on storage.objects;
create policy "checkout sheets delete" on storage.objects
  for delete using (bucket_id = 'checkout-sheets');
