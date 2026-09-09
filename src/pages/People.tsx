import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2, Users } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardHead, Empty, PageHeader, Progress, StatCard } from '@/components/ui/Primitives'
import { Donut, DonutLegend } from '@/components/charts/Charts'
import { Modal, Field } from '@/components/ui/Modal'
import { fmtDate, money, pct } from '@/lib/format'
import { byPerson, inMonth } from '@/lib/selectors'

export default function People() {
  const { people, transactions, addPerson, removePerson } = useStore()
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', relation: '', phone: '', color: '#3b82f6' })

  const spending = useMemo(() => byPerson(transactions), [transactions])
  const totalSpent = spending.reduce((a, p) => a + p.value, 0)
  const theyOwe = people.reduce((a, p) => a + p.theyOwe, 0)
  const iOwe = people.reduce((a, p) => a + p.iOwe, 0)

  const spendOf = (name: string) => spending.find((s) => s.name === name)?.value ?? 0
  const colors = people.map((p) => p.color)

  const personTxns = useMemo(
    () => (selected ? inMonth(transactions).filter((t) => t.person === selected) : []),
    [selected, transactions],
  )

  const save = () => {
    if (!form.name.trim()) return
    addPerson({ name: form.name.trim(), relation: form.relation.trim() || 'Contact', phone: form.phone, color: form.color, spent: 0, theyOwe: 0, iOwe: 0 })
    setForm({ name: '', relation: '', phone: '', color: '#3b82f6' })
    setModal(false)
  }

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="People"
        subtitle="See who you spend on, who owes you, and who you owe."
        actions={<button className="btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Add Person</button>}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="People Tracked" value={String(people.length)} icon={<Users size={20} />} tint="#3b82f6" footer={<span className="text-slate-400">Family, friends & business</span>} />
        <StatCard label="Spent This Month" value={money(totalSpent)} icon={<ArrowUpRight size={20} />} tint="#f43f5e" footer={<span className="text-slate-400">Across all people</span>} />
        <StatCard label="They Owe Me" value={money(theyOwe)} icon={<ArrowDownLeft size={20} />} tint="#10b981" footer={<span className="text-slate-400">{people.filter((p) => p.theyOwe > 0).length} people</span>} />
        <StatCard label="I Owe" value={money(iOwe)} icon={<ArrowUpRight size={20} />} tint="#f59e0b" footer={<span className="text-slate-400">{people.filter((p) => p.iOwe > 0).length} people</span>} />
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead title="People & Balances" sub="Click a person to see their transactions this month" />
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="th">Person</th>
                  <th className="th">Relation</th>
                  <th className="th">Phone</th>
                  <th className="th text-right">Spent (Month)</th>
                  <th className="th text-right">They Owe</th>
                  <th className="th text-right">I Owe</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {people.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p.name)}
                    className={`row-hover cursor-pointer ${selected === p.name ? 'bg-brand-50/50' : ''}`}
                  >
                    <td className="td font-semibold text-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="h-8 w-8 rounded-full grid place-items-center text-white text-[12px] font-bold shrink-0" style={{ background: p.color }}>
                          {p.name.charAt(0)}
                        </span>
                        {p.name}
                      </div>
                    </td>
                    <td className="td text-slate-500">{p.relation}</td>
                    <td className="td text-slate-500 text-[12px]">{p.phone ?? '—'}</td>
                    <td className="td text-right font-bold tabular-nums">{money(spendOf(p.name))}</td>
                    <td className={`td text-right tabular-nums font-semibold ${p.theyOwe ? 'text-emerald-600' : 'text-slate-300'}`}>{money(p.theyOwe)}</td>
                    <td className={`td text-right tabular-nums font-semibold ${p.iOwe ? 'text-rose-600' : 'text-slate-300'}`}>{money(p.iOwe)}</td>
                    <td className="td text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); removePerson(p.id) }}
                        className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer ml-auto"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="xl:col-span-4 space-y-4">
          <Card>
            <CardHead title="Spending by Person" right={<span className="chip bg-slate-100 text-slate-500">This Month</span>} />
            <div className="px-5 pb-5 flex flex-col items-center gap-4">
              <Donut data={spending} colors={colors} size={170} centerValue={money(totalSpent)} centerLabel="Total Spent" />
              <div className="w-full"><DonutLegend data={spending} total={totalSpent} colors={colors} /></div>
            </div>
          </Card>

          <Card>
            <CardHead title={selected ? `${selected} — This Month` : 'Select a person'} />
            <div className="px-5 pb-5 space-y-2.5">
              {!selected && <Empty text="Click a row to view their transactions." />}
              {selected && personTxns.length === 0 && <Empty text="No transactions this month." />}
              {personTxns.map((t) => (
                <div key={t.id} className="flex items-center gap-3 text-[12.5px]">
                  <span className="w-12 text-slate-400 shrink-0">{fmtDate(t.date).slice(0, 6)}</span>
                  <span className="flex-1 truncate text-slate-700 font-medium">{t.description}</span>
                  <span className={`font-bold tabular-nums ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{money(t.amount, t.currency)}
                  </span>
                </div>
              ))}
              {selected && personTxns.length > 0 && (
                <div className="pt-3 border-t border-[#f1f5f9]">
                  <div className="flex justify-between text-[12px] mb-1.5">
                    <span className="text-slate-500">Share of monthly spend</span>
                    <span className="font-bold text-slate-700">{pct(spendOf(selected), totalSpent)}%</span>
                  </div>
                  <Progress value={spendOf(selected)} max={totalSpent} color={people.find((p) => p.name === selected)?.color ?? '#3b82f6'} />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add Person"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Add Person</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" className="col-span-2">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmed" autoFocus />
          </Field>
          <Field label="Relation"><input className="input" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="e.g. Business Partner" /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+971 …" /></Field>
          <Field label="Colour" className="col-span-2">
            <div className="flex gap-2 flex-wrap">
              {['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'].map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`h-8 w-8 rounded-lg cursor-pointer ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`} style={{ background: c }} />
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
