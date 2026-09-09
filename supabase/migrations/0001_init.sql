-- ============================================================================
-- Thomas.ai — personal finance schema
-- Run this once in Supabase → SQL Editor → New query → Run.
--
-- Every table is scoped to auth.users via user_id, with row level security so
-- a signed-in user can only ever read and write their own rows. The anon key
-- shipped in the frontend therefore grants access to nothing until sign-in.
-- ============================================================================

-- ---------------------------------------------------------------- helpers ---
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------- settings ---
create table if not exists public.settings (
  user_id               uuid primary key references auth.users on delete cascade,
  user_name             text        not null default 'Thomas',
  account_label         text        not null default 'Personal Account',
  base_currency         text        not null default 'AED',
  monthly_income_target numeric(14,2) not null default 0,
  monthly_budget        numeric(14,2) not null default 0,
  period_start          date        not null default current_date,
  period_end            date        not null default current_date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- --------------------------------------------------------------- accounts ---
create table if not exists public.accounts (
  id         text        primary key,
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null,
  type       text        not null check (type in ('bank','cash','card','loan')),
  details    text        not null default '—',
  balance    numeric(14,2) not null default 0,
  currency   text        not null default 'AED',
  status     text        not null default 'Active',
  color      text        not null default '#3b82f6',
  bank       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------- transactions ---
create table if not exists public.transactions (
  id          text        primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  type        text        not null check (type in ('income','expense')),
  date        date        not null,
  description text        not null,
  category    text        not null,
  account_id  text,
  amount      numeric(14,2) not null,
  currency    text        not null default 'AED',
  person      text,
  method      text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- budgets ---
create table if not exists public.budgets (
  id         text        primary key,
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null,
  icon       text        not null default '📦',
  budget     numeric(14,2) not null default 0,
  spent      numeric(14,2) not null default 0,
  color      text        not null default '#3b82f6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ loans ---
create table if not exists public.loans (
  id           text        primary key,
  user_id      uuid        not null references auth.users on delete cascade,
  name         text        not null,
  lender       text        not null default '—',
  outstanding  numeric(14,2) not null default 0,
  principal    numeric(14,2) not null default 0,
  emi          numeric(14,2) not null default 0,
  next_payment date        not null default current_date,
  currency     text        not null default 'AED',
  status       text        not null default 'On Track',
  rate         numeric(6,2) not null default 0,
  icon         text        not null default '🏦',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------- people ---
create table if not exists public.people (
  id         text        primary key,
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null,
  relation   text        not null default 'Contact',
  color      text        not null default '#3b82f6',
  spent      numeric(14,2) not null default 0,
  they_owe   numeric(14,2) not null default 0,
  i_owe      numeric(14,2) not null default 0,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ bills ---
create table if not exists public.bills (
  id         text        primary key,
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null,
  category   text        not null default 'Utilities',
  amount     numeric(14,2) not null default 0,
  due_date   date        not null default current_date,
  frequency  text        not null default 'Monthly',
  status     text        not null default 'Pending',
  autopay    boolean     not null default false,
  icon       text        not null default '📄',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------- documents ---
create table if not exists public.documents (
  id         text        primary key,
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null,
  type       text        not null default 'Other',
  expiry     date        not null,
  owner      text        not null default 'Thomas',
  status     text        not null default 'Valid',
  icon       text        not null default '📄',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ notes ---
create table if not exists public.notes (
  id         text        primary key,
  user_id    uuid        not null references auth.users on delete cascade,
  title      text        not null,
  category   text        not null default 'Personal',
  due_date   date        not null default current_date,
  status     text        not null default 'Pending',
  done       boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ goals ---
create table if not exists public.goals (
  id         text        primary key,
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null,
  target     numeric(14,2) not null default 0,
  saved      numeric(14,2) not null default 0,
  deadline   date        not null default current_date,
  icon       text        not null default '🎯',
  color      text        not null default '#3b82f6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------- purchases ---
create table if not exists public.purchases (
  id              text        primary key,
  user_id         uuid        not null references auth.users on delete cascade,
  item            text        not null,
  store           text        not null default '—',
  category        text        not null default 'Other',
  price           numeric(14,2) not null default 0,
  qty             integer     not null default 1,
  date            date        not null default current_date,
  person          text        not null default 'Me',
  status          text        not null default 'Planned',
  warranty_months integer,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------ price_watch ---
create table if not exists public.price_watch (
  id             text        primary key,
  user_id        uuid        not null references auth.users on delete cascade,
  item           text        not null,
  store          text        not null default '—',
  current_price  numeric(14,2) not null default 0,
  previous_price numeric(14,2) not null default 0,
  target_price   numeric(14,2) not null default 0,
  updated        date        not null default current_date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------- indexes on the user key ---
create index if not exists accounts_user_idx      on public.accounts (user_id);
create index if not exists transactions_user_idx  on public.transactions (user_id, date desc);
create index if not exists budgets_user_idx       on public.budgets (user_id);
create index if not exists loans_user_idx         on public.loans (user_id);
create index if not exists people_user_idx        on public.people (user_id);
create index if not exists bills_user_idx         on public.bills (user_id, due_date);
create index if not exists documents_user_idx     on public.documents (user_id, expiry);
create index if not exists notes_user_idx         on public.notes (user_id, due_date);
create index if not exists goals_user_idx         on public.goals (user_id);
create index if not exists purchases_user_idx     on public.purchases (user_id, date desc);
create index if not exists price_watch_user_idx   on public.price_watch (user_id);

-- ------------------------------------- updated_at triggers on every table ---
do $$
declare t text;
begin
  foreach t in array array[
    'settings','accounts','transactions','budgets','loans','people',
    'bills','documents','notes','goals','purchases','price_watch'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ------------------------------------------------- row level security (RLS) ---
-- Each policy allows a signed-in user to touch only rows carrying their own
-- auth.uid(). Without a session, every table reads as empty and rejects writes.
do $$
declare t text; key text;
begin
  foreach t in array array[
    'settings','accounts','transactions','budgets','loans','people',
    'bills','documents','notes','goals','purchases','price_watch'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own_rows_select" on public.%I', t);
    execute format('drop policy if exists "own_rows_insert" on public.%I', t);
    execute format('drop policy if exists "own_rows_update" on public.%I', t);
    execute format('drop policy if exists "own_rows_delete" on public.%I', t);

    key := 'user_id';

    execute format(
      'create policy "own_rows_select" on public.%I for select to authenticated
         using ((select auth.uid()) = %I)', t, key);
    execute format(
      'create policy "own_rows_insert" on public.%I for insert to authenticated
         with check ((select auth.uid()) = %I)', t, key);
    execute format(
      'create policy "own_rows_update" on public.%I for update to authenticated
         using ((select auth.uid()) = %I) with check ((select auth.uid()) = %I)', t, key, key);
    execute format(
      'create policy "own_rows_delete" on public.%I for delete to authenticated
         using ((select auth.uid()) = %I)', t, key);
  end loop;
end $$;

-- ---------------------------------------------------------------- grants ---
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Anonymous visitors get nothing. RLS already blocks them; this makes it explicit.
revoke all on all tables in schema public from anon;
