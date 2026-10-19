-- ============================================================================
-- CloudBasket 360 — Plan fields for the Vision Board.
-- Run in Supabase → SQL Editor → New query → Run, after 0020. Safe to re-run.
--
-- Additive only. Each dream becomes a plan with a category and a start date,
-- so its progress can be measured against how much of its time has passed.
-- Existing rows keep working with both left empty.
-- ============================================================================

insert into public.schema_info (id, version) values (1, 21)
  on conflict (id) do update set version = excluded.version where public.schema_info.version < 21;

alter table public.dreams
  add column if not exists category   text,
  add column if not exists start_date date;

notify pgrst, 'reload schema';
