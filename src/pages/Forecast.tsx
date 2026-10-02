import { useMemo, useState } from 'react'
import {
  AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Coins, Pencil, PieChart, Sparkles, Wallet,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardHead, PageHeader, Badge } from '@/components/ui/Primitives'
import { TrendLine } from '@/components/charts/Charts'
import { TODAY, convert, money } from '@/lib/format'
import { totals } from '@/lib/selectors'
import { situationColor, SITUATION_TONE } from '@/lib/financials'
import { buildForecast, currentMonthPosition, forecastSuggestions, type ForecastMonth } from '@/lib/forecast'
import { incomeForMonth } from '@/lib/income'
import { DEFAULT_THEME } from '@/lib/theme'
import type { Currency } from '@/types'

const addMonth = (ym: string, n: number) => {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthLong = (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const monthShort = (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
const monthTiny = (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' })

export default function Forecast() {
  const {
    settings, accounts, transactions, loans, bills, documents, notes, budgetItems, budgets, people,
    incomeSources, updateSettings,
  } = useStore()
  const [span, setSpan] = useState<6 | 12>(6)
  const [editing, setEditing] = useState(false)

  const reporting = settings.baseCurrency
  const toReport = (a: number, c: Currency) => convert(a, c, reporting)
  const show = (v: number) => money(convert(v, reporting, 'AED'))

  const startMonth = TODAY.slice(0, 7)
  const months = useMemo(() => Array.from({ length: span }, (_, i) => addMonth(startMonth, i)), [startMonth, span])

  const extra = settings.extra ?? {}
  const theme = { ...DEFAULT_THEME, ...(extra.theme ?? {}) }

  // The forecast's "Budget" is what you have actually planned in Budget
  // Categories, added up — not the separate flat Total Budget target.
  const baseBudget = budgets.reduce((n, b) => n + toReport(b.budget, b.currency ?? 'AED'), 0)
  const baseIncome = settings.monthlyIncomeTarget > 0 ? toReport(settings.monthlyIncomeTarget, settings.baseCurrency) : 0

  const budgetFor = (m: string) =>
    extra.futureBudgets?.[m] !== undefined ? toReport(extra.futureBudgets[m], settings.baseCurrency) : baseBudget
  const incomeFor = (m: string) => {
    if (extra.futureIncome?.[m] !== undefined) return toReport(extra.futureIncome[m], settings.baseCurrency)
    // Income Planning's own sources come before the flat monthly target.
    const fromSources = incomeForMonth(incomeSources, m, toReport)
    return fromSources > 0 ? fromSources : baseIncome
  }

  const forecast = useMemo(() => {
    const out: ForecastMonth[] = []
    for (const m of months) {
      const [row] = buildForecast({
        months: [m], today: TODAY, loans, bills, documents, notes, budgetItems, people: people.map((p) => p.name),
        txns: transactions, accounts, budget: budgetFor(m), expectedIncome: incomeFor(m), toReport,
      })
      out.push(row)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, loans, bills, documents, notes, budgetItems, accounts, transactions, people, incomeSources, extra.futureBudgets, extra.futureIncome, baseBudget, baseIncome])

  // ---- where this month actually stands -----------------------------------
  const current = forecast[0]
  const balance = useMemo(
    () => toReport(accounts
      .filter((a) => a.type !== 'card' && a.type !== 'loan')
      .reduce((n, a) => n + convert(a.balance, a.currency, 'AED'), 0), 'AED'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, reporting],
  )
  const spentSoFar = useMemo(() => toReport(totals(transactions, startMonth).expenses, 'AED'), [transactions, startMonth, reporting]) // eslint-disable-line react-hooks/exhaustive-deps

  const pos = useMemo(
    () => currentMonthPosition({ balance, budget: budgetFor(startMonth), spentSoFar, items: current?.items ?? [], toReport }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balance, spentSoFar, current, extra.futureBudgets, baseBudget],
  )

  const suggestions = useMemo(() => forecastSuggestions(forecast, monthLong), [forecast])
  const chartData = forecast.map((f) => ({ month: monthTiny(f.month), income: f.income, expenses: f.totalNeed, net: f.expectedBalance }))

  const setOverride = (key: 'futureBudgets' | 'futureIncome', m: string, amount: number | undefined) => {
    const map = { ...(extra[key] ?? {}) }
    if (amount === undefined) delete map[m]
    else map[m] = amount
    updateSettings({ extra: { ...extra, [key]: map } })
  }

  const ROWS = [
    { key: 'income', label: 'Planned income', get: (f: ForecastMonth) => f.income, editable: 'futureIncome' as const },
    { key: 'budget', label: 'Expense budget', get: (f: ForecastMonth) => f.budget, editable: 'futureBudgets' as const },
    { key: 'emi', label: 'Loan EMI', get: (f: ForecastMonth) => f.loanEmi },
    { key: 'inst', label: 'Instalments', get: (f: ForecastMonth) => f.installments },
    { key: 'other', label: 'Other payments', get: (f: ForecastMonth) => f.otherPlanned },
  ]

  return (
    <div className="space-y-5 max-w-[1500px]">
      <PageHeader
        title="Financial Forecast"
        subtitle={`Your current position and the next ${span === 6 ? 'six months' : 'twelve months'}`}
        actions={
          <div className="flex rounded-lg border border-[#e2e8f0] p-0.5 bg-white">
            {([6, 12] as const).map((n) => (
              <button
                key={n}
                onClick={() => setSpan(n)}
                className={`h-9 px-3 rounded-md text-[12.5px] font-semibold cursor-pointer ${span === n ? 'bg-brand-600 text-white' : 'text-slate-500'}`}
              >
                {n === 6 ? '6 months' : '1 year'}
              </button>
            ))}
          </div>
        }
      />

      {/* ---------------- this month ---------------- */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0b2f8f] via-[#1549b8] to-[#1f6bff] px-5 py-5 text-white shadow-lg sm:px-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[18px] font-extrabold tracking-tight">
            {monthLong(startMonth)} <span className="font-medium text-white/60">• Current month</span>
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${
              pos.covered ? 'bg-emerald-400/95 text-emerald-950' : 'bg-amber-300/95 text-amber-950'
            }`}
          >
            {pos.covered ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {pos.covered ? 'Covered this month' : `${show(pos.extraNeeded)} short`}
          </span>
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <HeroFigure icon={<Wallet size={20} />} label="Current balance" value={show(pos.balance)} />
          <HeroFigure icon={<CalendarDays size={20} />} label="Remaining payments" value={show(pos.remaining)} />
          <HeroFigure
            icon={pos.covered ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            label="Extra money needed"
            value={show(pos.extraNeeded)}
          />
          <HeroFigure icon={<BarChart3 size={20} />} label="Balance after payments" value={show(pos.balanceAfter)} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2 items-start">
        {/* ---- what is still to pay ---- */}
        <Card>
          <CardHead
            title="Remaining payments breakdown"
            sub={`What is still to pay before ${monthShort(startMonth)} ends`}
            right={<CalendarDays size={16} className="text-amber-500" />}
          />
          <div className="px-5 pb-5">
            {[
              ['Expense budget', pos.budgetLeft],
              ['Loan EMI', pos.loanEmi],
              ['Instalments', pos.installments],
              ['Other payments', pos.otherPlanned],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between border-b border-[#f1f5f9] py-2.5 text-[13px] last:border-0">
                <span className="text-slate-600">{label}</span>
                <span className="font-bold tabular-nums text-slate-800">{show(Number(value))}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3 text-[14px]">
              <span className="font-bold text-slate-800">Total still to pay</span>
              <span className="font-extrabold tabular-nums text-slate-900">{show(pos.remaining)}</span>
            </div>
            {spentSoFar > 0 && (
              <p className="mt-2 text-[11px] text-slate-400">
                {show(spentSoFar)} of this month's budget has already been spent, so only what is left is counted here.
              </p>
            )}
            {pos.suggestedCount > 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                Includes {pos.suggestedCount} suggested item{pos.suggestedCount === 1 ? '' : 's'} you have not approved yet
                — review them in Budget.
              </p>
            )}
          </div>
        </Card>

        {/* ---- how the balance is spoken for ---- */}
        <Card>
          <CardHead title="Current balance allocation" right={<PieChart size={16} className="text-brand-500" />} />
          <div className="px-5 pb-5">
            {pos.balance <= 0 ? (
              <p className="py-6 text-center text-[12.5px] text-slate-400">
                No spendable balance recorded yet — add your accounts to see how it is allocated.
              </p>
            ) : (
              <>
                <div className="flex h-7 overflow-hidden rounded-lg bg-slate-100">
                  <div
                    className="grid place-items-center bg-emerald-500 text-[11px] font-bold text-white transition-[width] duration-700"
                    style={{ width: `${Math.round(pos.reservedShare * 100)}%` }}
                  >
                    {pos.reservedShare >= 0.12 ? `${Math.round(pos.reservedShare * 100)}%` : ''}
                  </div>
                  <div className="grid flex-1 place-items-center bg-blue-300 text-[11px] font-bold text-blue-900">
                    {1 - pos.reservedShare >= 0.12 ? `${100 - Math.round(pos.reservedShare * 100)}%` : ''}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Allocation color="#10b981" label="Reserved for payments" value={show(pos.remaining)} share={Math.round(pos.reservedShare * 100)} />
                  <Allocation color="#93c5fd" label="Remaining balance" value={show(pos.balanceAfter)} share={100 - Math.round(pos.reservedShare * 100)} />
                </div>
              </>
            )}
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-violet-50 px-3.5 py-2.5">
              <Coins size={15} className="mt-0.5 shrink-0 text-violet-500" />
              <p className="text-[12px] text-violet-900">
                Planned income <b>{show(current?.income ?? 0)}</b>{' '}
                <span className="text-violet-700">• Included only when received.</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ---------------- the months ahead ---------------- */}
      <Card>
        <CardHead
          title={`${span}-Month Forecast`}
          right={
            <div className="flex items-center gap-3">
              <span className="hidden text-[11.5px] text-slate-400 sm:block">All amounts in {reporting}</span>
              <button className="btn-ghost h-9" onClick={() => setEditing((v) => !v)}>
                <Pencil size={14} /> {editing ? 'Done' : 'Edit plan'}
              </button>
            </div>
          }
        />
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead>
              <tr className="border-b border-[#eef2f8]">
                <th className="th sticky left-0 bg-white">Category</th>
                {forecast.map((f, i) => (
                  <th key={f.month} className={`th text-center ${i === 0 ? 'bg-brand-50/70 text-brand-700' : ''}`}>
                    {monthShort(f.month)}
                    {i === 0 && (
                      <span className="mt-1 block">
                        <span className="chip bg-brand-600 text-white">Current</span>
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {ROWS.map((r) => (
                <tr key={r.key} className="row-hover">
                  <td className="td sticky left-0 bg-white font-semibold text-slate-700">{r.label}</td>
                  {forecast.map((f, i) => (
                    <td key={f.month} className={`td text-center tabular-nums ${i === 0 ? 'bg-brand-50/40' : ''}`}>
                      {editing && r.editable ? (
                        <input
                          className="w-24 rounded-lg border border-[#e2e8f0] px-2 py-1 text-right text-[12px] font-semibold tabular-nums"
                          type="number"
                          min="0"
                          defaultValue={Math.round(extra[r.editable]?.[f.month] ?? r.get(f))}
                          onBlur={(e) => {
                            const v = Number(e.target.value)
                            setOverride(r.editable!, f.month, Number.isFinite(v) && v >= 0 ? v : undefined)
                          }}
                        />
                      ) : (
                        <span className={r.key === 'income' ? 'font-semibold text-slate-800' : 'text-slate-600'}>{show(r.get(f))}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-slate-50/70 font-bold">
                <td className="td sticky left-0 bg-slate-50/70 text-slate-800">Total required</td>
                {forecast.map((f, i) => (
                  <td key={f.month} className={`td text-center tabular-nums text-slate-900 ${i === 0 ? 'bg-brand-50/60' : ''}`}>
                    {show(f.totalNeed)}
                  </td>
                ))}
              </tr>
              <tr className="bg-emerald-50/60 font-bold">
                <td className="td sticky left-0 bg-emerald-50/60 text-emerald-800">Monthly surplus</td>
                {forecast.map((f) => (
                  <td key={f.month} className={`td text-center tabular-nums ${f.expectedBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {show(f.expectedBalance)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="td sticky left-0 bg-white text-slate-500">Situation</td>
                {forecast.map((f) => (
                  <td key={f.month} className="td text-center">
                    <Badge tone={SITUATION_TONE[f.situation]} color={situationColor(f.situation, theme.statusColors)}>
                      {f.situation}
                    </Badge>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="flex items-start gap-2 border-t border-[#f1f5f9] px-5 py-3 text-[11.5px] text-slate-500">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-slate-300" />
          Forecast uses planned income and budgets. Your current balance changes as transactions are recorded.
          {editing && ' Edited figures are saved against that month and override the plan.'}
        </p>
      </Card>

      {/* ---------------- trend + what it implies ---------------- */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12 items-start">
        <Card className="xl:col-span-7">
          <CardHead title="Income against what each month needs" sub="Planned income, total required, and the surplus between them" />
          <div className="px-3 pb-4">
            <TrendLine data={chartData} height={260} />
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <CardHead
            title="Financial Suggestions"
            sub="Based on your actual records only — never a generic tip."
            right={<Sparkles size={16} className="text-brand-500" />}
          />
          <div className="space-y-2 px-5 pb-5">
            {suggestions.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-slate-400">
                Nothing stands out across these months — the commitments are steady.
              </p>
            ) : (
              suggestions.map((t, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-slate-700">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600">
                    {i + 1}
                  </span>
                  {t}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function HeroFigure({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 text-white">{icon}</span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-white/75">{label}</p>
        <p className="truncate text-[22px] font-extrabold tracking-tight">{value}</p>
      </div>
    </div>
  )
}

function Allocation({ color, label, value, share }: { color: string; label: string; value: string; share: number }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0">
        <p className="truncate text-[11.5px] text-slate-500">{label}</p>
        <p className="text-[15px] font-extrabold tracking-tight text-slate-900">{value}</p>
        <p className="text-[11px] text-slate-400">{share}%</p>
      </div>
    </div>
  )
}
