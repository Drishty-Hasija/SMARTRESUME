import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronRight, History, Info, LayoutDashboard, Settings, Target, FileSearch } from 'lucide-react'
import Logo from '../components/Logo'
import { UserContext } from '../hooks/UserContext'
import { api } from '../services/api'
import { cx, initials } from '../utils/format'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/analysis', label: 'Resume Analysis', short: 'Resume', icon: FileSearch, also: ['/app/upload'] },
  { to: '/app/match', label: 'Job Matching', short: 'Job Match', icon: Target },
  { to: '/app/history', label: 'History', icon: History },
]
const BOTTOM = [
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/', label: 'Help / About', icon: Info },
]

function isActive(item, pathname) {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(item.to + '/') || (item.also || []).some((p) => pathname.startsWith(p))
}

const itemCls = (active) => cx(
  'flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors duration-150 ease-out md:justify-center lg:justify-start',
  active ? 'bg-accent-soft text-ink' : 'text-ink-soft hover:bg-surface-soft hover:text-ink',
)

function Sidebar() {
  const { pathname } = useLocation()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r border-line bg-surface md:flex lg:w-[232px]">
      <div className="flex h-16 items-center border-b border-line px-5 md:justify-center lg:justify-start">
        <Logo to="/app" className="hidden lg:inline-flex" />
        <Logo to="/app" compact className="lg:hidden" />
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = isActive(item, pathname)
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={itemCls(active)} aria-current={active ? 'page' : undefined} title={item.label}>
              <item.icon size={18} className={active ? 'text-accent' : ''} aria-hidden />
              <span className="md:sr-only lg:not-sr-only">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className="space-y-1 border-t border-line p-3">
        {BOTTOM.map((item) => {
          const active = pathname.startsWith(item.to) && item.to !== '/'
          return (
            <Link key={item.label} to={item.to} className={itemCls(active)} aria-current={active ? 'page' : undefined} title={item.label}>
              <item.icon size={18} className={active ? 'text-accent' : ''} aria-hidden />
              <span className="md:sr-only lg:not-sr-only">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}

function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV.map((item) => {
        const active = isActive(item, pathname)
        return (
          <NavLink key={item.to} to={item.to} end={item.end} aria-current={active ? 'page' : undefined}
            className={cx('flex min-h-[56px] flex-col items-center justify-center gap-1 text-[12px] font-medium transition-colors', active ? 'text-accent' : 'text-ink-muted')}>
            <item.icon size={20} aria-hidden />
            {item.short || item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}

const CRUMBS = [
  [/^\/app$/, ['Dashboard']],
  [/^\/app\/upload/, ['Resume Analysis', 'Upload']],
  [/^\/app\/analysis/, ['Resume Analysis']],
  [/^\/app\/match/, ['Job Matching']],
  [/^\/app\/history\/\d+/, ['History', 'Analysis details']],
  [/^\/app\/history/, ['History']],
  [/^\/app\/settings/, ['Settings']],
]

function Topbar({ user }) {
  const { pathname } = useLocation()
  const trail = (CRUMBS.find(([re]) => re.test(pathname)) || [null, ['SmartResume']])[1]
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-canvas/95 px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Logo to="/app" compact className="md:hidden" />
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 text-[14px]">
            {trail.map((t, i) => (
              <li key={t} className="flex items-center gap-1.5 truncate">
                {i > 0 && <ChevronRight size={14} className="text-ink-muted" aria-hidden />}
                <span className={i === trail.length - 1 ? 'font-medium text-ink' : 'text-ink-muted'} aria-current={i === trail.length - 1 ? 'page' : undefined}>{t}</span>
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <Link to="/app/settings" className="flex items-center gap-2.5 rounded-lg py-1 pl-2 pr-1 hover:bg-surface-soft" aria-label="Profile and settings">
        <span className="hidden text-right text-[13px] leading-tight sm:block">
          <span className="block font-medium">{user?.name || 'Student'}</span>
          <span className="block text-ink-muted">{user?.email || ''}</span>
        </span>
        <span className="mono flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-surface text-ink" aria-hidden>{initials(user?.name)}</span>
      </Link>
    </header>
  )
}

export default function AppLayout() {
  const [user, setUser] = useState(null)
  const { pathname } = useLocation()
  useEffect(() => { api.getUser().then(setUser).catch(() => {}) }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:shadow-menu">Skip to content</a>
      <Sidebar />
      <div className="md:pl-[72px] lg:pl-[232px]">
        <Topbar user={user} />
        <main id="main" className="mx-auto w-full max-w-app px-4 pb-28 pt-8 md:px-8 md:pb-16 md:pt-10">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </UserContext.Provider>
  )
}
