import { NavLink } from 'react-router-dom'
import {
  BarChart3, CalendarDays, CreditCard, FileText, Gauge, Home, Landmark,
  MinusCircle, PiggyBank, PlusCircle, Settings as SettingsIcon, ShoppingBag, ShoppingCart, StickyNote, Tags, Users, Wallet,
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

/**
 * Dusk mountain scene for the footer card. Drawn inline rather than loaded as
 * a photo so the sidebar needs no network request and no bundled asset.
 */
function MountainScene() {
  return (
    <svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="sb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="45%" stopColor="#3b6bb8" />
          <stop offset="100%" stopColor="#7ba6d9" />
        </linearGradient>
        <linearGradient id="sb-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4b6fa8" />
          <stop offset="100%" stopColor="#37527e" />
        </linearGradient>
        <linearGradient id="sb-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#24365a" />
          <stop offset="100%" stopColor="#16233d" />
        </linearGradient>
        <linearGradient id="sb-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1220" stopOpacity="0" />
          <stop offset="100%" stopColor="#0b1220" stopOpacity="0.88" />
        </linearGradient>
      </defs>

      <rect width="240" height="150" fill="url(#sb-sky)" />
      <circle cx="182" cy="34" r="13" fill="#fde68a" opacity="0.9" />
      <circle cx="182" cy="34" r="22" fill="#fde68a" opacity="0.16" />

      {/* far ridge */}
      <path d="M0 92 L34 62 L58 78 L88 48 L120 80 L150 58 L186 86 L214 68 L240 88 L240 150 L0 150 Z" fill="url(#sb-far)" />
      {/* near ridge */}
      <path d="M0 116 L30 92 L62 112 L96 82 L128 108 L166 88 L200 112 L240 96 L240 150 L0 150 Z" fill="url(#sb-near)" />
      {/* snow caps */}
      <path d="M96 82 L106 90 L100 91 L92 96 L86 92 Z" fill="#e8f0fb" opacity="0.85" />
      <path d="M166 88 L175 96 L169 97 L162 101 L157 97 Z" fill="#e8f0fb" opacity="0.7" />

      <rect y="60" width="240" height="90" fill="url(#sb-shade)" />
    </svg>
  )
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const documents = useStore((s) => s.documents)
  const notes = useStore((s) => s.notes)

  const badges: Record<string, number> = {
    docs: documents.filter((d) => docStatus(d.expiry) !== 'Valid').length,
    notes: notes.filter((n) => !n.done && n.status === 'Pending').length,
  }

  return (
    <aside className="h-full w-[228px] shrink-0 bg-white border-r border-[#e8edf5] flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-400 grid place-items-center text-white font-black text-[16px] shadow-lg shadow-brand-500/25">
            T
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-[16px] font-extrabold tracking-tight truncate">
              <span className="text-slate-900">Thomas</span>
              <span className="text-brand-600">.ai</span>
            </p>
            <p className="text-[9.5px] text-slate-400 font-medium truncate">Your Money. Smarter Life.</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-thin px-2.5 pb-2">
        {NAV.map(({ to, label, icon: Icon, ...rest }) => {
          const count = 'badge' in rest && rest.badge ? badges[rest.badge as string] : 0
          return (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest ? rest.end : false}
              onClick={onNavigate}
              title={label}
              className={({ isActive }) =>
                [
                  'group flex items-center gap-2.5 rounded-lg px-2.5 h-9 text-[12.5px] font-semibold transition-all',
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} className={isActive ? 'text-white shrink-0' : 'text-slate-400 group-hover:text-slate-600 shrink-0'} />
                  <span className="flex-1 truncate">{label}</span>
                  {count > 0 && (
                    <span
                      className={`h-4 min-w-4 px-1 grid place-items-center rounded-full text-[9.5px] font-bold shrink-0 ${
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

      <div className="p-2.5 pt-0">
        <div className="relative rounded-2xl overflow-hidden h-[124px] shadow-md">
          <MountainScene />
          <div className="absolute inset-x-0 bottom-0 px-3 pb-3 text-center">
            <p className="text-[12px] font-bold text-white leading-tight">Better Tracking</p>
            <p className="text-[10px] text-white/75 leading-tight mt-0.5">A Brighter Tomorrow</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[9.5px] text-slate-300">v1.0.0</p>
      </div>
    </aside>
  )
}
