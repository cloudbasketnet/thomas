import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Badge, Card, CardHead, Empty, PageHeader, Progress, StatCard, statusTone } from '@/components/ui/Primitives'
import { Modal, Field } from '@/components/ui/Modal'
import { daysLeft, fmtDate, TODAY } from '@/lib/format'
import { docStatus } from '@/lib/selectors'

export default function Documents() {
  const { documents, addDocument, removeDocument } = useStore()
  const [filter, setFilter] = useState<'All' | 'Valid' | 'Expiring Soon' | 'Expired'>('All')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Identity', expiry: TODAY, owner: 'Thomas', icon: '📄' })

  const enriched = useMemo(
    () => documents.map((d) => ({ ...d, live: docStatus(d.expiry), days: daysLeft(d.expiry) })).sort((a, b) => a.days - b.days),
    [documents],
  )
  const list = enriched.filter((d) => (filter === 'All' ? true : d.live === filter))
  const counts = {
    valid: enriched.filter((d) => d.live === 'Valid').length,
    soon: enriched.filter((d) => d.live === 'Expiring Soon').length,
    expired: enriched.filter((d) => d.live === 'Expired').length,
  }

  const save = () => {
    if (!form.name.trim()) return
    addDocument({ name: form.name.trim(), type: form.type, expiry: form.expiry, owner: form.owner, status: docStatus(form.expiry), icon: form.icon || '📄' })
    setForm({ name: '', type: 'Identity', expiry: TODAY, owner: 'Thomas', icon: '📄' })
    setModal(false)
  }

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="Documents"
        subtitle="Emirates ID, visa, licence, insurance — tracked with expiry reminders."
        actions={
          <>
            <button className="btn-ghost"><Upload size={15} /> Upload File</button>
            <button className="btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Add Document</button>
          </>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Documents" value={String(documents.length)} icon={<FileText size={20} />} tint="#3b82f6" footer={<span className="text-slate-400">All tracked documents</span>} />
        <StatCard label="Valid" value={String(counts.valid)} icon={<CheckCircle2 size={20} />} tint="#10b981"
          footer={<div><div className="text-[10px] text-slate-400 mb-1">{Math.round((counts.valid / (documents.length || 1)) * 100)}% in good standing</div><Progress value={counts.valid} max={documents.length || 1} color="#10b981" height={5} /></div>} />
        <StatCard label="Expiring Soon" value={String(counts.soon)} icon={<AlertTriangle size={20} />} tint="#f59e0b" footer={<span className="text-slate-400">Within 30 days</span>} />
        <StatCard label="Expired" value={String(counts.expired)} icon={<ShieldCheck size={20} />} tint="#ef4444" footer={<span className="text-slate-400">Needs renewal now</span>} />
      </div>

      {counts.soon + counts.expired > 0 && (
        <div className="card px-5 py-4 flex items-start gap-3 bg-amber-50/60 border-amber-100">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[13px] text-amber-900">
            <b>{counts.soon + counts.expired} document{counts.soon + counts.expired > 1 ? 's need' : ' needs'} attention.</b>{' '}
            {enriched.filter((d) => d.live !== 'Valid').map((d) => `${d.name} (${d.days < 0 ? `${Math.abs(d.days)}d overdue` : `${d.days}d left`})`).join(', ')}
          </p>
        </div>
      )}

      <Card>
        <CardHead
          title="All Documents"
          right={
            <div className="flex gap-1 flex-wrap">
              {(['All', 'Valid', 'Expiring Soon', 'Expired'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`chip cursor-pointer transition ${filter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        />
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[680px]">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Document</th>
                <th className="th">Type</th>
                <th className="th">Owner</th>
                <th className="th">Expiry Date</th>
                <th className="th">Days Left</th>
                <th className="th">Status</th>
                <th className="th text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {list.map((d) => (
                <tr key={d.id} className="row-hover">
                  <td className="td font-semibold text-slate-800"><span className="mr-2">{d.icon}</span>{d.name}</td>
                  <td className="td text-slate-500">{d.type}</td>
                  <td className="td text-slate-500">{d.owner}</td>
                  <td className="td text-slate-500 whitespace-nowrap">{fmtDate(d.expiry)}</td>
                  <td className={`td font-semibold tabular-nums ${d.days < 0 ? 'text-rose-600' : d.days <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                    🔔 {d.days < 0 ? `${Math.abs(d.days)} days overdue` : `${d.days} days`}
                  </td>
                  <td className="td"><Badge tone={statusTone(d.live)}>{d.live}</Badge></td>
                  <td className="td text-right">
                    <button onClick={() => removeDocument(d.id)} className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer ml-auto">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <Empty text="No documents in this view." />}
        </div>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add Document"
        subtitle="Track expiry dates and get reminders"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Add Document</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Document Name" className="col-span-2">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Emirates ID" autoFocus />
          </Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {['Identity', 'Immigration', 'Vehicle', 'Insurance', 'Business', 'Property', 'Other'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Icon"><input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={2} /></Field>
          <Field label="Expiry Date"><input className="input" type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} /></Field>
          <Field label="Owner"><input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
