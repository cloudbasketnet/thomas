import { useMemo, useState } from 'react'
import { Banknote, CalendarClock, HandCoins, Landmark } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { PageHeader, Progress, StatCard } from '@/components/ui/Primitives'
import { hasSection } from '@/lib/access'
import { allSchedulesTotal, installmentStatus } from '@/lib/schedules'
import { loanSummary } from '@/lib/selectors'
import { fmtDate, money, toBase, TODAY } from '@/lib/format'
import { DEFAULT_THEME } from '@/lib/theme'
import { LoansSection } from '@/pages/Loans'
import { InstallmentsSection } from '@/pages/Installments'

type Tab = 'loans' | 'plans'

/**
 * Loans and instalment plans were two sidebar entries and two pages, which put
 * a car loan and a school-fee plan — both money owed, both paid monthly — in
 * different places. They are one screen now.
 *
 * What is NOT merged is the data behind them. A `Loan` has a principal, an
 * interest rate and an amortization schedule; an instalment plan is a `Note`
 * carrying a list of dated payments and no interest at all. Forcing one shape
 * onto the other would cost features on both sides, so each keeps its own
 * records and its own editor, and this page puts one summary over the two.
 */
export default function LoansEmis() {
  const { loans, notes, transactions, settings, membership } = useStore()
  const catColor = (settings.extra?.theme?.categoryColors ?? DEFAULT_THEME.categoryColors).loan

  // Permissions were granted per old page ('loans' and 'notes'). Merging the
  // screens must not quietly widen them, so each half is shown only to someone
  // who could already open it.
  const canLoans = hasSection(membership, 'loans')
  const canPlans = hasSection(membership, 'notes')

  const [tab, setTab] = useState<Tab>(canLoans ? 'loans' : 'plans')

  const txnIds = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions])
  const plans = useMemo(() => notes.filter((n) => (n.schedule?.length ?? 0) > 0), [notes])
  const ls = useMemo(() => loanSummary(loans), [loans])

  const ps = useMemo(
    () => allSchedulesTotal(plans, TODAY, (id) => txnIds.has(id), toBase),
    [plans, txnIds],
  )

  /** Instalments falling in the current calendar month that are not yet paid. */
  const planDueThisMonth = useMemo(() => {
    const month = TODAY.slice(0, 7)
    let amount = 0
    let count = 0
    for (const n of plans)
      for (const i of n.schedule ?? []) {
        if (i.dueDate.slice(0, 7) !== month) continue
        if (installmentStatus(i, TODAY, (id) => txnIds.has(id)) === 'Paid') continue
        amount += toBase(i.amount, i.currency)
        count += 1
      }
    return { amount, count }
  }, [plans, txnIds])

  const nextPlanDate = useMemo(() => {
    const dates: string[] = []
    for (const n of plans)
      for (const i of n.schedule ?? [])
        if (installmentStatus(i, TODAY, (id) => txnIds.has(id)) !== 'Paid') dates.push(i.dueDate)
    return dates.sort()[0]
  }, [plans, txnIds])

  const totalPrincipal = ls.active.reduce((a, l) => a + toBase(l.principal, l.currency), 0)
  const loanPaidOff = totalPrincipal - ls.outstanding

  const owed = ls.outstanding + ps.outstanding
  const dueAmount = ls.dueAmount + planDueThisMonth.amount
  const dueCount = ls.dueThisMonth.length + planDueThisMonth.count
  const repaid = loanPaidOff + ps.paid
  const borrowed = totalPrincipal + ps.total

  const TABS: { k: Tab; label: string; count: number; show: boolean }[] = [
    { k: 'loans', label: 'Loans', count: ls.active.length, show: canLoans },
    { k: 'plans', label: 'EMI Plans', count: plans.length, show: canPlans },
  ]
  const visibleTabs = TABS.filter((t) => t.show)

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="Loans & EMIs"
        subtitle="Every loan, EMI and instalment plan in one place — balances, schedules and what falls due next."
      />

      {/* One summary across both halves, so the total owed is the real total. */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Owed"
          value={money(owed)}
          icon={<Landmark size={20} />}
          tint="#ef4444"
          footer={<span className="text-slate-400">{money(ls.outstanding)} loans · {money(ps.outstanding)} plans</span>}
        />
        <StatCard
          label="Monthly EMI"
          value={money(ls.monthlyEmi)}
          icon={<Banknote size={20} />}
          tint={catColor}
          footer={<span className="text-slate-400">Across {ls.active.length} loan{ls.active.length === 1 ? '' : 's'}</span>}
        />
        <StatCard
          label="Due This Month"
          value={money(dueAmount)}
          icon={<CalendarClock size={20} />}
          tint="#f59e0b"
          footer={
            <span className="text-slate-400">
              {dueCount} payment{dueCount === 1 ? '' : 's'}
              {nextPlanDate ? ` · next instalment ${fmtDate(nextPlanDate)}` : ''}
            </span>
          }
        />
        <StatCard
          label="Repaid"
          value={money(repaid)}
          icon={<HandCoins size={20} />}
          tint="#10b981"
          footer={
            <div>
              <div className="text-[10px] text-slate-400 mb-1">
                {borrowed ? Math.round((repaid / borrowed) * 100) : 0}% of {money(borrowed)} committed
              </div>
              <Progress value={repaid} max={borrowed || 1} color="#10b981" height={5} />
            </div>
          }
        />
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {visibleTabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`chip cursor-pointer transition ${
                tab === t.k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      )}

      {tab === 'loans' && canLoans && <LoansSection />}
      {tab === 'plans' && canPlans && <InstallmentsSection />}
    </div>
  )
}
