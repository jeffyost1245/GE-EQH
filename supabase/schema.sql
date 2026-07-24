-- GE-EQH: machine hours log schema
-- Run this once in the Supabase SQL editor (Database -> SQL Editor -> New query).

create table if not exists machines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists crew (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines (id),
  crew_member_id uuid not null references crew (id),
  date date not null default current_date,
  start_hours numeric(10, 1) not null,
  end_hours numeric(10, 1),
  end_hours_autofilled boolean not null default false,
  note text,
  job_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Most recent entry per machine" lookups and dashboard week queries
create index if not exists entries_machine_recency
  on entries (machine_id, date desc, created_at desc);
create index if not exists entries_date on entries (date desc);

-- Access model: the app is gated by a single shared password at the app
-- layer, so the anon key is allowed full read/write on these tables.
-- RLS is enabled with permissive policies to satisfy Supabase defaults.
alter table machines enable row level security;
alter table crew enable row level security;
alter table entries enable row level security;

create policy "anon full access" on machines
  for all using (true) with check (true);
create policy "anon full access" on crew
  for all using (true) with check (true);
create policy "anon full access" on entries
  for all using (true) with check (true);
