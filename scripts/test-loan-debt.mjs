// Run: node --import ./scripts/register.mjs scripts/test-loan-debt.mjs
//
// The same borrowing can be recorded as a Loan record, as a loan-type account,
// or as both linked together. loanDebt() has to count each debt exactly once,
// whichever way it was entered — getting this wrong under-reports or
// double-reports what is owed on three different screens.
import assert from 'node:assert/strict'
import { loanDebt, netPosition } from '../src/lib/selectors.ts'

let n = 0
const test = (name, fn) => {
  try { fn(); n++; console.log('  ok  ', name) } catch (e) { console.error('  FAIL', name, '\n      ', e.stack.split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1 }
}

const account = (id, type, balance, currency = 'AED') => ({
  id, name: id, type, currency, balance, openingBalance: balance, details: '', status: 'Active', color: '',
})
const loan = (id, outstanding, extra = {}) => ({
  id, name: id, lender: 'Bank', outstanding, principal: outstanding, emi: 0,
  nextPayment: '2026-10-08', currency: 'AED', status: 'On Track', rate: 0, icon: '', ...extra,
})

console.log('\nCounting each debt once')

test('a loan account with no Loan record is still money owed', () => {
  const accounts = [account('tabby', 'loan', 3276), account('tabbyWife', 'loan', 3903)]
  const d = loanDebt([], accounts)
  assert.equal(d.total, 7179)
  assert.equal(d.count, 2)
})

test('a Loan record with no account behind it is counted', () => {
  const d = loanDebt([loan('agri', 15190)], [])
  assert.equal(d.total, 15190)
  assert.equal(d.count, 1)
})

test('a Loan linked to its account is counted once, not twice', () => {
  const accounts = [account('agriAcc', 'loan', 15190)]
  const d = loanDebt([loan('agri', 15190, { accountId: 'agriAcc' })], accounts)
  assert.equal(d.total, 15190, 'the linked pair is one debt')
  assert.equal(d.count, 1)
})

test('the reported case: one linked Loan plus two bare loan accounts', () => {
  const accounts = [account('agriAcc', 'loan', 15190), account('tabby', 'loan', 3276), account('tabbyWife', 'loan', 3903)]
  const d = loanDebt([loan('agri', 15190, { accountId: 'agriAcc' })], accounts)
  assert.equal(d.total, 22369, 'matches what the Accounts page shows')
  assert.equal(d.fromLoans, 15190)
  assert.equal(d.fromAccounts, 7179)
  assert.equal(d.count, 3)
})

test('a closed Loan is dropped, but its account is not silently dropped with it', () => {
  const accounts = [account('acc', 'loan', 5000)]
  const d = loanDebt([loan('old', 5000, { accountId: 'acc', status: 'Closed' })], accounts)
  assert.equal(d.total, 5000, 'the account still carries a balance')
  assert.equal(d.fromAccounts, 5000)
})

test('non-loan accounts are never counted as borrowing', () => {
  const accounts = [account('bank', 'bank', 2929), account('cash', 'cash', 325), account('card', 'card', 5671)]
  assert.equal(loanDebt([], accounts).total, 0)
})

console.log('\nNet position agrees with the parts')

test('bank + cash, less cards and every loan however it was entered', () => {
  const accounts = [
    account('bank', 'bank', 2929), account('cash', 'cash', 325), account('card', 'card', 5671),
    account('agriAcc', 'loan', 15190), account('tabby', 'loan', 3276), account('tabbyWife', 'loan', 3903),
  ]
  const loans = [loan('agri', 15190, { accountId: 'agriAcc' })]
  // 2929 + 325 - 5671 - 22369
  assert.equal(netPosition(accounts, loans), -24786)
})

test('a Loan with no account of its own still lowers the net position', () => {
  const accounts = [account('bank', 'bank', 10000)]
  assert.equal(netPosition(accounts, [loan('agri', 4000)]), 6000)
})

console.log(`\n${n} passed`)
