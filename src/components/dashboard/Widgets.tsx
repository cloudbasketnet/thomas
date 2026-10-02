import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, ArrowRight, BarChart3, Bell, CalendarClock, CreditCard, FileText, Landmark, Lightbulb,
  PiggyBank, Receipt, ShieldCheck, Sparkles, Star, StickyNote, TrendingUp, Wallet,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Badge, Card, CardHead, Progress, ViewAll } from '@/components/ui/Primitives'
import { CashFlowLine, DayBars, Gauge, PALETTE } from '@/components/charts/Charts'
import { TODAY, money, pct, shortDate } from '@/lib/format'
import { byCategory, statementFor } from '@/lib/selectors'
import { cardFigures } from '@/lib/ledger'
import { accountMonth, actionCentre, cashFlow, dailySpend, duePayments, safeToSpend, type DueRow } from '@/lib/dashboard'
import { hardWarnings } from '@/lib/insights'

const DAY_OPTIONS = [7, 14, 30]

/** Shared hook: a set of transaction ids, for "has this instalment been paid?". */
function useTxnIds() {
  const transactions = useStore((s) => s.transactions)
  return useMemo(() => new Set(transactions.map((t) => t.id)), [transactions])
}

// ---------------------------------------------------------------------------
// Safe to spend
// ---------------------------------------------------------------------------

