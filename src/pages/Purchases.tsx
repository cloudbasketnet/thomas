import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Package, Pencil, Plus, ShoppingBag, Trash2, Undo2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Badge, Card, CardHead, PageHeader, Progress, StatCard, statusTone, Empty } from '@/components/ui/Primitives'
import { Donut, DonutLegend, PALETTE } from '@/components/charts/Charts'
import { Modal, Field } from '@/components/ui/Modal'
import { fmtDate, money, pct, TODAY } from '@/lib/format'
import type { Purchase } from '@/types'

const STATUSES: Purchase['status'][] = ['Planned', 'Ordered', 'Delivered', 'Returned']

export default function Purchases() {
  const { purchases, people, addPurchase, updatePurchase, removePurchase } = useStore()
  const [filter, setFilter] = useState<'All' | Purchase['status']>('All')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Purchase | null>(null)

  const list = purchases.filter((p) => (filter === 'All' ? true : p.status === filter))
  const value = (p: Purchase) => p.price * p.qty

  const totalValue = purchases.filter((p) => p.status !== 'Returned').reduce((a, p) => a + value(p), 0)
  const planned = purchases.filter((p) => p.status === 'Planned')
  const plannedValue = planned.reduce((a, p) => a + value(p), 0)
  const delivered = purchases.filter((p) => p.status === 'Delivered')
  const ordered = purchases.filter((p) => p.status === 'Ordered')

  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of purchases) if (p.status !== 'Returned') m.set(p.category, (m.get(p.category) ?? 0) + value(p))
    return [...m.entries()].map(([name, v]) => ({ name, value: v })).sort((a, b) => b.value - a.value)
  }, [purchases])

  const byStore = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of purchases) if (p.status !== 'Returned') m.set(p.store, (m.get(p.store) ?? 0) + value(p))
    return [...m.entries()].map(([name, v]) => ({ name, value: v })).sort((a, b) => b.value - a.value)
  }, [purchases])

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="Purchase Management"
        subtitle="Plan, order and track every purchase — with warranty, store and person details."
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setModal(true) }}>
            <Plus size={15} /> Add Purchase
          </button>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Purchase Value" value={money(totalValue)} icon={<ShoppingBag size={20} />} tint="#3b82f6"
          footer={<span className="text-slate-400">{purchases.length} purchases tracked</span>} />
        <StatCard label="Planned Spend" value={money(plannedValue)} icon={<Clock size={20} />} tint="#f59e0b"
          footer={<span className="text-slate-400">{planned.length} items planned</span>} />
        <StatCard label="Delivered" value={money(delivered.reduce((a, p) => a + value(p), 0))} icon={<CheckCircle2 size={20} />} tint="#10b981"
          footer={<span className="text-slate-400">{delivered.length} items received</span>} />
        <StatCard label="In Transit" value={money(ordered.reduce((a, p) => a + value(p), 0))} icon={<Package size={20} />} tint="#8b5cf6"
          footer={<span className="text-slate-400">{ordered.length} orders pending</span>} />
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead
            title="All Purchases"
            right={
              <div className="flex gap-1 flex-wrap">
                {(['All', ...STATUSES] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`chip cursor-pointer transition ${
                      filter === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s} ({s === 'All' ? purchases.length : purchases.filter((p) => p.status === s).length})
                  </button>
                ))}
              </div>
            }
          />
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[820px]">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="th">Item</th>
                  <th className="th">Store</th>
                  <th className="th">Category</th>
                  <th className="th">Date</th>
                  <th className="th">Person</th>
                  <th className="th text-right">Qty</th>
                  <th className="th text-right">Total</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {list.map((p) => (
                  <tr key={p.id} className="row-hover">
                    <td className="td font-semibold text-slate-800">
                      {p.item}
                      {p.warrantyMonths ? (
                        <span className="ml-2 text-[10px] font-bold text-slate-400">🛡 {p.warrantyMonths}m</span>
                      ) : null}
                      {p.notes && <p className="text-[11px] text-slate-400 font-normal mt-0.5">{p.notes}</p>}
                    </td>
                    <td className="td text-slate-500">{p.store}</td>
                    <td className="td text-slate-500">{p.category}</td>
                    <td className="td text-slate-500 whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="td text-slate-500">{p.person}</td>
                    <td className="td text-right tabular-nums">{p.qty}</td>
                    <td className="td text-right font-bold tabular-nums">{money(value(p))}</td>
                    <td className="td"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        {p.status !== 'Delivered' && p.status !== 'Returned' && (
                          <button
                            title="Mark delivered"
                            onClick={() => updatePurchase(p.id, { status: 'Delivered' })}
                            className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                          </button>
                        )}
                        {p.status === 'Delivered' && (
                          <button
                            title="Mark returned"
                            onClick={() => updatePurchase(p.id, { status: 'Returned' })}
                            className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 cursor-pointer"
                          >
                            <Undo2 size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => { setEditing(p); setModal(true) }}
                          className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => removePurchase(p.id)}
                          className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <Empty text="No purchases in this view." />}
          </div>
        </Card>

        <div className="xl:col-span-4 space-y-4">
          <Card>
            <CardHead title="Purchases by Category" />
            <div className="px-5 pb-5 flex flex-col sm:flex-row items-center gap-4">
              <Donut data={byCat} size={160} centerValue={money(totalValue)} centerLabel="Total" />
              <div className="flex-1 w-full">
                <DonutLegend data={byCat} total={totalValue} showValue={false} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Top Stores" />
            <div className="px-5 pb-5 space-y-3.5">
              {byStore.slice(0, 6).map((s, i) => (
                <div key={s.name}>
                  <div className="flex items-center gap-2 text-[12px] mb-1.5">
                    <span className="flex-1 truncate text-slate-600 font-medium">{s.name}</span>
                    <span className="font-bold text-slate-700 tabular-nums">{money(s.value)}</span>
                    <span className="text-slate-400 font-semibold w-9 text-right">{pct(s.value, totalValue)}%</span>
                  </div>
                  <Progress value={s.value} max={totalValue} color={PALETTE[i % PALETTE.length]} height={7} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <PurchaseModal
        open={modal}
        onClose={() => setModal(false)}
        editing={editing}
        people={people.map((p) => p.name)}
        onSave={(data) => (editing ? updatePurchase(editing.id, data) : addPurchase(data))}
      />
    </div>
  )
}

function PurchaseModal({
  open, onClose, editing, people, onSave,
}: {
  open: boolean
  onClose: () => void
  editing: Purchase | null
  people: string[]
  onSave: (p: any) => void
}) {
  const blank = {
    item: '', store: '', category: 'Electronics', price: '', qty: '1', date: TODAY,
    person: people[0] ?? 'Me', status: 'Planned' as Purchase['status'], warrantyMonths: '', notes: '',
  }
  const [form, setForm] = useState(blank)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            item: editing.item, store: editing.store, category: editing.category, price: String(editing.price),
            qty: String(editing.qty), date: editing.date, person: editing.person, status: editing.status,
            warrantyMonths: editing.warrantyMonths ? String(editing.warrantyMonths) : '', notes: editing.notes ?? '',
          }
        : blank,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  const submit = () => {
    if (!form.item.trim() || !Number(form.price)) return
    onSave({
      item: form.item.trim(),
      store: form.store.trim() || '—',
      category: form.category,
      price: Number(form.price),
      qty: Number(form.qty) || 1,
      date: form.date,
      person: form.person,
      status: form.status,
      warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : undefined,
      notes: form.notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Purchase' : 'Add Purchase'}
      subtitle="Track what you buy, from planning to delivery"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}>{editing ? 'Save Changes' : 'Add Purchase'}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Item" className="col-span-2">
          <input className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="e.g. Surface Laptop 7" autoFocus />
        </Field>
        <Field label="Store"><input className="input" value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} placeholder="e.g. Sharaf DG" /></Field>
        <Field label="Category">
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {['Electronics', 'Furniture', 'Appliances', 'Groceries', 'Kids', 'Automotive', 'Business', 'Clothing', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Unit Price (AED)"><input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" /></Field>
        <Field label="Quantity"><input className="input" type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
        <Field label="Date"><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Purchase['status'] })}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Person">
          <select className="input" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}>
            {people.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Warranty (months)"><input className="input" type="number" value={form.warrantyMonths} onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })} placeholder="12" /></Field>
        <Field label="Notes" className="col-span-2"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional note…" /></Field>
      </div>
    </Modal>
  )
}
