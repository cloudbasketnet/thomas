/**
 * Gemini API client — receipt and document scanning, statement import,
 * spending analysis, natural-language entry and category suggestion.
 *
 * SECURITY: the key ships in the browser bundle, so anyone who can open the
 * app can read it and spend against your quota. That is acceptable for a
 * personal build; before putting this anywhere public, move the calls behind a
 * Supabase Edge Function and keep the key server-side. At minimum, restrict the
 * key to your own domain in Google Cloud Console.
 *
 * QUOTA: the free tier is counted per project *per model per day* — around 20
 * requests a day for a full flash model. Light, frequent work therefore runs on
 * a separate lite model, which both costs less and draws on its own allowance.
 */
import type { Purchase } from '@/types'

const KEY_RAW = __GEMINI_API_KEY__
const KEY = KEY_RAW || undefined
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Vision and reasoning: scanning, statements, analysis, questions. */
const MODEL = __GEMINI_MODEL__ || 'gemini-3.6-flash'
/** Short, frequent text calls: categorising one line, parsing one sentence. */
const FAST_MODEL = __GEMINI_FAST_MODEL__ || 'gemini-3.1-flash-lite'

export const hasGemini = Boolean(KEY)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Google returns how long to wait in a RetryInfo detail, e.g. "5.5s". Honour
 * it — the free tier allows only a handful of requests per minute, and a
 * shorter fixed backoff just burns the remaining attempts.
 */
function retryDelayMs(error: any, attempt: number) {
  const info = (error?.details ?? []).find((d: any) => String(d['@type'] ?? '').endsWith('RetryInfo'))
  const seconds = Number(String(info?.retryDelay ?? '').replace('s', ''))
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000 + 250, 30_000)
  return (attempt + 1) * 1500
}

/** Turn Google's wording into something a user can act on. */
function friendlyError(status: number, message: string, error?: any) {
  if (status === 429) {
    const violation = (error?.details ?? [])
      .flatMap((d: any) => d.violations ?? [])
      .find((v: any) => v?.quotaId)
    const perDay = String(violation?.quotaId ?? '').includes('PerDay')
    if (perDay) {
      return `Gemini's free daily limit for this model (${violation?.quotaValue ?? 'a few'} requests) is used up. It resets tomorrow, or you can enable billing on the Google Cloud project for a much higher limit.`
    }
    return 'Gemini is rate limiting — only a few requests a minute are allowed on the free tier. Wait a moment and try again.'
  }
  if (status === 503) return 'Gemini is busy right now. Try again in a moment.'
  if (status === 400 && /API key/i.test(message)) return 'That Gemini API key was rejected. Check GEMINI_API_KEY.'
  return message
}

export class GeminiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GeminiError'
  }
}

interface CallOptions {
  parts: unknown[]
  schema?: unknown
  model?: string
  temperature?: number
  signal?: AbortSignal
  /** Retries cost quota; skip them for optional, best-effort calls. */
  retries?: number
}

/**
 * One request to Gemini, returning the parsed JSON body of the reply.
 * 503 (overloaded) and 429 (rate limited) are retried using Google's own hint.
 */
async function callGemini<T>({ parts, schema, model, temperature = 0, signal, retries = 2 }: CallOptions): Promise<T> {
  if (!KEY) throw new GeminiError('No Gemini API key — set GEMINI_API_KEY (or VITE_GEMINI_API_KEY) and rebuild.', 0)

  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature,
      ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
    },
  }

  let lastError = ''
  let lastStatus = 0

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${ENDPOINT}/${model ?? MODEL}:generateContent?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (res.ok) {
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new GeminiError('Gemini returned an empty reply.', 200)
      if (!schema) return text as T
      try {
        return JSON.parse(text) as T
      } catch {
        throw new GeminiError('Gemini returned a reply that could not be read.', 200)
      }
    }

    const detail = await res.json().catch(() => null)
    lastStatus = res.status
    lastError = friendlyError(res.status, detail?.error?.message ?? `Request failed (${res.status})`, detail?.error)

    if (res.status !== 503 && res.status !== 429) break
    // A daily cap will not clear by waiting a few seconds.
    if (lastError.includes('daily limit')) break
    if (attempt < retries) await sleep(retryDelayMs(detail?.error, attempt))
  }

  throw new GeminiError(lastError || 'Gemini could not be reached.', lastStatus)
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Strip the `data:*;base64,` prefix a FileReader data URL carries. */
const toBase64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1)

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

