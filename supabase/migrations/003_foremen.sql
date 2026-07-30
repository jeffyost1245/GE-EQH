-- Multiple crews, one per foreman. Each foreman has their own machines,
-- crew list, entries, and pair of passwords; nothing is shared.
--
-- Passwords live here rather than in environment variables because a new
-- foreman would otherwise mean a new deploy-time variable. They are
-- bcrypt hashes in a table the anon key cannot read at all — the only way
-- in is the verify function below, which never returns the hash.

create extension if not exists pgcrypto;

create table if not exists foremen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order int not null default 0,
  crew_password_hash text not null,
  admin_password_hash text not null,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: the anon key cannot read, write, or even see
-- that a row exists. Everything goes through the functions below.
alter table foremen enable row level security;
revoke all on foremen from anon, authenticated;

-- Names for the login dropdown. Deliberately returns no password data.
create or replace function list_foremen()
returns table (id uuid, name text)
language sql
security definer
set search_path = public
stable
as $$
  select f.id, f.name
  from foremen f
  where f.status = 'active'
  order by f.sort_order, f.name;
$$;

-- Password check. Returns only true/false, so hashes never leave the
-- database even though the anon key may call this.
create or replace function verify_foreman_password(
  p_foreman uuid,
  p_password text,
  p_kind text
)
returns boolean
language plpgsql
security definer
-- pgcrypto lives in the "extensions" schema on Supabase; a function pinned
-- to public alone cannot see crypt(), and every password check fails at
-- runtime. The call below is schema-qualified as well, so resolution never
-- depends on the caller's search_path.
set search_path = public, extensions
as $$
declare
  stored text;
begin
  if p_kind not in ('crew', 'admin') then
    return false;
  end if;

  select case when p_kind = 'crew' then crew_password_hash
              else admin_password_hash end
    into stored
  from foremen
  where id = p_foreman and status = 'active';

  if stored is null then
    return false;
  end if;

  return stored = extensions.crypt(p_password, stored);
end;
$$;

revoke all on function list_foremen() from public;
revoke all on function verify_foreman_password(uuid, text, text) from public;
grant execute on function list_foremen() to anon, authenticated;
grant execute on function verify_foreman_password(uuid, text, text)
  to anon, authenticated;

-- Every machine, crew member, and entry now belongs to a foreman.
alter table machines add column if not exists foreman_id uuid references foremen (id);
alter table crew     add column if not exists foreman_id uuid references foremen (id);
alter table entries  add column if not exists foreman_id uuid references foremen (id);

-- Seed the two crews. Happy keeps the passwords already in use.
insert into foremen (name, sort_order, crew_password_hash, admin_password_hash)
select 'Happy', 1, crypt('GEcrew2026', gen_salt('bf', 10)),
                   crypt('Homo', gen_salt('bf', 10))
where not exists (select 1 from foremen where name = 'Happy');

insert into foremen (name, sort_order, crew_password_hash, admin_password_hash)
select 'AJ Facemire', 2, crypt('Face', gen_salt('bf', 10)),
                         crypt('Mire', gen_salt('bf', 10))
where not exists (select 1 from foremen where name = 'AJ Facemire');

-- Everything recorded so far was Happy's crew.
update machines set foreman_id = (select id from foremen where name = 'Happy')
  where foreman_id is null;
update crew set foreman_id = (select id from foremen where name = 'Happy')
  where foreman_id is null;
update entries set foreman_id = (select id from foremen where name = 'Happy')
  where foreman_id is null;

alter table machines alter column foreman_id set not null;
alter table crew     alter column foreman_id set not null;
alter table entries  alter column foreman_id set not null;

create index if not exists machines_foreman on machines (foreman_id);
create index if not exists crew_foreman on crew (foreman_id);
create index if not exists entries_foreman on entries (foreman_id, date desc);

-- Share links belong to a crew too, so a shared week shows only that
-- foreman's sheets.
alter table share_links add column if not exists foreman_id uuid references foremen (id);
update share_links set foreman_id = (select id from foremen where name = 'Happy')
  where foreman_id is null;
