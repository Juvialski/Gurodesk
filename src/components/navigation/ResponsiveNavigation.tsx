import {
  BookMarked,
  BookOpenCheck,
  ChartNoAxesColumnIncreasing,
  CircleHelp,
  ClipboardCheck,
  Files,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Settings,
  TableProperties,
  UsersRound,
  X,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { Profile } from '../../types/app'
import { Brand } from '../Brand'
import { useApp } from '../../contexts/AppContext'
import { isAdminUser } from '../../lib/adminAuth'

type Icon = LucideIcon
type NavigationEntry = { to: string; label: string; icon: Icon; end?: boolean }

const primaryNavigation: NavigationEntry[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/create', label: 'Create', icon: Plus },
  { to: '/lesson-plans', label: 'Lesson Plans', icon: BookOpenCheck },
  { to: '/assessments', label: 'Assessments', icon: ClipboardCheck },
  { to: '/classes', label: 'Classes', icon: UsersRound },
  { to: '/results', label: 'Results', icon: ChartNoAxesColumnIncreasing },
  { to: '/files', label: 'Documents', icon: Files },
]

const secondaryNavigation: NavigationEntry[] = [
  { to: '/curriculum', label: 'Curriculum', icon: BookMarked },
  { to: '/tos', label: 'Templates & TOS', icon: TableProperties },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help', label: 'Help', icon: CircleHelp },
]

const moreNavigation: NavigationEntry[] = [
  { to: '/lesson-plans', label: 'Lesson Plans', icon: BookOpenCheck },
  { to: '/assessments', label: 'Assessments', icon: ClipboardCheck },
  { to: '/files', label: 'Documents', icon: Files },
  { to: '/curriculum', label: 'Curriculum', icon: BookMarked },
  { to: '/tos', label: 'Templates & TOS', icon: TableProperties },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help', label: 'Help', icon: CircleHelp },
]

export type ResponsiveNavigationProps = {
  profile: Profile | null
  onSignOut: () => void | Promise<void>
  onReplayTour: () => void
}

function NavigationLink({ entry, onNavigate, className = '' }: { entry: NavigationEntry; onNavigate?: () => void; className?: string }) {
  const Icon = entry.icon
  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      onClick={onNavigate}
      className={({ isActive }) => `${className || 'nav-item'} ${isActive ? 'active' : ''}`.trim()}
    >
      <Icon size={19} aria-hidden="true" />
      <span>{entry.label}</span>
    </NavLink>
  )
}

export function ResponsiveNavigation({ profile, onSignOut, onReplayTour }: ResponsiveNavigationProps) {
  const { user, isDemo } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreMenuRef = useRef<HTMLElement>(null)

  const isAdmin = isAdminUser(user, profile, isDemo)
  const currentSecondaryNavigation = isAdmin
    ? [...secondaryNavigation, { to: '/admin', label: 'Admin Dashboard', icon: ShieldCheck }]
    : secondaryNavigation
  const currentMoreNavigation = isAdmin
    ? [...moreNavigation, { to: '/admin', label: 'Admin Dashboard', icon: ShieldCheck }]
    : moreNavigation

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!moreOpen) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const menu = moreMenuRef.current
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const frame = window.requestAnimationFrame(() => {
      menu?.querySelector<HTMLElement>('[data-dialog-autofocus]')?.focus()
    })

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMoreOpen(false)
        return
      }
      if (event.key !== 'Tab' || !menu) return
      const focusable = Array.from(menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !menu.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDialogKeys)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleDialogKeys)
      document.body.style.overflow = originalOverflow
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus()
    }
  }, [moreOpen])

  function goToAdvancedDiagnostics() {
    setMoreOpen(false)
    navigate('/settings#advanced')
  }

  function handleSignOut() {
    setMoreOpen(false)
    void onSignOut()
  }

  function handleReplayTour() {
    setMoreOpen(false)
    onReplayTour()
  }

  const moreActive = moreOpen || !primaryNavigation.some((entry) => {
    if (entry.to === '/') return location.pathname === '/'
    return location.pathname === entry.to || location.pathname.startsWith(`${entry.to}/`)
  })

  return (
    <>
      <aside className="sidebar" aria-label="Desktop navigation">
        <div className="sidebar-top">
          <Brand />
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {primaryNavigation.map((entry) => <NavigationLink key={entry.to} entry={entry} className={entry.to === '/create' ? 'nav-item nav-item-create' : 'nav-item'} />)}
        </nav>
        <div className="sidebar-secondary">
          <span className="nav-group-label">Workspace</span>
          {currentSecondaryNavigation.map((entry) => <NavigationLink key={entry.to} entry={entry} className="nav-item" />)}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <span className="sidebar-account-avatar">{profile?.fullName?.slice(0, 1).toUpperCase() || 'T'}</span>
            <span><strong>{profile?.fullName || 'Teacher'}</strong><small>{profile?.schoolName || 'School not set'}</small></span>
          </div>
          <button className="nav-item nav-button" type="button" onClick={handleSignOut}>
            <LogOut size={19} aria-hidden="true" /><span>Sign out</span>
          </button>
          <button className="nav-item nav-button" type="button" onClick={handleReplayTour}>
            <CircleHelp size={19} aria-hidden="true" /><span>Replay Tour</span>
          </button>
        </div>
      </aside>

      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        <NavigationLink entry={primaryNavigation.find((entry) => entry.to === '/')!} className="mobile-bottom-nav-item" />
        <NavigationLink entry={primaryNavigation.find((entry) => entry.to === '/create')!} className="mobile-bottom-nav-item mobile-bottom-nav-create" />
        <NavigationLink entry={primaryNavigation.find((entry) => entry.to === '/classes')!} className="mobile-bottom-nav-item" />
        <NavigationLink entry={primaryNavigation.find((entry) => entry.to === '/results')!} className="mobile-bottom-nav-item" />
        <button className={`mobile-bottom-nav-item ${moreActive ? 'active' : ''}`} type="button" aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen((current) => !current)}>
          <MoreHorizontal size={20} aria-hidden="true" /><span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="mobile-more-backdrop" aria-hidden="true" onClick={() => setMoreOpen(false)} />
          <section id="mobile-more-menu" className="mobile-more-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" ref={moreMenuRef}>
            <div className="mobile-more-heading"><div><span className="eyebrow">Workspace</span><h2 id="mobile-more-title">More</h2></div><button className="icon-button" type="button" onClick={() => setMoreOpen(false)} aria-label="Close more menu" data-dialog-autofocus><X size={19} /></button></div>
            <div className="mobile-more-links">
              {currentMoreNavigation.map((entry) => <NavigationLink key={entry.to} entry={entry} onNavigate={() => setMoreOpen(false)} className="mobile-more-link" />)}
              <button className="mobile-more-link" type="button" onClick={goToAdvancedDiagnostics}><Settings size={19} aria-hidden="true" /><span>Advanced diagnostics</span></button>
              <button className="mobile-more-link" type="button" onClick={handleReplayTour}><CircleHelp size={19} aria-hidden="true" /><span>Replay Tour</span></button>
            </div>
            <div className="mobile-more-account">
              <div><span className="sidebar-account-avatar">{profile?.fullName?.slice(0, 1).toUpperCase() || 'T'}</span><span><strong>{profile?.fullName || 'Teacher'}</strong><small>{profile?.email || 'Account'}</small></span></div>
              <button className="button ghost" type="button" onClick={handleSignOut}><LogOut size={16} /> Sign out</button>
            </div>
          </section>
        </>
      )}
    </>
  )
}
