// Run: node --import ./scripts/register.mjs scripts/test-dashboard.mjs
import assert from 'node:assert/strict'
import { actionCentre, addDays, cashFlow, dailySpend, duePayments, safeToSpend } from '../src/lib/dashboard.ts'
import { askableFaces, pickFace, sceneUsable } from '../src/lib/sceneLock.ts'
import { allSchedulesTotal } from '../src/lib/schedules.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.message); process.exitCode = 1 }
}

const TODAY = '2026-10-15'
const acc = (over = {}) => ({ id: 'a1', name: 'Bank', type: 'bank', details: '', balance: 10000, currency: 'AED', status: 'Active', color: '#000', ...over })
const txn = (over = {}) => ({ id: 't1', type: 'expense', date: TODAY, description: '', category: 'Food', accountId: 'a1', amount: 100, currency: 'AED', ...over })

console.log('Daily spending')
test('every day in the window is present, with 0 where nothing was recorded', () => {
  const rows = dailySpend([txn({ id: 'x', date: '2026-10-13', amount: 200 })], 7, TODAY)
  assert.equal(rows.length, 7)
  assert.equal(rows[0].date, '2026-10-09')
  assert.equal(rows[6].date, TODAY)
  assert.equal(rows.find((r) => r.date === '2026-10-13').value, 200)
  assert.equal(rows[6].value, 0)
})
test('a refund reduces that day rather than counting as spending', () => {
  const rows = dailySpend(
    [txn({ id: 'a', amount: 300 }), txn({ id: 'b', type: 'income', kind: 'refund', amount: 100 })],
    7, TODAY,
  )
  assert.equal(rows[6].value, 200)
})
test('an asset purchase is cash out but not household spending', () => {
  const rows = dailySpend([txn({ kind: 'asset_purchase', amount: 5000 })], 7, TODAY)
  assert.equal(rows[6].value, 0)
})
test('transactions outside the window are ignored', () => {
  const rows = dailySpend([txn({ date: '2026-09-01', amount: 999 })], 7, TODAY)
  assert.equal(rows.reduce((n, r) => n + r.value, 0), 0)
})

console.log('\nDue payments')
const loan = { id: 'l1', name: 'Car loan', lender: 'FAB', outstanding: 20000, principal: 30000, emi: 950, nextPayment: '2026-10-20', currency: 'AED', status: 'On Track', rate: 5, icon: '🚗' }
const bill = { id: 'b1', name: 'DEWA', category: 'Bills', amount: 450, dueDate: '2026-10-18', frequency: 'Monthly', status: 'Pending', autopay: false, icon: '💡' }
const note = {
  id: 'n1', title: 'College fees', category: 'Family', dueDate: '2026-12-01', status: 'Pending', done: false,
  schedule: [
    { id: 'i1', label: 'Instalment 1', dueDate: '2026-10-10', amount: 1200, currency: 'AED' },
    { id: 'i2', label: 'Instalment 2', dueDate: '2026-11-10', amount: 1200, currency: 'AED' },
  ],
}

test('loans, bills and instalments land on one timeline, soonest first', () => {
  const rows = duePayments([loan], [bill], [note], () => false, 60, TODAY)
  assert.deepEqual(rows.map((r) => r.kind), ['installment', 'bill', 'loan', 'installment'])
  assert.equal(rows[0].dueDate, '2026-10-10')
})
test('an overdue instalment is flagged with the days it has been overdue', () => {
  const rows = duePayments([], [], [note], () => false, 60, TODAY)
  assert.equal(rows[0].overdue, true)
  assert.equal(rows[0].days, -5)
})
test('a paid instalment drops off the list', () => {
  const paid = { ...note, schedule: [{ ...note.schedule[0], paidTxnId: 'p1' }, note.schedule[1]] }
  const rows = duePayments([], [], [paid], (id) => id === 'p1', 60, TODAY)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].dueDate, '2026-11-10')
})
test('a paid bill and a closed loan are never due', () => {
  const rows = duePayments([{ ...loan, status: 'Closed' }], [{ ...bill, status: 'Paid' }], [], () => false, 60, TODAY)
  assert.equal(rows.length, 0)
})
test('nothing beyond the horizon is listed', () => {
  const rows = duePayments([], [], [note], () => false, 5, TODAY)
  assert.equal(rows.length, 1) // only the overdue one, 10 Oct
})

