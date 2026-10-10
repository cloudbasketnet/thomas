import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ListChecks, Pencil, Plus, ReceiptText, Sparkles, Trash2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardHead, Empty, Progress, StatCard, Switch } from '@/components/ui/Primitives'
import { Modal, Field } from '@/components/ui/Modal'
import { ScheduleEditor, ScheduleView, PayModal } from '@/components/PaymentSchedule'
import { allSchedulesTotal, generateSchedule, installmentStatus, resolvePlan, scheduleSummary, MAX_INSTALLMENTS, type GenerateMode } from '@/lib/schedules'
import { fmtDate, money, toBase, TODAY, uid } from '@/lib/format'
import { DEFAULT_THEME } from '@/lib/theme'
import type { Currency, Installment, Note } from '@/types'

/** Built in, always offered. The user's own are kept in settings.extra.installmentCategories. */
const BUILT_IN_CATEGORIES = ['Education', 'Home / Rent', 'Insurance', 'Government & Renewals', 'Vehicle', 'Other']
const ADD_CATEGORY = '__add_category__'
const CURRENCIES: Currency[] = ['AED', 'INR', 'USD']

/** Which two figures you have. The third is worked out — see resolvePlan(). */
const MODES: { k: GenerateMode; label: string; hint: string }[] = [
  { k: 'total-count', label: 'Total & months', hint: 'Enter the whole fee and how many months to split it across.' },
  { k: 'total-monthly', label: 'Total & monthly', hint: 'Enter the whole fee and what is paid each month — the number of months is worked out.' },
  { k: 'monthly-count', label: 'Monthly & months', hint: 'Enter what is paid each month and for how many months — the total follows from it.' },
]

const blank = () => ({
  title: '', category: 'Other', person: '', extraCharge: '', autoAddToBudget: true,
  // The total, the monthly payment and the number of months: enter any two and
  // genMode says which, so the third is worked out rather than typed.
  genMode: 'total-count' as GenerateMode, genTotal: '', genMonthly: '', genCount: '4',
  genStart: TODAY, currency: 'AED' as Currency,
})

/**
 * The instalment half of Loans & EMIs: a fee or purchase split into dated
 * parts. Stored as a `Note` carrying a `schedule`, not as a `Loan` — there is
 * no principal or interest rate to amortize, just a list of payments. The
 * parent page shows the summary row that covers this and the loans together.
 */
