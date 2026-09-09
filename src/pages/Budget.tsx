import { useMemo, useState } from 'react'
import { CopyPlus, Gauge, PiggyBank, Plus, Target, Trash2, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '@/store/useStore'
import { Card, CardHead, PageHeader, Progress, StatCard, Empty } from '@/components/ui/Primitives'
import { Donut, DonutLegend } from '@/components/charts/Charts'
import { Modal, Field } from '@/components/ui/Modal'
import { compact, money, pct } from '@/lib/format'
import { budgetsWithSpend, currentMonthLabel, unbudgetedSpend } from '@/lib/selectors'

export default function Budget() {
  const { budgets: rawBudgets, transactions, settings, addBudget, updateBudget, removeBudget, updateSettings } = useStore()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '📦', budget: '', color: '#3b82f6' })

  // Spend is derived from this month's expenses, so recording one moves the bar.
  const budgets = useMemo(() => budgetsWithSpend(transactions, rawBudgets), [transactions, rawBudgets])
  const unbudgeted = useMemo(() => unbudgetedSpend(transactions, rawBudgets), [transactions, rawBudgets])

  const totalBudget = budgets.reduce((a, b) => a + b.budget, 0)
  const totalSpent = budgets.reduce((a, b) => a + b.spent, 0)
  const remaining = totalBudget - totalSpent
  const onTrack = totalSpent <= totalBudget

  const chart = useMemo(
    () => budgets.map((b) => ({ name: b.name.split(' ')[0], Budget: b.budget, Actual: b.spent })),
    [budgets],
  )
  const donut = budgets.map((b) => ({ name: b.name, value: b.spent }))
  const colors = budgets.map((b) => b.color)

  const save = () => {
    if (!form.name.trim() || !Number(form.budget)) return
    addBudget({ name: form.name.trim(), icon: form.icon || '📦', budget: Number(form.budget), spent: 0, color: form.color })
    setForm({ name: '', icon: '📦', budget: '', color: '#3b82f6' })
    setModal(false)
  }

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="Budget"
        subtitle="Plan your spending, stay in control and reach your goals."
        actions={
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Plus size={15} /> Create Budget
          </button>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Budget" value={money(totalBudget)} icon={<Wallet size={20} />} tint="#10b981" footer={<span className="text-slate-400">This Month</span>} />
        <StatCard label="Total Spent" value={money(totalSpent)} icon={<Gauge size={20} />} tint="#3b82f6"
          footer={<div><div className="text-[10px] text-slate-400 mb-1">{pct(totalSpent, totalBudget)}% of budget</div><Progress value={totalSpent} max={totalBudget} color="#3b82f6" height={5} /></div>} />
        <StatCard label="Remaining" value={money(remaining)} icon={<PiggyBank size={20} />} tint="#f43f5e"
          footer={<div><div className="text-[10px] text-slate-400 mb-1">{100 - pct(totalSpent, totalBudget)}% left</div><Progress value={remaining} max={totalBudget} color="#22c55e" height={5} /></div>} />
        <StatCard label="On Track" value={onTrack ? 'Yes' : 'No'} icon={<Target size={20} />} tint="#8b5cf6"
          footer={<span className={onTrack ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>{onTrack ? 'You are within budget' : 'Over budget this month'}</span>} />
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHead title="Budget vs Actual" />
          <div className="px-3 pb-4">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chart} margin={{ top: 5, right: 5, left: -18, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 12, border: '1px solid #e8edf5', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} verticalAlign="top" align="right" />
                <Bar isAnimationActive={false} dataKey="Budget" fill="#bfdbfe" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar isAnimationActive={false} dataKey="Actual" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-3">
          <CardHead title="Spending Overview" />
          <div className="px-5 pb-5 flex flex-col items-center gap-4">
            <Donut data={donut} colors={colors} size={175} centerValue={money(totalSpent)} centerLabel="Total Spent" />
            <div className="w-full">
              <DonutLegend data={donut} total={totalSpent} colors={colors} showValue={false} />
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead title="Budget Progress" right={<span className="chip bg-slate-100 text-slate-500">{currentMonthLabel()}</span>} />
          <div className="px-5 pb-5 space-y-3.5">
            {budgets.map((b) => (
              <div key={b.id}>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="text-[15px] w-5">{b.icon}</span>
                  <span className="flex-1 text-[12.5px] font-semibold text-slate-700 truncate">{b.name}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {b.spent.toLocaleString()} / {b.budget.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 w-9 text-right">{pct(b.spent, b.budget)}%</span>
                </div>
                <Progress value={b.spent} max={b.budget} color={b.color} height={7} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead title="Budget Categories" sub="Budget is editable; spent is calculated from this month's expenses" />
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="th">Category</th>
                  <th className="th text-right">Budget (AED)</th>
                  <th className="th text-right">Spent (AED)</th>
                  <th className="th text-right">Remaining</th>
                  <th className="th w-56">Progress</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {budgets.map((b) => (
                  <tr key={b.id} className="row-hover">
                    <td className="td font-semibold text-slate-800"><span className="mr-2">{b.icon}</span>{b.name}</td>
                    <td className="td text-right">
                      <input
                        type="number"
                        value={b.budget}
                        onChange={(e) => updateBudget(b.id, { budget: Number(e.target.value) || 0 })}
                        className="w-24 h-8 rounded-lg border border-transparent hover:border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 outline-none px-2 text-right font-bold tabular-nums bg-transparent"
                      />
                    </td>
                    <td className="td text-right font-semibold tabular-nums text-slate-600">
                      {b.spent.toLocaleString()}
                    </td>
                    <td className={`td text-right font-bold tabular-nums ${b.budget - b.spent < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {(b.budget - b.spent).toLocaleString()}
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Progress value={b.spent} max={b.budget} color={b.color} height={7} />
                        <span className="text-[11px] font-bold text-slate-400 w-9 text-right">{pct(b.spent, b.budget)}%</span>
                      </div>
                    </td>
                    <td className="td text-right">
                      <button onClick={() => removeBudget(b.id)} className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer ml-auto">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {budgets.length === 0 && <Empty text="No budget categories yet." />}
          </div>
          <div className="px-5 py-4 border-t border-[#f1f5f9] flex flex-wrap items-center gap-3">
            <button className="btn-soft" onClick={() => setModal(true)}><Plus size={14} /> Add Category</button>
            {unbudgeted > 0 && (
              <p className="text-[11.5px] text-slate-500">
                <b className="text-slate-700">{money(unbudgeted)}</b> spent this month in categories no budget covers.
              </p>
            )}
          </div>
        </Card>

        <div className="xl:col-span-4 space-y-4">
          <Card>
            <CardHead title="Monthly Budget" sub="Changes save as you type" />
            <div className="px-5 pb-5 space-y-3">
              <Field label="Total Budget (AED)">
                <input
                  className="input"
                  type="number"
                  value={settings.monthlyBudget}
                  onChange={(e) => updateSettings({ monthlyBudget: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Start Date">
                <input className="input" type="date" value={settings.periodStart} onChange={(e) => updateSettings({ periodStart: e.target.value })} />
              </Field>
              <Field label="End Date">
                <input className="input" type="date" value={settings.periodEnd} onChange={(e) => updateSettings({ periodEnd: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHead title="Quick Actions" />
            <div className="px-5 pb-5 grid grid-cols-1 gap-2.5">
              <button className="btn-ghost justify-start h-11" onClick={() => setModal(true)}><Plus size={15} /> Add Category</button>
              <button
                className="btn-ghost justify-start h-11"
                onClick={() => {
                  const total = Number(settings.monthlyBudget) || 0
                  if (!total || !budgets.length) return
                  const share = Math.round(total / budgets.length)
                  budgets.forEach((b) => updateBudget(b.id, { budget: share }))
                }}
              >
                <CopyPlus size={15} /> Split Monthly Budget Evenly
              </button>
              <Link to="/goals" className="btn-ghost justify-start h-11"><Target size={15} /> Set Savings Goal</Link>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add Budget Category"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Add Category</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category Name" className="col-span-2">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Education" autoFocus />
          </Field>
          <Field label="Icon (emoji)"><input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={2} /></Field>
          <Field label="Monthly Budget (AED)"><input className="input" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="1000" /></Field>
          <Field label="Colour" className="col-span-2">
            <div className="flex gap-2 flex-wrap">
              {['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#eab308'].map((c) => (
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
