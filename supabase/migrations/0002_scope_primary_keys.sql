-- ============================================================================
-- Thomas.ai — scope every primary key to the owning user.
-- Run in Supabase → SQL Editor → New query → Run, after 0001_init.sql.
--
-- 0001 declared `id text primary key`, which is unique across the WHOLE table
-- rather than per user. The demo dataset uses fixed ids ('ac1', 't1', …), so
-- the second person to sign up hits the first person's rows: the insert
-- conflicts, the ON CONFLICT update is refused by the row level security
-- policy (the row belongs to somebody else), and sign-up fails outright.
--
-- Making the key (user_id, id) lets every account carry its own 'ac1' while
-- keeping ids unique within each account. Existing rows are unaffected — id
-- was globally unique before, so no (user_id, id) pair can collide.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'accounts','transactions','budgets','loans','people',
    'bills','documents','notes','goals','purchases','price_watch'
  ] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_pkey');
    execute format('alter table public.%I add primary key (user_id, id)', t);
  end loop;
end $$;

-- PostgREST resolves upserts against the primary key, so the client keeps
-- working unchanged: it already sends user_id on every row it writes.
