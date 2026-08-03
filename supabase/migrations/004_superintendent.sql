-- A superintendent account: sees every crew, changes only maintenance.
--
-- Repair state lives on the entry rather than in a separate items table.
-- A repair is always discovered on a particular entry, and keeping it
-- there means the offline queue, the crew scoping, and the edit screen
-- all keep working unchanged — a second table would need its own sync
-- path and could drift from the entry it came from.

-- 1. Accounts gain a role. Foremen behave exactly as before.
alter table foremen add column if not exists role text not null default 'foreman'
  check (role in ('foreman', 'superintendent'));

-- The login dropdown needs the role so the app knows where to send them.
create or replace function list_foremen()
returns table (id uuid, name text, role text)
language sql
security definer
set search_path = public
stable
as $$
  select f.id, f.name, f.role
  from foremen f
  where f.status = 'active'
  order by f.sort_order, f.name;
$$;

revoke all on function list_foremen() from public;
grant execute on function list_foremen() to anon, authenticated;

-- 2. Repair tracking on entries.
alter table entries add column if not exists needs_repair boolean not null default false;
alter table entries add column if not exists repair_done boolean not null default false;
alter table entries add column if not exists repair_note text;
alter table entries add column if not exists repair_updated_at timestamptz;

-- Open repairs are the hot query for the superintendent screen.
create index if not exists entries_open_repairs
  on entries (needs_repair, repair_done, date desc)
  where needs_repair;

-- 3. Spoon. One password: superintendents never reach the machine and
--    crew management screens, so the admin slot is filled with a value
--    that cannot be typed rather than left usable.
insert into foremen (name, sort_order, role, crew_password_hash, admin_password_hash)
select 'Spoon', 100, 'superintendent',
       extensions.crypt('Fork', extensions.gen_salt('bf', 10)),
       extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf', 10))
where not exists (select 1 from foremen where name = 'Spoon');
