-- The digital equipment checkout sheet.
--
-- One row is one filled-out inspection: the header the paper asks for, a
-- mark for every item, the operator's signature, and whether repairs are
-- needed. The whole sheet lives in a single row on purpose — the offline
-- queue replays one insert, so a sheet filled out in a dead zone can't
-- arrive half-written the way a parent/child pair could.
--
-- Items are jsonb keyed "section/item", e.g.
--   {"outside/Hoses": {"mark": "rr", "note": "weeping at the fitting"}}
-- The item list itself lives in the app (src/lib/inspection.ts) rather
-- than in the database. It changes when the paper form changes, and a
-- text key keeps old sheets readable after it does — a renamed item makes
-- an old sheet say what it said at the time, instead of pointing at a row
-- that no longer means the same thing.

create table if not exists inspections (
  id uuid primary key default gen_random_uuid(),
  foreman_id uuid not null references foremen (id),
  machine_id uuid not null references machines (id),
  crew_member_id uuid references crew (id),
  date date not null default current_date,

  -- header fields, in the paper's order
  location text,
  shift text,
  job_no text,
  job_name text,
  hour_meter numeric(10, 1),
  mileage text,

  items jsonb not null default '{}'::jsonb,
  defects text,
  repairs_needed boolean not null default false,

  -- Strokes, not an image: {"w":600,"h":160,"strokes":[[[x,y],…],…]}.
  -- Redrawn as vectors in the PDF, so it stays sharp at print size and
  -- costs a few hundred bytes instead of a hundred kilobytes.
  signature jsonb,
  signed_at timestamptz,

  -- Repair follow-through, mirroring the columns on entries so the
  -- superintendent's list can hold both kinds of item side by side.
  repair_done boolean not null default false,
  repair_note text,
  repair_updated_at timestamptz,

  -- A sheet is the operator's to fix on the day. After that it is a
  -- record: the app stops offering the edit button, and a correction is
  -- stamped here so the change shows on the sheet instead of replacing
  -- it silently.
  corrected_at timestamptz,
  correction_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One checkout per machine per day, matching the paper. Hours can be
  -- logged many times a day against the same machine; the inspection
  -- happens once, when it is checked out.
  unique (foreman_id, machine_id, date)
);

create index if not exists inspections_crew_week
  on inspections (foreman_id, date desc);

create index if not exists inspections_open_repairs
  on inspections (repairs_needed, repair_done, date desc)
  where repairs_needed;

-- Access model matches the rest of the app: the shared password is
-- enforced at the app layer and the public key is trusted with the data,
-- so RLS is on with a permissive policy to satisfy Supabase's defaults.
-- Crew separation is done by foreman_id on every query.
alter table inspections enable row level security;

drop policy if exists "anon full access" on inspections;
create policy "anon full access" on inspections
  for all using (true) with check (true);
