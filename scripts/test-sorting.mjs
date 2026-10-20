// Run: node --import ./scripts/register.mjs scripts/test-sorting.mjs
import assert from 'node:assert/strict'
import { loanSortView, planSortView, sortBy } from '../src/lib/sorting.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.stack.split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1 }
}

const loan = (name, nextPayment, outstanding, extra = {}) => ({
  id: name, name, lender: '', outstanding, principal: outstanding, emi: 100, nextPayment,
  currency: 'AED', status: 'On Track', rate: 0, icon: '', ...extra,
})
const names = (xs) => xs.map((x) => x.name)

const loans = [
  loan('Car', '2026-11-05', 30000),
  loan('Agriculture', '2026-10-25', 15000),
  loan('Tabby', '2026-12-01', 3000),
]

console.log('\nLoans')

test('soonest first', () => {
  assert.deepEqual(names(sortBy(loans, 'due-asc', loanSortView)), ['Agriculture', 'Car', 'Tabby'])
})

test('latest first', () => {
  assert.deepEqual(names(sortBy(loans, 'due-desc', loanSortView)), ['Tabby', 'Car', 'Agriculture'])
})

test('largest amount first', () => {
  assert.deepEqual(names(sortBy(loans, 'amount-desc', loanSortView)), ['Car', 'Agriculture', 'Tabby'])
})

test('by name', () => {
  assert.deepEqual(names(sortBy(loans, 'name', loanSortView)), ['Agriculture', 'Car', 'Tabby'])
})

test('a closed loan goes last in a date order, in both directions', () => {
  const xs = [...loans, loan('Old', '2026-01-01', 0, { status: 'Closed' })]
  assert.equal(names(sortBy(xs, 'due-asc', loanSortView)).at(-1), 'Old')
  assert.equal(names(sortBy(xs, 'due-desc', loanSortView)).at(-1), 'Old')
})

test('amounts in different currencies compare after conversion', () => {
  // 300,000 rupees is far less than 30,000 dirhams.
  const xs = [loan('Rupee', '2026-11-01', 300000, { currency: 'INR' }), loan('Dirham', '2026-11-01', 30000)]
  assert.deepEqual(names(sortBy(xs, 'amount-desc', loanSortView)), ['Dirham', 'Rupee'])
})

test('same date falls back to name, so the order never jumps about', () => {
  const xs = [loan('B', '2026-11-01', 1), loan('A', '2026-11-01', 1)]
  assert.deepEqual(names(sortBy(xs, 'due-asc', loanSortView)), ['A', 'B'])
})

test('the input list is not reordered in place', () => {
  const copy = [...loans]
  sortBy(loans, 'name', loanSortView)
  assert.deepEqual(loans, copy)
})

console.log('\nInstalment plans')

const plans = [
  { title: 'School fees', s: { nextDate: '2026-11-10', outstanding: 2000 }, c: 'AED' },
  { title: 'Phone', s: { nextDate: '2026-10-28', outstanding: 900 }, c: 'AED' },
  { title: 'Sofa', s: { nextDate: undefined, outstanding: 0 }, c: 'AED' },
]
const view = (p) => planSortView(p.title, p.s, p.c)
const titles = (xs) => xs.map((x) => x.title)

test('soonest unpaid instalment first, paid-off plans last', () => {
  assert.deepEqual(titles(sortBy(plans, 'due-asc', view)), ['Phone', 'School fees', 'Sofa'])
})

test('latest first still keeps the paid-off plan at the end', () => {
  assert.deepEqual(titles(sortBy(plans, 'due-desc', view)), ['School fees', 'Phone', 'Sofa'])
})

test('largest remaining first', () => {
  assert.deepEqual(titles(sortBy(plans, 'amount-desc', view)), ['School fees', 'Phone', 'Sofa'])
})

console.log(`\n${n} passed`)
