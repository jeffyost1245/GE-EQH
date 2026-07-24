# GE-EQH — Machine Hours Log

A dead-simple equipment hours logger for a small crew: pick a machine, pick
your name, log the meter reading. Built for phones on job sites with spotty
signal.

## How it works

- **One shared password** gates the whole app (no individual accounts).
  Inside, each person just picks their name from a dropdown; the phone
  remembers it.
- **Start hours auto-fill**: selecting a machine pre-fills start hours from
  that machine's most recent end hours, however long ago that was.
- **Backfill**: if the previous entry was never closed out (blank end
  hours), your start hours are written into that older entry's end hours
  and it's flagged "auto-filled".
- **Offline queue**: if Supabase is unreachable, entries are saved in the
  phone's local storage and synced automatically when signal returns. A
  banner shows how many entries are waiting.
- **No deleted history**: machines and crew members are marked inactive
  instead of deleted, so old entries stay intact.
- **Dashboard**: current week's (Mon–Sun) hours per machine and per crew
  member. Open entries (no end hours yet) are excluded from totals and
  shown as a hint.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, run it.
3. From **Project Settings → API**, copy the Project URL and the `anon`
   public key.

> Access model: the anon key has full read/write on these tables (permissive
> RLS policies) because the app itself is gated by the shared password. Don't
> use this Supabase project for anything else.

### 2. Run locally

```bash
cp .env.example .env.local   # fill in the three values
npm install
npm run dev
```

### 3. Deploy on Vercel

1. Push this repo to GitHub and import it in Vercel.
2. In **Project Settings → Environment Variables**, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `APP_PASSWORD` — the shared crew password
3. Deploy. Changing `APP_PASSWORD` later signs everyone out.

## First use

Open **Machines** and **Crew** tabs and add your equipment and people, then
start logging from **Log Hours**.
