import { ArrowLeft, Check, Download, FileText, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AssessmentDocumentView } from '../components/AssessmentDocumentView'
import { useApp } from '../contexts/AppContext'
import { downloadAssessmentDocx, downloadAssessmentPdf } from '../lib/assessmentExport'
import { buildAssessmentExportModel } from '../lib/assessmentExportModel'
import { loadAssessmentDocument } from '../lib/assessmentRepository'
import { loadTeacherExportPreferences } from '../lib/repository'
import type { AssessmentExportMode, AssessmentExportModel, AssessmentExportOptions } from '../types/assessmentExport'
import type { AssessmentRecord } from '../types/assessment'
import type { TeacherExportPreferences } from '../types/export'

export function AssessmentPrintPreviewPage() {
  const { id = '' } = useParams()
  const { user, profile, isDemo } = useApp()
  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null)
  const [preferences, setPreferences] = useState<TeacherExportPreferences | null>(null)
  const [mode, setMode] = useState<AssessmentExportMode>('student')
  const [showCompetency, setShowCompetency] = useState(true)
  const [showCognitive, setShowCognitive] = useState(true)
  const [showRationale, setShowRationale] = useState(false)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | ''>('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !id) return
    let active = true
    setLoading(true)
    Promise.all([loadAssessmentDocument(id, user.id, isDemo), loadTeacherExportPreferences(user.id, isDemo)])
      .then(([nextAssessment, nextPreferences]) => {
        if (!active) return
        if (!nextAssessment) throw new Error('Assessment not found.')
        setAssessment(nextAssessment)
        setPreferences(nextPreferences)
      })
      .catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to prepare assessment preview.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, user?.id, isDemo])

  const options = useMemo<AssessmentExportOptions | null>(() => {
    if (!preferences || !profile) return null
    return {
      mode,
      paperSize: preferences.paperSize,
      documentLanguage: preferences.documentLanguage,
      teacherName: profile.fullName,
      positionTitle: profile.positionTitle,
      schoolName: profile.schoolName,
      region: profile.region,
      division: profile.division,
      includeAnswer: mode !== 'student',
      includeCompetency: mode === 'teacher' && showCompetency,
      includeCognitiveCategory: mode === 'teacher' && showCognitive,
      includeRationale: mode !== 'student' && showRationale,
    }
  }, [mode, preferences, profile, showCompetency, showCognitive, showRationale])

  const model = useMemo<AssessmentExportModel | null>(() => assessment && options ? buildAssessmentExportModel(assessment, options) : null, [assessment, options])

  async function download(kind: 'pdf' | 'docx') {
    if (!model || !preferences) return
    setDownloading(kind)
    setError('')
    try {
      if (kind === 'pdf') downloadAssessmentPdf(model, preferences.paperSize)
      else await downloadAssessmentDocx(model, preferences.paperSize)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to build this export.')
    } finally {
      setDownloading('')
    }
  }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Preparing assessment preview…</strong></div>
  if (error || !assessment || !model || !preferences) return <div className="export-preview-error"><FileText size={28} /><h2>Preview unavailable</h2><p>{error || 'Unable to build document preview.'}</p><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Back to assessments</Link></div>

  return <div className={`print-preview-page assessment-preview-page assessment-preview-${mode}`}>
    <style>{`@media print { @page { size: ${preferences?.paperSize ?? 'a4'}; margin: 0; } }`}</style>
    <div className="print-preview-toolbar no-print"><Link className="button ghost" to={`/assessments/${assessment.id}`}><ArrowLeft size={16} /> Back to editor</Link><div className="print-preview-title"><strong>Assessment preview</strong><small>{mode === 'student' ? 'Student copy' : mode === 'teacher' ? 'Teacher copy' : 'Answer key'} · {preferences.paperSize.toUpperCase()}</small></div><div className="assessment-preview-actions"><button className="button ghost" type="button" onClick={() => window.print()}><Printer size={16} /> Print</button><button className="button secondary" type="button" disabled={Boolean(downloading)} onClick={() => void download('docx')}><Download size={16} /> {downloading === 'docx' ? 'Building…' : 'Word'}</button><button className="button primary" type="button" disabled={Boolean(downloading)} onClick={() => void download('pdf')}><Download size={16} /> {downloading === 'pdf' ? 'Building…' : 'PDF'}</button></div></div>
    <div className="assessment-preview-controls no-print"><div className="assessment-mode-tabs" role="tablist" aria-label="Preview mode">{(['student', 'teacher', 'answer_key'] as AssessmentExportMode[]).map((option) => <button key={option} role="tab" aria-selected={mode === option} className={mode === option ? 'selected' : ''} type="button" onClick={() => setMode(option)}>{option === 'student' ? 'Student' : option === 'teacher' ? 'Teacher' : 'Answer key'}</button>)}</div>{mode === 'teacher' && <div className="assessment-preview-toggles"><label><input type="checkbox" checked={showCompetency} onChange={(event) => setShowCompetency(event.target.checked)} /> Competency</label><label><input type="checkbox" checked={showCognitive} onChange={(event) => setShowCognitive(event.target.checked)} /> Cognitive category</label><label><input type="checkbox" checked={showRationale} onChange={(event) => setShowRationale(event.target.checked)} /> Rationale</label></div>}<p>{mode === 'student' ? 'Student preview hides answers, mappings, AI metadata, IDs, and GuroDesk branding.' : mode === 'teacher' ? 'Teacher preview includes answer and review context according to the toggles.' : 'Answer key is derived from the saved structured answers.'}</p></div>
    <div className="print-preview-stage assessment-print-stage"><AssessmentDocumentView model={model} showCompetency={showCompetency} showCognitive={showCognitive} showRationale={showRationale} /></div>
  </div>
}
