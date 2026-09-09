import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardHead, Empty, PageHeader } from '@/components/ui/Primitives'
import { fmtDate, money, TODAY } from '@/lib/format'

interface Event {
  date: string
  label: string
  type: 'income' | 'expense' | 'loan' | 'bill' | 'document' | 'note'
  amount?: number
  currency?: string
}

const TYPE_STYLE: Record<Event['type'], { bg: string; text: string; dot: string; label: string }> = {
  income: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: '#22c55e', label: 'Income' },
  expense: { bg: 'bg-rose-50', text: 'text-rose-700', dot: '#f43f5e', label: 'Expense' },
  loan: { bg: 'bg-violet-50', text: 'text-violet-700', dot: '#8b5cf6', label: 'Loan' },
  bill: { bg: 'bg-amber-50', text: 'text-amber-700', dot: '#f59e0b', label: 'Bill' },
  document: { bg: 'bg-blue-50', text: 'text-blue-700', dot: '#3b82f6', label: 'Document' },
  note: { bg: 'bg-slate-100', text: 'text-slate-700', dot: '#64748b', label: 'Note' },
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarPage() {
  const { transactions, loans, bills, documents, notes } = useStore()
  const now = new Date(TODAY + 'T00:00:00')
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [filter, setFilter] = useState<'all' | Event['type']>('all')

  const events = useMemo<Event[]>(() => {
    const out: Event[] = []
    for (const t of transactions) out.push({ date: t.date, label: t.description, type: t.type, amount: t.amount, currency: t.currency })
    for (const l of loans) if (l.status !== 'Closed') out.push({ date: l.nextPayment, label: `${l.name} EMI`, type: 'loan', amount: l.emi, currency: l.currency })
    for (const b of bills) out.push({ date: b.dueDate, label: `${b.name} due`, type: 'bill', amount: b.amount, currency: 'AED' })
    for (const d of documents) out.push({ date: d.expiry, label: `${d.name} expires`, type: 'document' })
    for (const n of notes) if (!n.done) out.push({ date: n.dueDate, label: n.title, type: 'note' })
    return out
  }, [transactions, loans, bills, documents, notes])

  const visible = filter === 'all' ? events : events.filter((e) => e.type === filter)

  const first = new Date(cursor.year, cursor.month, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const key = (d: number) => `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const monthEvents = visible.filter((e) => e.date.startsWith(`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`))

  const move = (delta: number) => {
    const m = cursor.month + delta
    if (m < 0) setCursor({ year: cursor.year - 1, month: 11 })
    else if (m > 11) setCursor({ year: cursor.year + 1, month: 0 })
    else setCursor({ ...cursor, month: m })
  }

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader title="Calendar" subtitle="Every payment, due date and expiry on one timeline." />

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'income', 'expense', 'loan', 'bill', 'document', 'note'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip cursor-pointer transition ${filter === f ? 'bg-brand-600 text-white' : 'bg-white border border-[#e8edf5] text-slate-600 hover:bg-slate-50'}`}
          >
            {f !== 'all' && <span className="h-2 w-2 rounded-full" style={{ background: TYPE_STYLE[f].dot }} />}
            {f === 'all' ? `All (${events.length})` : `${TYPE_STYLE[f].label} (${events.filter((e) => e.type === f).length})`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="card-title">{MONTH_NAMES[cursor.month]} {cursor.year}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => move(-1)} className="h-8 w-8 grid place-items-center rounded-lg border border-[#e8edf5] text-slate-500 hover:bg-slate-50 cursor-pointer">
                <ChevronLeft size={15} />
              </button>
              <button onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })} className="h-8 px-3 rounded-lg border border-[#e8edf5] text-[12px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                Today
              </button>
              <button onClick={() => move(1)} className="h-8 w-8 grid place-items-center rounded-lg border border-[#e8edf5] text-slate-500 hover:bg-slate-50 cursor-pointer">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="px-4 pb-5">
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center text-[11px] font-bold text-slate-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: startDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const iso = key(day)
                const dayEvents = visible.filter((e) => e.date === iso)
                const isToday = iso === TODAY
                return (
                  <div
                    key={day}
                    className={`min-h-[86px] rounded-xl border p-1.5 transition ${
                      isToday ? 'border-brand-400 bg-brand-50/40 ring-2 ring-brand-500/10' : 'border-[#eef2f8] hover:border-slate-200'
                    }`}
                  >
                    <p className={`text-[11px] font-bold mb-1 ${isToday ? 'text-brand-700' : 'text-slate-500'}`}>{day}</p>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((e, idx) => (
                        <div
                          key={idx}
                          title={`${e.label}${e.amount ? ` — ${money(e.amount, (e.currency as any) ?? 'AED')}` : ''}`}
                          className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded truncate ${TYPE_STYLE[e.type].bg} ${TYPE_STYLE[e.type].text}`}
                        >
                          {e.label}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[9.5px] text-slate-400 font-semibold px-1.5">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead title={`${MONTH_NAMES[cursor.month]} Events`} sub={`${monthEvents.length} items this month`} />
          <div className="px-5 pb-5 space-y-2 max-h-[620px] overflow-y-auto scroll-thin">
            {[...monthEvents].sort((a, b) => a.date.localeCompare(b.date)).map((e, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[#eef2f8] px-3 py-2.5">
                <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: TYPE_STYLE[e.type].dot }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-slate-800 truncate">{e.label}</p>
                  <p className="text-[11px] text-slate-400">{fmtDate(e.date)} · {TYPE_STYLE[e.type].label}</p>
                </div>
                {e.amount != null && (
                  <span className="text-[12px] font-bold text-slate-700 whitespace-nowrap">
                    {money(e.amount, (e.currency as any) ?? 'AED')}
                  </span>
                )}
              </div>
            ))}
            {monthEvents.length === 0 && <Empty text="Nothing scheduled this month." />}
          </div>
        </Card>
      </div>
    </div>
  )
}
