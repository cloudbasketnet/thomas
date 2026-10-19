// Run: node --import ./scripts/register.mjs scripts/test-timeline.mjs
//
// The payment timeline tells you what the balance will be on a given day, and
// the simulator tells you whether one more payment is affordable then. Both
// are advice someone will act on, so the arithmetic has to be right and the
// verdict has to be defensible.
import assert from 'node:assert/strict'
import { buffer, paymentTimeline, simulateDebit, timelinePoints } from '../src/lib/timeline.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.stack.split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1 }
}

const MONTH = '2026-10'
const TODAY = '2026-10-01'

const account = (id, type, balance) => ({
  id, name: id, type, currency: 'AED', balance, openingBalance: balance, details: '', status: 'Active', color: '',
})
const bill = (id, amount, dueDate, category = 'Utilities') => ({
  id, name: id, category, amount, currency: 'AED', dueDate,
  frequency: 'Monthly', status: 'Pending', autopay: false, icon: '',
})
const loan = (id, emi, nextPayment) => ({
  id, name: id, lender: 'Bank', outstanding: 50000, principal: 50000, emi,
  nextPayment, currency: 'AED', status: 'On Track', rate: 5, icon: '',
})

/** 15,000 in the bank, a 3,000 EMI on the 2nd and a 500 bill on the 24th. */
const build = (over = {}) =>
  paymentTimeline({
    accounts: [account('bank', 'bank', 15000)],
    txns: [], transfers: [],
    loans: [loan('Car loan', 3000, '2026-10-02')],
    bills: [bill('Electricity', 500, '2026-10-24')],
    notes: [], incomeSources: [],
    txnExists: () => false,
    month: MONTH, today: TODAY,
    ...over,
  })

console.log('\nThe month in order')

test('opens on the real balance when nothing has moved yet', () => {
  assert.equal(build().startingBalance, 15000)
})

test('rows come out in date order with the balance each one leaves', () => {
  const t = build()
  assert.deepEqual(t.rows.map((r) => r.date), ['2026-10-02', '2026-10-24'])
  assert.deepEqual(t.rows.map((r) => r.balanceAfter), [12000, 11500])
  assert.equal(t.endBalance, 11500)
})

test('outflow is the sum of everything going out', () => {
  assert.equal(build().outflow, 3500)
})

test('each kind is counted separately', () => {
  const t = build()
  assert.equal(t.byKind.loan.total, 3000)
  assert.equal(t.byKind.loan.count, 1)
  assert.equal(t.byKind.bill.total, 500)
})

test('a software or entertainment bill is a subscription, not a bill', () => {
  const t = build({ bills: [bill('POS licence', 500, '2026-10-28', 'Software')] })
  assert.equal(t.byKind.subscription.total, 500)
  assert.equal(t.byKind.bill.total, 0)
})

test('the lowest point is reported, not just the closing balance', () => {
  // A big EMI early, then income later: the end looks fine, the middle does not.
  const t = build({
    loans: [loan('Big EMI', 14000, '2026-10-05')],
    txns: [{ id: 'pay', type: 'income', date: '2026-10-28', description: 'Salary', category: 'Salary', accountId: 'bank', amount: 9000, currency: 'AED' }],
  })
  // The 500 bill on the 24th digs deeper than the EMI on the 5th did.
  assert.equal(t.lowest.date, '2026-10-24')
  assert.equal(t.lowest.balance, 500)
  assert.ok(t.endBalance > t.lowest.balance, 'the closing balance hides the dip')
})

test('a card purchase does not move the cash line', () => {
  const t = build({
    accounts: [account('bank', 'bank', 15000), account('card', 'card', 0)],
    txns: [{ id: 'c', type: 'expense', date: '2026-10-03', description: 'On the card', category: 'Supplies', accountId: 'card', amount: 2000, currency: 'AED' }],
  })
  assert.equal(t.rows.find((r) => r.id === 'txn_c'), undefined)
  assert.equal(t.endBalance, 11500)
})

test('another month is not included', () => {
  const t = build({ bills: [bill('Next month', 900, '2026-11-04')] })
  assert.equal(t.byKind.bill.total, 0)
})

test('an empty month still reports the opening balance', () => {
  const t = build({ loans: [], bills: [] })
  assert.equal(t.rows.length, 0)
  assert.equal(t.endBalance, 15000)
  assert.equal(t.lowest.balance, 15000)
})

console.log('\nThe cushion')

test('a tenth of the opening balance, never under 500', () => {
  assert.equal(buffer(15000), 1500)
  assert.equal(buffer(2000), 500)
  assert.equal(buffer(0), 500)
})

