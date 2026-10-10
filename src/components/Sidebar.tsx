import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3, Bot, CalendarDays, ChevronLeft, ChevronRight, CreditCard, FileText, FolderTree, Gauge, Gem, Home,
  Landmark, LayoutDashboard, Scale, MinusCircle, PiggyBank, PlusCircle, Repeat,
  Settings as SettingsIcon, ShoppingBag, ShoppingCart, Sparkles, StickyNote, Tags, Target, TrendingUp, Users, Wallet,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { docStatus } from '@/lib/selectors'
import { hasGemini } from '@/lib/gemini'
import { AskModal } from '@/components/AskModal'
import { canOpen } from '@/lib/access'
import { CloudBasketMark } from '@/components/CloudBasketMark'
import { buildSnapshot } from '@/lib/financials'
import { tierTone } from '@/lib/status'
import { TODAY, convert, money } from '@/lib/format'
import type { Currency } from '@/types'

const NAV = [
  { to: '/', label: 'My Financial Status', icon: Home, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/income', label: 'Income', icon: PlusCircle },
  { to: '/income-planning', label: 'Income Planning', icon: Repeat },
  { to: '/expenses', label: 'Expenses', icon: MinusCircle },
  { to: '/expense-report', label: 'Expense Report', icon: ShoppingBag },
  { to: '/budget', label: 'Budget', icon: Gauge },
  { to: '/loans', label: 'Loans & EMIs', icon: Landmark },
  { to: '/forecast', label: 'Financial Forecast', icon: TrendingUp },
  { to: '/assets', label: 'Assets & Properties', icon: Gem },
  { to: '/profit-loss', label: 'Monthly P&L', icon: Scale },
  { to: '/people', label: 'People', icon: Users },
  { to: '/bills', label: 'Bills & Subscriptions', icon: CreditCard },
  { to: '/documents', label: 'Documents', icon: FileText, badge: 'docs' },
  { to: '/notes', label: 'Notes & Follow Up', icon: StickyNote, badge: 'notes' },
  { to: '/price-tracker', label: 'Price Tracker', icon: Tags },
  { to: '/shopping', label: 'Shopping Assistant', icon: ShoppingCart },
  { to: '/goals', label: 'Savings Goals', icon: PiggyBank },
  { to: '/vision-board', label: 'Vision Board', icon: Target },
  { to: '/categories', label: 'Categories', icon: FolderTree },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/ai-advisor', label: 'Family Advisor', icon: Sparkles },
  { to: '/ai-employees', label: 'AI Employees', icon: Bot },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
] as const

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggle,
}: {
  onNavigate?: () => void
  /** Icon-only rail — the tablet-landscape default, so page content keeps its multi-column layout. */
  collapsed?: boolean
  onToggle?: () => void
}) {
  const s = useStore()
  const { documents, notes, settings, accounts, transactions, transfers, loans, assets, bills, budgetItems, people } = s

  const [ask, setAsk] = useState(false)

  const badges: Record<string, number> = {
    docs: documents.filter((d) => docStatus(d.expiry) !== 'Valid').length,
    // Loan notes are listed under Loans & EMIs, not here, so they are not counted here either.
    notes: notes.filter((n) => !n.done && n.status === 'Pending' && n.category !== 'Loan').length,
  }

  const reporting = settings.baseCurrency
  const toReport = (a: number, c: Currency) => convert(a, c, reporting)
  const show = (v: number) => money(convert(v, reporting, 'AED'))
  const snap = useMemo(
    () => buildSnapshot({ today: TODAY, settings, accounts, transactions, transfers, loans, assets, bills, documents, notes, budgetItems, people: people.map((p) => p.name), toReport, fx: convert }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, accounts, transactions, transfers, loans, assets, bills, documents, notes, budgetItems, people],
  )
  const { tier, score, tiers } = snap.status

  return (
    <aside
      className={`h-full shrink-0 bg-white border-r border-[#eaeff8] flex flex-col ${collapsed ? 'w-[72px]' : 'w-[244px]'}`}
    >
      <div className={collapsed ? 'px-2 pt-4 pb-3' : 'px-4 pt-4 pb-3'}>
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <CloudBasketMark className="h-9 w-auto shrink-0" />
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <p className="text-[15.5px] font-extrabold tracking-tight truncate">
                <span className="text-slate-900">CloudBasket</span>
                <span className="text-brand-600"> 360</span>
              </p>
              <p className="text-[9.5px] text-slate-400 font-medium truncate">Your Money. Smarter Life.</p>
            </div>
          )}
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            className="mt-3 h-8 w-full rounded-lg border border-[#e2e8f0] bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer grid place-items-center"
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      <nav className={`flex-1 overflow-y-auto scroll-thin pb-2 ${collapsed ? 'px-2' : 'px-2.5'}`}>
        {NAV.filter((n) => canOpen(useStore.getState().membership, n.to)).map(({ to, label, icon: Icon, ...rest }) => {
          const count = 'badge' in rest && rest.badge ? badges[rest.badge as string] : 0
          return (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest ? rest.end : false}
              onClick={onNavigate}
              title={label}
              aria-label={label}
              className={({ isActive }) =>
                [
                  'group relative flex items-center rounded-xl text-[13px] font-semibold transition-all',
                  collapsed ? 'justify-center h-11 mt-1' : 'gap-3 px-3 h-11 mt-0.5',
                  // The active row is an amber pill with ink-dark text, not a
                  // filled brand-blue bar — see the reference design.
                  isActive
                    ? 'bg-accent-300 text-ink shadow-sm shadow-accent-300/50'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={collapsed ? 18 : 17}
                    className={isActive ? 'text-ink shrink-0' : 'text-slate-400 group-hover:text-slate-600 shrink-0'}
                  />
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  {count > 0 && (
                    <span
                      className={[
                        'grid place-items-center rounded-full font-bold shrink-0',
                        collapsed ? 'absolute top-1 right-1 h-4 min-w-4 px-1 text-[9px]' : 'h-4 min-w-4 px-1 text-[9.5px]',
                        isActive ? 'bg-ink/15 text-ink' : 'bg-rose-500 text-white',
                      ].join(' ')}
                    >
                      {count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className={`pt-0 ${collapsed ? 'p-2' : 'p-2.5'}`}>
        <NavLink
          to="/"
          onClick={onNavigate}
          title={`${tier.label} · ${score}/100 · Available ${show(snap.availableFunds)}`}
          className={`group relative block rounded-2xl overflow-hidden shadow-md bg-gradient-to-br ${tierTone(tier, tiers)} ${
            collapsed ? 'p-2 text-center' : 'p-3.5'
          }`}
        >
          {collapsed ? (
            <>
              <p className="text-[15px] font-extrabold text-white leading-none">{score}</p>
              <p className="text-[8px] font-bold text-white/70 uppercase tracking-wide mt-0.5">Score</p>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[9.5px] font-bold text-white/75 uppercase tracking-wide">My Financial Status</p>
                {hasGemini && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAsk(true) }}
                    title="Ask CloudBasket 360 about your money"
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-white/30 transition cursor-pointer"
                  >
                    <Sparkles size={9} /> Ask
                  </button>
                )}
              </div>
              <p className="text-[16px] font-extrabold text-white leading-tight mt-1 truncate">{tier.label}</p>
              <p className="text-[10.5px] text-white/85 mt-1">
                {score}/100 · Available {show(snap.availableFunds)}
              </p>
            </>
          )}
        </NavLink>
        {!collapsed && <p className="mt-2 text-center text-[9.5px] text-slate-300">v1.0.0</p>}
      </div>

      <AskModal open={ask} onClose={() => setAsk(false)} />
    </aside>
  )
}
