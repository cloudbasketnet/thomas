import type { Currency, Installment, Note } from '@/types'

export type InstallmentStatus = 'Planned' | 'Paid' | 'Overdue'

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * An instalment is Paid once it points at a payment that still exists (or the
 * user marked it paid by hand), Overdue once its date has passed unpaid, and
 * Planned otherwise. Derived, so it can never disagree with the transactions.
 */
export function installmentStatus(i: Installment, today: string, txnExists: (id: string) => boolean): InstallmentStatus {
  if ((i.paidTxnId && txnExists(i.paidTxnId)) || (!i.paidTxnId && i.paidAmount !== undefined && i.paidDate)) return 'Paid'
  return i.dueDate < today ? 'Overdue' : 'Planned'
}

export function scheduleSummary(note: Pick<Note, 'schedule'>, today: string, txnExists: (id: string) => boolean) {
  const list = [...(note.schedule ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  let total = 0
  let paid = 0
  for (const i of list) {
    total += i.amount
    if (installmentStatus(i, today, txnExists) === 'Paid') paid += i.paidAmount ?? i.amount
  }
  const next = list.find((i) => installmentStatus(i, today, txnExists) !== 'Paid')
  return {
    list,
    total: r2(total),
    paid: r2(paid),
    outstanding: r2(Math.max(0, total - paid)),
    next,
    nextDate: next?.dueDate,
    overdue: list.filter((i) => installmentStatus(i, today, txnExists) === 'Overdue').length,
  }
}

/** Instalments that need a reminder now: due within their reminder window and not paid. */
export function dueReminders(notes: Note[], today: string, txnExists: (id: string) => boolean) {
  const out: { note: Note; installment: Installment; days: number }[] = []
  for (const note of notes) {
    if (note.done) continue
    for (const i of note.schedule ?? []) {
      if (installmentStatus(i, today, txnExists) === 'Paid') continue
      const days = Math.round((new Date(i.dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
      if (days <= (i.remindDays ?? 7)) out.push({ note, installment: i, days })
    }
  }
  return out.sort((a, b) => a.days - b.days)
}

/**
 * Every plan added together, in ONE currency. A plan's own card reports in that
 * plan's currency, but these figures span plans, so each instalment is
 * converted first: 100,000 rupees is not 100,000 dirhams, and adding the raw
 * figures would claim it is. `toBase` is injected so this file stays pure.
 */
export function allSchedulesTotal(
  notes: Note[],
  today: string,
  txnExists: (id: string) => boolean,
  toBase: (amount: number, currency: Currency) => number,
) {
  let total = 0
  let paid = 0
  for (const n of notes) {
    for (const i of n.schedule ?? []) {
      total += toBase(i.amount, i.currency)
      if (installmentStatus(i, today, txnExists) === 'Paid') paid += toBase(i.paidAmount ?? i.amount, i.currency)
    }
  }
  return { total: r2(total), paid: r2(paid), outstanding: r2(Math.max(0, total - paid)) }
}

// ---------------------------------------------------------------------------
// Building a schedule from a few figures
// ---------------------------------------------------------------------------

/**
 * Which figure the user actually knows:
 *  - 'total'   the whole commitment, split evenly across the instalments
 *  - 'monthly' what is paid each month; the total follows from it
 * A fee letter usually gives one or the other, rarely both.
 */
export type GenerateMode = 'total' | 'monthly'

/** Add `n` months to a yyyy-MM-dd date, keeping it inside the target month. */
export function addMonthsClamped(date: string, n: number): string {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7)) - 1
  const day = Number(date.slice(8, 10))
  // The 31st of a month has no counterpart in November, and letting the date
  // roll over would push that instalment into the month after the one it
  // belongs to. Clamp it to the last day instead.
  const lastDay = new Date(y, m + n + 1, 0).getDate()
  const d = new Date(y, m + n, Math.min(day, lastDay))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface GenerateInput {
  mode: GenerateMode
  /** The total, or the monthly amount — whichever `mode` says. */
  amount: number
  count: number
  /** First due date, yyyy-MM-dd. */
  start: string
  currency: Currency
  remindDays?: number
  makeId: () => string
}

/**
 * Build an evenly spaced monthly schedule. In 'total' mode the instalments add
 * up to exactly the total — the rounding remainder goes on the last one rather
 * than being dropped, so the plan can never quietly come to less than the fee.
 */
export function generateSchedule(i: GenerateInput): Installment[] {
  const count = Math.max(1, Math.round(i.count) || 1)
  if (!Number.isFinite(i.amount) || i.amount <= 0) return []

  const per = i.mode === 'monthly' ? r2(i.amount) : r2(i.amount / count)
  const total = i.mode === 'monthly' ? r2(per * count) : r2(i.amount)

  return Array.from({ length: count }, (_, k) => ({
    id: i.makeId(),
    label: `Installment ${k + 1}`,
    dueDate: addMonthsClamped(i.start, k),
    amount: k === count - 1 ? r2(total - per * (count - 1)) : per,
    currency: i.currency,
    remindDays: i.remindDays ?? 7,
  }))
}

/** The other figure, for the hint under the inputs. Returns 0 when nothing is entered yet. */
export function generatePreview(mode: GenerateMode, amount: number, count: number) {
  const n = Math.max(1, Math.round(count) || 1)
  if (!Number.isFinite(amount) || amount <= 0) return { per: 0, total: 0, count: n }
  return mode === 'monthly'
    ? { per: r2(amount), total: r2(amount * n), count: n }
    : { per: r2(amount / n), total: r2(amount), count: n }
}
