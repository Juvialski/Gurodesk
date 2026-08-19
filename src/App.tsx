import { lazy, Suspense } from 'react'
import { FileBarChart, RefreshCw } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AdminGuard } from './components/admin/AdminGuard'
import { useApp } from './contexts/AppContext'
import { signedInEntryState } from './lib/workspaceEntry'

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const AssessmentEditorPage = lazy(() => import('./pages/AssessmentEditorPage').then((m) => ({ default: m.AssessmentEditorPage })))
const AssessmentNewPage = lazy(() => import('./pages/AssessmentNewPage').then((m) => ({ default: m.AssessmentNewPage })))
const AssessmentPrintPreviewPage = lazy(() => import('./pages/AssessmentPrintPreviewPage').then((m) => ({ default: m.AssessmentPrintPreviewPage })))
const AssessmentsPage = lazy(() => import('./pages/AssessmentsPage').then((m) => ({ default: m.AssessmentsPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const ClassesPage = lazy(() => import('./pages/ClassesPage').then((m) => ({ default: m.ClassesPage })))
const CurriculumPage = lazy(() => import('./pages/CurriculumPage').then((m) => ({ default: m.CurriculumPage })))
const CreateHubPage = lazy(() => import('./pages/CreateHubPage').then((m) => ({ default: m.CreateHubPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const FeaturePlaceholderPage = lazy(() => import('./pages/FeaturePlaceholderPage').then((m) => ({ default: m.FeaturePlaceholderPage })))
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })))
const LessonPlansPage = lazy(() => import('./pages/LessonPlansPage').then((m) => ({ default: m.LessonPlansPage })))
const LessonPlanEditorPage = lazy(() => import('./pages/LessonPlanEditorPage').then((m) => ({ default: m.LessonPlanEditorPage })))
const LessonPlanPrintPreviewPage = lazy(() => import('./pages/LessonPlanPrintPreviewPage').then((m) => ({ default: m.LessonPlanPrintPreviewPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const RemediationPage = lazy(() => import('./pages/RemediationPage').then((m) => ({ default: m.RemediationPage })))
const ResultAnalysisPage = lazy(() => import('./pages/ResultAnalysisPage').then((m) => ({ default: m.ResultAnalysisPage })))
const ResultSessionPage = lazy(() => import('./pages/ResultSessionPage').then((m) => ({ default: m.ResultSessionPage })))
const ResultsPage = lazy(() => import('./pages/ResultsPage').then((m) => ({ default: m.ResultsPage })))
const ResultsPrintPreviewPage = lazy(() => import('./pages/ResultsPrintPreviewPage').then((m) => ({ default: m.ResultsPrintPreviewPage })))
const RosterPage = lazy(() => import('./pages/RosterPage').then((m) => ({ default: m.RosterPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const TosEditorPage = lazy(() => import('./pages/TosEditorPage').then((m) => ({ default: m.TosEditorPage })))
const TosListPage = lazy(() => import('./pages/TosListPage').then((m) => ({ default: m.TosListPage })))
const TosPrintPreviewPage = lazy(() => import('./pages/TosPrintPreviewPage').then((m) => ({ default: m.TosPrintPreviewPage })))

function LoadingScreen({ label = 'Opening GuroDesk…' }: { label?: string }) {
  return <div className="loading-screen"><span className="loader" /><strong>{label}</strong></div>
}

function WorkspaceLoadFailure({ onRetry }: { onRetry: () => void | Promise<void> }) {
  return (
    <div className="loading-screen workspace-load-failure" role="alert">
      <section className="panel workspace-load-failure-card">
        <span className="eyebrow">Workspace unavailable</span>
        <h1>We couldn’t open your workspace</h1>
        <p>Check your connection and try again. Your account and saved work have not been changed.</p>
        <button className="button primary" type="button" onClick={() => void onRetry()}>
          <RefreshCw size={17} aria-hidden="true" /> Try again
        </button>
      </section>
    </div>
  )
}

function WorkspaceRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="lesson-plans/:id/print" element={<LessonPlanPrintPreviewPage />} />
        <Route path="tos/:id/print" element={<TosPrintPreviewPage />} />
        <Route path="assessments/:id/print" element={<AssessmentPrintPreviewPage />} />
        <Route path="results/:id/print" element={<ResultsPrintPreviewPage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="create" element={<CreateHubPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="curriculum" element={<CurriculumPage />} />
          <Route path="lesson-plans" element={<LessonPlansPage />} />
          <Route path="lesson-plans/new" element={<LessonPlanEditorPage />} />
          <Route path="lesson-plans/:id" element={<LessonPlanEditorPage />} />
          <Route path="assessments" element={<AssessmentsPage />} />
          <Route path="assessments/new" element={<AssessmentNewPage />} />
          <Route path="assessments/:id" element={<AssessmentEditorPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="results/roster" element={<RosterPage />} />
          <Route path="results/roster/:assignmentId/:sectionName" element={<RosterPage />} />
          <Route path="results/:id" element={<ResultSessionPage />} />
          <Route path="results/:id/analysis" element={<ResultAnalysisPage />} />
          <Route path="results/:id/remediation" element={<RemediationPage />} />
          <Route path="tos" element={<TosListPage />} />
          <Route path="tos/new" element={<TosEditorPage />} />
          <Route path="tos/:id" element={<TosEditorPage />} />
          <Route path="paperwork" element={<FeaturePlaceholderPage eyebrow="Teacher paperwork" title="Paperwork" description="Paperwork automation is not part of the current workspace yet. Use Documents and the supported export tools for lesson plans, TOS documents, assessments, results, and reports." icon={FileBarChart} bullets={['Role-aware paperwork matrix', 'Reusable teacher data', 'Policy-version aware templates', 'Clear LIS boundaries']} />} />
          <Route path="files" element={<DocumentsPage />} />
          <Route path="documents" element={<Navigate to="/files" replace />} />
          <Route path="templates" element={<Navigate to="/tos" replace />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="admin" element={<AdminGuard><AdminDashboardPage /></AdminGuard>} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

function SignedInExperience() {
  const { profile, error, refreshWorkspace } = useApp()
  const entryState = signedInEntryState(profile, error)
  if (entryState === 'workspace-error') return <WorkspaceLoadFailure onRetry={refreshWorkspace} />
  if (entryState === 'onboarding') return <Suspense fallback={<LoadingScreen />}><OnboardingPage /></Suspense>
  return <WorkspaceRoutes />
}

export default function App() {
  const { user, profile, loading, authLoading } = useApp()

  if (authLoading || (user && loading && !profile)) return <LoadingScreen />
  if (!user) return <Suspense fallback={<LoadingScreen />}><AuthPage /></Suspense>
  return <SignedInExperience />
}
