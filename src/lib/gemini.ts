/**
 * Bill/receipt scanning through the Gemini API.
 *
 * SECURITY: the key ships in the browser bundle, so anyone who can open the
 * app can read it and spend against your quota. That is acceptable for a
 * personal build; before putting this anywhere public, move the call behind a
 * Supabase Edge Function and keep the key server-side. Restrict the key to the
 * Generative Language API in Google AI Studio either way.
 */
import type { Purchase } from '@/types'

// Injected by vite.config.ts, which accepts either VITE_GEMINI_API_KEY or
// GEMINI_API_KEY so the same code works locally and on hosts that will not
// store a VITE_-prefixed name.
declare const __GEMINI_API_KEY__: string
declare const __GEMINI_MODEL__: string

const KEY = __GEMINI_API_KEY__ || undefined
const MODEL = __GEMINI_MODEL__ || 'gemini-3.6-flash'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export const hasGemini = Boolean(KEY)

/** Categories the model may choose from — kept in step with the purchase form. */
export const PURCHASE_CATEGORIES = [
  'Electronics', 'Furniture', 'Appliances', 'Groceries', 'Kids',
  'Automotive', 'Business', 'Clothing', 'Health', 'Other',
] as const

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

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    store: { type: 'STRING', description: 'Shop or merchant name' },
    date: { type: 'STRING', description: 'Purchase date as yyyy-MM-dd' },
    currency: { type: 'STRING', enum: ['AED', 'INR', 'USD'] },
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
          weightUnit: { type: 'STRING', enum: ['kg', 'g', 'lb', 'oz', 'L', 'ml'] },
        },
        required: ['item', 'category', 'qty', 'price'],
      },
    },
  },
  required: ['store', 'date', 'currency', 'total', 'items'],
}

const PROMPT = `You are reading a shopping receipt, invoice or bill.

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

/** Strip the `data:*;base64,` prefix a FileReader data URL carries. */
function toBase64(dataUrl: string) {
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

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
function friendlyError(status: number, message: string) {
  if (status === 429) {
    return message.includes('free_tier')
      ? 'Gemini’s free tier allows only a few requests a minute and that limit was just hit. Wait a moment and try again.'
      : `Rate limited by Gemini. ${message}`
  }
  if (status === 503) return 'Gemini is busy right now. Try again in a moment.'
  return message
}

/**
 * Send a bill image to Gemini and get its line items back.
 * The API returns 503 under load often enough to be worth retrying.
 */
export async function scanBill(dataUrl: string, mimeType: string, signal?: AbortSignal): Promise<ScannedBill> {
  if (!KEY) throw new Error('No Gemini API key — set GEMINI_API_KEY (or VITE_GEMINI_API_KEY) and rebuild.')

  const body = {
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: toBase64(dataUrl) } }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
  }

  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (res.ok) {
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Gemini returned no readable content for that image.')
      const parsed = JSON.parse(text) as ScannedBill
      return { ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] }
    }

    const detail = await res.json().catch(() => null)
    const raw = detail?.error?.message ?? `Request failed (${res.status})`
    lastError = friendlyError(res.status, raw)

    // 503 is transient overload; 429 is rate limiting. Both are worth retrying.
    if (res.status !== 503 && res.status !== 429) break
    if (attempt < 2) await sleep(retryDelayMs(detail?.error, attempt))
  }

  throw new Error(lastError || 'Gemini could not be reached.')
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
  /** One sentence on what is happening right now. */
  headline: string
  /** Where the month lands if nothing changes. */
  outlook: string
  insights: Insight[]
  /** When this was produced, so the UI can say how stale it is. */
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

/** Ask Gemini to read the snapshot and report what it sees. */
export async function analyseFinances(snapshot: unknown, signal?: AbortSignal): Promise<Analysis> {
  if (!KEY) throw new Error('No Gemini API key — set GEMINI_API_KEY (or VITE_GEMINI_API_KEY) and rebuild.')

  const body = {
    contents: [{ parts: [{ text: `${ANALYSIS_PROMPT}\n\nDATA:\n${JSON.stringify(snapshot)}` }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: ANALYSIS_SCHEMA, temperature: 0.2 },
  }

  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (res.ok) {
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Gemini returned no analysis.')
      const parsed = JSON.parse(text) as Analysis
      return {
        headline: parsed.headline ?? '',
        outlook: parsed.outlook ?? '',
        insights: Array.isArray(parsed.insights) ? parsed.insights.filter((i) => i && i.title) : [],
        generatedAt: new Date().toISOString(),
      }
    }

    const detail = await res.json().catch(() => null)
    const raw = detail?.error?.message ?? `Request failed (${res.status})`
    lastError = friendlyError(res.status, raw)
    if (res.status !== 503 && res.status !== 429) break
    if (attempt < 2) await sleep(retryDelayMs(detail?.error, attempt))
  }

  throw new Error(lastError || 'Gemini could not be reached.')
}
