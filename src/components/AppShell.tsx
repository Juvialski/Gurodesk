import { CheckCircle2, FileText, GraduationCap, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { useApp } from '../contexts/AppContext'
import { shouldAutoOpenTeacherTour } from '../lib/teacherTour'
import { Brand } from './Brand'
import { ErrorBoundary } from './ErrorBoundary'
import { TeacherTour } from './TeacherTour'
import { AiUsageStatus } from './AiUsageStatus'
import { ResponsiveNavigation } from './navigation/ResponsiveNavigation'
import { WorkspaceContextBar } from './workspace/WorkspaceContextBar'

function breadcrumbLabel(pathname: string) {
  if (pathname === '/') return 'Home'
  const labels: Record<string, string> = {
    classes: 'Classes',
    curriculum: 'Curriculum',
    create: 'Create',
    'lesson-plans': 'Lesson plans',
    assessments: 'Assessments',
    results: 'Results',
    tos: 'Templates & TOS',
    files: 'Documents',
    documents: 'Documents',
    admin: 'Admin Dashboard',
    settings: 'Settings',
    help: 'Help',
  }
  const segment = pathname.split('/').filter(Boolean)[0] ?? ''
  return labels[segment] ?? segment.replaceAll('-', ' ')
}

export function AppShell() {
  const { profile, assignments, signOut, user, isDemo } = useApp()
  const location = useLocation()
  const workspace = useWorkspaceSelection(user?.id)
  const { isOnline, wasOffline } = useOnlineStatus()
  const [tourOpen, setTourOpen] = useState(false)

  useEffect(() => {
    setTourOpen(shouldAutoOpenTeacherTour(user?.id))
  }, [user?.id])

  const replayTour = useCallback(() => setTourOpen(true), [])
  const closeTour = useCallback(() => setTourOpen(false), [])

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-to-content">Skip to main content</a>
      <ResponsiveNavigation profile={profile} onSignOut={signOut} onReplayTour={replayTour} />

      <div className="app-main">
        {!isOnline && (
          <div className="connectivity-banner offline" role="status">
            <WifiOff size={15} aria-hidden="true" />
            <span>Offline — keep this page open. Online saving is unavailable.</span>
          </div>
        )}
        {isOnline && wasOffline && (
          <div className="connectivity-banner online" role="status">
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>Back online — review and save any pending changes.</span>
          </div>
        )}
        <div className="mobile-topbar">
          <Brand compact />
          <span className="mobile-avatar" aria-label={`${profile?.fullName || 'Teacher'} account`}>{profile?.fullName?.slice(0, 1).toUpperCase() || 'T'}</span>
        </div>
        <div className="desktop-topbar">
          <div className="breadcrumbs" aria-label="Current location">
            <FileText size={15} aria-hidden="true" />
            <span>{breadcrumbLabel(location.pathname)}</span>
          </div>
          <div className="topbar-right">
            <span className="school-year">SY {profile?.schoolYear ?? '2026-2027'}</span>
            <div className="teacher-chip">
              <span className="avatar"><GraduationCap size={17} aria-hidden="true" /></span>
              <div><strong>{profile?.fullName || 'Teacher'}</strong><small>{profile?.schoolName || 'School not set'}</small></div>
            </div>
          </div>
        </div>
        <div className="workspace-context-main">
          <WorkspaceContextBar
            assignments={assignments}
            selection={workspace.selection}
            onChange={workspace.setSelection}
          />
        </div>
        <AiUsageStatus isDemo={isDemo} userId={user?.id ?? null} />
        <main className="content" id="main-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <TeacherTour userId={user?.id ?? null} open={tourOpen} onClose={closeTour} />
    </div>
  )
}
