import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LessonPlanDocumentView } from '../components/LessonPlanDocumentView'
import { useApp } from '../contexts/AppContext'
import { buildLessonPlanExportModel, downloadLessonPlanDocx, downloadLessonPlanPdf } from '../lib/lessonPlanExport'
import { loadLessonPlan, loadTeacherExportPreferences, loadTeacherLessonPreferences } from '../lib/repository'
import type { LessonPlanRecord } from '../types/lessonPlan'
import type { TeacherExportPreferences } from '../types/export'
import type { TeacherLessonPreferences } from '../types/teachingSetup'

export function LessonPlanPrintPreviewPage() {
  const { id = '' } = useParams()
  const { user, profile, isDemo } = useApp()
  const [plan, setPlan] = useState<LessonPlanRecord | null>(null)
  const [preferences, setPreferences] = useState<TeacherExportPreferences | null>(null)
  const [lessonPreferences, setLessonPreferences] = useState<TeacherLessonPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | ''>('')

  useEffect(() => {
    if (!user || !profile || !id) return
    let mounted = true
    setLoading(true)
    Promise.all([
      loadLessonPlan(id, user.id, isDemo),
      loadTeacherExportPreferences(user.id, isDemo),
      loadTeacherLessonPreferences(user.id, isDemo),
    ]).then(([nextPlan, nextPreferences, nextLessonPreferences]) => {
      if (!mounted) return
      if (!nextPlan) throw new Error('Lesson plan not found.')
      setPlan(nextPlan)
      setPreferences(nextPreferences)
      setLessonPreferences(nextLessonPreferences)
    }).catch((err) => {
      if (mounted) setError(err instanceof Error ? err.message : 'Unable to load printable lesson plan.')
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id, user?.id, profile?.id, isDemo])

  const model = useMemo(() => plan && profile && preferences
    ? buildLessonPlanExportModel(plan, profile, preferences, lessonPreferences)
    : null, [plan, profile, preferences, lessonPreferences])

  async function download(kind: 'pdf' | 'docx') {
    if (!model || !preferences) return
    setDownloading(kind)
    try {
      if (kind === 'pdf') downloadLessonPlanPdf(model, preferences)
      else await downloadLessonPlanDocx(model, preferences)
    } finally {
      setDownloading('')
    }
  }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Preparing printable lesson…</strong></div>
  if (error || !model || !plan) return <div className="export-preview-error"><FileText size={28} /><h2>Preview unavailable</h2><p>{error || 'Unable to build document preview.'}</p><Link className="button ghost" to="/lesson-plans">Back to lesson plans</Link></div>

  const printPaper = preferences?.paperSize === 'letter' ? 'letter' : preferences?.paperSize === 'legal' ? 'legal' : 'A4'

  return (
    <div className={`print-preview-page paper-${preferences?.paperSize ?? 'a4'}`}>
      <style>{`@media print { @page { size: ${printPaper}; margin: 0; } }`}</style>
      <div className="print-preview-toolbar no-print">
        <Link className="button ghost" to={`/lesson-plans/${plan.id}`}><ArrowLeft size={16} /> Back to editor</Link>
        <div className="print-preview-title"><strong>Document preview</strong><small>{model.templateLabel} · {model.language === 'filipino' ? 'Filipino labels' : 'English labels'} · {preferences?.paperSize.toUpperCase()}</small></div>
        <div className="print-preview-actions">
          <button className="button ghost" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <button className="button secondary" disabled={Boolean(downloading)} onClick={() => void download('docx')}><Download size={16} /> {downloading === 'docx' ? 'Building…' : 'Word'}</button>
          <button className="button primary" disabled={Boolean(downloading)} onClick={() => void download('pdf')}><Download size={16} /> {downloading === 'pdf' ? 'Building…' : 'PDF'}</button>
        </div>
      </div>
      <div className="print-preview-stage"><LessonPlanDocumentView model={model} /></div>
    </div>
  )
}