export function SafeToSpendBar() {
  const { accounts, loans, bills, notes, goals } = useStore()
  const ids = useTxnIds()
  const s = useMemo(
    () => safeToSpend(accounts, loans, bills, notes, goals, (id) => ids.has(id)),
    [accounts, loans, bills, notes, goals, ids],
  )

  const alerts = s.overdue.length + s.dueToday.length
  const tight = s.safe < 0

  return (
    <div className="card flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tight ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}
        >
          <ShieldCheck size={20} />
        </span>
        <div>
          <p className="text-[12px] font-semibold text-slate-500">Safe to spend</p>
          <p className={`text-[22px] font-extrabold tracking-tight ${tight ? 'text-rose-600' : 'text-emerald-600'}`}>
            {money(s.safe)}
          </p>
        </div>
      </div>

      <div className="min-w-[240px] flex-1 border-l border-[#eef2f8] pl-6 max-sm:border-l-0 max-sm:pl-0">
        <p className="text-[12px] text-slate-600">
          Balance <b className="tabular-nums">{money(s.balance)}</b> − reserved for payments{' '}
          <b className="tabular-nums">{money(s.reserved)}</b> − savings <b className="tabular-nums">{money(s.savings)}</b>
        </p>
        <p className="mt-0.5 text-[11.5px] text-slate-400">
          {tight
            ? 'Your commitments this month come to more than your available balance.'
            : 'This is what you can spend freely before this month’s commitments.'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-full ${alerts ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
          <AlertCircle size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-slate-800">
            {alerts
              ? `${alerts} payment${alerts === 1 ? '' : 's'} ${s.overdue.length ? 'overdue or due today' : 'due today'}`
              : 'Nothing due today'}
          </p>
          <p className="text-[11px] text-slate-400">Keep your accounts up to date.</p>
        </div>
        <Link to="/installments" className="btn-primary h-9">
          Review <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Daily expenses
// ---------------------------------------------------------------------------

export function DailyExpensesCard() {
  const transactions = useStore((s) => s.transactions)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const days = settings.extra?.dailyChartDays ?? 7

  const data = useMemo(() => dailySpend(transactions, days), [transactions, days])
  const today = data[data.length - 1]?.value ?? 0
  const average = data.length ? Math.round(data.reduce((n, d) => n + d.value, 0) / data.length) : 0

  return (
    <Card className="xl:col-span-7">
      <CardHead
        title="Daily Expenses"
        sub={`Daily spending · average ${money(average)} a day`}
        right={
          <select
            className="input h-8 w-[112px] text-[12px]"
            value={days}
            onChange={(e) => updateSettings({ extra: { ...settings.extra, dailyChartDays: Number(e.target.value) } })}
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        }
      />
      <div className="px-5 pb-5">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[11.5px] text-slate-400">Today’s spending</span>
          <span className="text-[18px] font-extrabold tracking-tight text-rose-600">{money(today)}</span>
        </div>
        <DayBars data={data} />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Favourite bank
// ---------------------------------------------------------------------------

export function FavouriteBankCard() {
  const { accounts, transactions, settings, updateSettings } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const banks = accounts.filter((a) => a.type !== 'card' && a.type !== 'loan' && a.status !== 'Closed')
  const chosen = banks.find((a) => a.id === settings.extra?.favouriteAccountId) ?? banks[0]

  const month = useMemo(
    () => (chosen ? accountMonth(transactions, chosen.id) : { spent: 0, received: 0 }),
    [transactions, chosen],
  )
  const limit = chosen ? settings.extra?.accountLimits?.[chosen.id] : undefined

  if (!chosen) {
    return (
      <Card className="xl:col-span-5">
        <CardHead title="Favourite Bank" sub="Pin one account to watch here" />
        <div className="px-5 pb-8 pt-2 text-center">
          <Landmark size={26} className="mx-auto text-slate-300" />
          <p className="mt-2 text-[12.5px] text-slate-400">No bank, cash or savings account yet.</p>
          <Link to="/accounts" className="btn-soft mt-3 inline-flex">Add an account</Link>
        </div>
      </Card>
    )
  }

  const balance = chosen.balance
  // Scale the dial to the limit when one is set, otherwise to a round number
  // above whatever the account actually holds — never to an invented target.
  const max = limit && limit > 0 ? Math.max(limit, balance) : niceMax(Math.max(balance, month.spent, 1))

  const saveLimit = () => {
    const n = Number(draft)
    const next = { ...(settings.extra?.accountLimits ?? {}) }
    if (Number.isFinite(n) && n > 0) next[chosen.id] = n
    else delete next[chosen.id]
    updateSettings({ extra: { ...settings.extra, accountLimits: next } })
    setEditing(false)
  }

  return (
    <Card className="xl:col-span-5">
      <CardHead
        title="Favourite Bank"
        sub={chosen.details || chosen.bank || 'Main account'}
        right={
          <div className="flex items-center gap-2">
            <select
              className="input h-8 max-w-[150px] text-[12px]"
              value={chosen.id}
              onChange={(e) => updateSettings({ extra: { ...settings.extra, favouriteAccountId: e.target.value } })}
            >
              {banks.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Star size={16} className="fill-amber-400 text-amber-400" />
          </div>
        }
      />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[1.1fr_1fr]">
        <Gauge
          value={balance}
          max={max}
          centerValue={money(balance, chosen.currency)}
          centerLabel="Available balance"
        />
        <div className="space-y-3 self-center">
          <MiniRow icon={<Receipt size={15} />} tint="#f43f5e" label="Spent this month" value={money(month.spent)} />
          <MiniRow icon={<TrendingUp size={15} />} tint="#22c55e" label="Received this month" value={money(month.received)} />
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Monthly limit</span>
              {editing ? (
                <span className="flex items-center gap-1">
                  <input
                    className="input h-7 w-20 text-right text-[11.5px]"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveLimit()}
                  />
                  <button className="text-[11px] font-bold text-brand-600 cursor-pointer" onClick={saveLimit}>
                    Save
                  </button>
                </span>
              ) : (
                <button
                  className="text-[11.5px] font-bold text-slate-700 hover:text-brand-600 cursor-pointer"
                  onClick={() => {
                    setDraft(limit ? String(limit) : '')
                    setEditing(true)
                  }}
                >
                  {limit ? money(limit) : 'Set a limit'}
                </button>
              )}
            </div>
            {limit ? (
              <>
                <Progress value={month.spent} max={limit} color={month.spent > limit ? '#ef4444' : '#f59e0b'} height={6} />
                <p className="mt-1 text-[10.5px] text-slate-400">{pct(month.spent, limit)}% of the limit used</p>
              </>
            ) : (
              <p className="text-[10.5px] text-slate-400">Set one to track spending on this account.</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Credit card balance
// ---------------------------------------------------------------------------

export function CreditCardCard() {
  const { accounts, settings, updateSettings } = useStore()
  const cards = accounts.filter((a) => a.type === 'card' && a.status !== 'Closed')
  const chosen = cards.find((a) => a.id === settings.extra?.favouriteCardId) ?? cards[0]

  if (!chosen) {
    return (
      <Card className="xl:col-span-5">
        <CardHead title="Credit Card Balance" />
        <div className="px-5 pb-8 pt-2 text-center">
          <CreditCard size={26} className="mx-auto text-slate-300" />
          <p className="mt-2 text-[12.5px] text-slate-400">No credit card added yet.</p>
          <Link to="/accounts" className="btn-soft mt-3 inline-flex">Add a card</Link>
        </div>
      </Card>
    )
  }

  const fig = cardFigures(chosen)
  const statement = chosen.statementDay && chosen.dueDay ? statementFor(TODAY, chosen.statementDay, chosen.dueDay) : null
  const dueDays = statement ? dayGap(statement.due) : null
  const max = fig.limit && fig.limit > 0 ? fig.limit : niceMax(Math.max(fig.owed, 1))

  return (
    <Card className="xl:col-span-5">
      <CardHead
        title="Credit Card Balance"
        sub={chosen.details || chosen.name}
        right={
          cards.length > 1 ? (
            <select
              className="input h-8 max-w-[150px] text-[12px]"
              value={chosen.id}
              onChange={(e) => updateSettings({ extra: { ...settings.extra, favouriteCardId: e.target.value } })}
            >
              {cards.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[1.1fr_1fr]">
        <Gauge
          value={fig.owed}
          max={max}
          centerValue={money(fig.owed, chosen.currency)}
          centerLabel="Outstanding balance"
          segments={[
            { to: 0.3, color: '#22c55e' },
            { to: 0.7, color: '#f59e0b' },
            { to: 1, color: '#ef4444' },
          ]}
        />
        <div className="space-y-3 self-center">
          <MiniRow
            icon={<CreditCard size={15} />}
            tint="#3b82f6"
            label="Credit limit"
            value={fig.limit ? money(fig.limit, chosen.currency) : 'Not set'}
          />
          <MiniRow
            icon={<Wallet size={15} />}
            tint="#22c55e"
            label="Available credit"
            value={fig.available !== undefined ? money(fig.available, chosen.currency) : '—'}
          />
          <MiniRow
            icon={<BarChart3 size={15} />}
            tint="#f59e0b"
            label="Minimum due (est. 5%)"
            value={money(Math.round(fig.owed * 0.05), chosen.currency)}
            hint="A common rule of thumb — your statement gives the real figure."
          />
          {statement && (
            <div className={`rounded-xl px-3 py-2.5 ${dueDays !== null && dueDays <= 3 ? 'bg-rose-50' : 'bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">Payment due</span>
                <span className="text-[12px] font-bold text-slate-800">{shortDate(statement.due)}</span>
              </div>
              {dueDays !== null && (
                <p className={`mt-0.5 text-[11px] font-semibold ${dueDays <= 3 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {dueDays < 0 ? `${-dueDays} days overdue` : dueDays === 0 ? 'Due today' : `${dueDays} days left`}
                </p>
              )}
            </div>
          )}
          {fig.limit ? (
            <div>
              <Progress value={fig.owed} max={fig.limit} color={fig.owed / fig.limit > 0.7 ? '#ef4444' : '#f59e0b'} height={6} />
              <p className="mt-1 text-[10.5px] text-slate-400">{pct(fig.owed, fig.limit)}% of the limit used</p>
            </div>
          ) : (
            <p className="text-[10.5px] text-slate-400">Add a credit limit on the Accounts page to see utilisation.</p>
          )}
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Instalments & due dates
// ---------------------------------------------------------------------------

export function DuePaymentsCard() {
  const { loans, bills, notes } = useStore()
  const ids = useTxnIds()
  const rows = useMemo(
    () => duePayments(loans, bills, notes, (id) => ids.has(id), 60).slice(0, 6),
    [loans, bills, notes, ids],
  )

  return (
    <Card className="xl:col-span-7">
      <CardHead title="Instalments & Due Dates" sub="Everything still to pay in the next 60 days" right={<ViewAll to="/installments" />} />
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[560px]">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="th">Description</th>
              <th className="th">Amount</th>
              <th className="th">Due date</th>
              <th className="th">Days left</th>
              <th className="th text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {rows.length === 0 && (
              <tr>
                <td className="td py-8 text-center text-slate-400" colSpan={5}>
                  Nothing due in the next 60 days.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="row-hover">
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${dueTint(r)}1a`, color: dueTint(r) }}>
                      {r.kind === 'loan' ? <Landmark size={15} /> : r.kind === 'bill' ? <Receipt size={15} /> : <CalendarClock size={15} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold text-slate-800">{r.title}</p>
                      <p className="truncate text-[10.5px] text-slate-400">{r.sub}</p>
                    </div>
                  </div>
                </td>
                <td className="td font-bold">{money(r.amount, r.currency)}</td>
                <td className="td text-slate-500">{shortDate(r.dueDate)}</td>
                <td className="td">
                  <Badge tone={r.days < 0 ? 'red' : r.days === 0 ? 'red' : r.days <= 7 ? 'amber' : 'green'}>
                    {r.days < 0 ? `${-r.days} days overdue` : r.days === 0 ? 'Due today' : `${r.days} days left`}
                  </Badge>
                </td>
                <td className="td text-right">
                  <Link
                    to={r.kind === 'loan' ? '/loans' : r.kind === 'bill' ? '/bills' : '/installments'}
                    className="btn-soft h-8 px-3 text-[11.5px]"
                  >
                    {r.days <= 0 ? 'Pay now' : 'Open'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Expense categories
// ---------------------------------------------------------------------------

export function ExpenseCategoriesCard() {
  const transactions = useStore((s) => s.transactions)
  const rows = useMemo(() => byCategory(transactions, 'expense').slice(0, 6), [transactions])
  const total = rows.reduce((n, r) => n + r.value, 0)

  return (
    <Card className="xl:col-span-4">
      <CardHead title="Expense Categories" right={<span className="chip bg-slate-100 text-slate-500">This month</span>} />
      <div className="space-y-3 px-5 pb-5">
        {rows.length === 0 && <p className="py-8 text-center text-[12.5px] text-slate-400">Nothing spent yet this month.</p>}
        {rows.map((r, i) => (
          <div key={r.name}>
            <div className="mb-1.5 flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="flex-1 truncate text-[12.5px] font-semibold text-slate-700">{r.name}</span>
              <span className="tabular-nums text-[11.5px] font-bold text-slate-800">{money(r.value)}</span>
              <span className="w-9 text-right tabular-nums text-[11px] font-bold text-slate-400">{pct(r.value, total)}%</span>
            </div>
            <Progress value={r.value} max={total} color={PALETTE[i % PALETTE.length]} height={7} />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 30-day cash flow
// ---------------------------------------------------------------------------

export function CashFlowCard() {
  const { accounts, transactions, transfers, loans, bills, notes } = useStore()
  const ids = useTxnIds()
  const flow = useMemo(
    () => cashFlow(accounts, transactions, transfers, loans, bills, notes, (id) => ids.has(id)),
    [accounts, transactions, transfers, loans, bills, notes, ids],
  )

  return (
    <Card className="xl:col-span-8">
      <CardHead
        title="30-Day Cash Flow Forecast"
        sub="The last week as recorded, then a projection from your commitments and recent spending"
        right={<span className="chip bg-slate-100 text-slate-500">Next 30 days</span>}
      />
      <div className="px-5 pb-5">
        <CashFlowLine data={flow.points} />
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-slate-500">
          <span>
            Projected balance in 30 days{' '}
            <b className={flow.projected < 0 ? 'text-rose-600' : 'text-slate-800'}>{money(flow.projected)}</b>
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-400">
            Estimate — uses {money(flow.dailyBurn)} a day, your 30-day average, plus known payments.
          </span>
        </p>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Savings goal
// ---------------------------------------------------------------------------

export function SavingsGoalCard({ className = 'xl:col-span-4' }: { className?: string }) {
  const goals = useStore((s) => s.goals)
  const top = [...goals].sort((a, b) => b.saved / Math.max(1, b.target) - a.saved / Math.max(1, a.target))[0]

  return (
    <Card className={className}>
      <CardHead title="Savings Goal" right={<ViewAll to="/goals" />} />
      <div className="px-5 pb-5">
        {!top ? (
          <div className="py-10 text-center">
            <PiggyBank size={28} className="mx-auto text-slate-300" />
            <p className="mt-2 text-[12.5px] text-slate-400">No savings goal yet.</p>
            <Link to="/goals" className="btn-soft mt-3 inline-flex">Add a goal</Link>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[22px]" style={{ background: `${top.color}1a` }}>
                {top.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-slate-700">{top.name}</p>
                <p className="text-[22px] font-extrabold tracking-tight text-slate-900">
                  {money(top.saved, top.currency)}{' '}
                  <span className="text-[14px] font-bold text-slate-400">/ {money(top.target, top.currency)}</span>
                </p>
              </div>
            </div>
            <p className="mt-2 text-[12px] font-bold" style={{ color: top.color }}>
              {pct(top.saved, top.target)}% complete
            </p>
            <div className="mt-1.5">
              <Progress value={top.saved} max={top.target} color={top.color} height={9} />
            </div>
            <p className="mt-2 text-[11.5px] text-slate-400">
              {money(Math.max(0, top.target - top.saved), top.currency)} left · target {shortDate(top.deadline)}
            </p>
            <Link to="/goals" className="btn-soft mt-4 w-full">
              <PiggyBank size={14} /> Add savings
            </Link>
          </>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Recent transactions
// ---------------------------------------------------------------------------

export function RecentTransactionsCard() {
  const { transactions, accounts } = useStore()
  const rows = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [transactions],
  )
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—'

  return (
    <Card className="xl:col-span-5">
      <CardHead title="Recent Transactions" right={<ViewAll to="/expenses" />} />
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[460px]">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="th">Date</th>
              <th className="th">Description</th>
              <th className="th">Account</th>
              <th className="th text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {rows.length === 0 && (
              <tr>
                <td className="td py-8 text-center text-slate-400" colSpan={4}>
                  Nothing recorded yet.
                </td>
              </tr>
            )}
            {rows.map((t) => (
              <tr key={t.id} className="row-hover">
                <td className="td whitespace-nowrap text-slate-500">{shortDate(t.date)}</td>
                <td className="td">
                  <p className="truncate text-[12.5px] font-semibold text-slate-800">{t.description || t.category}</p>
                  <p className="truncate text-[10.5px] text-slate-400">{t.category}</p>
                </td>
                <td className="td truncate text-slate-500">{nameOf(t.accountId)}</td>
                <td className={`td text-right font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.type === 'income' ? '+' : '−'}
                  {money(t.amount, t.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Action centre
// ---------------------------------------------------------------------------

const TONES: Record<string, { bg: string; fg: string }> = {
  rose: { bg: 'bg-rose-50', fg: 'text-rose-600' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-600' },
  blue: { bg: 'bg-blue-50', fg: 'text-blue-600' },
  violet: { bg: 'bg-violet-50', fg: 'text-violet-600' },
}

const ACTION_ICONS: Record<string, typeof Receipt> = {
  bills: Receipt,
  documents: FileText,
  notes: StickyNote,
  installments: CalendarClock,
}

export function ActionCentreCard() {
  const { bills, documents, notes } = useStore()
  const ids = useTxnIds()
  const items = useMemo(() => actionCentre(bills, documents, notes, (id) => ids.has(id)), [bills, documents, notes, ids])

  return (
    <Card className="xl:col-span-3">
      <CardHead title="Action Centre" right={<Bell size={16} className="text-slate-400" />} />
      <div className="space-y-2 px-5 pb-5">
        {items.length === 0 && (
          <p className="py-10 text-center text-[12.5px] text-slate-400">Nothing needs your attention.</p>
        )}
        {items.map((a) => {
          const Icon = ACTION_ICONS[a.key] ?? Bell
          const tone = TONES[a.tone] ?? TONES.blue
          return (
            <Link key={a.key} to={a.to} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone.bg} ${tone.fg}`}>
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-slate-800">{a.label}</p>
                <p className="truncate text-[10.5px] text-slate-400">{a.detail}</p>
              </div>
              <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white ${a.tone === 'rose' ? 'bg-rose-500' : a.tone === 'amber' ? 'bg-amber-500' : a.tone === 'violet' ? 'bg-violet-500' : 'bg-blue-500'}`}>
                {a.count}
              </span>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Insight
// ---------------------------------------------------------------------------

export function InsightCard() {
  const { transactions, budgets, bills, loans, settings } = useStore()
  const warnings = useMemo(
    () => hardWarnings(transactions, budgets, bills, loans, settings),
    [transactions, budgets, bills, loans, settings],
  )
  const top = warnings[0]

  return (
    <Card className="xl:col-span-4">
      <CardHead title="Insight" right={<Sparkles size={16} className="text-brand-500" />} />
      <div className="space-y-2.5 px-5 pb-5">
        {!top ? (
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-[12.5px] font-bold text-emerald-900">Nothing over budget right now.</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-emerald-800">
                No budget line is past its limit and no bill or loan payment is overdue.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3.5">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-amber-900">{top.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-800">{top.detail}</p>
            </div>
          </div>
        )}
        {warnings.slice(1, 3).map((w) => (
          <div key={w.title} className="flex items-start gap-2.5 px-1">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-[11.5px] leading-relaxed text-slate-600">
              <b className="text-slate-800">{w.title}.</b> {w.detail}
            </p>
          </div>
        ))}
        <Link to="/reports" className="btn-soft w-full">
          <BarChart3 size={14} /> See the full picture
        </Link>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// small pieces
// ---------------------------------------------------------------------------

function MiniRow({
  icon,
  tint,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  tint: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-2.5" title={hint}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${tint}1a`, color: tint }}>
        {icon}
      </span>
      <span className="flex-1 truncate text-[11.5px] text-slate-500">{label}</span>
      <span className="shrink-0 text-[12.5px] font-bold text-slate-800">{value}</span>
    </div>
  )
}

function dueTint(r: DueRow) {
  return r.kind === 'loan' ? '#8b5cf6' : r.kind === 'bill' ? '#f59e0b' : '#3b82f6'
}

/** Round a dial's top end up to a readable number (1, 2 or 5 × a power of ten). */
function niceMax(n: number) {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, n))))
  const r = n / mag
  const step = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10
  return step * mag
}

function dayGap(iso: string) {
  const a = new Date(TODAY + 'T00:00:00').getTime()
  const b = new Date(iso + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}