const filePart = (dataUrl: string, mimeType: string) => ({
  inline_data: { mime_type: mimeType, data: toBase64(dataUrl) },
})

/** Categories the model may choose from — kept in step with the expense form. */
export const PURCHASE_CATEGORIES = [
  'Electronics', 'Furniture', 'Appliances', 'Groceries', 'Kids',
  'Automotive', 'Business', 'Clothing', 'Health', 'Other',
] as const

const WEIGHT_UNIT_ENUM = ['kg', 'g', 'lb', 'oz', 'L', 'ml']
const CURRENCY_ENUM = ['AED', 'INR', 'USD']
const METHOD_ENUM = ['Bank Transfer', 'Cash', 'Card', 'Credit Card', 'Cheque', 'Auto Debit', 'Online']

// ---------------------------------------------------------------------------
// Receipt scanning
// ---------------------------------------------------------------------------

export interface ScannedItem {
  item: string
  category: string
  qty: number
  /** Unit price, in the receipt's own currency. */
  price: number
  /** Pack size read off the line, e.g. 10 for "Basmati Rice 10kg". */
  weight?: number
  weightUnit?: string
}

export interface ScannedBill {
  store: string
  date: string
  currency: Purchase extends { currency: infer C } ? C : string
  total: number
  items: ScannedItem[]
}

const BILL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    store: { type: 'STRING', description: 'Shop or merchant name' },
    date: { type: 'STRING', description: 'Purchase date as yyyy-MM-dd' },
    currency: { type: 'STRING', enum: CURRENCY_ENUM },
    total: { type: 'NUMBER', description: 'Grand total paid, including tax' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          item: { type: 'STRING' },
          category: { type: 'STRING', enum: PURCHASE_CATEGORIES as unknown as string[] },
          qty: { type: 'NUMBER' },
          price: { type: 'NUMBER', description: 'Unit price: line total divided by qty' },
          weight: { type: 'NUMBER', description: 'Pack size if the line states one, e.g. 10 for "Rice 10kg". Omit if absent.' },
          weightUnit: { type: 'STRING', enum: WEIGHT_UNIT_ENUM },
        },
        required: ['item', 'category', 'qty', 'price'],
      },
    },
  },
  required: ['store', 'date', 'currency', 'total', 'items'],
}

const BILL_PROMPT = `You are reading a shopping receipt, invoice or bill.

Extract every purchased line item. Rules:
- price is the UNIT price: if a line shows a total for several units, divide by qty.
- Skip subtotal, tax/VAT, discount, rounding and payment lines — items only.
- date must be yyyy-MM-dd. Receipts are usually DD/MM/YYYY; read the day first
  unless that gives an impossible month.
- If the currency is unclear, infer it from the merchant's country; default AED.
- weight is the pack size printed on the line, per unit: "Basmati Rice 10kg"
  is weight 10, weightUnit kg. Leave both out when the line states no size.
  Never convert or estimate a size that is not written down.
- If a field is genuinely unreadable, use an empty string for text and 0 for
  numbers. Never invent a value.`

export async function scanBill(dataUrl: string, mimeType: string, signal?: AbortSignal): Promise<ScannedBill> {
  const parsed = await callGemini<ScannedBill>({
    parts: [{ text: BILL_PROMPT }, filePart(dataUrl, mimeType)],
    schema: BILL_SCHEMA,
    signal,
  })
  return { ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] }
}