console.log('\nSafe to spend')
test('balance minus this month’s commitments minus the monthly share of goals', () => {
  const goal = { id: 'g1', name: 'Car', target: 12000, saved: 0, deadline: '2027-10-15', icon: '🚗', color: '#000', currency: 'AED' }
  const s = safeToSpend([acc()], [loan], [bill], [note], [goal], () => false, TODAY)
  assert.equal(s.balance, 10000)
  // 1200 instalment (10 Oct) + 450 bill (18 Oct) + 950 EMI (20 Oct) — all before month end
  assert.equal(s.reserved, 2600)
  assert.equal(s.savings, 1000) // 12000 over ~12 months
  assert.equal(s.safe, 6400)
})
test('a commitment in a later month is not reserved out of this month', () => {
  const later = { ...note, schedule: [{ id: 'i9', label: 'Later', dueDate: '2026-11-10', amount: 5000, currency: 'AED' }] }
  const s = safeToSpend([acc()], [], [], [later], [], () => false, TODAY)
  assert.equal(s.reserved, 0)
  assert.equal(s.safe, 10000)
})
test('overdue payments are reported separately so they can be chased', () => {
  const s = safeToSpend([acc()], [], [], [note], [], () => false, TODAY)
  assert.equal(s.overdue.length, 1)
  assert.equal(s.overdue[0].amount, 1200)
})

console.log('\nCash flow')
test('today’s point is the real available balance, and card debt never moves the line', () => {
  const accounts = [acc({ balance: 10000 }), acc({ id: 'c1', name: 'Card', type: 'card', balance: 3000 })]
  const txns = [txn({ id: 'onCard', accountId: 'c1', amount: 500, date: '2026-10-14' })]
  const { points } = cashFlow(accounts, txns, [], [], [], [], () => false, 7, 30, TODAY)
  const todayPoint = points.find((p) => p.date === TODAY)
  assert.equal(todayPoint.actual, 10000)
  // Spending on the card changed no cash, so yesterday's balance was the same.
  assert.equal(points.find((p) => p.date === '2026-10-14').actual, 10000)
})
test('a cash expense on a day lowers that day’s close, so the day before was higher', () => {
  const { points } = cashFlow([acc({ balance: 10000 })], [txn({ date: '2026-10-14', amount: 400 })], [], [], [], [], () => false, 7, 30, TODAY)
  assert.equal(points.find((p) => p.date === '2026-10-14').actual, 10000) // closed at today's figure
  assert.equal(points.find((p) => p.date === '2026-10-13').actual, 10400) // before the 400 went out
})
test('paying a card from the bank is money out, even though it is a transfer', () => {
  const accounts = [acc({ balance: 10000 }), acc({ id: 'c1', type: 'card', balance: 0 })]
  const transfer = { id: 'tr1', date: '2026-10-14', fromAccountId: 'a1', toKind: 'account', toId: 'c1', amount: 1000, currency: 'AED', purpose: 'Credit card payment' }
  const { points } = cashFlow(accounts, [], [transfer], [], [], [], () => false, 7, 30, TODAY)
  assert.equal(points.find((p) => p.date === '2026-10-13').actual, 11000)
})
test('a transfer between two liquid accounts leaves the line untouched', () => {
  const accounts = [acc({ balance: 10000 }), acc({ id: 'a2', balance: 0 })]
  const transfer = { id: 'tr2', date: '2026-10-14', fromAccountId: 'a1', toKind: 'account', toId: 'a2', amount: 1000, currency: 'AED', purpose: 'Other' }
  const { points } = cashFlow(accounts, [], [transfer], [], [], [], () => false, 7, 30, TODAY)
  assert.equal(points.find((p) => p.date === '2026-10-13').actual, 10000)
})
test('the projection runs forward 30 days and only the past half has an actual', () => {
  const { points } = cashFlow([acc()], [], [], [], [], [], () => false, 7, 30, TODAY)
  assert.equal(points.length, 38) // 7 back + today + 30 forward
  assert.equal(points.filter((p) => p.actual !== undefined).length, 8)
  assert.equal(points[points.length - 1].date, addDays(TODAY, 30))
})
test('a known payment ahead pulls the projected balance down on that day', () => {
  const plain = cashFlow([acc()], [], [], [], [], [], () => false, 7, 30, TODAY).projected
  const withBill = cashFlow([acc()], [], [], [], [{ ...bill, dueDate: '2026-10-20', amount: 450 }], [], () => false, 7, 30, TODAY).projected
  assert.equal(plain - withBill, 450)
})

