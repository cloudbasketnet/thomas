import { useMemo, useState } from 'react'
import { AlertCircle, CalendarClock, CheckCircle2, Plus, Repeat, Trash2, Zap } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Badge, Card, CardHead, Empty, PageHeader, Progress, StatCard, statusTone } from '@/components/ui/Primitives'
import { Donut, DonutLegend } from '@/components/charts/Charts'
import { Modal, Field } from '@/components/ui/Modal'
import { daysLeft, fmtDate, money, pct, TODAY } from '@/lib/format'
import { billSummary } from '@/lib/selectors'
import type { Bill } from '@/types'

export default function Bills() {
  const { bills, addBill, updateBill, removeBill, payBill } = useStore()
  const [filter, setFilter] = useState<'All' | Bill['status']>('All')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'Utilities', amount: '', dueDate: TODAY,
    frequency: 'Monthly' as Bill['frequency'], autopay: false, icon: '📄',
  })

  const s = useMemo(() => billSummary(bills), [bills])
  const monthlyTotal = bills.filter((b) => b.frequency === 'Monthly').reduce((a, b) => a + b.amount, 0)
  const autopayCount = bills.filter((b) => b.autopay).length
  const list = bills.filter((b) => (filter === 'All' ? true : b.status === filter)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of bills) m.set(b.category, (m.get(b.category) ?? 0) + b.amount)
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [bills])
  const catTotal = byCat.reduce((a, c) => a + c.value, 0)

  const save = () => {
    if (!form.name.trim() || !Number(form.amount)) return
    addBill({
      name: form.name.trim(), category: form.category, amount: Number(form.amount), dueDate: form.dueDate,
      frequency: form.frequency, status: 'Pending', autopay: form.autopay, icon: form.icon || '📄',
    })
    setForm({ name: '', category: 'Utilities', amount: '', dueDate: TODAY, frequency: 'Monthly', autopay: false, icon: '📄' })
    setModal(false)
  }

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="Bills & Subscriptions"
        subtitle="Never miss a due date — utilities, insurance, subscriptions and recurring fees."
        actions={<button className="btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Add Bill</button>}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monthly Recurring" value={money(monthlyTotal)} icon={<Repeat size={20} />} tint="#3b82f6"
          footer={<span className="text-slate-400">{bills.filter((b) => b.frequency === 'Monthly').length} monthly bills</span>} />
        <StatCard label="Upcoming Total" value={money(s.upcomingTotal)} icon={<CalendarClock size={20} />} tint="#f59e0b"
          footer={<span className="text-slate-400">{s.upcoming.length} bills unpaid</span>} />
        <StatCard label="Paid This Month" value={money(s.paidTotal)} icon={<CheckCircle2 size={20} />} tint="#10b981"
          footer={<div><div className="text-[10px] text-slate-400 mb-1">{pct(s.paidTotal, s.paidTotal + s.upcomingTotal)}% settled</div><Progress value={s.paidTotal} max={s.paidTotal + s.upcomingTotal} color="#10b981" height={5} /></div>} />
        <StatCard label="Overdue" value={money(s.overdue.reduce((a, b) => a + b.amount, 0))} icon={<AlertCircle size={20} />} tint="#ef4444"
          footer={<span className="text-slate-400">{s.overdue.length} bills · {autopayCount} on autopay</span>} />
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead
            title="All Bills"
            right={
              <div className="flex gap-1 flex-wrap">
                {(['All', 'Pending', 'Paid', 'Overdue'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`chip cursor-pointer transition ${filter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {f} ({f === 'All' ? bills.length : bills.filter((b) => b.status === f).length})
                  </button>
                ))}
              </div>
            }
          />
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="th">Bill</th>
                  <th className="th">Category</th>
                  <th className="th">Frequency</th>
                  <th className="th">Due Date</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Autopay</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {list.map((b) => {
                  const dl = daysLeft(b.dueDate)
                  return (
                    <tr key={b.id} className="row-hover">
                      <td className="td font-semibold text-slate-800"><span className="mr-2">{b.icon}</span>{b.name}</td>
                      <td className="td text-slate-500">{b.category}</td>
                      <td className="td text-slate-500">{b.frequency}</td>
                      <td className="td whitespace-nowrap">
                        <span className="text-slate-600">{fmtDate(b.dueDate)}</span>
                        {b.status !== 'Paid' && (
                          <span className={`block text-[10px] ${dl < 0 ? 'text-rose-500' : dl <= 7 ? 'text-amber-500' : 'text-slate-400'}`}>
                            {dl < 0 ? `${Math.abs(dl)} days overdue` : `in ${dl} days`}
                          </span>
                        )}
                      </td>
                      <td className="td text-right font-bold tabular-nums">{money(b.amount)}</td>
                      <td className="td">
                        <button
                          onClick={() => updateBill(b.id, { autopay: !b.autopay })}
                          className={`h-6 w-11 rounded-full transition relative cursor-pointer ${b.autopay ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${b.autopay ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                      </td>
                      <td className="td"><Badge tone={statusTone(b.status)}>{b.status}</Badge></td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          {b.status !== 'Paid' && (
                            <button onClick={() => payBill(b.id)} className="h-7 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 cursor-pointer">
                              Mark Paid
                            </button>
                          )}
                          <button onClick={() => removeBill(b.id)} className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {list.length === 0 && <Empty text="No bills in this view." />}
          </div>
        </Card>

        <div className="xl:col-span-4 space-y-4">
          <Card>
            <CardHead title="Bills by Category" />
            <div className="px-5 pb-5 flex flex-col sm:flex-row items-center gap-4">
              <Donut data={byCat} size={160} centerValue={money(catTotal)} centerLabel="All Bills" />
              <div className="flex-1 w-full"><DonutLegend data={byCat} total={catTotal} showValue={false} /></div>
            </div>
          </Card>

          <Card>
            <CardHead title="Due Next" sub="Sorted by due date" />
            <div className="px-5 pb-5 space-y-2.5">
              {s.upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border border-[#eef2f8] px-3 py-2.5">
                  <span className="h-8 w-8 rounded-lg bg-slate-50 grid place-items-center text-[14px]">{b.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-slate-800 truncate">{b.name}</p>
                    <p className="text-[11px] text-slate-400">{fmtDate(b.dueDate)}</p>
                  </div>
                  <span className="text-[12.5px] font-extrabold text-slate-800">{money(b.amount)}</span>
                </div>
              ))}
              {s.upcoming.length === 0 && <Empty text="Everything is paid 🎉" />}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add Bill or Subscription"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Add Bill</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bill Name" className="col-span-2">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. DEWA Electricity" autoFocus />
          </Field>
          <Field label="Category">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {['Utilities', 'Entertainment', 'Insurance', 'Transport', 'Education', 'Software', 'Other'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Icon"><input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={2} /></Field>
          <Field label="Amount (AED)"><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Due Date"><input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Frequency">
            <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as Bill['frequency'] })}>
              <option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Yearly</option>
            </select>
          </Field>
          <Field label="Autopay">
            <button
              onClick={() => setForm({ ...form, autopay: !form.autopay })}
              className={`input flex items-center gap-2 cursor-pointer ${form.autopay ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}
            >
              <Zap size={14} /> {form.autopay ? 'Enabled' : 'Disabled'}
            </button>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
