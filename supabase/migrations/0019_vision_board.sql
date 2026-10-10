-- ============================================================================
-- CloudBasket 360 — Vision Board.
-- Run in Supabase → SQL Editor → New query → Run, after 0018. Safe to re-run.
--
-- Additive only. Nothing is dropped and no existing row is rewritten.
--
-- What it adds
--   * dreams          — what you are working towards, with a picture and a
--                       progress figure you set by hand
--   * vision_words    — the handful of words kept in front of you
--   * schedule_blocks — the recurring shape of a day (06:00 gym, 22:00 sleep)
--   * activity_log    — where the hours actually went, one row per stretch;
--                       this is the only one that grows with use, so it is
--                       indexed on (user_id, date)
--
-- Until this runs the Vision Board still works — the app keeps these four in
-- the browser and starts syncing them once the tables exist.
-- ============================================================================

insert into public.schema_info (id, version) values (1, 19)
  on conflict (id) do update set version = excluded.version where public.schema_info.version < 19;

-- ------------------------------------------------------------------ dreams ---
create table if not exists public.dreams (
  id          text not null,
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null,
  note        text not null default '',
  image       text,
  emoji       text not null default '⭐',
  color       text not null default '#2563eb',
  progress    integer not null default 0 check (progress between 0 and 100),
  target_date date,
  "order"     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ----------------------------------------------------------- vision_words ---
create table if not exists public.vision_words (
  id         text not null,
  user_id    uuid not null references auth.users on delete cascade,
  word       text not null,
  note       text not null default '',
  emoji      text not null default '✨',
  color      text not null default '#f59e0b',
  "order"    integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- -------------------------------------------------------- schedule_blocks ---
-- `end_at` may be earlier than `start_at`: a block that wraps past midnight,
-- such as sleep from 22:00 to 06:00. The app reads it that way.
create table if not exists public.schedule_blocks (
  id         text not null,
  user_id    uuid not null references auth.users on delete cascade,
  label      text not null,
  kind       text not null default 'other'
             check (kind in ('gym','sleep','rest','work','personal','family','other')),
  start_at   text not null,
  end_at     text not null,
  "order"    integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ------------------------------------------------------------ activity_log ---
create table if not exists public.activity_log (
  id         text not null,
  user_id    uuid not null references auth.users on delete cascade,
  date       date not null,
  kind       text not null default 'other'
             check (kind in ('gym','sleep','rest','work','personal','family','other')),
  minutes    integer not null default 0 check (minutes >= 0),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
-- The one table here that grows with use; every read is "this user, this month".
create index if not exists activity_log_user_date_idx on public.activity_log (user_id, date);

-- ------------------------------------------------------------------- RLS ---
-- Personal to the account owner, like documents and notes: a household member
-- does not see somebody else's dreams or sleep log.
do $$
declare t text;
begin
  foreach t in array array['dreams','vision_words','schedule_blocks','activity_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own_rows_select" on public.%I', t);
    execute format('drop policy if exists "own_rows_insert" on public.%I', t);
    execute format('drop policy if exists "own_rows_update" on public.%I', t);
    execute format('drop policy if exists "own_rows_delete" on public.%I', t);
    execute format(
      'create policy "own_rows_select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own_rows_insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own_rows_update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own_rows_delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