export function InstallmentsSection() {
  const { notes, people, transactions, settings, addNote, updateNote, removeNote, payInstallment, updateSettings } = useStore()
  const catColor = (settings.extra?.theme?.categoryColors ?? DEFAULT_THEME.categoryColors).installment
  const txnIds = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions])
  const plans = useMemo(() => notes.filter((n) => (n.schedule?.length ?? 0) > 0), [notes])

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [schedule, setSchedule] = useState<Installment[]>([])
  const [form, setForm] = useState(blank())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState<string | null>(null) // null = not adding
  const [payFor, setPayFor] = useState<{ note: Note; inst: Installment } | null>(null)

  /**
   * Built-in categories, the user's own, and anything an existing plan already
   * uses — so editing an older plan never silently drops its category just
   * because it is not on the list any more.
   */
  const categoryOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const c of [
      ...BUILT_IN_CATEGORIES,
      ...(settings.extra?.installmentCategories ?? []),
      ...notes.map((n) => n.feeCategory ?? '').filter(Boolean),
    ]) {
      const name = c.trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      out.push(name)
    }
    return out
  }, [settings.extra?.installmentCategories, notes])

  const addCategory = (raw: string) => {
    const name = raw.trim()
    if (!name) return
    const existing = categoryOptions.find((c) => c.toLowerCase() === name.toLowerCase())
    if (!existing) {
      const own = settings.extra?.installmentCategories ?? []
      updateSettings({ extra: { ...settings.extra, installmentCategories: [...own, name] } })
    }
    setForm((f) => ({ ...f, category: existing ?? name }))
    setNewCategory(null)
  }

  const summaries = useMemo(
    () => new Map(plans.map((n) => [n.id, scheduleSummary(n, TODAY, (id) => txnIds.has(id))])),
    [plans, txnIds],
  )

  // Each plan's own card reports in that plan's currency. These cards add every
  // plan together, so each instalment is converted first — a 100,000 rupee plan
  // is not 100,000 dirhams, and summing the raw figures would say it is.
  const totals = useMemo(() => {
    const sums = allSchedulesTotal(plans, TODAY, (id) => txnIds.has(id), toBase)
    const nextDates = [...summaries.values()].map((s) => s.nextDate).filter(Boolean).sort() as string[]
    return {
      ...sums,
      next: nextDates[0],
      active: [...summaries.values()].filter((s) => s.outstanding > 0).length,
    }
  }, [plans, summaries, txnIds])

  const openAdd = () => { setEditing(null); setForm(blank()); setSchedule([]); setNewCategory(null); setModal(true) }
  const openEdit = (n: Note) => {
    setEditing(n)
    setForm({
      ...blank(), title: n.title, category: n.category, person: n.person ?? '',
      extraCharge: n.extraCharge !== undefined ? String(n.extraCharge) : '',
      autoAddToBudget: n.autoAddToBudget !== false,
      // Keep the plan's own currency, so regenerating or adding a row does not
      // quietly turn a rupee plan into a dirham one.
      currency: n.schedule?.[0]?.currency ?? 'AED',
    })
    setSchedule(n.schedule ?? [])
    setNewCategory(null)
    setModal(true)
  }

  // "AED 3,000 over 4 months" or "AED 500 a month for 4", start 15 Oct → the schedule.
  const genFigures = { total: Number(form.genTotal), monthly: Number(form.genMonthly), count: Number(form.genCount) }
  const plan = resolvePlan(form.genMode, genFigures)
  const generate = () => {
    const rows: Installment[] = generateSchedule({
      mode: form.genMode, ...genFigures,
      start: form.genStart, currency: form.currency, makeId: () => uid('in'),
    })
    if (!rows.length) return
    setSchedule(rows)
  }

  const save = () => {
    if (!form.title.trim() || schedule.length === 0) return
    const payload = {
      title: form.title.trim(), category: 'Loan' as Note['category'], dueDate: [...schedule].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0].dueDate,
      status: 'Pending' as Note['status'], person: form.person || undefined, feeCategory: form.category,
      extraCharge: Number(form.extraCharge) > 0 ? Number(form.extraCharge) : undefined,
      autoAddToBudget: form.autoAddToBudget, schedule: schedule.filter((i) => i.dueDate && i.amount > 0),
    }
    if (editing) updateNote(editing.id, payload)
    else addNote({ ...payload, done: false })
    setModal(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] text-slate-500">
          Fees and purchases paid in parts — each instalment becomes its own reminder and lands in the budget of the month it falls due.
        </p>
        <button className="btn-primary shrink-0" onClick={openAdd}><Plus size={15} /> Add EMI Plan</button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Plans" value={String(totals.active)} icon={<ListChecks size={20} />} tint="#3b82f6" footer={<span className="text-slate-400">{plans.length} total</span>} />
        <StatCard label="Total Committed" value={money(totals.total)} icon={<ReceiptText size={20} />} tint={catColor} />
        <StatCard label="Paid So Far" value={money(totals.paid)} icon={<CheckCircle2 size={20} />} tint="#10b981"
          footer={<div><div className="text-[10px] text-slate-400 mb-1">{totals.total ? Math.round((totals.paid / totals.total) * 100) : 0}% of committed</div><Progress value={totals.paid} max={totals.total || 1} color="#10b981" height={5} /></div>} />
        <StatCard label="Remaining" value={money(totals.outstanding)} icon={<CalendarClock size={20} />} tint="#f59e0b"
          footer={<span className="text-slate-400">{totals.next ? `Next due ${fmtDate(totals.next)}` : 'Nothing due'}</span>} />
      </div>

      {plans.length === 0 ? (
        <Card><div className="py-10"><Empty text="No installment plans yet — add one for a fee, purchase or bill paid in parts." /></div></Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 items-start">
          {plans.map((n) => {
            const sum = summaries.get(n.id)!
            const isOpen = expanded === n.id
            return (
              <Card key={n.id}>
                <CardHead
                  title={n.title}
                  sub={`${n.feeCategory ?? n.category}${n.person ? ` · ${n.person}` : ''}${n.extraCharge ? ` · +${money(n.extraCharge, sum.list[0]?.currency)} interest/extra` : ''}`}
                  right={
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(n)} className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"><Pencil size={13} /></button>
                      <button onClick={() => removeNote(n.id)} className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 size={13} /></button>
                    </div>
                  }
                />
                <div className="px-5 pb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex-1 text-[11.5px] text-slate-500">
                      {money(sum.paid, sum.list[0]?.currency)} of {money(sum.total, sum.list[0]?.currency)} paid
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{sum.total ? Math.round((sum.paid / sum.total) * 100) : 0}%</span>
                  </div>
                  <Progress value={sum.paid} max={sum.total || 1} color="#10b981" height={7} />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    {[
                      ['Remaining', money(sum.outstanding, sum.list[0]?.currency)],
                      ['Next Payment', sum.next ? money(sum.next.amount, sum.next.currency) : '—'],
                      ['Next Date', sum.nextDate ? fmtDate(sum.nextDate) : 'All paid'],
                      ['Remaining Installments', String(sum.list.filter((i) => installmentStatus(i, TODAY, (id) => txnIds.has(id)) !== 'Paid').length)],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                        <p className="text-[9.5px] text-slate-400">{k}</p>
                        <p className="text-[12px] font-extrabold text-slate-800">{v}</p>
                      </div>
                    ))}
                  </div>
                  {sum.overdue > 0 && <p className="text-[11px] font-semibold text-rose-600 mt-2">{sum.overdue} overdue</p>}
                  <button onClick={() => setExpanded(isOpen ? null : n.id)} className="mt-3 text-[12px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer">
                    {isOpen ? 'Hide payment history' : 'Show payment history'}
                  </button>
                  {isOpen && <div className="mt-3"><ScheduleView note={n} onPay={(inst) => setPayFor({ note: n, inst })} /></div>}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Installment Plan' : 'Add Installment Plan'}
        width="max-w-3xl"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>{editing ? 'Save Changes' : 'Add Plan'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Installment Name" className="col-span-2">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. School Fee" autoFocus />
          </Field>
          <Field label="Category">
            {newCategory === null ? (
              <select
                className="input"
                value={form.category}
                onChange={(e) => {
                  if (e.target.value === ADD_CATEGORY) setNewCategory('')
                  else setForm({ ...form, category: e.target.value })
                }}
              >
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value={ADD_CATEGORY}>+ Add a category…</option>
              </select>
            ) : (
              <div className="flex gap-1.5">
                <input
                  className="input flex-1 min-w-0"
                  autoFocus
                  placeholder="e.g. School Bus"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addCategory(newCategory) }
                    if (e.key === 'Escape') setNewCategory(null)
                  }}
                />
                <button type="button" className="btn-primary h-9 px-3" disabled={!newCategory.trim()} onClick={() => addCategory(newCategory)}>
                  Add
                </button>
                <button type="button" className="btn-ghost h-9 px-3" onClick={() => setNewCategory(null)}>
                  Cancel
                </button>
              </div>
            )}
          </Field>
          <Field label="Person (who it is for)">
            <select className="input" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}>
              <option value="">— none —</option>
              {people.map((p) => <option key={p.id}>{p.name}</option>)}
            </select>
          </Field>
          {/* extraCharge has no currency of its own — it is reported in the schedule's, so show which that is. */}
          <Field label={`Interest / Extra Charge (optional, ${form.currency})`}>
            <div className="flex gap-1">
              <input className="input flex-1 min-w-0" type="number" min="0" value={form.extraCharge} onChange={(e) => setForm({ ...form, extraCharge: e.target.value })} />
              <span className="input w-[4.4rem] flex items-center justify-center bg-slate-50 text-slate-500 font-semibold">{form.currency}</span>
            </div>
          </Field>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
            <span className="text-[12.5px] font-semibold text-slate-600">Auto Add to Budget</span>
            <Switch checked={form.autoAddToBudget} onChange={(v) => setForm({ ...form, autoAddToBudget: v })} />
          </div>

          <div className="col-span-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3.5">
            <p className="text-[11.5px] font-bold text-brand-800 mb-2 flex items-center gap-1.5"><Sparkles size={13} /> Auto-create the schedule</p>
            {/* Which figure you actually have: the whole fee, or one month's payment. */}
            {/* Any two of total / monthly / months — the third is worked out. */}
            <div className="mb-2 flex flex-wrap rounded-lg border border-[#dbe4f3] bg-white p-0.5 w-fit">
              {MODES.map((o) => (
                <button
                  key={o.k}
                  type="button"
                  title={o.hint}
                  onClick={() => setForm({ ...form, genMode: o.k })}
                  className={`h-7 px-3 rounded-md text-[11.5px] font-semibold cursor-pointer transition ${form.genMode === o.k ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              {/* first figure: always money */}
              <div className="flex gap-1">
                <input
                  className="input h-9 flex-1 min-w-0"
                  type="number"
                  min="0"
                  placeholder={form.genMode === 'monthly-count' ? 'Monthly amount' : 'Total amount'}
                  value={form.genMode === 'monthly-count' ? form.genMonthly : form.genTotal}
                  onChange={(e) => setForm({ ...form, [form.genMode === 'monthly-count' ? 'genMonthly' : 'genTotal']: e.target.value })}
                />
                <select
                  className="input h-9 w-[4.4rem] px-1"
                  value={form.currency}
                  title="Currency for every instalment generated"
                  onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* second figure: the EMI, or how many months */}
              {form.genMode === 'total-monthly' ? (
                <div className="flex gap-1">
                  <input
                    className="input h-9 flex-1 min-w-0"
                    type="number"
                    min="0"
                    placeholder="Monthly / EMI"
                    value={form.genMonthly}
                    onChange={(e) => setForm({ ...form, genMonthly: e.target.value })}
                  />
                  <span className="input h-9 w-[4.4rem] flex items-center justify-center bg-slate-50 text-[11.5px] font-semibold text-slate-500">
                    {form.currency}
                  </span>
                </div>
              ) : (
                <div className="flex gap-1">
                  <input
                    className="input h-9 flex-1 min-w-0"
                    type="number"
                    min="1"
                    placeholder="No. of months"
                    value={form.genCount}
                    onChange={(e) => setForm({ ...form, genCount: e.target.value })}
                  />
                  <span className="input h-9 w-[4.4rem] flex items-center justify-center bg-slate-50 text-[11.5px] font-semibold text-slate-500">
                    months
                  </span>
                </div>
              )}

              <input className="input h-9" type="date" value={form.genStart} onChange={(e) => setForm({ ...form, genStart: e.target.value })} />
              <button type="button" className="btn-soft h-9" onClick={generate} disabled={!plan.valid}>Generate</button>
            </div>

            <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500">
              {plan.capped ? (
                <span className="font-semibold text-rose-600">
                  That monthly amount would need more than {MAX_INSTALLMENTS} instalments — raise it, or enter the
                  number of months instead.
                </span>
              ) : plan.valid ? (
                <>
                  <b className="text-slate-700">
                    {plan.count} instalment{plan.count === 1 ? '' : 's'} of {money(plan.per, form.currency)}
                    {plan.last !== plan.per && <> (the last one {money(plan.last, form.currency)})</>} ={' '}
                    {money(plan.total, form.currency)}
                  </b>
                  , monthly from {fmtDate(form.genStart)}.{' '}
                </>
              ) : (
                <>{MODES.find((m) => m.k === form.genMode)?.hint}{' '}</>
              )}
              Each instalment can still be changed on its own below.
            </p>
          </div>

          <div className="col-span-2 border-t border-[#eef2f8] pt-4">
            <ScheduleEditor value={schedule} onChange={setSchedule} defaultCurrency={form.currency} />
          </div>
        </div>
      </Modal>

      <PayModal
        open={payFor !== null}
        onClose={() => setPayFor(null)}
        title={payFor ? `${payFor.note.title} — ${payFor.inst.label}` : ''}
        amount={payFor?.inst.amount}
        currency={payFor?.inst.currency ?? 'AED'}
        onConfirm={(p) => payFor && payInstallment(payFor.note.id, payFor.inst.id, p)}
        allowLoan
        suggestLoanFor={payFor?.note.title}
      />
    </div>
  )
}
