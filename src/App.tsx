import { ClipboardCheck, FileBarChart, Files, TableProperties } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useApp } from './contexts/AppContext'
import { loadAiCredentialStatus } from './lib/repository'
import { AiSetupRequiredPage } from './pages/AiSetupRequiredPage'
import { AuthPage } from './pages/AuthPage'
import { ClassesPage } from './pages/ClassesPage'
import { CurriculumPage } from './pages/CurriculumPage'
import { DashboardPage } from './pages/DashboardPage'
import { FeaturePlaceholderPage } from './pages/FeaturePlaceholderPage'
import { LessonPlansPage } from './pages/LessonPlansPage'
import { LessonPlanEditorPage } from './pages/LessonPlanEditorPage'
import { LessonPlanPrintPreviewPage } from './pages/LessonPlanPrintPreviewPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { SettingsPage } from './pages/SettingsPage'

function LoadingScreen({ label = 'Opening GuroDesk…' }: { label?: string }) {
  return <div className="loading-screen"><span className="loader" /><strong>{label}</strong></div>
}

function WorkspaceRoutes() {
  return (
    <Routes>
      <Route path="lesson-plans/:id/print" element={<LessonPlanPrintPreviewPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="curriculum" element={<CurriculumPage />} />
        <Route path="lesson-plans" element={<LessonPlansPage />} />
        <Route path="lesson-plans/new" element={<LessonPlanEditorPage />} />
        <Route path="lesson-plans/:id" element={<LessonPlanEditorPage />} />
        <Route path="assessments" element={<FeaturePlaceholderPage eyebrow="Assessment studio" title="Assessments" description="Build competency-aligned tests, answer keys, rubrics, and analysis-ready assessment records." phase="Phase 4" icon={ClipboardCheck} bullets={['Question bank schema', 'Competency mapping', 'Answer keys and solutions', 'TOS-linked generation']} />} />
        <Route path="tos" element={<FeaturePlaceholderPage eyebrow="Assessment planning" title="TOS Builder" description="Create a mathematically validated Table of Specifications from actual covered competencies and instructional time." phase="Phase 4" icon={TableProperties} bullets={['Validated totals', 'Cognitive-level distribution', 'Competency coverage', 'Direct test generation']} />} />
        <Route path="paperwork" element={<FeaturePlaceholderPage eyebrow="Teacher paperwork" title="Paperwork" description="Show only the forms and reports relevant to the teacher's role, assignment, and active DepEd policy version." phase="Phase 6" icon={FileBarChart} bullets={['Role-aware paperwork matrix', 'Reusable teacher data', 'Policy-version aware templates', 'Clear LIS boundaries']} />} />
        <Route path="files" element={<FeaturePlaceholderPage eyebrow="Documents" title="My Files" description="Saved lesson plans already support Word/PDF exports. This area will become the unified library for lessons, TOS files, test papers, reports, and export versions." phase="Phase 3.6+" icon={Files} bullets={['Saved documents', 'Versions', 'Search and filters', 'Exports']} />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function SignedInExperience() {
  const { profile, isDemo } = useApp()
  const [aiGate, setAiGate] = useState<'checking' | 'required' | 'ready'>(isDemo ? 'ready' : 'checking')

  useEffect(() => {
    let mounted = true
    if (isDemo) {
      setAiGate('ready')
      return () => { mounted = false }
    }
    setAiGate('checking')
    loadAiCredentialStatus(false)
      .then((status) => { if (mounted) setAiGate(status.configured ? 'ready' : 'required') })
      .catch(() => { if (mounted) setAiGate('required') })
    return () => { mounted = false }
  }, [isDemo])

  if (aiGate === 'checking') return <LoadingScreen label="Checking Gemini setup…" />
  if (aiGate === 'required') return <AiSetupRequiredPage onConfigured={() => setAiGate('ready')} />
  if (!profile || !profile.onboardingCompleted) return <OnboardingPage />
  return <WorkspaceRoutes />
}

export default function App() {
  const { user, profile, loading, authLoading } = useApp()

  if (authLoading || (user && loading && !profile)) return <LoadingScreen />
  if (!user) return <AuthPage />
  return <SignedInExperience />
}
