-- ============================================================================
-- Thomas.ai — optional weight on expenses.
-- Run in Supabase → SQL Editor → New query → Run, after 0004.
--
-- Grocery lines are usually sold by weight or volume ("Basmati Rice 10kg",
-- "Sunflower Oil 5L"). Recording it makes lines comparable over time — the
-- same item at a different size is no longer mistaken for a price change.
--
-- Both columns are optional and existing rows are untouched.
-- ============================================================================

alter table public.transactions
  add column if not exists weight      numeric(12,3),
  add column if not exists weight_unit text;

comment on column public.transactions.weight is
  'Amount of product bought, in weight_unit. Optional; independent of qty.';
comment on column public.transactions.weight_unit is
  'Unit for weight: kg, g, lb, oz, L or ml.';

-- Keep the unit to a known set so per-unit comparisons stay meaningful,
-- while still allowing both columns to be left empty.
do $$
begin
  alter table public.transactions
    add constraint transactions_weight_unit_check
    check (weight_unit is null or weight_unit in ('kg','g','lb','oz','L','ml'));
exception
  when duplicate_object then null;
end $$;
