import { ArrowLeft, Check, ChevronDown, Download, FileText, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CustomDocxPreview } from '../components/CustomDocxPreview'
import { LessonPlanDocumentView } from '../components/LessonPlanDocumentView'
import { useApp } from '../contexts/AppContext'
import { customDocxPreviewToPdf } from '../lib/customTemplateRender'
import { buildLessonPlanExportModel, downloadLessonPlanDocx, downloadLessonPlanPdf, lessonPlanExportFilename } from '../lib/lessonPlanExport'
import { buildLessonTemplateValues, downloadBlob, fillDocxTemplate } from '../lib/docxTemplate'
import { loadLessonPlan, loadTeacherExportPreferences, loadTeacherLessonPreferences } from '../lib/repository'
import { downloadDocumentTemplateFile, listDocumentTemplates } from '../lib/templateRepository'
import type { DocumentTemplate } from '../types/documentTemplate'
import type { LessonPlanRecord } from '../types/lessonPlan'
import type { TeacherExportPreferences } from '../types/export'
import type { TeacherLessonPreferences } from '../types/teachingSetup'

const BUILTIN_ID = 'gurodesk_ilaw_standard'

export function LessonPlanPrintPreviewPage() {
  const { id = '' } = useParams()
  const { user, profile, isDemo } = useApp()
  const [plan, setPlan] = useState<LessonPlanRecord | null>(null)
  const [preferences, setPreferences] = useState<TeacherExportPreferences | null>(null)
  const [lessonPreferences, setLessonPreferences] = useState<TeacherLessonPreferences | null>(null)
  const [customTemplates, setCustomTemplates] = useState<DocumentTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(BUILTIN_ID)
  const [customBlob, setCustomBlob] = useState<Blob | null>(null)
  const [customPreviewElement, setCustomPreviewElement] = useState<HTMLElement | null>(null)
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [error, setError] = useState('')
  const [templateError, setTemplateError] = useState('')
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | ''>('')

  useEffect(() => {
    if (!user || !profile || !id) return
    let mounted = true
    setLoading(true)
    Promise.all([
      loadLessonPlan(id, user.id, isDemo),
      loadTeacherExportPreferences(user.id, isDemo),
      loadTeacherLessonPreferences(user.id, isDemo),
      isDemo ? Promise.resolve([]) : listDocumentTemplates(user.id, 'lesson_plan'),
    ]).then(([nextPlan, nextPreferences, nextLessonPreferences, templates]) => {
      if (!mounted) return
      if (!nextPlan) throw new Error('Lesson plan not found.')
      setPlan(nextPlan)
      setPreferences(nextPreferences)
      setLessonPreferences(nextLessonPreferences)
      setCustomTemplates(templates)
      const defaultTemplate = templates.find((item) => item.isDefault)
      if (defaultTemplate) setSelectedTemplateId(defaultTemplate.id)
    }).catch((err) => {
      if (mounted) setError(err instanceof Error ? err.message : 'Unable to load printable lesson plan.')
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id, user?.id, profile?.id, isDemo])

  const model = useMemo(() => plan && profile && preferences
    ? buildLessonPlanExportModel(plan, profile, preferences, lessonPreferences)
    : null, [plan, profile, preferences, lessonPreferences])

  const selectedCustomTemplate = customTemplates.find((item) => item.id === selectedTemplateId) ?? null

  useEffect(() => {
    if (!selectedCustomTemplate || !model) {
      setCustomBlob(null)
      setCustomPreviewElement(null)
      setTemplateError('')
      return
    }
    let active = true
    setTemplateLoading(true)
    setTemplateError('')
    setCustomPreviewElement(null)
    void downloadDocumentTemplateFile(selectedCustomTemplate)
      .then((buffer) => fillDocxTemplate(buffer, selectedCustomTemplate.mappings, buildLessonTemplateValues(model)))
      .then((blob) => { if (active) setCustomBlob(blob) })
      .catch((err) => { if (active) setTemplateError(err instanceof Error ? err.message : 'Unable to fill the custom template.') })
      .finally(() => { if (active) setTemplateLoading(false) })
    return () => { active = false }
  }, [selectedCustomTemplate?.id, selectedCustomTemplate?.updatedAt, model])

  async function download(kind: 'pdf' | 'docx') {
    if (!model || !preferences) return
    setDownloading(kind)
    try {
      if (selectedCustomTemplate) {
        if (!customBlob) throw new Error('Custom template is still being prepared.')
        if (kind === 'docx') downloadBlob(customBlob, lessonPlanExportFilename(model, 'docx'))
        else {
          if (!customPreviewElement) throw new Error('Wait for the custom template preview to finish rendering before downloading PDF.')
          await customDocxPreviewToPdf(customPreviewElement, lessonPlanExportFilename(model, 'pdf'))
        }
      } else if (kind === 'pdf') downloadLessonPlanPdf(model, preferences)
      else await downloadLessonPlanDocx(model, preferences)
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Unable to download document.')
    } finally {
      setDownloading('')
    }
  }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Preparing printable lesson…</strong></div>
  if (error || !model || !plan) return <div className="export-preview-error"><FileText size={28} /><h2>Preview unavailable</h2><p>{error || 'Unable to build document preview.'}</p><Link className="button ghost" to="/lesson-plans">Back to lesson plans</Link></div>

  const printPaper = preferences?.paperSize === 'letter' ? 'letter' : preferences?.paperSize === 'legal' ? 'legal' : 'A4'
  const selectedLabel = selectedCustomTemplate?.name ?? 'ILAW Standard'

  return (
    <div className={`print-preview-page ${selectedCustomTemplate ? 'custom-template-active' : `paper-${preferences?.paperSize ?? 'a4'}`}`}>
      {!selectedCustomTemplate && <style>{`@media print { @page { size: ${printPaper}; margin: 0; } }`}</style>}
      <div className="print-preview-toolbar no-print">
        <Link className="button ghost" to={`/lesson-plans/${plan.id}`}><ArrowLeft size={16} /> Back to editor</Link>
        <div className="print-preview-title"><strong>Document preview</strong><small>{selectedLabel}{selectedCustomTemplate ? ' · Original teacher template' : ` · ${model.language === 'filipino' ? 'Filipino labels' : 'English labels'} · ${preferences?.paperSize.toUpperCase()}`}</small></div>
        <div className="preview-template-picker">
          <button className="template-picker-trigger" onClick={() => setTemplateMenuOpen((value) => !value)}><FileText size={15} /><span>{selectedLabel}</span><ChevronDown size={15} /></button>
          {templateMenuOpen && <div className="preview-template-menu">
            <button onClick={() => { setSelectedTemplateId(BUILTIN_ID); setTemplateMenuOpen(false) }}><div><strong>ILAW Standard</strong><small>Built-in GuroDesk fallback</small></div>{!selectedCustomTemplate && <Check size={15} />}</button>
            {customTemplates.map((template) => <button key={template.id} onClick={() => { setSelectedTemplateId(template.id); setTemplateMenuOpen(false) }}><div><strong>{template.name}</strong><small>{template.originalFilename}{template.isDefault ? ' · Default' : ''}</small></div>{selectedTemplateId === template.id && <Check size={15} />}</button>)}
          </div>}
        </div>
        <div className="print-preview-actions">
          <button className="button ghost" disabled={templateLoading} onClick={() => window.print()}><Printer size={16} /> Print</button>
          <button className="button secondary" disabled={Boolean(downloading) || templateLoading || (Boolean(selectedCustomTemplate) && !customBlob)} onClick={() => void download('docx')}><Download size={16} /> {downloading === 'docx' ? 'Building…' : 'Word'}</button>
          <button className="button primary" disabled={Boolean(downloading) || templateLoading || (Boolean(selectedCustomTemplate) && !customPreviewElement)} onClick={() => void download('pdf')}><Download size={16} /> {downloading === 'pdf' ? 'Building…' : 'PDF'}</button>
        </div>
      </div>
      {templateError && <div className="custom-template-error no-print">{templateError}</div>}
      {templateLoading && <div className="loading-screen compact no-print"><span className="loader" /><strong>Filling original template…</strong></div>}
      <div className={`print-preview-stage ${selectedCustomTemplate ? 'custom-docx-stage' : ''}`}>
        {selectedCustomTemplate && customBlob
          ? <CustomDocxPreview blob={customBlob} onReady={setCustomPreviewElement} onError={setTemplateError} />
          : !selectedCustomTemplate ? <LessonPlanDocumentView model={model} /> : null}
      </div>
    </div>
  )
}
