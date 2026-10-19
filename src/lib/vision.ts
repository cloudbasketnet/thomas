import type { ActivityEntry, ActivityKind, Dream, ScheduleBlock } from '@/types'

// ============================================================================
// Vision board arithmetic. Pure — no store, no clock of its own — so every
// figure on the page can be checked in scripts/test-vision.mjs.
// ============================================================================

export const MINUTES_IN_DAY = 24 * 60

export const ACTIVITY: Record<ActivityKind, { label: string; color: string; emoji: string; rest: boolean }> = {
  gym: { label: 'Gym', color: '#10b981', emoji: '🏋️', rest: false },
  sleep: { label: 'Sleep', color: '#6366f1', emoji: '🌙', rest: true },
  rest: { label: 'Rest', color: '#38bdf8', emoji: '☕', rest: true },
  work: { label: 'Work', color: '#2563eb', emoji: '💼', rest: false },
  personal: { label: 'Personal', color: '#f59e0b', emoji: '📚', rest: false },
  family: { label: 'Family', color: '#ec4899', emoji: '👨‍👩‍👧', rest: false },
  other: { label: 'Other', color: '#94a3b8', emoji: '•', rest: false },
}

export const ACTIVITY_KINDS = Object.keys(ACTIVITY) as ActivityKind[]

/** "7h 30m", "45m", "0m" — the form the cards use. */
export function duration(minutes: number) {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (!h) return `${rest}m`
  return `${h}h ${rest}m`
}

/** Minutes since midnight for "HH:MM". NaN-safe: a malformed time counts as 0. */
export function clockMinutes(hhmm: string) {
  const [h, m] = (hhmm ?? '').split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return Math.min(MINUTES_IN_DAY, Math.max(0, h * 60 + m))
}

/**
 * How long a block runs. A block may wrap past midnight — sleep from 22:00 to
 * 06:00 is eight hours, not minus sixteen — so an end at or before the start
 * is read as the next day. Equal times mean a full day round, not zero.
 */
export function blockMinutes(block: Pick<ScheduleBlock, 'start' | 'end'>) {
  const from = clockMinutes(block.start)
  const to = clockMinutes(block.end)
  return to > from ? to - from : MINUTES_IN_DAY - from + to
}

/** Every block in order of when it starts, so the schedule always reads top to bottom. */
export function sortedSchedule(blocks: ScheduleBlock[]) {
  return [...blocks].sort((a, b) => clockMinutes(a.start) - clockMinutes(b.start) || a.order - b.order)
}

/**
 * How one day was spent. "Other" is whatever is left of the 24 hours after the
 * logged activities, so the three figures always add up to a whole day rather
 * than to however much happened to be recorded.
 */
export function dayAnalysis(entries: ActivityEntry[], date: string) {
  const forDay = entries.filter((e) => e.date === date)
  const byKind = {} as Record<ActivityKind, number>
  for (const k of ACTIVITY_KINDS) byKind[k] = 0
  for (const e of forDay) byKind[e.kind] = (byKind[e.kind] ?? 0) + Math.max(0, e.minutes)

  const rest = ACTIVITY_KINDS.filter((k) => ACTIVITY[k].rest).reduce((a, k) => a + byKind[k], 0)
  const gym = byKind.gym
  // A day cannot hold more than 24 hours of anything, however much was logged.
  const logged = Math.min(MINUTES_IN_DAY, rest + gym)
  const other = MINUTES_IN_DAY - logged

  const share = (m: number) => Math.round((m / MINUTES_IN_DAY) * 100)
  return {
    byKind,
    rest: Math.min(rest, MINUTES_IN_DAY),
    gym: Math.min(gym, MINUTES_IN_DAY),
    other,
    restPct: share(Math.min(rest, MINUTES_IN_DAY)),
    gymPct: share(Math.min(gym, MINUTES_IN_DAY)),
    otherPct: share(other),
    /** The window each covers, for the "From 22:00 - 06:00" line. */
    entries: forDay,
  }
}

/** How many days that month has — February and the short months included. */
export function daysInMonth(monthKey: string) {
  const year = Number(monthKey.slice(0, 4))
  const month = Number(monthKey.slice(5, 7))
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 30
  return new Date(year, month, 0).getDate()
}

/**
 * A month of rest and gym, day by day, for the overview bars. Averages are per
 * day of the month so far rather than per day with an entry — a week off the
 * gym should pull the average down, not vanish from it.
 */
