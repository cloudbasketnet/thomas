// Run: node --import ./scripts/register.mjs scripts/test-schedule-gen.mjs
// Building an instalment schedule from any two of: total, monthly, months.
import assert from 'node:assert/strict'
import { addMonthsClamped, generateSchedule, resolvePlan, MAX_INSTALLMENTS } from '../src/lib/schedules.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.message); process.exitCode = 1 }
}

let seq = 0
const gen = (over = {}) =>
  generateSchedule({ mode: 'total-count', total: 3000, count: 4, start: '2026-10-15', currency: 'AED', makeId: () => `i${++seq}`, ...over })
const sum = (rows) => Math.round(rows.reduce((a, r) => a + r.amount, 0) * 100) / 100

console.log('Stepping a month at a time')
test('an ordinary date just moves month by month', () => {
  assert.equal(addMonthsClamped('2026-10-15', 0), '2026-10-15')
  assert.equal(addMonthsClamped('2026-10-15', 3), '2027-01-15')
})
test('the 31st lands on the last day of a shorter month, not in the month after', () => {
  assert.equal(addMonthsClamped('2026-10-31', 1), '2026-11-30')
  assert.equal(addMonthsClamped('2026-12-31', 2), '2027-02-28')
})
test('each step is measured from the start, so one short month does not drag the rest', () => {
  assert.equal(addMonthsClamped('2026-10-31', 2), '2026-12-31')
})

console.log('\nTotal & months — the monthly amount is worked out')
test('the total is split evenly', () => {
  const p = resolvePlan('total-count', { total: 3000, count: 4 })
  assert.equal(p.per, 750)
  assert.equal(p.count, 4)
  assert.equal(p.total, 3000)
})
test('a total that does not divide evenly still adds up to exactly the total', () => {
  const rows = gen({ total: 1000, count: 3 })
  assert.deepEqual(rows.map((r) => r.amount), [333.33, 333.33, 333.34])
  assert.equal(sum(rows), 1000)
})

console.log('\nTotal & monthly — the NUMBER OF MONTHS is worked out')
test('8,600 at 2,150 a month is four instalments', () => {
  const p = resolvePlan('total-monthly', { total: 8600, monthly: 2150 })
  assert.equal(p.count, 4)
  assert.equal(p.per, 2150)
  assert.equal(p.last, 2150)
  assert.equal(p.total, 8600)
})
test('a remainder becomes a smaller final payment, as a real EMI plan does', () => {
  const p = resolvePlan('total-monthly', { total: 10000, monthly: 3000 })
  assert.equal(p.count, 4)
  assert.equal(p.last, 1000)
  const rows = gen({ mode: 'total-monthly', total: 10000, monthly: 3000, count: undefined })
  assert.deepEqual(rows.map((r) => r.amount), [3000, 3000, 3000, 1000])
  assert.equal(sum(rows), 10000)
})
test('the generated dates run monthly from the start date', () => {
  const rows = gen({ mode: 'total-monthly', total: 8600, monthly: 2150, count: undefined })
  assert.deepEqual(rows.map((r) => r.dueDate), ['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15'])
})
test('a monthly amount bigger than the total is simply one payment', () => {
  const p = resolvePlan('total-monthly', { total: 500, monthly: 2000 })
  assert.equal(p.count, 1)
  assert.equal(p.last, 500)
  assert.equal(sum(gen({ mode: 'total-monthly', total: 500, monthly: 2000, count: undefined })), 500)
})
test('an awkward division never loses or invents money', () => {
  const rows = gen({ mode: 'total-monthly', total: 1000, monthly: 333.33, count: undefined })
  assert.equal(rows.length, 4) // ceil(1000 / 333.33)
  assert.equal(sum(rows), 1000)
  assert.equal(rows[3].amount, 0.01)
})
test('a monthly amount too small for the total is refused rather than hanging the browser', () => {
  const p = resolvePlan('total-monthly', { total: 1_000_000, monthly: 1 })
  assert.equal(p.capped, true)
  assert.equal(p.valid, false)
  assert.equal(p.count, MAX_INSTALLMENTS)
  assert.deepEqual(gen({ mode: 'total-monthly', total: 1_000_000, monthly: 1, count: undefined }), [])
})

console.log('\nMonthly & months — the total is worked out')
test('the monthly amount is repeated and the total follows', () => {
  const p = resolvePlan('monthly-count', { monthly: 500, count: 6 })
  assert.equal(p.total, 3000)
  assert.equal(p.last, 500)
})
test('every instalment is the amount agreed — the last one is not adjusted', () => {
  const rows = gen({ mode: 'monthly-count', monthly: 333.33, count: 3, total: undefined })
  assert.deepEqual(rows.map((r) => r.amount), [333.33, 333.33, 333.33])
})

console.log('\nThe three modes agree with each other')
test('3,000 over 6, 500 a month for 6, and 3,000 at 500 a month are one plan', () => {
  const a = gen({ mode: 'total-count', total: 3000, count: 6 }).map((r) => r.amount)
  const b = gen({ mode: 'monthly-count', monthly: 500, count: 6, total: undefined }).map((r) => r.amount)
  const c = gen({ mode: 'total-monthly', total: 3000, monthly: 500, count: undefined }).map((r) => r.amount)
  assert.deepEqual(a, b)
  assert.deepEqual(b, c)
})

console.log('\nGuards')
test('a mode is invalid until BOTH of its figures are entered', () => {
  assert.equal(resolvePlan('total-monthly', { total: 8600 }).valid, false)
  assert.equal(resolvePlan('total-monthly', { monthly: 2150 }).valid, false)
  assert.equal(resolvePlan('total-count', { total: 8600, count: 0 }).valid, false)
  assert.equal(resolvePlan('monthly-count', { monthly: 0, count: 4 }).valid, false)
})
test('zero, blank and negative figures generate nothing', () => {
  assert.deepEqual(gen({ total: 0 }), [])
  assert.deepEqual(gen({ total: NaN }), [])
  assert.deepEqual(gen({ total: -500 }), [])
})
test('the currency asked for is stamped on every instalment', () => {
  const rows = gen({ mode: 'total-monthly', total: 15000, monthly: 5000, count: undefined, currency: 'INR' })
  assert.equal(rows.length, 3)
  assert.ok(rows.every((r) => r.currency === 'INR'))
  assert.ok(rows.every((r) => r.remindDays === 7))
})

console.log(`
${n} passed`)
