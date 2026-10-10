import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { compact, money, pct } from '@/lib/format'

export const PALETTE = [
  '#2563eb', '#fbbf24', '#10b981', '#8b5cf6', '#ec4899',
  '#06b6d4', '#ef4444', '#f97316', '#94a3b8', '#14b8a6',
]

const axis = { fontSize: 11, fill: '#94a3b8' }

/**
 * Recharts animates every mark through react-smooth, which never starts under
 * React 19 — the axes, grid and legend paint but the bars, pie sectors and
 * lines stay empty. Drawing them without animation is what makes them appear.
 */
const STATIC = { isAnimationActive: false } as const

/**
 * Placeholder for a chart with nothing to draw yet. It does NOT hold the
 * chart's full height open: a card with no data was reserving 230px to say
 * one short line, and a dashboard of those is mostly empty space. A chart
 * that does have data is unaffected.
 */
function NoData({ height, text = 'No data yet' }: { height: number | string; text?: string }) {
  const h = typeof height === 'number' ? Math.min(height, 110) : height
  return (
    <div className="grid place-items-center text-[12px] text-slate-400" style={{ height: h }}>
      {text}
    </div>
  )
}

const hasValues = (data: any[], keys: string[]) =>
  data.length > 0 && data.some((d) => keys.some((k) => Number(d[k]) > 0))

function TipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white border border-[#e8edf5] shadow-lg px-3 py-2">
      {label && <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="text-[12px] font-bold" style={{ color: p.color ?? p.payload?.fill }}>
          {p.name}: {money(p.value)}
        </p>
      ))}
    </div>
  )
}

