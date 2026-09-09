import { NavLink } from 'react-router-dom'
import {
  BarChart3, Banknote, Bell, CalendarDays, CreditCard, FileText, Gauge, Home, LayoutGrid, Landmark,
  MinusCircle, PiggyBank, PlusCircle, Settings as SettingsIcon, ShoppingBag, ShoppingCart, StickyNote, Tags, Users, Wallet, Sparkles,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { docStatus } from '@/lib/selectors'

const NAV = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/income', label: 'Income', icon: PlusCircle },
  { to: '/expenses', label: 'Expenses', icon: MinusCircle },
  { to: '/purchases', label: 'Purchases', icon: ShoppingBag },
  { to: '/budget', label: 'Budget', icon: Gauge },
  { to: '/loans', label: 'Loans', icon: Landmark },
  { to: '/people', label: 'People', icon: Users },
  { to: '/bills', label: 'Bills & Subscriptions', icon: CreditCard },
  { to: '/documents', label: 'Documents', icon: FileText, badge: 'docs' },
  { to: '/notes', label: 'Notes & Follow Up', icon: StickyNote, badge: 'notes' },
  { to: '/price-tracker', label: 'Price Tracker', icon: Tags },
  { to: '/shopping', label: 'Shopping Assistant', icon: ShoppingCart },
  { to: '/goals', label: 'Savings Goals', icon: PiggyBank },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
] as const

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const documents = useStore((s) => s.documents)
  const notes = useStore((s) => s.notes)

  const badges: Record<string, number> = {
    docs: documents.filter((d) => docStatus(d.expiry) !== 'Valid').length,
    notes: notes.filter((n) => !n.done && n.status === 'Pending').length,
  }

  return (
    <aside className="h-full w-[248px] shrink-0 bg-white border-r border-[#e8edf5] flex flex-col">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-400 grid place-items-center text-white font-black text-lg shadow-lg shadow-brand-500/25">
            T
          </div>
          <div className="leading-tight">
            <p className="text-[19px] font-extrabold tracking-tight">
              <span className="text-slate-900">Thomas</span>
              <span className="text-brand-600">.ai</span>
            </p>
            <p className="text-[10px] text-slate-400 font-medium">Your Money. Smarter Life.</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-3 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, ...rest }) => {
          const count = 'badge' in rest && rest.badge ? badges[rest.badge as string] : 0
          return (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest ? rest.end : false}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'group flex items-center gap-3 rounded-xl px-3 h-10 text-[13px] font-semibold transition-all',
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span className="flex-1 truncate">{label}</span>
                  {count > 0 && (
                    <span
                      className={`h-5 min-w-5 px-1.5 grid place-items-center rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'
                      }`}
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

      <div className="p-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-cyan-500 p-4 text-white shadow-lg shadow-brand-600/25">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-8 w-8 rounded-lg bg-white/20 grid place-items-center backdrop-blur">
              <Sparkles size={16} />
            </div>
            <div className="leading-tight">
              <p className="text-[13px] font-bold">Thomas.ai</p>
              <p className="text-[10px] text-white/75">AI Money Advisor</p>
            </div>
          </div>
          <p className="text-[11px] text-white/85 leading-relaxed mb-3">
            Ask me anything about your money, bills, loans or plans.
          </p>
          <button className="w-full h-9 rounded-xl bg-white text-brand-700 text-[12px] font-bold hover:bg-white/90 transition cursor-pointer inline-flex items-center justify-center gap-1.5">
            <Bell size={13} /> Chat with Thomas
          </button>
        </div>
        <div className="mt-3 rounded-2xl bg-slate-900 p-4 text-center">
          <LayoutGrid size={16} className="mx-auto text-brand-300 mb-1.5" />
          <p className="text-[13px] font-bold text-white leading-tight">Plan Today</p>
          <p className="text-[11px] text-slate-400">A Better Tomorrow</p>
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-300 flex items-center justify-center gap-1">
          <Banknote size={11} /> v1.0.0
        </p>
      </div>
    </aside>
  )
}
