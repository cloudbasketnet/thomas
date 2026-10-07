// Figures behind the new dashboard widgets: safe-to-spend, daily spending, the
// upcoming-payments list, the 30-day cash flow projection and the action centre.
//
// Every number here is derived from what is already recorded — nothing is
// invented, and a widget with no data says so rather than showing a guess.
import type { Account, Bill, Doc, Goal, Installment, Loan, Note, Transaction, Transfer } from '@/types'
import { TODAY, daysLeft, monthKey, shortDate, toBase, todayISO } from '@/lib/format'
import { CURRENT_MONTH, availableMoney, docStatus, isSpend, spendValue } from '@/lib/selectors'
import { installmentStatus } from '@/lib/schedules'

const r0 = (n: number) => Math.round(n)

/** Shift a yyyy-MM-dd date by n days, staying on the local calendar. */
export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Daily expenses
// ---------------------------------------------------------------------------

export interface DaySpend {
  date: string
  label: string
  value: number
}

/** Spending per day across the last `days` days, ending today. Days with nothing recorded are 0, not missing. */
export function dailySpend(txns: Transaction[], days = 7, today = TODAY): DaySpend[] {
  const start = addDays(today, -(days - 1))
  const totals = new Map<string, number>()
  for (const t of txns) {
    if (!isSpend(t) || t.date < start || t.date > today) continue
    totals.set(t.date, (totals.get(t.date) ?? 0) + spendValue(t))
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i)
    return { date, label: shortDate(date), value: Math.max(0, r0(totals.get(date) ?? 0)) }
  })
}

// ---------------------------------------------------------------------------
// Upcoming payments — loans, bills and instalments on one timeline
// ---------------------------------------------------------------------------

export type DueKind = 'loan' | 'bill' | 'installment'

export interface DueRow {
  id: string
  kind: DueKind
  title: string
  sub: string
  amount: number
  /** Base-currency value, for totals. */
  base: number
  currency: Transaction['currency']
  dueDate: string
  days: number
  overdue: boolean
  /** Instalments only — the note and the instalment, so "Pay now" can open the right record. */
  noteId?: string
  installment?: Installment
}

/**
 * Everything still to pay, soonest first, within `withinDays`. Anything already
 * paid is left out, so the list empties itself as the month goes on.
 */
