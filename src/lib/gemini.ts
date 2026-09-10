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
    if (attempt) await sleep(attempt * 1500)

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
    lastError = detail?.error?.message ?? `Request failed (${res.status})`

    // 503 is transient overload; 429 is rate limiting. Both are worth retrying.
    if (res.status !== 503 && res.status !== 429) break
  }

  throw new Error(lastError || 'Gemini could not be reached.')
}
