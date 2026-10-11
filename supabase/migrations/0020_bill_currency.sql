-- ============================================================================
-- CloudBasket 360 — Per-bill currency.
-- Run in Supabase → SQL Editor → New query → Run, after 0019. Safe to re-run.
--
-- Additive only. Adds bills.currency (defaulting existing rows to AED, which
-- is what every bill was implicitly denominated in before this) so a bill can
-- be set in AED, INR or USD like everything else in the app.
-- ============================================================================

insert into public.schema_info (id, version) values (1, 20)
  on conflict (id) do update set version = excluded.version where public.schema_info.version < 20;

alter table public.bills
  add column if not exists currency text not null default 'AED';

notify pgrst, 'reload schema';