export function duePayments(
  loans: Loan[],
  bills: Bill[],
  notes: Note[],
  txnExists: (id: string) => boolean,
  withinDays = 60,
  today = TODAY,
): DueRow[] {
  const out: DueRow[] = []
  const horizon = addDays(today, withinDays)

  for (const l of loans) {
    if (l.status === 'Closed' || !l.nextPayment || l.emi <= 0) continue
    if (l.nextPayment > horizon) continue
    out.push({
      id: `loan_${l.id}`,
      kind: 'loan',
      title: l.name,
      sub: l.lender ? `Loan • ${l.lender}` : 'Loan EMI',
      amount: l.emi,
      base: toBase(l.emi, l.currency),
      currency: l.currency,
      dueDate: l.nextPayment,
      days: daysLeft(l.nextPayment, today),
      overdue: l.nextPayment < today,
    })
  }

  for (const b of bills) {
    if (b.status === 'Paid' || !b.dueDate || b.dueDate > horizon) continue
    out.push({
      id: `bill_${b.id}`,
      kind: 'bill',
      title: b.name,
      sub: `${b.category} • ${b.frequency}`,
      amount: b.amount,
      base: b.amount,
      currency: 'AED',
      dueDate: b.dueDate,
      days: daysLeft(b.dueDate, today),
      overdue: b.dueDate < today,
    })
  }

  for (const n of notes) {
    if (n.done) continue
    const schedule = n.schedule ?? []
    const total = schedule.length
    schedule.forEach((inst, idx) => {
      if (installmentStatus(inst, today, txnExists) === 'Paid') return
      if (inst.dueDate > horizon) return
      out.push({
        id: `inst_${n.id}_${inst.id}`,
        kind: 'installment',
        title: inst.label || n.title,
        sub: `Instalment ${idx + 1} of ${total}${n.person ? ` • ${n.person}` : ''}`,
        amount: inst.amount,
        base: toBase(inst.amount, inst.currency),
        currency: inst.currency,
        dueDate: inst.dueDate,
        days: daysLeft(inst.dueDate, today),
        overdue: inst.dueDate < today,
        noteId: n.id,
        installment: inst,
      })
    })
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// ---------------------------------------------------------------------------
// Safe to spend
// ---------------------------------------------------------------------------

export interface SafeToSpend {
  balance: number
  /** Loans, bills and instalments still to pay before the month ends. */
  reserved: number
  /** What the goals need from this month to land on their deadlines. */
  savings: number
  safe: number
  dueToday: DueRow[]
  overdue: DueRow[]
}

/**
 * What is genuinely free to spend this month:
 * available balance − what is already committed before month end − this
 * month's share of the savings goals.
 */
export function safeToSpend(
  accounts: Account[],
  loans: Loan[],
  bills: Bill[],
  notes: Note[],
  goals: Goal[],
  txnExists: (id: string) => boolean,
  today = TODAY,
): SafeToSpend {
  const balance = availableMoney(accounts)
  const monthEnd = lastDayOfMonth(monthKey(today))
  const due = duePayments(loans, bills, notes, txnExists, 400, today)
  const thisMonth = due.filter((d) => d.dueDate <= monthEnd)
  const reserved = thisMonth.reduce((n, d) => n + d.base, 0)

  const savings = goals.reduce((n, g) => {
    const remaining = Math.max(0, g.target - g.saved)
    if (!remaining) return n
    const months = Math.max(1, Math.round(daysLeft(g.deadline, today) / 30))
    return n + toBase(remaining / months, g.currency ?? 'AED')
  }, 0)

  return {
    balance: r0(balance),
    reserved: r0(reserved),
    savings: r0(savings),
    safe: r0(balance - reserved - savings),
    dueToday: due.filter((d) => d.dueDate === today),
    overdue: due.filter((d) => d.overdue),
  }
}

// ---------------------------------------------------------------------------
// 30-day cash flow
// ---------------------------------------------------------------------------

export interface CashPoint {
  date: string
  label: string
  /** Balance actually reached on a day that has already happened. */
  actual?: number
  /** Projected balance — present on every point so the line is continuous. */
  forecast: number
}

/**
 * Balance day by day: backwards from today's real balance across the days
 * already recorded, then forwards using the known commitments and the recent
 * average daily spend. The forward half is an estimate and is labelled as one.
 */
export function cashFlow(
  accounts: Account[],
  txns: Transaction[],
  transfers: Transfer[],
  loans: Loan[],
  bills: Bill[],
  notes: Note[],
  txnExists: (id: string) => boolean,
  back = 7,
  forward = 30,
  today = TODAY,
): { points: CashPoint[]; projected: number; dailyBurn: number } {
  const balance = availableMoney(accounts)

  // --- the days already lived: unwind the ledger from today's balance back ---
  // Only accounts that count toward `availableMoney` may move this line. A
  // purchase on a credit card raises debt without touching cash, so counting it
  // here would walk the balance backwards to a figure that never existed.
  const liquid = new Set(accounts.filter((a) => a.type !== 'card' && a.type !== 'loan').map((a) => a.id))
  const netByDay = new Map<string, number>()
  const add = (date: string, v: number) => netByDay.set(date, (netByDay.get(date) ?? 0) + v)

  for (const t of txns) {
    if (!liquid.has(t.accountId)) continue
    add(t.date, t.type === 'income' ? toBase(t.amount, t.currency) : -toBase(t.amount, t.currency))
  }
  // A transfer between two liquid accounts nets to zero; paying a card or a
  // loan from one takes real money out, so it has to be counted.
  for (const tr of transfers) {
    const out = liquid.has(tr.fromAccountId)
    const into = tr.toKind === 'account' && liquid.has(tr.toId)
    if (out && !into) add(tr.date, -toBase(tr.amount, tr.currency))
    else if (into && !out) add(tr.date, toBase(tr.amount, tr.currency))
  }

  const past: CashPoint[] = []
  let running = balance
  for (let i = 0; i <= back; i++) {
    const date = addDays(today, -i)
    past.unshift({ date, label: shortDate(date), actual: r0(running), forecast: r0(running) })
    running -= netByDay.get(date) ?? 0
  }

  // --- the days ahead: committed payments, plus the recent spending rate ---
  const recent = dailySpend(txns, 30, today)
  const spentRecently = recent.reduce((n, d) => n + d.value, 0)
  const dailyBurn = r0(spentRecently / 30)

  const due = duePayments(loans, bills, notes, txnExists, forward + 1, today)
  const committed = new Map<string, number>()
  for (const d of due) {
    if (d.dueDate <= today) continue
    committed.set(d.dueDate, (committed.get(d.dueDate) ?? 0) + d.base)
  }

  const ahead: CashPoint[] = []
  let projected = balance
  for (let i = 1; i <= forward; i++) {
    const date = addDays(today, i)
    projected -= dailyBurn + (committed.get(date) ?? 0)
    ahead.push({ date, label: shortDate(date), forecast: r0(projected) })
  }

  return { points: [...past, ...ahead], projected: r0(projected), dailyBurn }
}

// ---------------------------------------------------------------------------
// Action centre
// ---------------------------------------------------------------------------

export interface ActionItem {
  key: string
  label: string
  detail: string
  count: number
  to: string
  tone: 'rose' | 'amber' | 'blue' | 'violet'
}

/** The things waiting on the user, each with a real count and a link to the page that clears it. */
export function actionCentre(
  bills: Bill[],
  documents: Doc[],
  notes: Note[],
  txnExists: (id: string) => boolean,
  today = TODAY,
): ActionItem[] {
  const out: ActionItem[] = []

  const pendingBills = bills.filter((b) => b.status !== 'Paid')
  if (pendingBills.length) {
    const overdue = pendingBills.filter((b) => b.status === 'Overdue').length
    out.push({
      key: 'bills',
      label: 'Pending bills',
      detail: overdue ? `${overdue} overdue, ${pendingBills.length} in total` : `${pendingBills.length} still to be paid`,
      count: pendingBills.length,
      to: '/bills',
      tone: overdue ? 'rose' : 'amber',
    })
  }

  const expiring = documents.filter((d) => docStatus(d.expiry) !== 'Valid')
  if (expiring.length) {
    const expired = expiring.filter((d) => docStatus(d.expiry) === 'Expired').length
    out.push({
      key: 'documents',
      label: 'Documents expiring',
      detail: expired ? `${expired} already expired` : 'Expiring within 30 days',
      count: expiring.length,
      to: '/documents',
      tone: expired ? 'rose' : 'amber',
    })
  }

  const dueNotes = notes.filter((n) => !n.done && n.dueDate && daysLeft(n.dueDate, today) <= 7)
  if (dueNotes.length) {
    out.push({
      key: 'notes',
      label: 'Notes due',
      detail: `${dueNotes.length} awaiting follow-up this week`,
      count: dueNotes.length,
      to: '/notes',
      tone: 'blue',
    })
  }

  const upcomingInst = notes.flatMap((n) =>
    n.done ? [] : (n.schedule ?? []).filter((i) => installmentStatus(i, today, txnExists) !== 'Paid' && daysLeft(i.dueDate, today) <= 30),
  )
  if (upcomingInst.length) {
    const next = [...upcomingInst].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    out.push({
      key: 'installments',
      label: 'Upcoming instalments',
      detail: `Next payment ${shortDate(next.dueDate)}`,
      count: upcomingInst.length,
      to: '/loans',
      tone: 'violet',
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Bank spending, for the Favourite Bank gauge
// ---------------------------------------------------------------------------

/** What has gone out of one account this month, and what has come in. */
export function accountMonth(txns: Transaction[], accountId: string, month = CURRENT_MONTH) {
  let spent = 0
  let received = 0
  for (const t of txns) {
    if (t.accountId !== accountId || monthKey(t.date) !== month) continue
    if (t.type === 'expense') spent += toBase(t.amount, t.currency)
    else received += toBase(t.amount, t.currency)
  }
  return { spent: r0(spent), received: r0(received) }
}
