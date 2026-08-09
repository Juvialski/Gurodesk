import {
  BookMarked,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  FileBarChart,
  FileText,
  Files,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Settings,
  TableProperties,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Brand } from './Brand'
import { StatusBadge } from './StatusBadge'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/classes', label: 'My Classes', icon: School },
  { to: '/curriculum', label: 'Curriculum', icon: BookMarked },
  { to: '/lesson-plans', label: 'Lesson Plans', icon: CalendarDays },
  { to: '/assessments', label: 'Assessments', icon: ClipboardCheck },
  { to: '/results', label: 'Results', icon: ChartNoAxesColumnIncreasing },
  { to: '/tos', label: 'TOS Builder', icon: TableProperties },
  { to: '/paperwork', label: 'Paperwork', icon: FileBarChart },
  { to: '/files', label: 'My Files', icon: Files },
]

export function AppShell() {
  const { profile, signOut } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Brand />
          <button className="icon-button sidebar-close" onClick={closeMenu} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={closeMenu}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/settings" onClick={closeMenu} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={19} /><span>Settings</span>
          </NavLink>
          <button className="nav-item nav-button" onClick={() => void signOut()}>
            <LogOut size={19} /><span>Sign out</span>
          </button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-backdrop" onClick={closeMenu} aria-label="Close navigation" />}

      <div className="app-main">
        <div className="mobile-topbar">
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>
          <Brand compact />
          <span className="mobile-avatar">{profile?.fullName?.slice(0, 1).toUpperCase() || 'T'}</span>
        </div>
        <div className="desktop-topbar">
          <div className="breadcrumbs">
            <FileText size={15} />
            <span>{location.pathname === '/' ? 'Workspace' : location.pathname.slice(1).replaceAll('-', ' ')}</span>
          </div>
          <div className="topbar-right">
            <StatusBadge />
            <span className="school-year">SY {profile?.schoolYear ?? '2026-2027'}</span>
            <div className="teacher-chip">
              <span className="avatar"><GraduationCap size={17} /></span>
              <div><strong>{profile?.fullName || 'Teacher'}</strong><small>{profile?.schoolName || 'School not set'}</small></div>
            </div>
          </div>
        </div>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}
