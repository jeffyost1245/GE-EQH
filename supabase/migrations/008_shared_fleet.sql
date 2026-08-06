-- The fleet stops belonging to crews.
--
-- A machine is company iron identified by its unit number. Crews hold
-- machines; they don't own them. So which machines a crew sees becomes
-- a list they keep, not a column on the machine, and one machine can be
-- on several crews' lists at once — which is what happens on a site
-- where two crews share a skid steer for a day.
--
-- Nothing is merged here. The same physical machine is probably entered
-- twice under different crews right now, and picking which of those to
-- keep is a judgement about real iron and real meter readings that
-- belongs to a person, not a migration. This change stops NEW duplicates
-- being created; the existing ones get merged by hand, with the
-- superintendent looking at them.

create table if not exists crew_machines (
  foreman_id uuid not null references foremen (id) on delete cascade,
  machine_id uuid not null references machines (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (foreman_id, machine_id)
);

-- Every machine starts on the list of the crew that already had it, so
-- nobody's dropdown changes on the day this ships.
insert into crew_machines (foreman_id, machine_id)
select foreman_id, id from machines
on conflict do nothing;

create index if not exists crew_machines_machine on crew_machines (machine_id);

alter table crew_machines enable row level security;
drop policy if exists "anon full access" on crew_machines;
create policy "anon full access" on crew_machines
  for all using (true) with check (true);

-- machines.foreman_id stays, and stops meaning ownership: it now records
-- which crew first entered the machine. Kept because it is NOT NULL and
-- because knowing who created a row is worth having when two rows turn
-- out to describe one machine.
comment on column machines.foreman_id is
  'The crew that first entered this machine. Not ownership — see crew_machines.';

-- Still no unique constraint on unit_no. It cannot be added until the
-- duplicates are merged, and adding it early would break the merge tool
-- before it has a chance to fix anything.
