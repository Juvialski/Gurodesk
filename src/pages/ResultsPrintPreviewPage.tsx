import { ArrowLeft, Download, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ResultsReportView } from '../components/ResultsReportView'
import { useApp } from '../contexts/AppContext'
import { analyzeResultSession } from '../lib/itemAnalysis'
import { buildRemediationSignals } from '../lib/remediation'
import { loadRemediationPlans } from '../lib/remediationRepository'
import { loadResultSession } from '../lib/resultsRepository'
import { loadTeacherExportPreferences } from '../lib/repository'
import { downloadResultsDocx, downloadResultsPdf, downloadResultsWorkbook, printResults } from '../lib/resultsExport'
import { buildResultsReportModel } from '../lib/resultsExportModel'
import { createDefaultTeacherExportPreferences, type TeacherExportPreferences } from '../types/export'
import type { ItemAnalysisResult } from '../types/itemAnalysis'
import type { AssessmentResultSession } from '../types/results'
import type { RemediationPlanDraft } from '../types/remediation'
import type { ResultsReportMode } from '../types/resultsReport'

export type ResultsPrintPreviewPageProps = {
  session?: AssessmentResultSession | null
  analysis?: ItemAnalysisResult | null
}

export function ResultsPrintPreviewPage({ session: suppliedSession = null, analysis: suppliedAnalysis = null }: ResultsPrintPreviewPageProps = {}) {
  const { id = '' } = useParams()
  const { user, profile, isDemo } = useApp()
  const [session, setSession] = useState<AssessmentResultSession | null>(suppliedSession)
  const [analysis, setAnalysis] = useState<ItemAnalysisResult | null>(suppliedAnalysis)
  const [remediationPlan, setRemediationPlan] = useState<(RemediationPlanDraft & { reviewState?: string; threshold?: number; thresholdBasis?: 'percentage_correct' | 'point_facility'; thresholdComparison?: 'below' | 'at_or_below' }) | null>(null)
  const [preferences, setPreferences] = useState<TeacherExportPreferences | null>(null)
  const [mode, setMode] = useState<ResultsReportMode>('summary')
  const [loading, setLoading] = useState(!suppliedSession)
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | 'xlsx' | ''>('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (suppliedSession) {
      setSession(suppliedSession)
      setAnalysis(suppliedAnalysis ?? analyzeResultSession(suppliedSession))
      setLoading(false)
      return
    }
    if (!user || !id) return
    let active = true
    setLoading(true)
    loadResultSession(id, user.id, isDemo).then((nextSession) => {
      if (!active) return
      if (!nextSession) throw new Error('Results session not found.')
      setSession(nextSession)
      setAnalysis(analyzeResultSession(nextSession))
    }).catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to prepare results preview.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, isDemo, suppliedAnalysis, suppliedSession, user?.id])

  useEffect(() => {
    if (!session || !user) return
    let active = true
    loadRemediationPlans(user.id, session.id, isDemo).then((plans) => {
      if (!active) return
      const next = (plans as Array<RemediationPlanDraft & { reviewState?: string; threshold?: number; thresholdBasis?: 'percentage_correct' | 'point_facility'; thresholdComparison?: 'below' | 'at_or_below' }>)
        .find((plan) => plan.reviewState !== 'archived') ?? null
      setRemediationPlan(next)
    }).catch(() => { if (active) setRemediationPlan(null) })
    return () => { active = false }
  }, [isDemo, session?.id, user?.id])

  useEffect(() => {
    if (!user) return
    let active = true
    loadTeacherExportPreferences(user.id, isDemo).then((next) => { if (active) setPreferences(next) }).catch(() => { if (active) setPreferences(createDefaultTeacherExportPreferences(user.id)) })
    return () => { active = false }
  }, [isDemo, user?.id])

  const model = useMemo(() => {
    if (!session || !analysis) return null
    const remediation = buildRemediationSignals(analysis, remediationPlan ? {
      threshold: {
        percentageThreshold: remediationPlan.threshold ?? 0.75,
        basis: remediationPlan.thresholdBasis ?? 'point_facility',
        comparison: remediationPlan.thresholdComparison ?? 'below',
      },
      scope: remediationPlan.scope,
      participantIds: remediationPlan.scope === 'selected_learners' ? remediationPlan.selectedParticipantIds : undefined,
    } : undefined)
    return buildResultsReportModel({ session, analysis }, {
      mode,
      documentLanguage: preferences?.documentLanguage ?? 'match',
      teacherName: profile?.fullName,
      schoolName: profile?.schoolName,
      sectionName: session.sectionName,
      remediation,
      remediationPlan,
    })
  }, [analysis, mode, preferences?.documentLanguage, profile?.fullName, profile?.schoolName, remediationPlan, session])

  async function download(kind: 'pdf' | 'docx' | 'xlsx') {
    if (!model || !preferences) return
    setDownloading(kind)
    setError('')
    try {
      if (kind === 'pdf') downloadResultsPdf(model, preferences.paperSize)
      else if (kind === 'docx') await downloadResultsDocx(model, preferences.paperSize)
      else {
        // The combined workbook is always a teacher-authorized model with the
        // learner score sheet populated, regardless of the on-screen tab.
        const workbookModel = session && analysis
          ? buildResultsReportModel({ session, analysis }, {
            mode: 'summary',
            documentLanguage: preferences.documentLanguage,
            teacherName: profile?.fullName,
            schoolName: profile?.schoolName,
            sectionName: session.sectionName,
            includeLearnerNames: true,
            remediation: model.remediation.length > 0 ? buildRemediationSignals(analysis, remediationPlan ? {
              threshold: { percentageThreshold: remediationPlan.threshold ?? 0.75, basis: remediationPlan.thresholdBasis ?? 'point_facility', comparison: remediationPlan.thresholdComparison ?? 'below' },
              scope: remediationPlan.scope,
              participantIds: remediationPlan.scope === 'selected_learners' ? remediationPlan.selectedParticipantIds : undefined,
            } : undefined) : undefined,
            remediationPlan,
          })
          : model
        downloadResultsWorkbook(workbookModel)
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to build this results export.')
    } finally {
      setDownloading('')
    }
  }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Preparing results preview…</strong></div>
  if (error || !session || !analysis || !model) return <div className="export-preview-error"><FileText size={28} /><h2>Preview unavailable</h2><p>{error || 'Unable to build this results report.'}</p><Link className="button ghost" to="/results">Back to results</Link></div>

  const modes: Array<{ id: ResultsReportMode; label: string }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'item_analysis', label: 'Item analysis' },
    { id: 'competency', label: 'Competency' },
    { id: 'remediation', label: 'Remediation' },
  ]
  return <div className="print-preview-page results-preview-page">
    <style>{`@media print { @page { size: ${preferences?.paperSize ?? 'a4'}; margin: 0; } }`}</style>
    <div className="print-preview-toolbar no-print"><Link className="button ghost" to={session ? `/results/${session.id}` : '/results'}><ArrowLeft size={16} /> Back to results</Link><div className="print-preview-title"><strong>Results preview</strong><small>{model.documentTitle} · {preferences?.paperSize.toUpperCase() ?? 'A4'}</small></div><div className="print-preview-actions"><button className="button ghost" type="button" onClick={() => printResults(model)}><Printer size={16} /> Print</button><button className="button secondary" type="button" disabled={Boolean(downloading)} onClick={() => void download('docx')}><FileText size={16} /> {downloading === 'docx' ? 'Building…' : 'Word'}</button><button className="button secondary" type="button" disabled={Boolean(downloading)} onClick={() => void download('pdf')}><Download size={16} /> {downloading === 'pdf' ? 'Building…' : 'PDF'}</button><button className="button primary" type="button" disabled={Boolean(downloading)} onClick={() => void download('xlsx')}><FileSpreadsheet size={16} /> {downloading === 'xlsx' ? 'Building…' : 'XLSX'}</button></div></div>
    <div className="results-preview-controls no-print"><div className="assessment-mode-tabs" role="tablist" aria-label="Results report mode">{modes.map((option) => <button key={option.id} role="tab" aria-selected={mode === option.id} className={mode === option.id ? 'selected' : ''} type="button" onClick={() => setMode(option.id)}>{option.label}</button>)}</div><p>Reports use deterministic values from the finalized assessment snapshot. Learner names appear only in the teacher-facing summary.</p></div>
    <div className="print-preview-stage results-print-stage"><ResultsReportView model={model} showLearnerNames={mode === 'summary'} /></div>
  </div>
}
