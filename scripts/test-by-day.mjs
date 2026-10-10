// Run: node --import ./scripts/register.mjs scripts/test-by-day.mjs
//
// byDay() backs the day-by-day table on the Income and Expenses dashboards.
// It has to agree with byCategory() to the dirham — the two sit on the same
// page, and a day total that does not add up to the category totals is worse
// than no table at all.
import assert from 'node:assert/strict'
import { byCategory, byDay, totals } from '../src/lib/selectors.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.stack.split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1 }
}

const M = '2026-10'
const tx = (id, date, amount, extra = {}) => ({
  id, date, type: 'expense', description: id, category: 'Groceries',
  accountId: 'bank', amount, currency: 'AED', ...extra,
})

console.log('\nGrouping by date')

test('one row per day, newest first', () => {
  const log = [tx('a', '2026-10-01', 100), tx('b', '2026-10-03', 50), tx('c', '2026-10-02', 25)]
  assert.deepEqual(byDay(log, 'expense', M).rows.map((r) => r.date), ['2026-10-03', '2026-10-02', '2026-10-01'])
})

test('several entries on one day add up and are counted', () => {
  const log = [tx('a', '2026-10-01', 100), tx('b', '2026-10-01', 50), tx('c', '2026-10-01', 25)]
  const [day] = byDay(log, 'expense', M).rows
  assert.equal(day.total, 175)
  assert.equal(day.count, 3)
})

test('a day with nothing on it is left out, not listed as a zero', () => {
  const log = [tx('a', '2026-10-01', 100), tx('b', '2026-10-05', 40)]
  assert.equal(byDay(log, 'expense', M).rows.length, 2)
})

test('another month is not counted', () => {
  const log = [tx('a', '2026-10-01', 100), tx('old', '2026-09-28', 999)]
  const d = byDay(log, 'expense', M)
  assert.equal(d.rows.length, 1)
  assert.equal(d.total, 100)
})

console.log('\nAgreeing with the rest of the page')

test('the day totals add up to the same figure as the category totals', () => {
  const log = [
    tx('a', '2026-10-01', 100, { category: 'Groceries' }),
    tx('b', '2026-10-02', 60, { category: 'Fuel' }),
    tx('c', '2026-10-02', 40, { category: 'Groceries' }),
    tx('d', '2026-10-07', 25, { category: 'Fuel' }),
  ]
  const byDayTotal = byDay(log, 'expense', M).total
  const byCatTotal = byCategory(log, 'expense', M).reduce((a, c) => a + c.value, 0)
  assert.equal(byDayTotal, byCatTotal)
  assert.equal(byDayTotal, totals(log, M).expenses)
})

test('a refund lowers its day the same way it lowers the month', () => {
  const log = [tx('buy', '2026-10-02', 200), tx('back', '2026-10-02', 50, { type: 'income', kind: 'refund' })]
  const d = byDay(log, 'expense', M)
  assert.equal(d.rows[0].total, 150, 'the refund comes off the day')
  assert.equal(d.total, totals(log, M).expenses)
})

test('an asset purchase is excluded, exactly as byCategory excludes it', () => {
  const log = [tx('food', '2026-10-02', 100), tx('car', '2026-10-02', 8000, { kind: 'asset_purchase' })]
  assert.equal(byDay(log, 'expense', M).total, 100)
})

test('income mode counts earned income only', () => {
  const log = [
    tx('salary', '2026-10-01', 5000, { type: 'income', category: 'Salary' }),
    tx('refund', '2026-10-01', 50, { type: 'income', kind: 'refund' }),
  ]
  const d = byDay(log, 'income', M)
  assert.equal(d.total, 5000, 'a refund is not earnings')
})

console.log('\nThe summary figures')

test('the top category is where most of that day went', () => {
  const log = [
    tx('a', '2026-10-02', 30, { category: 'Fuel' }),
    tx('b', '2026-10-02', 120, { category: 'Groceries' }),
  ]
  const [day] = byDay(log, 'expense', M).rows
  assert.equal(day.top, 'Groceries')
  assert.deepEqual(day.categories.map((c) => c.name), ['Groceries', 'Fuel'])
})

test('the average is over days with activity, not over the whole month', () => {
  const log = [tx('a', '2026-10-01', 100), tx('b', '2026-10-02', 200)]
  assert.equal(byDay(log, 'expense', M).average, 150)
})

test('the busiest day is the one that cost the most', () => {
  const log = [tx('a', '2026-10-01', 100), tx('b', '2026-10-09', 400), tx('c', '2026-10-03', 250)]
  assert.equal(byDay(log, 'expense', M).busiest.date, '2026-10-09')
})

test('an empty month gives no rows and no divide by zero', () => {
  const d = byDay([], 'expense', M)
  assert.deepEqual(d.rows, [])
  assert.equal(d.total, 0)
  assert.equal(d.average, 0)
  assert.equal(d.busiest, undefined)
})

console.log('\nCurrencies')

test('a foreign-currency day is converted, not added raw', () => {
  const log = [tx('inr', '2026-10-02', 10000, { currency: 'INR' }), tx('aed', '2026-10-02', 100)]
  const [day] = byDay(log, 'expense', M).rows
  assert.ok(day.total > 100 && day.total < 10100, `10,000 INR is not 10,000 AED — got ${day.total}`)
  assert.equal(Math.round(day.total), Math.round(byCategory(log, 'expense', M).reduce((a, c) => a + c.value, 0)))
})

console.log(`\n${n} passed`)
