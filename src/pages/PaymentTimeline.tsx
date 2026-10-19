import { useMemo, useState } from 'react'
import {
  AlertTriangle, Calculator, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, TrendingDown, Wallet,
} from 'lucide-react'
import {
  Area, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useStore } from '@/store/useStore'
import { Badge, Card, CardHead, Empty, PageHeader, Progress, StatCard } from '@/components/ui/Primitives'
import { KIND_COLOR, KIND_LABEL, buffer, paymentTimeline, simulateDebit, timelinePoints, type TimelineKind } from '@/lib/timeline'
import { CURRENT_MONTH } from '@/lib/selectors'
import { TODAY, fmtDate, money, shortDate } from '@/lib/format'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const label = (key: string) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`
const shiftMonth = (key: string, by: number) => {
  const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The outflow lines drawn under the balance, in the order the legend lists them. */
const SERIES = ['expense', 'loan', 'bill', 'subscription', 'instalment'] as const
type ChartKind = 'all' | (typeof SERIES)[number]

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {text}
    </span>
  )
}

/**
 * A value pinned above its point, as a filled tag. Zero is left unlabelled, so
 * an outflow line only speaks on the days something actually left.
 */
function Pill({ x, y, value, fill }: { x?: number | string; y?: number | string; value?: number | string; fill: string }) {
  const v = Number(value)
  if (!v || x == null || y == null) return null
  const text = money(v)
  const w = text.length * 6.4 + 16
  const cx = Number(x)
  const top = Number(y) - 30
  return (
    <g>
      <rect x={cx - w / 2} y={top} width={w} height={20} rx={7} fill={fill} />
      <text x={cx} y={top + 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">{text}</text>
    </g>
  )
}
const weekday = (iso: string) => DAYS[new Date(`${iso}T00:00:00`).getDay()]

const FILTERS: { key: 'all' | TimelineKind; label: string }[] = [
  { key: 'all', label: 'All categories' },
  { key: 'loan', label: KIND_LABEL.loan },
  { key: 'bill', label: KIND_LABEL.bill },
  { key: 'subscription', label: KIND_LABEL.subscription },
  { key: 'instalment', label: KIND_LABEL.instalment },
  { key: 'expense', label: KIND_LABEL.expense },
  { key: 'income', label: KIND_LABEL.income },
]

export default function PaymentTimeline() {
  const accounts = useStore((s) => s.accounts)
  const transactions = useStore((s) => s.transactions)
  const transfers = useStore((s) => s.transfers)
  const loans = useStore((s) => s.loans)
  const bills = useStore((s) => s.bills)
  const notes = useStore((s) => s.notes)
  const incomeSources = useStore((s) => s.incomeSources)

  const [month, setMonth] = useState(CURRENT_MONTH)
  const [filter, setFilter] = useState<'all' | TimelineKind>('all')
  const [chartKind, setChartKind] = useState<ChartKind>('all')
  const [testAmount, setTestAmount] = useState('')
  const [testDate, setTestDate] = useState(TODAY)

  const txnIds = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions])
  const timeline = useMemo(
    () =>
      paymentTimeline({
        accounts, txns: transactions, transfers, loans, bills, notes, incomeSources,
        txnExists: (id) => txnIds.has(id),
        month,
      }),
    [accounts, transactions, transfers, loans, bills, notes, incomeSources, txnIds, month],
  )

  const points = useMemo(() => timelinePoints(timeline), [timeline])
  const amount = Number(testAmount) || 0
  const sim = useMemo(() => (amount > 0 ? simulateDebit(timeline, amount, testDate) : null), [timeline, amount, testDate])
  const cushion = buffer(timeline.startingBalance)
  const rows = filter === 'all' ? timeline.rows : timeline.rows.filter((r) => r.kind === filter)

  const chart = points.map((p) => ({ ...p, label: shortDate(p.date) }))
  // Written out in full: Tailwind only generates classes it can see as literal
  // strings, so building `bg-${tone}-50` at runtime would style nothing.
  const verdictBox =
    sim?.verdict === 'shortfall' ? 'bg-rose-50/60 border-rose-100'
      : sim?.verdict === 'tight' ? 'bg-amber-50/60 border-amber-100'
        : 'bg-emerald-50/60 border-emerald-100'

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="Payment Timeline"
        subtitle="Every payment in date order, and the cash you are left with after each one."
        actions={
          <div className="flex items-center gap-1.5">
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="h-9 w-9 grid place-items-center rounded-xl border border-[#e8edf5] bg-white text-slate-500 hover:bg-slate-50 cursor-pointer"><ChevronLeft size={15} /></button>
            <span className="text-[13px] font-bold text-slate-700 px-2 whitespace-nowrap">{label(month)}</span>
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="h-9 w-9 grid place-items-center rounded-xl border border-[#e8edf5] bg-white text-slate-500 hover:bg-slate-50 cursor-pointer"><ChevronRight size={15} /></button>
          </div>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard label="Starting Balance" value={money(timeline.startingBalance)} icon={<Wallet size={20} />} tint="#3b82f6"
          footer={<span className="text-slate-400">What {MONTH_NAMES[Number(month.slice(5, 7)) - 1]} opened with</span>} />
        <StatCard label="Expected Inflow" value={money(timeline.inflow)} icon={<CheckCircle2 size={20} />} tint="#10b981"
          footer={<span className="text-slate-400">Received and planned</span>} />
        <StatCard label="Total Outflow" value={money(timeline.outflow)} icon={<TrendingDown size={20} />} tint="#ef4444"
          footer={<span className="text-slate-400">{timeline.rows.filter((r) => r.delta < 0).length} payments</span>} />
      </div>

      {/* ---- simulator ---- */}
      <Card>
        <CardHead
          title="Amount Impact Simulator"
          sub="Try a payment against this month and see whether the day you have in mind works"
          right={<Calculator size={16} className="text-slate-400" />}
        />
        <div className="px-5 pb-5">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="label">Amount to test</span>
              <input className="input" type="number" min="0" value={testAmount} onChange={(e) => setTestAmount(e.target.value)} placeholder="e.g. 2000" />
            </label>
            <label className="block">
              <span className="label">On this date</span>
              <input className="input" type="date" value={testDate} min={`${month}-01`} max={`${month}-31`} onChange={(e) => setTestDate(e.target.value)} />
            </label>
            <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
              <p className="text-[10.5px] text-slate-400">New total outflow</p>
              <p className="text-[15px] font-extrabold text-rose-600 tabular-nums">{money(sim ? sim.newOutflow : timeline.outflow)}</p>
              <p className="text-[10px] text-slate-400">Now {money(timeline.outflow)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
              <p className="text-[10.5px] text-slate-400">Balance at month end</p>
              <p className={`text-[15px] font-extrabold tabular-nums ${(sim?.newEndBalance ?? timeline.endBalance) < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {money(sim ? sim.newEndBalance : timeline.endBalance)}
              </p>
              <p className="text-[10px] text-slate-400">Now {money(timeline.endBalance)}</p>
            </div>
          </div>

          {sim ? (
            <div className={`mt-4 rounded-2xl border px-4 py-3.5 ${verdictBox}`}>
              <div className="flex items-start gap-2.5">
                {sim.verdict === 'comfortable'
                  ? <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                  : <AlertTriangle size={18} className={sim.verdict === 'shortfall' ? 'text-rose-600 mt-0.5 shrink-0' : 'text-amber-600 mt-0.5 shrink-0'} />}
                <div className="min-w-0">
                  <p className={`text-[13.5px] font-bold ${sim.verdict === 'comfortable' ? 'text-emerald-800' : sim.verdict === 'shortfall' ? 'text-rose-800' : 'text-amber-800'}`}>
                    {sim.headline}
                  </p>
                  <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{sim.reason}</p>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    <span className="chip bg-white text-slate-600">Lowest point {money(sim.lowest.balance)} on {shortDate(sim.lowest.date)}</span>
                    <span className="chip bg-white text-slate-600">Cushion kept back {money(cushion)}</span>
                    {sim.affordable > 0 && <span className="chip bg-white text-slate-600">Comfortable up to {money(sim.affordable)} that day</span>}
                    {sim.betterDate && (
                      <button onClick={() => setTestDate(sim.betterDate!)} className="chip bg-brand-600 text-white cursor-pointer">
                        Try {shortDate(sim.betterDate)} instead
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[12px] text-slate-400">
              Enter an amount to see what it does to the balance on that day, and whether a later one would sit better.
            </p>
          )}
        </div>
      </Card>

      {/* ---- chart ---- */}
      <Card>
        <CardHead
          title={`Cash Flow Timeline (${label(month)})`}
          sub={`Lowest point ${money(timeline.lowest.balance)} on ${fmtDate(timeline.lowest.date)}`}
          right={
            <select className="input h-9 w-40 text-[12px]" value={chartKind} onChange={(e) => setChartKind(e.target.value as ChartKind)}>
              <option value="all">All categories</option>
              {SERIES.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          }
        />
        <div className="px-5 -mt-1 pb-1 flex flex-wrap gap-x-4 gap-y-1">
          <Legend color="#10b981" text="Cash balance" />
          {SERIES.filter((k) => chartKind === 'all' || chartKind === k).map((k) => (
            <Legend key={k} color={KIND_COLOR[k]} text={KIND_LABEL[k]} />
          ))}
        </div>
        <div className="px-2 pb-4">
          {points.length <= 1 ? (
            <Empty text="Nothing recorded or committed in this month yet." />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chart} margin={{ top: 34, right: 28, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => money(v)} />
                <Tooltip
                  formatter={(v: number, name: string) => [money(v), name === 'balance' ? 'Cash balance' : KIND_LABEL[name as TimelineKind] ?? name]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e9eef8', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2.5} fill="url(#balanceFill)" isAnimationActive={false}
                  dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}>
                  {/* Every value on the line itself, not hidden behind a hover. */}
                  <LabelList dataKey="balance" content={(p: any) => <Pill {...p} fill="#10b981" />} />
                </Area>
                {SERIES.filter((k) => chartKind === 'all' || chartKind === k).map((k) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={KIND_COLOR[k]} strokeWidth={2} isAnimationActive={false}
                    dot={(p: any) => (p.value > 0 ? <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill={KIND_COLOR[k]} stroke="#fff" strokeWidth={2} /> : <g key={p.index} />)}>
                    <LabelList dataKey={k} content={(p: any) => <Pill {...p} fill={KIND_COLOR[k]} />} />
                  </Line>
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ---- the list ---- */}
      <Card>
        <CardHead
          title={`All Payments · ${label(month)}`}
          sub={`${timeline.rows.length} movement${timeline.rows.length === 1 ? '' : 's'}`}
          right={
            <select className="input h-9 w-44 text-[12px]" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | TimelineKind)}>
              {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          }
        />
        {rows.length === 0 ? (
          <Empty text="Nothing in this month for that filter." />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="th w-8" />
                  <th className="th">Date</th>
                  <th className="th">Description</th>
                  <th className="th">Category</th>
                  <th className="th text-right">Amount</th>
                  <th className="th text-right">Balance after</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {rows.map((r) => (
                  <tr key={r.id} className="row-hover">
                    <td className="td"><span className="h-2.5 w-2.5 rounded-full block" style={{ background: KIND_COLOR[r.kind] }} /></td>
                    <td className="td whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{fmtDate(r.date)}</span>
                      <span className="block text-[10px] text-slate-400">{weekday(r.date)}</span>
                    </td>
                    <td className="td font-semibold text-slate-800">{r.description}</td>
                    <td className="td">
                      <span className="chip" style={{ background: `${KIND_COLOR[r.kind]}1a`, color: KIND_COLOR[r.kind] }}>{KIND_LABEL[r.kind]}</span>
                    </td>
                    <td className={`td text-right font-bold tabular-nums ${r.delta < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {r.delta < 0 ? '−' : '+'}{money(r.amount, r.currency)}
                    </td>
                    <td className={`td text-right font-extrabold tabular-nums ${r.balanceAfter < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {money(r.balanceAfter)}
                    </td>
                    <td className="td">
                      <Badge tone={r.status === 'Paid' ? 'green' : r.status === 'Overdue' ? 'red' : 'blue'}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/70">
                <tr>
                  <td className="td" />
                  <td className="td font-bold" colSpan={3}>Balance at the end of {MONTH_NAMES[Number(month.slice(5, 7)) - 1]}</td>
                  <td className="td text-right font-bold tabular-nums text-rose-600">−{money(timeline.outflow)}</td>
                  <td className={`td text-right font-extrabold tabular-nums ${timeline.endBalance < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {money(timeline.endBalance)}
                  </td>
                  <td className="td" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* ---- where the month goes ---- */}
      <Card>
        <CardHead title="Where the month goes" sub="Each kind of payment against the month's total outflow" />
        <div className="px-5 pb-5 space-y-3">
          {(['loan', 'bill', 'subscription', 'instalment', 'expense'] as TimelineKind[])
            .filter((k) => timeline.byKind[k].count > 0)
            .map((k) => (
              <div key={k}>
                <div className="flex items-center gap-2 text-[12.5px] mb-1.5">
                  <span className="flex-1 font-semibold text-slate-700">{KIND_LABEL[k]}</span>
                  <span className="text-slate-500 tabular-nums">{money(timeline.byKind[k].total)}</span>
                  <span className="w-10 text-right font-bold text-slate-400 tabular-nums">
                    {timeline.outflow ? Math.round((timeline.byKind[k].total / timeline.outflow) * 100) : 0}%
                  </span>
                </div>
                <Progress value={timeline.byKind[k].total} max={timeline.outflow || 1} color={KIND_COLOR[k]} height={8} />
              </div>
            ))}
          {timeline.outflow === 0 && <Empty text="Nothing going out this month." />}
          <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
            <CalendarClock size={11} className="inline -mt-0.5 mr-1" />
            Paid rows come from your records; upcoming ones from loan EMIs, bills and instalment schedules. A purchase
            on a credit card raises what you owe without moving cash, so it is not on this line —
            <CreditCard size={11} className="inline -mt-0.5 mx-1" />
            it appears when the card is paid.
          </p>
        </div>
      </Card>
    </div>
  )
}