// ---------------------------------------------------------------------------
// Spending analysis
// ---------------------------------------------------------------------------

export type InsightKind = 'warning' | 'watch' | 'good'

export interface Insight {
  kind: InsightKind
  title: string
  detail: string
  /** The figure the point rests on, e.g. "AED 2,400 over budget". */
  metric?: string
  /** One concrete thing to do about it. */
  action?: string
}

export interface Analysis {
  headline: string
  outlook: string
  insights: Insight[]
  generatedAt: string
}

const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING', description: 'One sentence on what is happening with spending right now.' },
    outlook: { type: 'STRING', description: 'Where the month ends up if the current rate continues. Cite the projected figure.' },
    insights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: ['warning', 'watch', 'good'] },
          title: { type: 'STRING', description: 'Six words or fewer.' },
          detail: { type: 'STRING', description: 'One or two sentences, citing the actual numbers.' },
          metric: { type: 'STRING', description: 'The key figure, formatted with its currency.' },
          action: { type: 'STRING', description: 'One concrete step. Omit for good news.' },
        },
        required: ['kind', 'title', 'detail'],
      },
    },
  },
  required: ['headline', 'outlook', 'insights'],
}

const ANALYSIS_PROMPT = `You are a careful personal finance analyst reviewing one month of a
single person's own records. The JSON below is their real data.

Produce:
- headline: one sentence on what is actually happening with their spending.
- outlook: what the month looks like at this rate. Use projectedSpend and say
  plainly whether it lands over or under budget, and by how much.
- insights: between 3 and 6 points. Include at least one "good" when the data
  supports one, and mark genuine problems "warning". Use "watch" for things
  that are not yet a problem but are heading that way.

Rules that matter:
- Every claim must come from the numbers given. Cite them. Never invent a
  figure, a category or a merchant that is not in the data.
- Amounts are already in the base currency; write them with that currency code.
- daysElapsed of daysInMonth have passed. Early in a month a high projection is
  less certain — say so rather than alarming them over three days of data.
- If income is 0 they may simply not have recorded it yet. Do not conclude they
  have no income; note the gap instead.
- A category with no budget set is not overspending, it is unbudgeted.
- Be specific and brief. No generic advice like "make a budget" or "track your
  spending" — they already are. No greetings, no filler, no emoji.
- Address them as "you".`

export async function analyseFinances(snapshot: unknown, signal?: AbortSignal): Promise<Analysis> {
  const parsed = await callGemini<Analysis>({
    parts: [{ text: `${ANALYSIS_PROMPT}\n\nDATA:\n${JSON.stringify(snapshot)}` }],
    schema: ANALYSIS_SCHEMA,
    temperature: 0.2,
    signal,
  })
  return {
    headline: parsed.headline ?? '',
    outlook: parsed.outlook ?? '',
    insights: Array.isArray(parsed.insights) ? parsed.insights.filter((i) => i && i.title) : [],
    generatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Category suggestion (fallback for descriptions history has never seen)
// ---------------------------------------------------------------------------

export interface CategoryGuess {
  category: string
  subcategory?: string
  confidence: number
}

const GUESS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: { type: 'STRING', description: 'Must be copied exactly from the allowed list.' },
    subcategory: { type: 'STRING', description: 'Only from the sub-categories of the chosen category. Omit if unsure.' },
    confidence: { type: 'NUMBER', description: '0 to 1.' },
  },
  required: ['category', 'confidence'],
}

/**
 * Place one description into the user's categories.
 * Returns null rather than throwing — history covers most cases and the field
 * stays editable, so a failed suggestion is not worth interrupting anyone for.
 */
