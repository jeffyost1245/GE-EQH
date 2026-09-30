-- Employee numbers: the company already has one for every person.
--
-- Two things follow from putting it here. Logging in becomes "pick your
-- crew, type your number", so the app knows who you are instead of
-- asking you to say — no more picking your own name off a dropdown
-- before every entry and every checkout sheet. And someone who leaves
-- loses access the moment their row is retired, which a shared crew
-- password could never do.
--
-- Additive on purpose. Nothing reads these columns yet and no login
-- changes today: the numbers have to be filled in before they can be
-- typed, and that is done on the office screen, not in a migration.
-- Guessing which crew row is which foreman from a name is exactly the
-- kind of thing a person should do with the list in front of them.

alter table crew add column if not exists employee_no text;

-- What the number unlocks. 'hand' logs hours and fills out sheets;
-- 'foreman' additionally reaches the machine and crew screens, which is
-- what the second password does today. The list lives here rather than
-- in the app because it decides access, and an unrecognised value must
-- fail closed instead of showing up as an odd label.
alter table crew add column if not exists role text not null default 'hand';

alter table crew drop constraint if exists crew_role_check;
alter table crew add constraint crew_role_check
  check (role in ('hand', 'foreman', 'superintendent'));

-- One number per person, company-wide, among people still working here.
-- Scoped to active rows for the same reason the unit numbers are: a
-- number belonging to someone who left can be issued again, and blocking
-- that would mean the app disagreeing with the company's own paperwork.
create unique index if not exists crew_employee_no_unique
  on crew (employee_no)
  where employee_no is not null and status = 'active';

-- The office screen. 'owner' reaches nothing but that screen: it manages
-- people and crews, and has no business logging hours or reading a
-- crew's entries.
alter table foremen drop constraint if exists foremen_role_check;
alter table foremen add constraint foremen_role_check
  check (role in ('foreman', 'superintendent', 'owner'));

-- The office login. Sorted last so it sits under the crews rather than
-- among them, and given an unusable admin password for the same reason
-- Spoon has one: the owner never reaches the per-crew admin screens.
insert into foremen (name, sort_order, role, crew_password_hash, admin_password_hash)
select 'Office', 200, 'owner',
       extensions.crypt('Yost', extensions.gen_salt('bf', 10)),
       extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf', 10))
where not exists (select 1 from foremen where role = 'owner');

-- Crew rows are written by the office screen now as well as by a
-- foreman, and both go through the anon key. The existing permissive
-- policy already covers it; this is here to say so out loud.
--
-- Note what is NOT granted: employee numbers sit in `crew`, which the
-- anon key can read. They are not secrets — the foreman knows his
-- crew's numbers and the company prints them on paperwork — but they
-- are login credentials from here on, so verifying one must happen in
-- the database the way foreman passwords do, not by reading the column
-- and comparing in the browser. That function comes with the login
-- change, not with this file.
