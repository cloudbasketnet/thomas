# Thomas.ai — Your Money. Smarter Life.

Personal finance workspace for **Thomas** — money, purchases, expenses, income and accounts in one fast app.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 7** | Instant HMR, ~4s production builds |
| UI | **React 19 + TypeScript** | Type-safe components, strict mode on |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | No PostCSS config, CSS-first theme tokens |
| Charts | **Recharts 2** | Responsive donuts, bars and trend lines |
| State | **Zustand + persist** | Tiny store, auto-saves to localStorage |
| Backend | **Supabase** (Postgres + Auth) | 12 RLS-scoped tables, email/password sign-in |
| Routing | **React Router 7** (hash router) | Works from `file://` and any static host |
| Icons | **lucide-react** | Consistent 1.5px stroke icon set |

## Setup

### 1. Create the database tables

Open **Supabase → SQL Editor → New query**, paste the whole of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and Run.

It creates 12 tables (`settings`, `accounts`, `transactions`, `budgets`, `loans`, `people`, `bills`,
`documents`, `notes`, `goals`, `purchases`, `price_watch`), plus indexes, `updated_at` triggers, and
**row level security** on every one — each policy matches `auth.uid() = user_id`, so a signed-in user
can only ever touch their own rows and the anon key alone reads nothing.

### 2. Point the app at your project

`.env.local` (git-ignored) holds:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Only the **anon** key belongs here. The service_role key bypasses RLS and must never reach the browser.

### 3. Sign in

Run the app and create an account on the sign-in screen. The first sign-in seeds your tables with the
demo dataset so the dashboard isn't blank; replace it with real figures, or reset from Settings.

> Without the env vars the app still runs in **local-only mode** — no sign-in, data persists to
> localStorage. That makes the UI usable before the database exists.

## Run

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # dist/ — static, deploy anywhere
npm run preview  # serve the production build
npm run lint     # tsc type check
```

## Features

- **Dashboard** — greeting, AI month plan, 5 KPI cards, income vs expenses, budget progress, spend by person, loan tracker, currency converter, document expiry, notes, savings goals, report shortcuts.
- **Accounts** — banks, cash wallets, credit cards and loan accounts; multi-currency balances rolled up into AED; balance-mix donut; add / edit / delete.
- **Income** — totals vs target, category donut, per-account split, monthly trend, full transaction ledger.
- **Expenses** — same ledger engine, plus payment-method breakdown and budget status.
- **Purchases** — purchase management: Planned → Ordered → Delivered → Returned, warranty months, per-store and per-category analysis.
- **Budget** — inline-editable category budgets, budget vs actual chart, spending overview, monthly period settings.
- **Loans** — outstanding, EMI, interest rate, repayment progress, record-a-payment, overdue alerts, multi-currency (AED + INR).
- **People** — who you spend on, who owes you, who you owe; click a person for their transactions.
- **Bills & Subscriptions** — due dates, autopay toggles, mark-paid, recurring totals.
- **Documents** — Emirates ID, visa, licence, mulkiya…; live expiry status and day counters.
- **Notes & Follow Up** — categorised to-dos with status and overdue tracking.
- **Price Tracker** — watchlist with previous/current/target prices; editing the current price keeps the old one for comparison.
- **Shopping Assistant** — build a list, see the total before you go, budget-aware suggestions.
- **Savings Goals** — targets, contributions, required monthly saving.
- **Reports** — monthly summary, category, loan, document-expiry and notes reports + CSV export.
- **Calendar** — every transaction, EMI, bill, expiry and note on a month grid.
- **Settings** — profile, targets, FX rates, JSON backup / restore / reset.

## Data flow

The Zustand store stays the single source of truth for the UI. Every mutation updates local state
immediately, then writes through to Postgres in the background — the UI never blocks on the network, and
a failed write surfaces in the user menu and on Settings rather than being silently lost.

```
page → store action → optimistic set()  → UI updates now
                    → upsert/delete     → Postgres (RLS-scoped)
```

On sign-in the app pulls all twelve tables in parallel, or seeds them if the account is new.
**Settings → Cloud Sync** exposes manual *Push to Cloud* / *Pull from Cloud* for when you want to force
either direction. `src/lib/mappers.ts` maps camelCase domain fields to snake_case columns.

Seed data lives in `src/data/seed.ts` (September 2026, AED base with INR at 0.0434). **Settings → Export**
writes a JSON backup; **Reset** restores the seed set.

## Structure

```
src/
  components/     Layout, Sidebar, Topbar, shared modals, LedgerPage
    ui/           Card, StatCard, Badge, Progress, Modal primitives
    charts/       Recharts wrappers (Donut, bars, trend line)
  pages/          One file per route
  store/          Zustand store with CRUD for every entity
  lib/            format.ts (money, dates) · selectors.ts (all derived totals)
  data/seed.ts    Demo dataset + FX rates
  types.ts        Domain types
supabase/
  migrations/     0001_init.sql — tables, indexes, triggers, RLS policies
```

## Security notes

- Only the anon key is bundled. RLS makes it useless without a session.
- `.env.local` is git-ignored; `.env.example` documents the shape.
- If a service_role key is ever exposed, rotate it in **Supabase → Settings → API**.
