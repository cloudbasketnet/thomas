-- ============================================================================
-- Thomas.ai — carry purchase detail on expense transactions.
-- Run in Supabase → SQL Editor → New query → Run, after 0002.
--
-- Purchases used to live in their own table that nothing else read: money
-- recorded there never reached expense totals, budgets or reports. Purchases
-- are now ordinary expense transactions, so the three fields that only
-- purchases carried move onto the transactions table.
--
-- All three are optional. Existing rows are untouched and stay valid.
-- ============================================================================

alter table public.transactions
  add column if not exists store           text,
  add column if not exists qty             numeric(12,2),
  add column if not exists warranty_months integer;

comment on column public.transactions.store is
  'Merchant or shop the money went to. Drives the by-store breakdown in the expense report.';
comment on column public.transactions.qty is
  'Units bought. amount is always the line total, so unit price is amount / qty.';
comment on column public.transactions.warranty_months is
  'Warranty length in months, for things worth tracking after purchase.';

-- Reporting groups by store, so give that its own index.
create index if not exists transactions_store_idx
  on public.transactions (user_id, store)
  where store is not null;

-- The old purchases table is deliberately left in place rather than dropped:
-- it may still hold rows, and dropping it is not reversible. The application
-- no longer reads or writes it. Once you have confirmed nothing there is
-- needed, you can remove it yourself with:
--
--   drop table if exists public.purchases;
