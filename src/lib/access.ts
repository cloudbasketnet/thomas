import type { HouseholdMember } from '@/types'

/** Which permission section each screen belongs to. The database enforces the same sections. */
export const PATH_SECTION: Record<string, string> = {
  '/accounts': 'accounts', '/income': 'transactions', '/income-planning': 'income', '/expenses': 'transactions', '/expense-report': 'transactions',
  '/categories': 'transactions', '/reports': 'transactions', '/profit-loss': 'transactions', '/budget': 'budget',
  '/loans': 'loans', '/people': 'people', '/bills': 'bills', '/calendar': 'bills', '/documents': 'documents',
  '/notes': 'notes', '/installments': 'notes', '/goals': 'goals', '/price-tracker': 'shopping', '/shopping': 'shopping',
  '/assets': 'assets', '/ai-advisor': 'advisor', '/ai-employees': 'advisor',
}

/** Does this user hold one specific permission? The owner (no membership row) holds all of them. */
export function hasSection(member: HouseholdMember | null, section: string) {
  if (!member) return true
  return member.sections.includes('*') || member.sections.includes(section)
}

/**
 * Should this screen be offered to this user? The owner sees everything. This is
 * a convenience for the menus — the real protection is row level security in
 * the database, which refuses the data itself.
 */
export function canOpen(member: HouseholdMember | null, path: string) {
  if (!member) return true
  const base = '/' + path.replace(/^\//, '').split('/')[0]
  const section = PATH_SECTION[base]
  if (!section) return true // dashboard, settings
  if (member.sections.includes('*')) return true
  // Loans & EMIs is one screen over two permissions. Someone granted only one
  // of them still opens the page; the page itself shows just their half.
  if (base === '/loans') return member.sections.includes('loans') || member.sections.includes('notes')
  return member.sections.includes(section)
}
