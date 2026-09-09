import type { Currency } from '@/types'
import { FX } from '@/data/seed'

export const SYMBOL: Record<Currency, string> = { AED: 'AED', INR: '₹', USD: '$' }

export function money(value: number, currency: Currency = 'AED', decimals = 0) {
  const n = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const sign = value < 0 ? '-' : ''
  return currency === 'AED' ? `${sign}AED ${n}` : `${sign}${SYMBOL[currency]} ${n}`
}

export function compact(value: number) {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`
  return String(value)
}

/** Convert any amount into the base currency (AED). */
export function toBase(amount: number, from: Currency = 'AED') {
  return amount * (FX[from] ?? 1)
}

export function convert(amount: number, from: Currency, to: Currency) {
  return (amount * (FX[from] ?? 1)) / (FX[to] ?? 1)
}

export function pct(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function shortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`
}

/** App "today" — the seeded dataset lives in September 2026. */
export const TODAY = '2026-09-09'

export function daysLeft(iso: string, from: string = TODAY) {
  const a = new Date(from + 'T00:00:00').getTime()
  const b = new Date(iso + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

export function monthKey(iso: string) {
  return iso.slice(0, 7)
}

export function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}
