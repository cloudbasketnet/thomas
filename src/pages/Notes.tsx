import { useState } from 'react'
import { CheckCircle2, Clock, ListTodo, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardHead, Empty, PageHeader, Progress, StatCard } from '@/components/ui/Primitives'
import { Modal, Field } from '@/components/ui/Modal'
import { daysLeft, fmtDate, TODAY } from '@/lib/format'
import type { Note } from '@/types'

const CATEGORIES: Note['category'][] = ['Personal', 'Work', 'Family', 'Car', 'Loan']

export default function Notes() {
  const { notes, addNote, updateNote, removeNote, toggleNote } = useStore()
  const [filter, setFilter] = useState<'All' | Note['category']>('All')
  const [showDone, setShowDone] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'Personal' as Note['category'], dueDate: TODAY, status: 'Pending' as Note['status'] })

  const list = notes
    .filter((n) => (filter === 'All' ? true : n.category === filter))
    .filter((n) => (showDone ? true : !n.done))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate))

  const pending = notes.filter((n) => !n.done).length
  const done = notes.filter((n) => n.done).length
  const overdue = notes.filter((n) => !n.done && daysLeft(n.dueDate) < 0).length

  const save = () => {
    if (!form.title.trim()) return
    addNote({ title: form.title.trim(), category: form.category, dueDate: form.dueDate, status: form.status, done: false })
    setForm({ title: '', category: 'Personal', dueDate: TODAY, status: 'Pending' })
    setModal(false)
  }

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="Notes & Follow Up"
        subtitle="Reminders, follow-ups and to-dos tied to your money life."
        actions={<button className="btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Add Note</button>}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Notes" value={String(notes.length)} icon={<StickyNote size={20} />} tint="#3b82f6" footer={<span className="text-slate-400">All follow-ups</span>} />
        <StatCard label="Pending" value={String(pending)} icon={<ListTodo size={20} />} tint="#f59e0b" footer={<span className="text-slate-400">Still open</span>} />
        <StatCard label="Completed" value={String(done)} icon={<CheckCircle2 size={20} />} tint="#10b981"
          footer={<div><div className="text-[10px] text-slate-400 mb-1">{Math.round((done / (notes.length || 1)) * 100)}% done</div><Progress value={done} max={notes.length || 1} color="#10b981" height={5} /></div>} />
        <StatCard label="Overdue" value={String(overdue)} icon={<Clock size={20} />} tint="#ef4444" footer={<span className="text-slate-400">Past due date</span>} />
      </div>

      <Card>
        <CardHead
          title="All Notes"
          right={
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-[12px] text-slate-500 cursor-pointer">
                <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-brand-600 cursor-pointer" />
                Show completed
              </label>
              <div className="flex gap-1 flex-wrap">
                {(['All', ...CATEGORIES] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    className={`chip cursor-pointer transition ${filter === c ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {c} ({c === 'All' ? notes.length : notes.filter((n) => n.category === c).length})
                  </button>
                ))}
              </div>
            </div>
          }
        />
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[680px]">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th w-10"></th>
                <th className="th">Note</th>
                <th className="th">Category</th>
                <th className="th">Due Date</th>
                <th className="th">Status</th>
                <th className="th text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {list.map((n) => {
                const dl = daysLeft(n.dueDate)
                return (
                  <tr key={n.id} className="row-hover">
                    <td className="td">
                      <input type="checkbox" checked={n.done} onChange={() => toggleNote(n.id)} className="accent-brand-600 h-4 w-4 cursor-pointer" />
                    </td>
                    <td className={`td font-semibold ${n.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{n.title}</td>
                    <td className="td text-slate-500">{n.category}</td>
                    <td className="td whitespace-nowrap">
                      <span className="text-slate-600">{fmtDate(n.dueDate)}</span>
                      {!n.done && (
                        <span className={`block text-[10px] ${dl < 0 ? 'text-rose-500' : dl <= 7 ? 'text-amber-500' : 'text-slate-400'}`}>
                          {dl < 0 ? `${Math.abs(dl)} days overdue` : `in ${dl} days`}
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <select
                        value={n.status}
                        onChange={(e) => updateNote(n.id, { status: e.target.value as Note['status'], done: e.target.value === 'Done' })}
                        className="text-[11px] font-bold rounded-full px-2.5 py-1 border-none outline-none cursor-pointer appearance-none"
                        style={{
                          background: n.status === 'Done' ? '#ecfdf5' : n.status === 'In Progress' ? '#eff6ff' : n.status === 'Planned' ? '#f5f3ff' : '#fffbeb',
                          color: n.status === 'Done' ? '#047857' : n.status === 'In Progress' ? '#1d4ed8' : n.status === 'Planned' ? '#6d28d9' : '#b45309',
                        }}
                      >
                        <option>Pending</option><option>In Progress</option><option>Planned</option><option>Done</option>
                      </select>
                    </td>
                    <td className="td text-right">
                      <button onClick={() => removeNote(n.id)} className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer ml-auto">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {list.length === 0 && <Empty text="Nothing here — add your first note." />}
        </div>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        {CATEGORIES.map((c) => {
          const items = notes.filter((n) => n.category === c)
          const doneCount = items.filter((n) => n.done).length
          return (
            <Card key={c} className="card-pad">
              <p className="text-[13px] font-bold text-slate-800">{c}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-3">{doneCount} of {items.length} completed</p>
              <Progress value={doneCount} max={items.length || 1} color="#3b82f6" height={7} />
              <div className="mt-3 space-y-1.5">
                {items.filter((n) => !n.done).slice(0, 3).map((n) => (
                  <div key={n.id} className="flex items-center gap-2 text-[11.5px] text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                    <span className="truncate">{n.title}</span>
                  </div>
                ))}
                {items.filter((n) => !n.done).length === 0 && <p className="text-[11.5px] text-slate-300">All clear</p>}
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add Note"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Add Note</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Note" className="col-span-2">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Renew car insurance" autoFocus />
          </Field>
          <Field label="Category">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Note['category'] })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Due Date"><input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Status" className="col-span-2">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Note['status'] })}>
              <option>Pending</option><option>In Progress</option><option>Planned</option><option>Done</option>
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
