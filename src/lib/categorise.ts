import type { Category, Subcategory, Transaction, TxnType } from '@/types'
import { categoriesOf, subcategoriesOf } from '@/lib/selectors'

/**
 * Category suggestion from the user's own history.
 *
 * Deliberately local and synchronous. Most descriptions repeat — the same shop,
 * the same bill, month after month — so a lookup against what they picked last
 * time answers nearly everything instantly and for free. The AI fallback in
 * lib/gemini.ts is only for descriptions never seen before.
 */

export interface Suggestion {
  category: string
  subcategory?: string
  /** 0–1. Above ~0.6 is a confident match. */
  confidence: number
  source: 'exact' | 'similar' | 'token'
  /** The past entry this came from, for explaining the suggestion. */
  basis?: string
}

/** Words too common to carry meaning when matching descriptions. */
const STOP = new Set([
  'the', 'and', 'for', 'from', 'with', 'payment', 'paid', 'purchase', 'bought',
  'buy', 'at', 'in', 'on', 'to', 'of', 'a', 'an', 'my', 'our', 'bill',
])

/** Lowercase, drop punctuation and bare numbers, and split into useful words. */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
}

const normalise = (text: string) => tokenise(text).join(' ')

interface Entry {
  normalised: string
  tokens: Set<string>
  category: string
  subcategory?: string
  count: number
  original: string
}

export interface CategoryIndex {
  entries: Entry[]
  /** token -> category -> how many times they appeared together */
  tokenCategory: Map<string, Map<string, number>>
  size: number
}

/** Build a lookup from everything already recorded of this type. */
export function buildIndex(transactions: Transaction[], type: TxnType = 'expense'): CategoryIndex {
  const byNormalised = new Map<string, Entry>()
  const tokenCategory = new Map<string, Map<string, number>>()

  for (const t of transactions) {
    if (t.type !== type || !t.category) continue
    const norm = normalise(t.description ?? '')
    if (!norm) continue

    // Newer rows win the sub-category, older ones only add weight.
    const existing = byNormalised.get(`${norm}|${t.category}`)
    if (existing) {
      existing.count += 1
      if (t.subcategory) existing.subcategory = t.subcategory
    } else {
      byNormalised.set(`${norm}|${t.category}`, {
        normalised: norm,
        tokens: new Set(tokenise(t.description ?? '')),
        category: t.category,
        subcategory: t.subcategory,
        count: 1,
        original: t.description ?? '',
      })
    }

    for (const token of new Set(tokenise(`${t.description ?? ''} ${t.store ?? ''}`))) {
      const forToken = tokenCategory.get(token) ?? new Map<string, number>()
      forToken.set(t.category, (forToken.get(t.category) ?? 0) + 1)
      tokenCategory.set(token, forToken)
    }
  }

  const entries = [...byNormalised.values()]
  return { entries, tokenCategory, size: entries.length }
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const x of a) if (b.has(x)) shared += 1
  return shared / (a.size + b.size - shared)
}

/**
 * Best guess for a description, from history alone.
 * Returns undefined when nothing similar has been recorded before.
 */
export function suggestFromHistory(
  description: string,
  index: CategoryIndex,
  store?: string,
): Suggestion | undefined {
  const norm = normalise(description)
  if (!norm) return undefined
  const tokens = new Set(tokenise(`${description} ${store ?? ''}`))

  // 1. Exactly this description before — the strongest signal there is.
  const exact = index.entries
    .filter((e) => e.normalised === norm)
    .sort((a, b) => b.count - a.count)[0]
  if (exact) {
    return {
      category: exact.category,
      subcategory: exact.subcategory,
      confidence: Math.min(1, 0.85 + exact.count * 0.05),
      source: 'exact',
      basis: exact.original,
    }
  }

  // 2. A close relative: "Carrefour groceries" against "Groceries Carrefour".
  let best: { entry: Entry; score: number } | undefined
  for (const entry of index.entries) {
    const score = jaccard(tokens, entry.tokens)
    if (score > (best?.score ?? 0)) best = { entry, score }
  }
  if (best && best.score >= 0.34) {
    return {
      category: best.entry.category,
      subcategory: best.score >= 0.6 ? best.entry.subcategory : undefined,
      confidence: Math.min(0.84, best.score),
      source: 'similar',
      basis: best.entry.original,
    }
  }

  // 3. Individual words vote — catches a known merchant in a new sentence.
  const votes = new Map<string, number>()
  for (const token of tokens) {
    const forToken = index.tokenCategory.get(token)
    if (!forToken) continue
    for (const [category, n] of forToken) votes.set(category, (votes.get(category) ?? 0) + n)
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length) {
    const total = ranked.reduce((a, [, n]) => a + n, 0)
    const [category, n] = ranked[0]
    const share = n / total
    // Only trust it when one category clearly dominates.
    if (share >= 0.6) {
      return { category, confidence: Math.min(0.7, share * 0.7), source: 'token' }
    }
  }

  return undefined
}

/** Keep a suggestion only if the category still exists in the user's list. */
export function validate(
  suggestion: Suggestion | undefined,
  categories: Category[],
  subcategories: Subcategory[],
  type: TxnType,
  fallbackNames: string[],
): Suggestion | undefined {
  if (!suggestion) return undefined

  const owned = categoriesOf(categories, type)
  const names = owned.length ? owned.map((c) => c.name) : fallbackNames
  const match = names.find((n) => n.toLowerCase() === suggestion.category.toLowerCase())
  if (!match) return undefined

  let subcategory = suggestion.subcategory
  if (subcategory) {
    const cat = owned.find((c) => c.name.toLowerCase() === match.toLowerCase())
    const subs = subcategoriesOf(subcategories, cat?.id).map((s) => s.name)
    if (!subs.some((s) => s.toLowerCase() === subcategory!.toLowerCase())) subcategory = undefined
  }

  return { ...suggestion, category: match, subcategory }
}

/**
 * A few representative past entries, to show the model how this person
 * actually labels things. Most frequent first, capped to keep the prompt small.
 */
export function historyExamples(index: CategoryIndex, limit = 40) {
  return [...index.entries]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => ({
      description: e.original,
      category: e.category,
      ...(e.subcategory ? { subcategory: e.subcategory } : {}),
    }))
}
