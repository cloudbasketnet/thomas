import type { CardSize, CardStyle, CategoryColors, Density, StatusColors, ThemeColor, ThemeMode } from '@/types'

export interface ThemeSettings {
  mode: ThemeMode
  color: ThemeColor
  cardStyle: CardStyle
  cardSize: CardSize
  density: Density
  /** The highlight colour: the active nav pill, and anything that picks it up. */
  accent: string
  /** A brand colour of the user's own. When set it overrides the named `color` preset. */
  brandCustom?: string
  categoryColors: CategoryColors
  statusColors: StatusColors
}

export const DEFAULT_CATEGORY_COLORS: CategoryColors = { budget: '#0ea5e9', income: '#22c55e', loan: '#a855f7', installment: '#f59e0b' }
export const DEFAULT_STATUS_COLORS: StatusColors = { healthy: '#10b981', stable: '#3b82f6', tight: '#f59e0b', warning: '#f97316', deficit: '#ef4444' }

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'light', color: 'blue', cardStyle: 'soft', cardSize: 'Standard', density: 'Compact', accent: '#ffd84d',
  categoryColors: DEFAULT_CATEGORY_COLORS, statusColors: DEFAULT_STATUS_COLORS,
}

export const COLOR_SWATCH: Record<ThemeColor, { label: string; from: string; to: string }> = {
  blue: { label: 'Ocean', from: '#3b82f6', to: '#1d4ed8' },
  emerald: { label: 'Emerald', from: '#10b981', to: '#047857' },
  violet: { label: 'Violet', from: '#8b5cf6', to: '#6d28d9' },
  rose: { label: 'Rose', from: '#f43f5e', to: '#be123c' },
  amber: { label: 'Amber', from: '#f59e0b', to: '#b45309' },
  slate: { label: 'Graphite', from: '#64748b', to: '#334155' },
}

const KEY = 'cloudbasket360-theme'

/** Last-used theme on THIS device, so the page never flashes the wrong look before settings load. */
export function readCachedTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) }
  } catch { /* private mode */ }
  return DEFAULT_THEME
}


/**
 * How light a colour reads, 0 to 1 — the sRGB relative luminance, the same
 * measure WCAG uses. Needed because the accent is a user's free choice: the
 * active nav pill puts text on top of it, and ink-on-navy would be unreadable
 * where ink-on-yellow is fine.
 */
export function luminance(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (!Number.isFinite(n) || full.length !== 6) return 1
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const r = channel((n >> 16) & 255)
  const g = channel((n >> 8) & 255)
  const b = channel(n & 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Text that stays readable on a given background. */
export const readableOn = (hex: string) => (luminance(hex) > 0.45 ? '#0f2744' : '#ffffff')

function applyAccent(root: HTMLElement, accent: string) {
  root.style.setProperty('--color-accent-300', accent)
  root.style.setProperty('--accent-ink', readableOn(accent))
}


/** A hex to its three channels, or null if it is not a six-digit hex. */
function rgb(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return null
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')

/**
 * A full 50-900 ramp from a single colour, so a brand colour chosen with the
 * picker behaves like one of the built-in palettes: the light end mixes toward
 * white for tinted backgrounds, the dark end toward black for text and hovers,
 * and 500 is exactly what was picked.
 */
export function brandScale(hex: string): Record<string, string> | null {
  const c = rgb(hex)
  if (!c) return null
  const mix = (t: number, toward: number) => ({
    r: c.r + (toward - c.r) * t,
    g: c.g + (toward - c.g) * t,
    b: c.b + (toward - c.b) * t,
  })
  const out = (m: { r: number; g: number; b: number }) => `#${hex2(m.r)}${hex2(m.g)}${hex2(m.b)}`
  return {
    '50': out(mix(0.92, 255)), '100': out(mix(0.84, 255)), '200': out(mix(0.68, 255)),
    '300': out(mix(0.46, 255)), '400': out(mix(0.24, 255)), '500': out(mix(0, 0)),
    '600': out(mix(0.16, 0)), '700': out(mix(0.32, 0)), '800': out(mix(0.46, 0)), '900': out(mix(0.6, 0)),
  }
}

function applyBrand(root: HTMLElement, custom?: string) {
  const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
  const scale = custom ? brandScale(custom) : null
  // Clearing the inline values hands the colour back to the [data-color] rules.
  for (const step of steps) {
    if (scale) root.style.setProperty(`--color-brand-${step}`, scale[step])
    else root.style.removeProperty(`--color-brand-${step}`)
  }
}

export function applyTheme(t: ThemeSettings) {
  const dark = t.mode === 'dark' || (t.mode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.color = t.color
  root.dataset.cards = t.cardStyle
  root.dataset.cardSize = (t.cardSize ?? DEFAULT_THEME.cardSize).toLowerCase()
  root.dataset.density = (t.density ?? DEFAULT_THEME.density).toLowerCase()
  applyAccent(root, t.accent ?? DEFAULT_THEME.accent)
  applyBrand(root, t.brandCustom)
  root.style.colorScheme = dark ? 'dark' : 'light'
  try { localStorage.setItem(KEY, JSON.stringify(t)) } catch { /* ignore */ }
}

/** The public login page is always light; only the signed-in app follows the theme. */
export function resetTheme() {
  const root = document.documentElement
  root.dataset.theme = 'light'
  root.dataset.color = 'blue'
  root.dataset.cards = 'soft'
  root.dataset.cardSize = 'standard'
  root.dataset.density = 'compact'
  applyAccent(root, DEFAULT_THEME.accent)
  applyBrand(root, undefined)
  root.style.colorScheme = 'light'
}
