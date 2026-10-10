// Run: node --import ./scripts/register.mjs scripts/test-vision.mjs
import assert from 'node:assert/strict'
import {
  blockMinutes, clockMinutes, dayAnalysis, daysInMonth, dreamProgress, duration, monthAnalysis, sortedSchedule,
} from '../src/lib/vision.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.stack.split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1 }
}

const entry = (date, kind, minutes) => ({ id: `${date}-${kind}`, date, kind, minutes })

console.log('\nReading the clock')

test('a block inside one day is its plain length', () => {
  assert.equal(blockMinutes({ start: '06:00', end: '07:00' }), 60)
  assert.equal(blockMinutes({ start: '08:00', end: '13:00' }), 300)
})

test('sleep from 22:00 to 06:00 is eight hours, not minus sixteen', () => {
  assert.equal(blockMinutes({ start: '22:00', end: '06:00' }), 480)
})

test('equal times mean a full day round, not an empty block', () => {
  assert.equal(blockMinutes({ start: '09:00', end: '09:00' }), 1440)
})

test('a malformed time does not produce NaN', () => {
  assert.equal(clockMinutes('nonsense'), 0)
  assert.equal(Number.isFinite(blockMinutes({ start: '', end: '06:00' })), true)
})

test('the schedule always reads in start order', () => {
  const blocks = [
    { id: 'c', label: 'Sleep', kind: 'sleep', start: '22:00', end: '06:00', order: 0 },
    { id: 'a', label: 'Gym', kind: 'gym', start: '06:00', end: '07:00', order: 1 },
    { id: 'b', label: 'Work', kind: 'work', start: '08:00', end: '13:00', order: 2 },
  ]
  assert.deepEqual(sortedSchedule(blocks).map((b) => b.id), ['a', 'b', 'c'])
})

console.log('\nA day adds up to a day')

test("the mockup's day: 7h30m rest, 1h gym", () => {
  const log = [entry('2026-10-09', 'sleep', 450), entry('2026-10-09', 'gym', 60)]
  const a = dayAnalysis(log, '2026-10-09')
  assert.equal(duration(a.rest), '7h 30m')
  assert.equal(duration(a.gym), '1h 0m')
  assert.equal(a.restPct, 31)
  assert.equal(a.gymPct, 4)
  assert.equal(a.otherPct, 65)
})

test('rest, gym and other always cover the whole 24 hours', () => {
  const a = dayAnalysis([entry('2026-10-09', 'rest', 120)], '2026-10-09')
  assert.equal(a.rest + a.gym + a.other, 1440)
})

test('an empty day is all "other", not all zero', () => {
  const a = dayAnalysis([], '2026-10-09')
  assert.equal(a.other, 1440)
  assert.equal(a.otherPct, 100)
})

test('sleep and rest both count as rest; work does not', () => {
  const log = [entry('2026-10-09', 'sleep', 400), entry('2026-10-09', 'rest', 80), entry('2026-10-09', 'work', 300)]
  assert.equal(dayAnalysis(log, '2026-10-09').rest, 480)
})

test('two entries of the same kind add up', () => {
  const log = [entry('2026-10-09', 'gym', 30), entry('2026-10-09', 'gym', 45)]
  assert.equal(dayAnalysis(log, '2026-10-09').gym, 75)
})

test('more than 24 hours logged never overflows the day', () => {
  const log = [entry('2026-10-09', 'sleep', 1400), entry('2026-10-09', 'gym', 600)]
  const a = dayAnalysis(log, '2026-10-09')
  assert.equal(a.other, 0, 'other never goes negative')
  assert.ok(a.restPct + a.gymPct + a.otherPct >= 100)
})

test('another day is not counted', () => {
  const log = [entry('2026-10-08', 'gym', 60), entry('2026-10-09', 'gym', 30)]
  assert.equal(dayAnalysis(log, '2026-10-09').gym, 30)
})

console.log('\nThe month')

test('short months and leap years are counted correctly', () => {
  assert.equal(daysInMonth('2026-10'), 31)
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(daysInMonth('2028-02'), 29)
  assert.equal(daysInMonth('2026-11'), 30)
})

test('a month totals every day and keeps one bar per day', () => {
  const log = [entry('2026-10-01', 'gym', 60), entry('2026-10-02', 'gym', 30), entry('2026-10-02', 'sleep', 480)]
  const m = monthAnalysis(log, '2026-10')
  assert.equal(m.days.length, 31)
  assert.equal(m.gymMinutes, 90)
  assert.equal(m.restMinutes, 480)
})

test('averages divide by days elapsed, so a quiet week pulls them down', () => {
  const log = [entry('2026-10-01', 'gym', 600)]
  const early = monthAnalysis(log, '2026-10', '2026-10-02')
  const later = monthAnalysis(log, '2026-10', '2026-10-10')
  assert.equal(early.elapsed, 2)
  assert.equal(later.elapsed, 10)
  assert.ok(later.gymHoursPerDay < early.gymHoursPerDay, 'the same gym time spread over more days averages lower')
})

test('a month in the past divides by the whole month, not by today', () => {
  const m = monthAnalysis([entry('2026-09-01', 'gym', 60)], '2026-09', '2026-10-09')
  assert.equal(m.elapsed, 30)
})

console.log('\nDreams')

test('progress is averaged and clamped to 0-100', () => {
  const dreams = [
    { id: 'a', title: 'A', note: '', emoji: '', color: '', progress: 70, order: 0 },
    { id: 'b', title: 'B', note: '', emoji: '', color: '', progress: 50, order: 1 },
  ]
  assert.equal(dreamProgress(dreams), 60)
})

test('a stray progress figure cannot break the bar', () => {
  const dreams = [{ id: 'a', title: 'A', note: '', emoji: '', color: '', progress: 400, order: 0 }]
  assert.equal(dreamProgress(dreams), 100)
})

test('no dreams is zero, not a divide by zero', () => {
  assert.equal(dreamProgress([]), 0)
})

console.log('\nFormatting')

test('durations read as the cards show them', () => {
  assert.equal(duration(450), '7h 30m')
  assert.equal(duration(60), '1h 0m')
  assert.equal(duration(45), '45m')
  assert.equal(duration(0), '0m')
  assert.equal(duration(-10), '0m')
})

console.log(`\n${n} passed`)
