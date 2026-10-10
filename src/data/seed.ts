import type {
  Account, Bill, BudgetCategory, Doc, Dream, Goal, Loan, Note, Person, PriceWatch, Purchase, ScheduleBlock, Settings,
  Transaction, VisionWord,
} from '@/types'
/**
 * First and last day of the current month.
 *
 * Deliberately computed here rather than imported from lib/format: format.ts
 * imports FX from this file, so reaching back into it would make the two
 * modules circular and leave TODAY uninitialised at load time depending on
 * which one the bundler evaluates first.
 */
function currentPeriod(d = new Date()) {
  const y = d.getFullYear()
  const m = d.getMonth()
  const mm = String(m + 1).padStart(2, '0')
  const last = new Date(y, m + 1, 0).getDate()
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` }
}

const period = currentPeriod()

/**
 * Defaults for a brand-new account. Everything starts empty and at zero —
 * figures only appear once you enter your own.
 */
export const SETTINGS: Settings = {
  userName: 'Thomas',
  accountLabel: 'Personal Account',
  phone: '',
  baseCurrency: 'AED',
  monthlyIncomeTarget: 0,
  monthlyBudget: 0,
  periodStart: period.start,
  periodEnd: period.end,
}

/** Conversion rates into the AED base. Edit these to match your own. */
export const FX: Record<string, number> = { AED: 1, INR: 0.0434, USD: 3.6725 }

export const ACCOUNTS: Account[] = []
export const TRANSACTIONS: Transaction[] = []
export const BUDGETS: BudgetCategory[] = []
export const LOANS: Loan[] = []
export const PEOPLE: Person[] = []
export const BILLS: Bill[] = []
export const DOCUMENTS: Doc[] = []
export const NOTES: Note[] = []
export const GOALS: Goal[] = []
export const PURCHASES: Purchase[] = []
export const PRICE_WATCH: PriceWatch[] = []

// ---------------------------------------------------------------------------
// Vision board starters. A blank board teaches nothing, so a new account opens
// on a worked example it can edit or clear. Everything here is replaceable.
// ---------------------------------------------------------------------------

export const DREAMS: Dream[] = [
  { id: 'dr1', title: 'Family Travel', note: 'Explore the world together', emoji: '🏝️', color: '#0ea5e9', progress: 70, order: 0 },
  { id: 'dr2', title: 'Dream House', note: 'Our future home', emoji: '🏡', color: '#10b981', progress: 45, order: 1 },
  { id: 'dr3', title: 'Grow My Business', note: 'Multiple successful ventures', emoji: '📈', color: '#f59e0b', progress: 60, order: 2 },
  { id: 'dr4', title: 'Healthy & Fit', note: 'Stronger, healthier me', emoji: '💪', color: '#ef4444', progress: 50, order: 3 },
]

export const VISION_WORDS: VisionWord[] = [
  { id: 'vw1', word: 'Discipline', note: 'Do it every day', emoji: '🏆', color: '#f59e0b', order: 0 },
  { id: 'vw2', word: 'Health', note: 'My priority', emoji: '❤️', color: '#ef4444', order: 1 },
  { id: 'vw3', word: 'Family', note: 'Always together', emoji: '👨‍👩‍👧', color: '#3b82f6', order: 2 },
  { id: 'vw4', word: 'Focus', note: 'One step at a time', emoji: '🎯', color: '#8b5cf6', order: 3 },
  { id: 'vw5', word: 'Growth', note: 'Better than yesterday', emoji: '🌱', color: '#10b981', order: 4 },
  { id: 'vw6', word: 'Gratitude', note: 'Be thankful', emoji: '🙏', color: '#ec4899', order: 5 },
]

export const SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { id: 'sb1', label: 'Gym', kind: 'gym', start: '06:00', end: '07:00', order: 0 },
  { id: 'sb2', label: 'Shower & Breakfast', kind: 'personal', start: '07:00', end: '08:00', order: 1 },
  { id: 'sb3', label: 'Work / Business', kind: 'work', start: '08:00', end: '13:00', order: 2 },
  { id: 'sb4', label: 'Lunch & Rest', kind: 'rest', start: '13:00', end: '14:00', order: 3 },
  { id: 'sb5', label: 'Work / Meetings', kind: 'work', start: '14:00', end: '18:00', order: 4 },
  { id: 'sb6', label: 'Family Time', kind: 'family', start: '18:00', end: '19:00', order: 5 },
  { id: 'sb7', label: 'Personal / Learning', kind: 'personal', start: '19:00', end: '21:00', order: 6 },
  { id: 'sb8', label: 'Sleep', kind: 'sleep', start: '22:00', end: '06:00', order: 7 },
]
