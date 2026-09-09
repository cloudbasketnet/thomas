import { useState } from 'react'
import { ArrowDown, ArrowUp, Minus, Plus, Tags, Target, Trash2, TrendingDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardHead, Empty, PageHeader, Progress, StatCard } from '@/components/ui/Primitives'
import { Modal, Field } from '@/components/ui/Modal'
import { fmtDate, money, TODAY } from '@/lib/format'

export default function PriceTracker() {
  const { priceWatch, addPriceWatch, updatePriceWatch, removePriceWatch } = useStore()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ item: '', store: '', current: '', previous: '', target: '' })

  const drops = priceWatch.filter((p) => p.current < p.previous)
  const hits = priceWatch.filter((p) => p.current <= p.target)
  const totalSaved = drops.reduce((a, p) => a + (p.previous - p.current), 0)

  const save = () => {
    if (!form.item.trim() || !Number(form.current)) return
    addPriceWatch({
      item: form.item.trim(),
      store: form.store.trim() || '—',
      current: Number(form.current),
      previous: Number(form.previous) || Number(form.current),
      target: Number(form.target) || Number(form.current),
      updated: TODAY,
    })
    setForm({ item: '', store: '', current: '', previous: '', target: '' })
    setModal(false)
  }

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="Price Tracker"
        subtitle="Watch prices before you buy — know when an item hits your target."
        actions={<button className="btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Track Item</button>}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Items Tracked" value={String(priceWatch.length)} icon={<Tags size={20} />} tint="#3b82f6" footer={<span className="text-slate-400">Across all stores</span>} />
        <StatCard label="Price Drops" value={String(drops.length)} icon={<TrendingDown size={20} />} tint="#10b981" footer={<span className="text-slate-400">Cheaper than before</span>} />
        <StatCard label="Target Hit" value={String(hits.length)} icon={<Target size={20} />} tint="#f59e0b" footer={<span className="text-slate-400">Ready to buy</span>} />
        <StatCard label="Potential Savings" value={money(totalSaved)} icon={<ArrowDown size={20} />} tint="#8b5cf6" footer={<span className="text-slate-400">From tracked drops</span>} />
      </div>

      <Card>
        <CardHead title="Watchlist" sub="Update the current price any time — the tracker keeps the previous value for comparison" />
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[820px]">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Item</th>
                <th className="th">Store</th>
                <th className="th text-right">Previous</th>
                <th className="th text-right">Current</th>
                <th className="th text-right">Change</th>
                <th className="th text-right">Target</th>
                <th className="th w-40">To Target</th>
                <th className="th">Updated</th>
                <th className="th text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {priceWatch.map((p) => {
                const diff = p.current - p.previous
                const reached = p.current <= p.target
                const gap = Math.max(0, p.current - p.target)
                return (
                  <tr key={p.id} className="row-hover">
                    <td className="td font-semibold text-slate-800">{p.item}</td>
                    <td className="td text-slate-500">{p.store}</td>
                    <td className="td text-right text-slate-400 tabular-nums line-through">{money(p.previous)}</td>
                    <td className="td text-right">
                      <input
                        type="number"
                        value={p.current}
                        onChange={(e) => updatePriceWatch(p.id, { previous: p.current, current: Number(e.target.value) || 0, updated: TODAY })}
                        className="w-24 h-8 rounded-lg border border-transparent hover:border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 outline-none px-2 text-right font-bold tabular-nums bg-transparent"
                      />
                    </td>
                    <td className={`td text-right font-bold tabular-nums ${diff < 0 ? 'text-emerald-600' : diff > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      <span className="inline-flex items-center gap-1">
                        {diff < 0 ? <ArrowDown size={12} /> : diff > 0 ? <ArrowUp size={12} /> : <Minus size={12} />}
                        {money(Math.abs(diff))}
                      </span>
                    </td>
                    <td className="td text-right text-slate-500 tabular-nums">{money(p.target)}</td>
                    <td className="td">
                      {reached ? (
                        <span className="chip bg-emerald-50 text-emerald-700">🎯 Target reached</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Progress value={p.target} max={p.current} color="#f59e0b" height={7} />
                          <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">-{money(gap)}</span>
                        </div>
                      )}
                    </td>
                    <td className="td text-slate-400 text-[12px] whitespace-nowrap">{fmtDate(p.updated)}</td>
                    <td className="td text-right">
                      <button onClick={() => removePriceWatch(p.id)} className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer ml-auto">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {priceWatch.length === 0 && <Empty text="Nothing tracked yet." />}
        </div>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Track an Item"
        subtitle="Set a target price and get a nudge when it drops"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Track Item</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Item" className="col-span-2">
            <input className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="e.g. Samsung 55&quot; TV" autoFocus />
          </Field>
          <Field label="Store"><input className="input" value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} placeholder="e.g. Amazon.ae" /></Field>
          <Field label="Current Price"><input className="input" type="number" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} /></Field>
          <Field label="Previous Price"><input className="input" type="number" value={form.previous} onChange={(e) => setForm({ ...form, previous: e.target.value })} /></Field>
          <Field label="Target Price"><input className="input" type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
