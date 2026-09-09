import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { compact, money, pct } from '@/lib/format'

export const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#ef4444', '#eab308', '#64748b', '#14b8a6',
]

const axis = { fontSize: 11, fill: '#94a3b8' }

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
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -18, bottom: 0 }} barGap={3}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
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
        <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={16} />
        <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={16} />
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
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
        <Tooltip content={<TipBox />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey={dataKey} name="Amount" radius={[5, 5, 0, 0]} maxBarSize={30}>
          {data.map((d, i) => (
            <Cell key={i} fill={highlight && d.month === highlight ? color : `${color}80`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TrendLine({ data, height = 220 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
        <Tooltip content={<TipBox />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} verticalAlign="top" align="right" />
        <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="net" name="Net" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={false} />
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
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={outer * innerRatio}
            outerRadius={outer}
            paddingAngle={1.5}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<TipBox />} />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <p className="text-[17px] font-extrabold text-slate-900 leading-tight">{centerValue}</p>
            <p className="text-[11px] text-slate-500">{centerLabel}</p>
          </div>
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
