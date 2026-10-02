// Run: node --import ./scripts/register.mjs scripts/test-forecast-position.mjs
// The Financial Forecast's "this month" block — what is still to pay, and
// whether the balance covers it.
import assert from 'node:assert/strict'
import { currentMonthPosition } from '../src/lib/forecast.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.message); process.exitCode = 1 }
}

const same = (amount) => amount // the test works in one currency
const item = (sourceKind, amount, status = 'Planned') => ({
  key: `k-${sourceKind}-${amount}-${status}`, month: '2026-10', name: sourceKind, category: 'Other',
  amount, currency: 'AED', sourceKind, sourceKey: `sk-${sourceKind}-${amount}-${status}`,
  status, needsInput: false, reason: '', edited: false,
})

console.log('This month’s position')

test('remaining = the budget still unspent, plus every unpaid commitment', () => {
  const p = currentMonthPosition({
    balance: 2169, budget: 1400, spentSoFar: 0,
    items: [item('loan', 0), item('bill', 0)], toReport: same,
  })
  assert.equal(p.budgetLeft, 1400)
  assert.equal(p.remaining, 1400)
  assert.equal(p.balanceAfter, 769)
  assert.equal(p.extraNeeded, 0)
  assert.equal(p.covered, true)
})

test('what has already been spent comes out of the budget, never counted twice', () => {
  const p = currentMonthPosition({ balance: 2000, budget: 1400, spentSoFar: 900, items: [], toReport: same })
  assert.equal(p.budgetLeft, 500)
  assert.equal(p.remaining, 500)
})

test('overspending the budget cannot make the remaining figure negative', () => {
  const p = currentMonthPosition({ balance: 2000, budget: 1400, spentSoFar: 3000, items: [], toReport: same })
  assert.equal(p.budgetLeft, 0)
  assert.equal(p.remaining, 0)
})

test('commitments are split by where they came from', () => {
  const p = currentMonthPosition({
    balance: 5000, budget: 1000, spentSoFar: 0,
    items: [item('loan', 950), item('schedule', 1200), item('bill', 450), item('note', 50)],
    toReport: same,
  })
  assert.equal(p.loanEmi, 950)
  assert.equal(p.installments, 1200)
  assert.equal(p.otherPlanned, 500) // bill + note
  assert.equal(p.remaining, 3650)   // + 1000 budget
})

test('paid and dismissed items are not still to pay', () => {
  const p = currentMonthPosition({
    balance: 5000, budget: 0, spentSoFar: 0,
    items: [item('bill', 400, 'Paid'), item('bill', 300, 'Dismissed'), item('bill', 200, 'Overdue')],
    toReport: same,
  })
  assert.equal(p.remaining, 200) // only the overdue one is still owed
})

test('an item with no amount entered yet adds nothing rather than NaN', () => {
  const blank = { ...item('bill', 0), amount: undefined, needsInput: true }
  const p = currentMonthPosition({ balance: 100, budget: 0, spentSoFar: 0, items: [blank], toReport: same })
  assert.equal(p.remaining, 0)
  assert.equal(p.balanceAfter, 100)
})

test('a month that does not cover reports exactly what is short', () => {
  const p = currentMonthPosition({ balance: 1000, budget: 1500, spentSoFar: 0, items: [item('loan', 800)], toReport: same })
  assert.equal(p.remaining, 2300)
  assert.equal(p.balanceAfter, -1300)
  assert.equal(p.extraNeeded, 1300)
  assert.equal(p.covered, false)
  assert.equal(p.reservedShare, 1) // the bar never claims more than the whole balance
})

test('planned income is never added to the current balance', () => {
  // Until a salary lands it cannot pay a bill, so it must not close a shortfall
  // on this screen. currentMonthPosition takes no income at all, by design.
  const p = currentMonthPosition({ balance: 500, budget: 1000, spentSoFar: 0, items: [], toReport: same })
  assert.equal(p.balanceAfter, -500)
  assert.equal(p.extraNeeded, 500)
})

test('suggested items are counted in, and counted separately so it can be said', () => {
  const p = currentMonthPosition({
    balance: 900, budget: 0, spentSoFar: 0,
    items: [item('bill', 100, 'Suggested'), item('bill', 200, 'Planned')],
    toReport: same,
  })
  assert.equal(p.remaining, 300)
  assert.equal(p.suggestedCount, 1)
})

test('an empty month is zero, and the share never divides by zero', () => {
  const p = currentMonthPosition({ balance: 0, budget: 0, spentSoFar: 0, items: [], toReport: same })
  assert.equal(p.remaining, 0)
  assert.equal(p.reservedShare, 0)
  assert.equal(p.covered, true)
})

test('a currency is converted before it is added in', () => {
  const inr = { ...item('schedule', 100000), currency: 'INR' }
  const p = currentMonthPosition({
    balance: 10000, budget: 0, spentSoFar: 0, items: [inr],
    toReport: (amount, c) => amount * (c === 'INR' ? 0.0434 : 1),
  })
  assert.equal(Math.round(p.installments), 4340)
})

console.log(`
${n} passed`)