console.log('\nAction centre')
test('only things that actually need attention are listed, each with a real count', () => {
  const items = actionCentre(
    [bill],
    [{ id: 'd1', name: 'Passport', type: 'ID', expiry: '2026-10-25', owner: 'Me', status: 'Expiring Soon', icon: '🛂' }],
    [note],
    () => false,
    TODAY,
  )
  const keys = items.map((i) => i.key)
  assert.deepEqual(keys.sort(), ['bills', 'documents', 'installments'].sort())
  assert.equal(items.find((i) => i.key === 'bills').count, 1)
})
test('nothing outstanding means an empty list, not a zero-count row', () => {
  assert.deepEqual(actionCentre([], [], [], () => false, TODAY), [])
})

console.log('\nInstalment totals across currencies')
const RATE = { AED: 1, INR: 0.0434, USD: 3.6725 }
const toBase = (n, c) => n * RATE[c]
const plan = (id, rows) => ({ id, title: id, category: 'Family', dueDate: '2026-11-01', status: 'Pending', done: false, schedule: rows })

test('a rupee plan is converted before it is added to a dirham one', () => {
  const t = allSchedulesTotal(
    [
      plan('aed', [{ id: 'a1', label: 'A', dueDate: '2026-11-01', amount: 1000, currency: 'AED' }]),
      plan('inr', [{ id: 'b1', label: 'B', dueDate: '2026-11-01', amount: 100000, currency: 'INR' }]),
    ],
    TODAY, () => false, toBase,
  )
  // 100,000 INR is 4,340 AED — not another 100,000.
  assert.equal(t.total, 5340)
  assert.equal(t.outstanding, 5340)
})
test('what has been paid is converted too, and the paid amount beats the planned one', () => {
  const rows = [
    { id: 'p1', label: 'Paid', dueDate: '2026-10-01', amount: 100000, currency: 'INR', paidTxnId: 'tx1', paidAmount: 50000 },
    { id: 'p2', label: 'Due', dueDate: '2026-11-01', amount: 100000, currency: 'INR' },
  ]
  const t = allSchedulesTotal([plan('inr', rows)], TODAY, (id) => id === 'tx1', toBase)
  assert.equal(t.total, 8680)   // 200,000 INR
  assert.equal(t.paid, 2170)    // the 50,000 INR actually paid, not the 100,000 planned
  assert.equal(t.outstanding, 6510)
})
test('nothing recorded is zero, not NaN', () => {
  assert.deepEqual(allSchedulesTotal([], TODAY, () => false, toBase), { total: 0, paid: 0, outstanding: 0 })
  assert.deepEqual(allSchedulesTotal([plan('x', undefined)], TODAY, () => false, toBase), { total: 0, paid: 0, outstanding: 0 })
})

console.log('\nPhoto security lock')
const face = (over = {}) => ({ id: 'f1', x: 0.1, y: 0.1, w: 0.1, h: 0.1, enabled: true, question: 'Who taught me to ride a bicycle?', ...over })

test('a face is only asked about when it is enabled and has a question', () => {
  const scene = { photo: 'x', randomQuestion: true, avoidRepeatLast: true, faces: [
    face(),
    face({ id: 'f2', enabled: false }),
    face({ id: 'f3', question: '   ' }),
    face({ id: 'f4', question: undefined }),
  ] }
  assert.deepEqual(askableFaces(scene).map((f) => f.id), ['f1'])
})
test('a scene needs a question and at least two people before it can lock anything', () => {
  assert.equal(sceneUsable(undefined), false)
  assert.equal(sceneUsable({ photo: 'x', faces: [face()], randomQuestion: true, avoidRepeatLast: true }), false)
  assert.equal(sceneUsable({ photo: 'x', faces: [face(), face({ id: 'f2', question: '' })], randomQuestion: true, avoidRepeatLast: true }), true)
  assert.equal(sceneUsable({ photo: 'x', faces: [face({ question: '' }), face({ id: 'f2', question: '' })], randomQuestion: true, avoidRepeatLast: true }), false)
})

console.log(`\n${n} passed`)
