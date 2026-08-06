-- Give a machine an identity of its own: the unit number.
--
-- The company already identifies iron by a three-character number —
-- 741, 925, 871R — because a job site with four skid steers on it needs
-- a way to say which one. Today that number lives inside the free-text
-- name ("Bobcat (741)", "John Deere 870(871R)"), where nothing can sort
-- by it, group by it, or match one crew's machine to another's.
--
-- Additive on purpose. Nothing reads these columns yet and nothing
-- behaves differently; this is step one of making the fleet
-- company-wide, and it has to be safe to deploy on its own.

alter table machines add column if not exists unit_no text;
alter table machines add column if not exists make_model text;
alter table machines add column if not exists machine_type text;

-- Deliberately NOT unique yet. The same physical machine may well be
-- entered under two crews right now — that is exactly what the numbers
-- are going to reveal. Making it unique today would stop people
-- recording the truth. The constraint comes with the merge, once the
-- duplicates are known and reconciled.
create index if not exists machines_unit_no
  on machines (upper(unit_no))
  where unit_no is not null;

-- The type list lives in the app (src/lib/machineTypes.ts) rather than a
-- check constraint here: the yard adds a kind of attachment more often
-- than anyone wants to run a migration, and an unknown value should show
-- up as an odd label rather than a failed save.
