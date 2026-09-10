-- ============================================================================
-- Thomas.ai — user-managed categories, sub-categories, and card statement cycles.
-- Run in Supabase → SQL Editor → New query → Run, after 0003.
--
-- Categories were hardcoded in the frontend, so they could not be edited.
-- They now live in two tables you own: a category, and sub-categories that
-- hang off it (Groceries → Rice, Oil, Vegetables …).
-- ============================================================================

-- ------------------------------------------------------------- categories ---
create table if not exists public.categories (
  id         text        not null,
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null,
  kind       text        not null default 'expense' check (kind in ('expense','income')),
  icon       text        not null default '📦',
  color      text        not null default '#3b82f6',
  sort       integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- One name per kind per user, so the pickers never show duplicates.
create unique index if not exists categories_unique_name
  on public.categories (user_id, kind, lower(name));

-- --------------------------------------------------------- sub-categories ---
create table if not exists public.subcategories (
  id          text        not null,
  user_id     uuid        not null references auth.users on delete cascade,
  category_id text        not null,
  name        text        not null,
  sort        integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id),
  -- Deleting a category takes its sub-categories with it.
  constraint subcategories_category_fk
    foreign key (user_id, category_id) references public.categories (user_id, id) on delete cascade
);

create index if not exists subcategories_category_idx on public.subcategories (user_id, category_id);
create unique index if not exists subcategories_unique_name
  on public.subcategories (user_id, category_id, lower(name));

-- ------------------------------------------- sub-category on transactions ---
alter table public.transactions
  add column if not exists subcategory text;

comment on column public.transactions.subcategory is
  'Free text, matched against the sub-categories of the chosen category.';

-- ------------------------------------------------ credit card statements ---
-- A card expense belongs to the statement period it falls in, and that
-- statement is paid later. Both days are per-card, so they live on the account.
alter table public.accounts
  add column if not exists statement_day integer check (statement_day between 1 and 31),
  add column if not exists due_day       integer check (due_day between 1 and 31);

comment on column public.accounts.statement_day is
  'Day of month the statement closes, e.g. 25 means the period runs 26th to 25th.';
comment on column public.accounts.due_day is
  'Day of the following month the statement payment is due.';

-- ---------------------------------------------------------------- rls -------
-- Same policy shape as every other table: a signed-in user sees only their rows.
do $$
declare t text;
begin
  foreach t in array array['categories','subcategories'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own_rows_select" on public.%I', t);
    execute format('drop policy if exists "own_rows_insert" on public.%I', t);
    execute format('drop policy if exists "own_rows_update" on public.%I', t);
    execute format('drop policy if exists "own_rows_delete" on public.%I', t);

    execute format(
      'create policy "own_rows_select" on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own_rows_insert" on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own_rows_update" on public.%I for update to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own_rows_delete" on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)', t);

    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.subcategories to authenticated;
revoke all on public.categories from anon;
revoke all on public.subcategories from anon;