export async function suggestCategory(
  description: string,
  options: { name: string; subcategories: string[] }[],
  examples: { description: string; category: string; subcategory?: string }[],
  signal?: AbortSignal,
): Promise<CategoryGuess | null> {
  if (!KEY || !description.trim() || !options.length) return null

  const prompt = `Classify one expense description into exactly one of the allowed categories.

ALLOWED CATEGORIES (copy the name exactly):
${JSON.stringify(options)}

${examples.length ? `HOW THIS PERSON HAS LABELLED THINGS BEFORE:\n${JSON.stringify(examples)}\n` : ''}
DESCRIPTION: ${JSON.stringify(description)}

Pick the single best category. Add a sub-category only if one clearly fits and
it belongs to the category you chose. Never invent a name that is not listed.
Set confidence honestly: below 0.5 when the description is too vague to place.`

  try {
    const parsed = await callGemini<CategoryGuess>({
      parts: [{ text: prompt }],
      schema: GUESS_SCHEMA,
      model: FAST_MODEL,
      retries: 0,
      signal,
    })
    const allowed = options.find((o) => o.name.toLowerCase() === String(parsed.category).toLowerCase())
    if (!allowed) return null
    const sub = parsed.subcategory
      ? allowed.subcategories.find((x) => x.toLowerCase() === String(parsed.subcategory).toLowerCase())
      : undefined
    return { category: allowed.name, subcategory: sub, confidence: Number(parsed.confidence) || 0 }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Natural-language entry
// ---------------------------------------------------------------------------

export interface QuickEntry {
  description: string
  amount: number
  currency?: string
  date?: string
  category?: string
  subcategory?: string
  store?: string
  person?: string
  method?: string
  type: 'expense' | 'income'
}

const QUICK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['expense', 'income'] },
    description: { type: 'STRING', description: 'Short label for the entry, e.g. "Groceries".' },
    amount: { type: 'NUMBER' },
    currency: { type: 'STRING', enum: CURRENCY_ENUM },
    date: { type: 'STRING', description: 'yyyy-MM-dd, resolved from words like yesterday.' },
    category: { type: 'STRING', description: 'Exactly one of the allowed categories.' },
    subcategory: { type: 'STRING' },
    store: { type: 'STRING', description: 'Merchant, if one is named.' },
    person: { type: 'STRING', description: 'Only if one of the known people is named.' },
    method: { type: 'STRING', enum: METHOD_ENUM },
  },
  required: ['type', 'description', 'amount'],
}

/** Turn "240 at carrefour on groceries yesterday" into fields for the form. */
export async function parseQuickEntry(
  text: string,
  context: { today: string; currency: string; categories: { name: string; subcategories: string[] }[]; people: string[] },
  signal?: AbortSignal,
): Promise<QuickEntry> {
  const prompt = `Turn one line of natural language into a single money entry.

TODAY IS ${context.today}. Resolve "today", "yesterday", "last Friday" against it,
and never return a date in the future unless the text clearly states one.
DEFAULT CURRENCY: ${context.currency}. Only change it if the text names another.
ALLOWED CATEGORIES: ${JSON.stringify(context.categories)}
KNOWN PEOPLE: ${JSON.stringify(context.people)}

INPUT: ${JSON.stringify(text)}

Rules:
- type is "income" only for money coming in (salary, refund, payment received).
  Everything else is an expense.
- amount is a positive number, never negative.
- description is a short human label, not the raw sentence.
- category must be copied exactly from the allowed list; omit it if nothing fits.
- Only set person when one of the known people is actually named.
- Only set store when a merchant is named.
- Omit any field the text does not support. Never guess an amount.`

  const parsed = await callGemini<QuickEntry>({
    parts: [{ text: prompt }],
    schema: QUICK_SCHEMA,
    model: FAST_MODEL,
    signal,
  })

  if (!(Number(parsed.amount) > 0)) {
    throw new GeminiError('No amount found — try something like "240 groceries at Carrefour yesterday".', 200)
  }
  return { ...parsed, amount: Number(parsed.amount) }
}
