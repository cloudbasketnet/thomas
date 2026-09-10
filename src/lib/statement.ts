import type { Transaction, TxnType } from '@/types'
import { tokenise } from '@/lib/categorise'
import type { StatementRow } from '@/lib/gemini'

/**
 * Matching imported statement rows against what is already recorded.
 *
 * Re-importing an overlapping statement is the normal case — you import
 * January, then February's statement repeats the last few days of January.
 * Anything already present is flagged and left unticked, rather than silently
 * dropped, so the decision stays with the person doing the import.
 */

export interface CandidateRow {
  id: string
  date: string
  description: string
  amount: number
  type: TxnType
  category: string
  subcategory?: string
  include: boolean
  /** The existing transaction this appears to repeat. */
  duplicateOf?: { id: string; description: string; date: string }
}

const money = (n: number) => Math.round(n * 100)

/** Word overlap, 0–1, used to decide whether two narrations describe the same thing. */
function overlap(a: string, b: string) {
  const A = new Set(tokenise(a))
  const B = new Set(tokenise(b))
  if (!A.size || !B.size) return 0
  let shared = 0
  for (const x of A) if (B.has(x)) shared += 1
  return shared / Math.min(A.size, B.size)
}

/**
 * An existing transaction that plausibly is this row already.
 *
 * Same direction and the same amount to the cent is required throughout.
 * Beyond that:
 *
 * - Same day: treated as a duplicate whatever the wording. A statement writes
 *   merchant names nothing like a person does ("CRF DXB 4471" against
 *   "Carrefour groceries"), so demanding matching words would miss the very
 *   case this exists for. Two genuinely different transactions for the same
 *   amount on the same day in one account are rare, and importing a duplicate
 *   corrupts every total while a wrongly flagged row is merely left unticked
 *   in a list the user is already reviewing.
 * - One to three days apart: banks post later than the purchase, so this is
 *   still plausible — but with the date no longer pinning it down, the wording
 *   has to corroborate.
 */
export function findDuplicate(row: { date: string; amount: number; type: TxnType; description: string }, existing: Transaction[]) {
  const target = money(row.amount)
  const rowTime = new Date(row.date + 'T00:00:00').getTime()
  if (!Number.isFinite(rowTime)) return undefined

  let best: { txn: Transaction; score: number } | undefined

  for (const t of existing) {
    if (t.type !== row.type) continue
    if (money(t.amount) !== target) continue

    const days = Math.abs(new Date(t.date + 'T00:00:00').getTime() - rowTime) / 86_400_000
    if (!Number.isFinite(days) || days > 3) continue

    const similarity = overlap(row.description, t.description)
    const score = days === 0 ? 1 + similarity : similarity >= 0.34 ? 0.6 + similarity : 0
    if (score > 0 && score > (best?.score ?? 0)) best = { txn: t, score }
  }

  return best?.txn
}

/** Turn parsed statement rows into reviewable candidates. */
export function toCandidates(
  rows: StatementRow[],
  existing: Transaction[],
  categorise: (description: string, type: TxnType) => { category: string; subcategory?: string },
): CandidateRow[] {
  const seen: Transaction[] = [...existing]

  return rows.map((r, i) => {
    const type: TxnType = r.direction === 'credit' ? 'income' : 'expense'
    const description = (r.description ?? '').trim() || 'Statement entry'
    const amount = Math.abs(Number(r.amount) || 0)
    const guess = categorise(description, type)
    const duplicate = findDuplicate({ date: r.date, amount, type, description }, seen)

    // Also guard against the same row appearing twice within one statement.
    if (!duplicate) {
      seen.push({
        id: `pending-${i}`, type, date: r.date, description,
        category: guess.category, accountId: '', amount, currency: 'AED',
      })
    }

    return {
      id: `row-${i}`,
      date: r.date,
      description,
      amount,
      type,
      category: guess.category,
      subcategory: guess.subcategory,
      include: !duplicate,
      duplicateOf: duplicate
        ? { id: duplicate.id, description: duplicate.description, date: duplicate.date }
        : undefined,
    }
  })
}

/** Headline counts for the import summary. */
export function summarise(rows: CandidateRow[]) {
  const chosen = rows.filter((r) => r.include)
  return {
    total: rows.length,
    duplicates: rows.filter((r) => r.duplicateOf).length,
    selected: chosen.length,
    income: chosen.filter((r) => r.type === 'income').reduce((a, r) => a + r.amount, 0),
    expense: chosen.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0),
  }
}
