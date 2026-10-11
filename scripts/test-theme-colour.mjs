// Run: node --import ./scripts/register.mjs scripts/test-theme-colour.mjs
//
// The accent and the brand colour are now a free choice, so the app has to
// cope with any hex it is given: text on the accent must stay readable, and a
// single brand colour has to produce the whole 50-900 ramp the UI expects.
import assert from 'node:assert/strict'
import { brandScale, luminance, readableOn } from '../src/lib/theme.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.stack.split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1 }
}

console.log('\nText stays readable on whatever is picked')

test('dark ink on the default yellow', () => {
  assert.equal(readableOn('#ffd84d'), '#0f2744')
})

test('white on a dark navy', () => {
  assert.equal(readableOn('#0f2744'), '#ffffff')
})

test('the extremes go the obvious way', () => {
  assert.equal(readableOn('#ffffff'), '#0f2744')
  assert.equal(readableOn('#000000'), '#ffffff')
})

test('a mid blue takes white, a pale mint takes ink', () => {
  assert.equal(readableOn('#2563eb'), '#ffffff')
  assert.equal(readableOn('#a7f3d0'), '#0f2744')
})

test('luminance runs light to dark', () => {
  assert.ok(luminance('#ffffff') > luminance('#ffd84d'))
  assert.ok(luminance('#ffd84d') > luminance('#2563eb'))
  assert.ok(luminance('#2563eb') > luminance('#000000'))
})

test('a malformed hex does not throw or produce NaN', () => {
  assert.equal(Number.isFinite(luminance('nonsense')), true)
  assert.equal(typeof readableOn('#xyz'), 'string')
})

console.log('\nOne colour makes a whole ramp')

test('500 is exactly the colour that was picked', () => {
  assert.equal(brandScale('#2563eb')['500'], '#2563eb')
})

test('the ramp runs light to dark across every step', () => {
  const s = brandScale('#2563eb')
  const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
  for (let i = 1; i < steps.length; i++) {
    assert.ok(
      luminance(s[steps[i]]) < luminance(s[steps[i - 1]]),
      `${steps[i]} (${s[steps[i]]}) should be darker than ${steps[i - 1]} (${s[steps[i - 1]]})`,
    )
  }
})

test('every step is a valid six-digit hex', () => {
  const s = brandScale('#f43f5e')
  for (const [step, hex] of Object.entries(s)) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `${step} -> ${hex}`)
  }
})

test('the light end is pale enough to put dark text on', () => {
  const s = brandScale('#2563eb')
  assert.equal(readableOn(s['50']), '#0f2744')
  assert.equal(readableOn(s['100']), '#0f2744')
})

test('the dark end is dark enough to put white text on', () => {
  const s = brandScale('#2563eb')
  assert.equal(readableOn(s['800']), '#ffffff')
})

test('black and white do not collapse the ramp or overflow it', () => {
  for (const hex of ['#000000', '#ffffff']) {
    const s = brandScale(hex)
    for (const v of Object.values(s)) assert.match(v, /^#[0-9a-f]{6}$/, `${hex} -> ${v}`)
  }
})

test('a malformed hex yields no scale rather than a broken one', () => {
  assert.equal(brandScale('not a colour'), null)
  assert.equal(brandScale('#12345'), null)
})

test('three-digit hex is accepted', () => {
  const s = brandScale('#09f')
  assert.equal(s['500'], '#0099ff')
})

console.log(`\n${n} passed`)