console.log('\nIs this affordable, on this day?')

test('a small debit on a healthy month is comfortable', () => {
  const s = simulateDebit(build(), 2000, '2026-10-10')
  assert.equal(s.verdict, 'comfortable')
  assert.equal(s.newEndBalance, 9500)
  assert.equal(s.change, -2000)
  assert.equal(s.betterDate, undefined, 'no need to suggest another day')
})

test('a debit bigger than the balance is a shortfall', () => {
  const s = simulateDebit(build(), 20000, '2026-10-10')
  assert.equal(s.verdict, 'shortfall')
  assert.ok(s.lowest.balance < 0)
  assert.match(s.reason, /below zero/)
})

test('a debit that eats into the cushion is tight, not comfortable', () => {
  // Leaves 11,500 - 10,800 = 700, under the 1,500 cushion but above zero.
  const s = simulateDebit(build(), 10800, '2026-10-28')
  assert.equal(s.verdict, 'tight')
  assert.ok(s.lowest.balance >= 0, 'still solvent')
  assert.match(s.reason, /cushion/)
})

test('the debit is charged before anything else on its day', () => {
  // On the 2nd, the 3,000 EMI is also due. Charging after it would look safer
  // than it is, so the simulator charges first.
  const s = simulateDebit(build(), 12500, '2026-10-02')
  assert.equal(s.verdict, 'shortfall', '15,000 - 12,500 - 3,000 goes negative')
})

test('a later day is suggested when the asked-for day does not work', () => {
  const t = build({
    loans: [loan('EMI', 14000, '2026-10-05')],
    txns: [{ id: 'pay', type: 'income', date: '2026-10-20', description: 'Salary', category: 'Salary', accountId: 'bank', amount: 12000, currency: 'AED' }],
  })
  const s = simulateDebit(t, 5000, '2026-10-02')
  assert.equal(s.verdict, 'shortfall')
  assert.ok(s.betterDate && s.betterDate >= '2026-10-20', `expected a date after payday, got ${s.betterDate}`)
})

test('no better day is claimed when there is not one', () => {
  const s = simulateDebit(build(), 999999, '2026-10-02')
  assert.equal(s.betterDate, undefined)
  assert.match(s.reason, /no day this month/i)
})

test('affordable says how much could go out and stay comfortable', () => {
  const t = build()
  const s = simulateDebit(t, 0, '2026-10-28')
  // The balance on the 28th is 11,500; keeping 1,500 back leaves 10,000.
  assert.equal(s.affordable, 10000)
  assert.equal(simulateDebit(t, s.affordable, '2026-10-28').verdict, 'comfortable')
  assert.notEqual(simulateDebit(t, s.affordable + 1000, '2026-10-28').verdict, 'comfortable')
})

test('affordable is never negative on a month already in the red', () => {
  const t = build({ loans: [loan('Huge', 40000, '2026-10-02')] })
  assert.equal(simulateDebit(t, 100, '2026-10-20').affordable, 0)
})

console.log('\nThe chart')

test('one point per day that moved, opening with the starting balance', () => {
  const pts = timelinePoints(build())
  assert.equal(pts[0].balance, 15000)
  assert.deepEqual(pts.map((p) => p.balance), [15000, 12000, 11500])
})

test('same-day payments collapse into one point', () => {
  const t = build({ bills: [bill('A', 200, '2026-10-24'), bill('B', 300, '2026-10-24')] })
  const pts = timelinePoints(t)
  const day = pts.filter((p) => p.date === '2026-10-24')
  assert.equal(day.length, 1)
  assert.equal(day[0].out, 500)
})

console.log(`\n${n} passed`)

{
  let k = 0
  const t2 = (name, fn) => { try { fn(); k++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.stack.split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1 } }
  console.log('\nThe chart, by kind')
  t2('each point carries what left under each kind that day', () => {
    const pts = timelinePoints(build())
    const emi = pts.find((p) => p.date === '2026-10-02')
    assert.equal(emi.loan, 3000)
    assert.equal(emi.bill, 0)
    assert.equal(pts.find((p) => p.date === '2026-10-24').bill, 500)
  })
  t2('a movement on the 1st does not produce two points for the 1st', () => {
    const pts = timelinePoints(build({ bills: [bill('Rent', 4000, '2026-10-01')] }))
    assert.equal(pts.filter((p) => p.date === '2026-10-01').length, 1)
    assert.equal(pts[0].balance, 11000)
  })
  console.log(`\n${k} chart checks passed`)
}
