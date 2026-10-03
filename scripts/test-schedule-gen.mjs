// Run: node --import ./scripts/register.mjs scripts/test-schedule-gen.mjs
// Building an instalment schedule from either the total or the monthly amount.
import assert from 'node:assert/strict'
import { addMonthsClamped, generatePreview, generateSchedule } from '../src/lib/schedules.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.message); process.exitCode = 1 }
}

let seq = 0
const gen = (over = {}) =>
  generateSchedule({ mode: 'total', amount: 3000, count: 4, start: '2026-10-15', currency: 'AED', makeId: () => `i${++seq}`, ...over })

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
  // 31 Oct + 1 is clamped to 30 Nov, but + 2 must still be 31 Dec.
  assert.equal(addMonthsClamped('2026-10-31', 2), '2026-12-31')
})

console.log('\nFrom the total')
test('the total is split evenly across the instalments', () => {
  const rows = gen()
  assert.equal(rows.length, 4)
  assert.deepEqual(rows.map((r) => r.amount), [750, 750, 750, 750])
  assert.deepEqual(rows.map((r) => r.dueDate), ['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15'])
})
test('a total that does not divide evenly still adds up to exactly the total', () => {
  const rows = gen({ amount: 1000, count: 3 })
  assert.deepEqual(rows.map((r) => r.amount), [333.33, 333.33, 333.34])
  assert.equal(rows.reduce((a, r) => a + r.amount, 0), 1000)
})

console.log('\nFrom the monthly amount')
test('the monthly amount is repeated, and the total follows from it', () => {
  const rows = gen({ mode: 'monthly', amount: 500, count: 6 })
  assert.equal(rows.length, 6)
  assert.deepEqual(rows.map((r) => r.amount), [500, 500, 500, 500, 500, 500])
  assert.equal(rows.reduce((a, r) => a + r.amount, 0), 3000)
})
test('every instalment is the amount asked for — the last one is not adjusted', () => {
  const rows = gen({ mode: 'monthly', amount: 333.33, count: 3 })
  assert.deepEqual(rows.map((r) => r.amount), [333.33, 333.33, 333.33])
})
test('the two modes meet: 500 a month for 6 is the same as 3,000 over 6', () => {
  const a = gen({ mode: 'monthly', amount: 500, count: 6 }).map((r) => r.amount)
  const b = gen({ mode: 'total', amount: 3000, count: 6 }).map((r) => r.amount)
  assert.deepEqual(a, b)
})

console.log('\nGuards and the preview')
test('nothing is generated from a blank, zero or negative amount', () => {
  assert.deepEqual(gen({ amount: 0 }), [])
  assert.deepEqual(gen({ amount: NaN }), [])
  assert.deepEqual(gen({ amount: -500 }), [])
})
test('a count below one still makes a single instalment rather than none', () => {
  assert.equal(gen({ count: 0 }).length, 1)
  assert.equal(gen({ count: NaN }).length, 1)
})
test('the preview reports the figure the user did not type', () => {
  assert.deepEqual(generatePreview('total', 3000, 4), { per: 750, total: 3000, count: 4 })
  assert.deepEqual(generatePreview('monthly', 750, 4), { per: 750, total: 3000, count: 4 })
})
test('the preview is zero until something is entered, never NaN', () => {
  assert.deepEqual(generatePreview('total', NaN, 4), { per: 0, total: 0, count: 4 })
  assert.deepEqual(generatePreview('monthly', 0, 0), { per: 0, total: 0, count: 1 })
})
test('the currency asked for is stamped on every instalment', () => {
  const rows = gen({ mode: 'monthly', amount: 5000, count: 3, currency: 'INR' })
  assert.ok(rows.every((r) => r.currency === 'INR'))
  assert.ok(rows.every((r) => r.remindDays === 7))
})

console.log(`
${n} passed`)
