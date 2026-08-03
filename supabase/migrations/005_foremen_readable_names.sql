-- The superintendent's screens label every row with the crew it belongs
-- to, which means reading foremen.name alongside entries and machines.
-- Migration 003 revoked the table wholesale to protect the password
-- hashes, so those reads were refused and his pages failed to load.
--
-- Grant the harmless columns only. Column-level privileges mean a query
-- naming crew_password_hash or admin_password_hash is still rejected
-- outright — including select * — so the hashes stay exactly as
-- unreadable as before. The policy below governs which rows are visible,
-- not which columns, which is why both pieces are needed.

grant select (id, name, status, sort_order, role, created_at)
  on foremen to anon, authenticated;

drop policy if exists "names are readable" on foremen;
create policy "names are readable" on foremen
  for select using (true);
