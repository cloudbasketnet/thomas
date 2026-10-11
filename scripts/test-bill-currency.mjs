// Run: node --import ./scripts/register.mjs scripts/test-bill-currency.mjs
//
// A bill is billed in its own currency. Every figure that adds bills together
// has to convert first — a 10,000 rupee bill is not a 10,000 dirham bill, and
// a total that pretends otherwise is wrong by a factor of twenty.
import assert from 'node:assert/strict'
import { billSummary } from '../src/lib/selectors.ts'
import { duePayments } from '../src/lib/dashboard.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.stack.split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1 }
}

const bill = (id, amount, extra = {}) => ({
  id, name: id, category: 'Utilities', amount, dueDate: '2026-10-20',
  frequency: 'Monthly', status: 'Pending', autopay: false, icon: '', ...extra,
})

console.log('\nTotals convert before they add')

test('a rupee bill is not counted as dirhams', () => {
  const inr = billSummary([bill('inr', 10000, { currency: 'INR' })]).upcomingTotal
  assert.ok(inr > 300 && inr < 600, `10,000 INR should be a few hundred AED, got ${inr}`)
})

test('a mixed set adds up to the converted sum, not the raw one', () => {
  const bills = [bill('aed', 500), bill('inr', 10000, { currency: 'INR' })]
  const total = billSummary(bills).upcomingTotal
  assert.notEqual(total, 10500, 'raw addition would give 10,500')
  const inrAlone = billSummary([bill('inr', 10000, { currency: 'INR' })]).upcomingTotal
  assert.equal(Math.round(total), Math.round(500 + inrAlone))
})

test('a bill with no currency is still treated as AED', () => {
  assert.equal(billSummary([bill('old', 750)]).upcomingTotal, 750)
})

test('paid bills convert too', () => {
  const paid = billSummary([bill('inr', 10000, { currency: 'INR', status: 'Paid' })]).paidTotal
  assert.ok(paid > 300 && paid < 600, `got ${paid}`)
  assert.notEqual(paid, 10000)
})

test('an empty list is zero, not NaN', () => {
  const s = billSummary([])
  assert.equal(s.upcomingTotal, 0)
  assert.equal(s.paidTotal, 0)
})

console.log('\nThe dashboard due list')

test("a bill carries its own currency, and its base value is converted", () => {
  const rows = duePayments([], [bill('inr', 10000, { currency: 'INR' })], [], () => false, 400, '2026-10-01')
  const row = rows.find((r) => r.kind === 'bill')
  assert.ok(row, 'the bill should appear in the due list')
  assert.equal(row.amount, 10000, 'the amount stays in the bill currency for display')
  assert.equal(row.currency, 'INR')
  assert.ok(row.base > 300 && row.base < 600, `base should be converted, got ${row.base}`)
})

test('an AED bill has the same amount and base', () => {
  const rows = duePayments([], [bill('aed', 400)], [], () => false, 400, '2026-10-01')
  const row = rows.find((r) => r.kind === 'bill')
  assert.equal(row.amount, 400)
  assert.equal(row.base, 400)
  assert.equal(row.currency, 'AED')
})

console.log(`\n${n} passed`)
