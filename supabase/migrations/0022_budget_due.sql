-- ============================================================================
-- CloudBasket 360 — Mandatory budgets and their due day.
-- Run in Supabase → SQL Editor → New query → Run, after 0021. Safe to re-run.
--
-- Additive only. A budget can be marked mandatory (rent, school fees) as
-- against optional spending, and given the day of the month it falls due.
-- Existing budgets become optional with no due day.
-- ============================================================================

insert into public.schema_info (id, version) values (1, 22)
  on conflict (id) do update set version = excluded.version where public.schema_info.version < 22;

alter table public.budgets
  add column if not exists mandatory boolean not null default false,
  add column if not exists due_day   integer check (due_day between 1 and 31);

notify pgrst, 'reload schema';
