import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearAuth } from '@/lib/auth'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', icon: 'ri-dashboard-line', label: 'Dashboard' },
  { to: '/groups', icon: 'ri-group-line', label: 'Groups' },
  { to: '/oas', icon: 'ri-file-code-line', label: 'OAS Entries' },
  { to: '/tokens', icon: 'ri-key-line', label: 'Tokens' },
]

export default function Layout() {
  const navigate = useNavigate()

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 px-4">
          <i className="ri-hexagon-line text-xl text-violet-400" />
          <span className="font-semibold text-sm tracking-tight">OAS Gateway</span>
          <span className="ml-auto text-xs text-sidebar-foreground/40">Admin</span>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2 flex-1">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )
              }
            >
              <i className={cn(icon, 'text-base')} />
              {label}
            </NavLink>
          ))}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* Logout */}
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            onClick={handleLogout}
          >
            <i className="ri-logout-box-line text-base" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
