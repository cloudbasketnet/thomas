import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { DEFAULT_THEME, applyTheme, readCachedTheme, resetTheme } from '@/lib/theme'
import { canOpen } from '@/lib/access'
import { Lock } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const RAIL_KEY = 'cb360.sidebar.collapsed'

/**
 * The sidebar is a labelled column on a desktop, an icon rail on a landscape
 * tablet — between 1024px and 1280px the labels would otherwise eat the width
 * the page needs for its two- and three-column card rows. Either way the
 * choice is the user's once they touch the toggle, and it sticks per device.
 */
function useRail() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1280px)').matches)
  const [pref, setPref] = useState<boolean | null>(() => {
    const saved = localStorage.getItem(RAIL_KEY)
    return saved === null ? null : saved === '1'
  })

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const collapsed = pref ?? !wide
  const toggle = () => {
    const next = !collapsed
    setPref(next)
    localStorage.setItem(RAIL_KEY, next ? '1' : '0')
  }
  return { collapsed, toggle }
}

export function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const theme = useStore((s) => s.settings.extra?.theme)
  const membership = useStore((s) => s.membership)
  const { collapsed, toggle } = useRail()

  // The saved theme (synced across devices) wins; until it loads, use the one cached on this device.
  useEffect(() => {
    applyTheme(theme ? { ...DEFAULT_THEME, ...theme } : readCachedTheme())
    if (theme?.mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme({ ...DEFAULT_THEME, ...theme })
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])
  // Leaving the app (sign-out) returns the page to the always-light public look.
  useEffect(() => () => resetTheme(), [])

  // A tap on a nav item closes the drawer; so does rotating into the docked layout.
  useEffect(() => {
    if (!open) return
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => mq.matches && setOpen(false)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [open])

  return (
    <div className="flex h-screen [height:100dvh] overflow-hidden pad-safe-x">
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="relative animate-pop max-w-[85vw] pad-safe-top">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setOpen(true)} />
        <main
          key={pathname}
          className="flex-1 overflow-y-auto scroll-thin p-4 lg:p-5 xl:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] animate-fade-up"
        >
          {canOpen(membership, pathname) ? (
            <Outlet />
          ) : (
            <div className="card max-w-md mx-auto mt-16 p-8 text-center">
              <Lock size={26} className="mx-auto text-slate-400" />
              <p className="text-[15px] font-bold text-slate-800 mt-3">You don't have access to this section</p>
              <p className="text-[12.5px] text-slate-500 mt-1">Ask the account owner to allow it under Settings → Family Users.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