export function monthAnalysis(entries: ActivityEntry[], monthKey: string, today?: string) {
  const total = daysInMonth(monthKey)
  const elapsed = today && today.slice(0, 7) === monthKey ? Math.min(total, Number(today.slice(8, 10))) : total

  const days = Array.from({ length: total }, (_, i) => {
    const date = `${monthKey}-${String(i + 1).padStart(2, '0')}`
    const a = dayAnalysis(entries, date)
    return { day: i + 1, date, rest: a.rest, gym: a.gym }
  })

  const restMinutes = days.reduce((a, d) => a + d.rest, 0)
  const gymMinutes = days.reduce((a, d) => a + d.gym, 0)
  const per = (m: number) => (elapsed ? m / 60 / elapsed : 0)
  return {
    days,
    restMinutes,
    gymMinutes,
    elapsed,
    restHoursPerDay: Math.round(per(restMinutes) * 10) / 10,
    gymHoursPerDay: Math.round(per(gymMinutes) * 10) / 10,
  }
}

/** Dreams in board order, with a safe progress figure. */
export function sortedDreams(dreams: Dream[]) {
  return [...dreams]
    .sort((a, b) => a.order - b.order)
    .map((d) => ({ ...d, progress: Math.min(100, Math.max(0, Math.round(d.progress || 0))) }))
}

/** Average progress across every dream — the "how is life going" number. */
export function dreamProgress(dreams: Dream[]) {
  if (!dreams.length) return 0
  const sum = sortedDreams(dreams).reduce((a, d) => a + d.progress, 0)
  return Math.round(sum / dreams.length)
}

// ---------------------------------------------------------------------------
// Plans: progress measured against how much of the plan's time has passed.
// ---------------------------------------------------------------------------

export type PlanStatus = 'Completed' | 'On Track' | 'In Progress' | 'Needs Attention' | 'Planned'

export const STATUS_TONE: Record<PlanStatus, { color: string; bg: string }> = {
  Completed: { color: '#059669', bg: '#ecfdf5' },
  'On Track': { color: '#16a34a', bg: '#f0fdf4' },
  'In Progress': { color: '#d97706', bg: '#fffbeb' },
  'Needs Attention': { color: '#dc2626', bg: '#fef2f2' },
  Planned: { color: '#64748b', bg: '#f8fafc' },
}

const dayNo = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000)

/**
 * Where a plan stands. Progress alone says little — 35% is excellent a month
 * in and alarming a month from the end — so it is read against the share of
 * the plan's window that has already gone:
 *
 *   on or ahead of the calendar, or no more than 5 points behind  → On Track
 *   up to 20 points behind                                        → In Progress
 *   further behind, or past the end date unfinished               → Needs Attention
 *
 * Not started yet is Planned; 100% is Completed whatever the calendar says.
 * Without both dates there is no window to measure against, so it falls back
 * to whether anything has happened yet.
 */
export function planTiming(d: Pick<Dream, 'progress' | 'startDate' | 'targetDate'>, today: string) {
  const progress = Math.min(100, Math.max(0, Math.round(d.progress || 0)))
  const hasWindow = Boolean(d.startDate && d.targetDate && d.targetDate > d.startDate!)

  const total = hasWindow ? dayNo(d.targetDate!) - dayNo(d.startDate!) : 0
  const done = hasWindow ? Math.min(total, Math.max(0, dayNo(today) - dayNo(d.startDate!))) : 0
  const left = d.targetDate ? Math.max(0, dayNo(d.targetDate) - dayNo(today)) : null
  const expected = hasWindow ? Math.round((done / total) * 100) : null

  let status: PlanStatus
  if (progress >= 100) status = 'Completed'
  else if (d.startDate && today < d.startDate) status = 'Planned'
  else if (d.targetDate && today > d.targetDate) status = 'Needs Attention'
  else if (expected === null) status = progress > 0 ? 'In Progress' : 'Planned'
  else {
    const behind = expected - progress
    status = behind <= 5 ? 'On Track' : behind <= 20 ? 'In Progress' : 'Needs Attention'
  }

  const explain: Record<PlanStatus, string> = {
    Completed: 'Done — well done.',
    'On Track': expected !== null ? `${progress}% done with ${expected}% of the time gone. Keep the pace.` : 'Moving along.',
    'In Progress': expected !== null ? `${progress}% done with ${expected}% of the time gone — a little behind.` : 'Under way.',
    'Needs Attention':
      d.targetDate && today > d.targetDate
        ? `The end date has passed at ${progress}%. Move the date or push to finish.`
        : `${progress}% done with ${expected}% of the time gone — falling behind.`,
    Planned: d.startDate && today < d.startDate ? `Starts ${d.startDate}.` : 'Not started yet.',
  }

  return { progress, status, total, done, left, expected, explain: explain[status] }
}

/** The year a plan lands in — the board is grouped by when things should be done. */
export const planYear = (d: Pick<Dream, 'targetDate' | 'startDate'>) =>
  (d.targetDate ?? d.startDate ?? '').slice(0, 4) || 'Someday'
