import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="relative animate-pop">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setOpen(true)} />
        <main key={pathname} className="flex-1 overflow-y-auto scroll-thin p-4 lg:p-6 animate-fade-up">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
