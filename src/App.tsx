import { FileBarChart, RefreshCw } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useApp } from './contexts/AppContext'
import { signedInEntryState } from './lib/workspaceEntry'
import { AssessmentEditorPage } from './pages/AssessmentEditorPage'
import { AssessmentNewPage } from './pages/AssessmentNewPage'
import { AssessmentPrintPreviewPage } from './pages/AssessmentPrintPreviewPage'
import { AssessmentsPage } from './pages/AssessmentsPage'
import { AuthPage } from './pages/AuthPage'
import { ClassesPage } from './pages/ClassesPage'
import { CurriculumPage } from './pages/CurriculumPage'
import { CreateHubPage } from './pages/CreateHubPage'
import { DashboardPage } from './pages/DashboardPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { FeaturePlaceholderPage } from './pages/FeaturePlaceholderPage'
import { HelpPage } from './pages/HelpPage'
import { LessonPlansPage } from './pages/LessonPlansPage'
import { LessonPlanEditorPage } from './pages/LessonPlanEditorPage'
import { LessonPlanPrintPreviewPage } from './pages/LessonPlanPrintPreviewPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { RemediationPage } from './pages/RemediationPage'
import { ResultAnalysisPage } from './pages/ResultAnalysisPage'
import { ResultSessionPage } from './pages/ResultSessionPage'
import { ResultsPage } from './pages/ResultsPage'
import { ResultsPrintPreviewPage } from './pages/ResultsPrintPreviewPage'
import { RosterPage } from './pages/RosterPage'
import { SettingsPage } from './pages/SettingsPage'
import { TosEditorPage } from './pages/TosEditorPage'
import { TosListPage } from './pages/TosListPage'
import { TosPrintPreviewPage } from './pages/TosPrintPreviewPage'

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
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function SignedInExperience() {
  const { profile, error, refreshWorkspace } = useApp()
  const entryState = signedInEntryState(profile, error)
  if (entryState === 'workspace-error') return <WorkspaceLoadFailure onRetry={refreshWorkspace} />
  if (entryState === 'onboarding') return <OnboardingPage />
  return <WorkspaceRoutes />
}

export default function App() {
  const { user, profile, loading, authLoading } = useApp()

  if (authLoading || (user && loading && !profile)) return <LoadingScreen />
  if (!user) return <AuthPage />
  return <SignedInExperience />
}
