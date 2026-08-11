import { CircleHelp, FileBarChart, Files } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useApp } from './contexts/AppContext'
import { AssessmentEditorPage } from './pages/AssessmentEditorPage'
import { AssessmentNewPage } from './pages/AssessmentNewPage'
import { AssessmentPrintPreviewPage } from './pages/AssessmentPrintPreviewPage'
import { AssessmentsPage } from './pages/AssessmentsPage'
import { AuthPage } from './pages/AuthPage'
import { ClassesPage } from './pages/ClassesPage'
import { CurriculumPage } from './pages/CurriculumPage'
import { CreateHubPage } from './pages/CreateHubPage'
import { DashboardPage } from './pages/DashboardPage'
import { FeaturePlaceholderPage } from './pages/FeaturePlaceholderPage'
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
        <Route path="paperwork" element={<FeaturePlaceholderPage eyebrow="Teacher paperwork" title="Paperwork" description="Show only the forms and reports relevant to the teacher's role, assignment, and active DepEd policy version." phase="Phase 6" icon={FileBarChart} bullets={['Role-aware paperwork matrix', 'Reusable teacher data', 'Policy-version aware templates', 'Clear LIS boundaries']} />} />
        <Route path="files" element={<FeaturePlaceholderPage eyebrow="Documents" title="My Files" description="Saved lesson plans already support Word/PDF exports. This area will become the unified library for lessons, TOS files, test papers, reports, and export versions." phase="Phase 3.6+" icon={Files} bullets={['Saved documents', 'Versions', 'Search and filters', 'Exports']} />} />
        <Route path="documents" element={<Navigate to="/files" replace />} />
        <Route path="templates" element={<Navigate to="/tos" replace />} />
        <Route path="help" element={<FeaturePlaceholderPage eyebrow="Support" title="Help" description="Find plain-language guidance for the teacher workflows in GuroDesk." phase="the next release" icon={CircleHelp} bullets={['Workflow guidance', 'Accessibility help', 'Export support', 'Contact options']} />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function SignedInExperience() {
  const { profile } = useApp()
  if (!profile || !profile.onboardingCompleted) return <OnboardingPage />
  return <WorkspaceRoutes />
}

export default function App() {
  const { user, profile, loading, authLoading } = useApp()

  if (authLoading || (user && loading && !profile)) return <LoadingScreen />
  if (!user) return <AuthPage />
  return <SignedInExperience />
}