export function IncomeExpenseBars({
  data,
  height = 230,
}: {
  data: { month: string; income: number; expenses: number }[]
  height?: number
}) {
  if (!hasValues(data, ['income', 'expenses'])) return <NoData height={height} text="No income or expenses recorded yet" />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -18, bottom: 0 }} barGap={3}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef8" />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
        <Tooltip content={<TipBox />} cursor={{ fill: '#f1f5f9' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, paddingBottom: 4 }}
          verticalAlign="top"
          align="right"
        />
        <Bar {...STATIC} dataKey="income" name="Income" fill="#fbbf24" radius={[6, 6, 0, 0]} maxBarSize={16} />
        <Bar {...STATIC} dataKey="expenses" name="Expenses" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SingleBars({
  data,
  dataKey = 'value',
  color = '#3b82f6',
  highlight,
  height = 220,
}: {
  data: any[]
  dataKey?: string
  color?: string
  highlight?: string
  height?: number
}) {
  if (!hasValues(data, [dataKey])) return <NoData height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef8" />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
        <Tooltip content={<TipBox />} cursor={{ fill: '#f1f5f9' }} />
        <Bar {...STATIC} dataKey={dataKey} name="Amount" radius={[5, 5, 0, 0]} maxBarSize={30}>
          {data.map((d, i) => (
            <Cell key={i} fill={highlight && d.month === highlight ? color : `${color}80`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TrendLine({ data, height = 220 }: { data: any[]; height?: number }) {
  if (!hasValues(data, ['income', 'expenses'])) return <NoData height={height} text="No income or expenses recorded yet" />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef8" />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
        <Tooltip content={<TipBox />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} verticalAlign="top" align="right" />
        <Line {...STATIC} type="monotone" dataKey="income" name="Income" stroke="#fbbf24" strokeWidth={2.5} dot={false} />
        <Line {...STATIC} type="monotone" dataKey="expenses" name="Expenses" stroke="#2563eb" strokeWidth={2.5} dot={false} />
        <Line {...STATIC} type="monotone" dataKey="net" name="Net" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function Donut({
  data,
  centerLabel,
  centerValue,
  size = 200,
  colors = PALETTE,
  innerRatio = 0.66,
}: {
  data: { name: string; value: number }[]
  centerLabel?: string
  centerValue?: string
  size?: number
  colors?: string[]
  innerRatio?: number
}) {
  const outer = size / 2 - 6
  const empty = !hasValues(data, ['value'])
  // Keep the centre label inside the hole rather than spilling over the ring.
  const hole = outer * innerRatio * 2
  const centerSize = Math.max(11, Math.min(18, Math.round(hole * 0.17)))
  return (
    // shrink-0: as a flex child the donut was being squeezed narrower than its
    // declared size, which squashed the ring and pushed the centre label out.
    // max-width + aspect-ratio instead of a fixed height: on a column narrower
    // than `size` (a small phone, or a three-across tablet row) it scales down
    // and stays circular rather than spilling out of the card.
    <div className="relative shrink-0 max-w-full" style={{ width: size, aspectRatio: '1 / 1' }}>
      {empty && (
        <div
          className="absolute inset-0 rounded-full border-[14px] border-slate-100"
          style={{ borderWidth: Math.max(10, outer * (1 - innerRatio)) }}
        />
      )}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={empty ? [] : data}
            dataKey="value"
            nameKey="name"
            innerRadius={outer * innerRatio}
            outerRadius={outer}
            paddingAngle={1.5}
            stroke="none"
            {...STATIC}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<TipBox />} />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && !empty && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center leading-tight" style={{ maxWidth: hole * 0.92 }}>
            <p
              className="font-extrabold text-slate-900 leading-tight truncate"
              style={{ fontSize: centerSize }}
              title={centerValue}
            >
              {centerValue}
            </p>
            <p className="text-slate-500 truncate" style={{ fontSize: Math.max(9, centerSize - 6) }}>
              {centerLabel}
            </p>
          </div>
        </div>
      )}
      {empty && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <p className="text-[11px] text-slate-400">No data</p>
        </div>
      )}
    </div>
  )
}

export function DonutLegend({
  data,
  total,
  colors = PALETTE,
  showValue = true,
}: {
  data: { name: string; value: number }[]
  total: number
  colors?: string[]
  showValue?: boolean
}) {
  if (!data.length) return <p className="text-[12px] text-slate-400 py-2">Nothing to show yet.</p>
  return (
    <ul className="space-y-2.5 min-w-[168px]">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center gap-2.5 text-[12px]">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
          <span className="flex-1 truncate text-slate-600">{d.name}</span>
          {showValue && (
            <span className="font-bold text-slate-800 tabular-nums">{Math.round(d.value).toLocaleString()}</span>
          )}
          <span className="w-9 text-right font-semibold text-slate-400 tabular-nums">{pct(d.value, total)}%</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Dashboard widgets
// ---------------------------------------------------------------------------

export interface GaugeSegment {
  /** Where this colour band ends, as a share of `max` (0–1). */
  to: number
  color: string
}

const GAUGE_BANDS: GaugeSegment[] = [
  { to: 0.4, color: '#ef4444' },
  { to: 0.7, color: '#f59e0b' },
  { to: 1, color: '#22c55e' },
]

function polar(cx: number, cy: number, r: number, fraction: number) {
  const a = Math.PI * (1 - Math.min(1, Math.max(0, fraction)))
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from)
  const b = polar(cx, cy, r, to)
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

/**
 * A half-circle dial — used for a bank balance against its monthly limit and
 * for a card balance against its credit limit. Pure SVG: Recharts has no gauge,
 * and this stays crisp at any size.
 */
export function Gauge({
  value,
  max,
  centerValue,
  centerLabel,
  segments = GAUGE_BANDS,
  width = 260,
}: {
  value: number
  max: number
  centerValue: string
  centerLabel: string
  segments?: GaugeSegment[]
  width?: number
}) {
  const cx = width / 2
  const r = width / 2 - 20
  const cy = r + 18
  const height = cy + 26
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const needle = polar(cx, cy, r - 24, fraction)

  return (
    // w-full alone scales the dial to whatever the column is wide, and because
    // the viewBox fixes the aspect ratio that comes straight back as height —
    // a 600px-wide card was drawing a 360px-tall gauge and leaving the card
    // mostly empty below it. It grows to its natural size and stops.
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full mx-auto"
      style={{ maxWidth: width }}
      role="img"
      aria-label={`${centerLabel}: ${centerValue}`}
    >
      <path d={arcPath(cx, cy, r, 0, 1)} stroke="#e9eef8" strokeWidth={16} fill="none" strokeLinecap="round" />
      {segments.map((s, i) => {
        const from = i === 0 ? 0 : segments[i - 1].to
        return <path key={s.color + i} d={arcPath(cx, cy, r, from, s.to)} stroke={s.color} strokeWidth={16} fill="none" />
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const p = polar(cx, cy, r + 13, f)
        return (
          <text
            key={f}
            x={p.x}
            y={p.y + 4}
            textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
            className="fill-slate-400"
            style={{ fontSize: 9.5 }}
          >
            {compact(Math.round(max * f))}
          </text>
        )
      })}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#334155" strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="#334155" />
      <text x={cx} y={cy - 30} textAnchor="middle" className="fill-slate-900 font-extrabold" style={{ fontSize: 17 }}>
        {centerValue}
      </text>
      <text x={cx} y={cy - 14} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
        {centerLabel}
      </text>
    </svg>
  )
}

/** Spending per day, with the amount written over each bar. */
export function DayBars({
  data,
  color = '#3b82f6',
  height = 210,
}: {
  data: { label: string; value: number }[]
  color?: string
  height?: number
}) {
  if (!hasValues(data, ['value'])) return <NoData height={height} text="Nothing spent in this period" />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 5, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef8" />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
        <Tooltip content={<TipBox />} cursor={{ fill: '#f1f5f9' }} />
        <Bar {...STATIC} dataKey="value" name="Spent" fill={color} radius={[5, 5, 0, 0]} maxBarSize={34}>
          <LabelList dataKey="value" position="top" formatter={(v: any) => (Number(v) ? compact(Number(v)) : '')} style={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Balance so far (solid) and the projection ahead (dashed), on one axis. */
export function CashFlowLine({
  data,
  height = 220,
}: {
  data: { label: string; actual?: number; forecast: number }[]
  height?: number
}) {
  if (!data.length) return <NoData height={height} text="No balance history yet" />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef8" />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
        <Tooltip content={<TipBox />} />
        <Legend iconType="plainline" iconSize={14} wrapperStyle={{ fontSize: 11 }} verticalAlign="top" align="right" />
        <Line {...STATIC} type="monotone" dataKey="actual" name="Actual" stroke="#06b6d4" strokeWidth={2.5} dot={false} connectNulls={false} />
        <Line {...STATIC} type="monotone" dataKey="forecast" name="Forecast" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
