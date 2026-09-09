import { useEffect, useState } from 'react'
import { Modal, Field } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'
import { TODAY } from '@/lib/format'
import type { Currency, Transaction, TxnType } from '@/types'

const INCOME_CATEGORIES = ['Restaurant Sales', 'Online Orders', 'Catering', 'Salary', 'Investment', 'Refund / Adjustment', 'Other Income']
const EXPENSE_CATEGORIES = ['Home / Rent', 'Groceries', 'Transport', 'Utilities', 'Shopping', 'Family Support', 'Health', 'Restaurants', 'Personal', 'Subscriptions', 'Loan Payment', 'Education', 'Other']
const METHODS = ['Bank Transfer', 'Cash', 'Card', 'Credit Card', 'Cheque', 'Auto Debit', 'Online']

export function TransactionModal({
  open,
  onClose,
  type,
  editing,
}: {
  open: boolean
  onClose: () => void
  type: TxnType
  editing?: Transaction | null
}) {
  const { accounts, people, addTransaction, updateTransaction } = useStore()
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const blank = {
    description: '',
    amount: '',
    date: TODAY,
    category: cats[0],
    accountId: accounts[0]?.id ?? '',
    currency: 'AED' as Currency,
    person: 'Me',
    method: METHODS[0],
    notes: '',
  }
  const [form, setForm] = useState(blank)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        description: editing.description,
        amount: String(editing.amount),
        date: editing.date,
        category: editing.category,
        accountId: editing.accountId,
        currency: editing.currency,
        person: editing.person ?? 'Me',
        method: editing.method ?? METHODS[0],
        notes: editing.notes ?? '',
      })
    } else {
      setForm({ ...blank, category: cats[0], accountId: accounts[0]?.id ?? '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, type])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    const amount = Number(form.amount)
    if (!form.description.trim() || !amount || amount <= 0) return
    const payload = {
      type,
      date: form.date,
      description: form.description.trim(),
      category: form.category,
      accountId: form.accountId,
      amount,
      currency: form.currency,
      person: form.person,
      method: form.method,
      notes: form.notes,
    }
    if (editing) updateTransaction(editing.id, payload)
    else addTransaction(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${editing ? 'Edit' : 'Add'} ${type === 'income' ? 'Income' : 'Expense'}`}
      subtitle={type === 'income' ? 'Record money coming in' : 'Record money going out'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={type === 'income' ? 'btn-green' : 'btn-rose'} onClick={submit}>
            {editing ? 'Save Changes' : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Description" className="col-span-2">
          <input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Restaurant Sales (POS)" autoFocus />
        </Field>
        <Field label="Amount">
          <input className="input" type="number" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Currency">
          <select className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
            <option>AED</option>
            <option>INR</option>
            <option>USD</option>
          </select>
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Category">
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Account">
          <select className="input" value={form.accountId} onChange={(e) => set('accountId', e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment Method">
          <select className="input" value={form.method} onChange={(e) => set('method', e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Person" className="col-span-2">
          <select className="input" value={form.person} onChange={(e) => set('person', e.target.value)}>
            {people.map((p) => (
              <option key={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes (optional)" className="col-span-2">
          <input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Add a note…" />
        </Field>
      </div>
    </Modal>
  )
}
