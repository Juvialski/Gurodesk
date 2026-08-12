import { ArrowLeft, Check, ChevronDown, Download, FileSpreadsheet, Printer, TableProperties } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TosDocumentView } from '../components/TosDocumentView'
import { useApp } from '../contexts/AppContext'
import { loadTeacherExportPreferences } from '../lib/repository'
import { loadTosDocument } from '../lib/tosRepository'
import { downloadTosTemplateFile, listTosTemplates } from '../lib/tosTemplateRepository'
import { buildTosExportModel, downloadTosPdf, downloadTosXlsx } from '../lib/tosExport'
import { downloadTosDocx } from '../lib/tosDocxExport'
import { validateXlsxTemplateMappings } from '../lib/xlsxTemplate'
import type { TosDocumentTemplate } from '../types/tosTemplate'
import type { TeacherExportPreferences } from '../types/export'
import type { TosRecord } from '../types/tos'

const BUILTIN_ID = 'gurodesk_tos_standard'

export function TosPrintPreviewPage() {
  const { id = '' } = useParams()
  const { user, profile, isDemo } = useApp()
  const [record, setRecord] = useState<TosRecord | null>(null)
  const [preferences, setPreferences] = useState<TeacherExportPreferences | null>(null)
  const [templates, setTemplates] = useState<TosDocumentTemplate[]>([])
  const [selectedId, setSelectedId] = useState(BUILTIN_ID)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | 'xlsx' | ''>('')
  const [error, setError] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!user || !profile || !id) return
    let active = true
    Promise.all([
      loadTosDocument(id, user.id, isDemo),
      loadTeacherExportPreferences(user.id, isDemo),
      isDemo ? Promise.resolve([]) : listTosTemplates(user.id),
    ]).then(([nextRecord, nextPreferences, nextTemplates]) => {
      if (!nextRecord) throw new Error('TOS document not found.')
      if (!active) return
      setRecord(nextRecord); setPreferences(nextPreferences); setTemplates(nextTemplates)
      const defaultTemplate = nextTemplates.find((item) => item.isDefault)
      if (defaultTemplate) setSelectedId(defaultTemplate.id)
    }).catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to prepare the TOS export.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, user?.id, profile?.id, isDemo])

  useEffect(() => {
    if (!menuOpen) return
    const closeOutside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [menuOpen])

  const model = useMemo(() => record && profile && preferences ? buildTosExportModel(record, profile, preferences) : null, [record, profile, preferences])
  const selectedTemplate = templates.find((item) => item.id === selectedId) ?? null

  async function download(kind: 'pdf' | 'docx' | 'xlsx') {
    if (!model || !preferences) return
    setDownloading(kind); setError('')
    try {
      if (kind === 'pdf') downloadTosPdf(model, preferences)
      else if (kind === 'docx') await downloadTosDocx(model, preferences.paperSize)
      else if (selectedTemplate) {
        const mappingErrors = validateXlsxTemplateMappings(selectedTemplate.elements, selectedTemplate.mappings)
        if (mappingErrors.length) throw new Error(`This workbook mapping is no longer safe to export: ${mappingErrors[0]}`)
        const master = await downloadTosTemplateFile(selectedTemplate)
        await downloadTosXlsx(model, master, selectedTemplate.mappings, selectedTemplate.sourceHash)
      } else await downloadTosXlsx(model)
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to build this export.') }
    finally { setDownloading('') }
  }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Preparing TOS exports…</strong></div>
  if (error && !model) return <div className="export-preview-error"><TableProperties size={28} /><h2>Preview unavailable</h2><p>{error}</p><Link className="button ghost" to="/tos">Back to TOS</Link></div>
  if (!model || !record || !preferences) return null
  const paper = preferences.paperSize === 'letter' ? 'letter landscape' : preferences.paperSize === 'legal' ? 'legal landscape' : 'A4 landscape'
  const selectedLabel = selectedTemplate?.name ?? 'TOS Standard'

  return <div className={`print-preview-page tos-preview-page paper-${preferences.paperSize}`}>
    <style>{`@media print { @page { size: ${paper}; margin: 0; } }`}</style>
    <div className="print-preview-toolbar no-print">
      <Link className="button ghost" to={`/tos/${record.id}`}><ArrowLeft size={16} /> Back to TOS</Link>
      <div className="print-preview-title"><strong>Printable TOS preview</strong><small>Plain teacher document · {preferences.paperSize.toUpperCase()} landscape · Word/PDF use this layout · XLSX: {selectedLabel}</small></div>
      <div className="preview-template-picker" ref={menuRef}><button aria-controls="tos-export-template-options" aria-expanded={menuOpen} aria-haspopup="listbox" className="template-picker-trigger" type="button" onClick={() => setMenuOpen((value) => !value)}><FileSpreadsheet size={15} /><span>{selectedLabel}</span><ChevronDown size={15} /></button>{menuOpen && <div className="preview-template-menu" id="tos-export-template-options" role="listbox"><button aria-selected={!selectedTemplate} role="option" type="button" onClick={() => { setSelectedId(BUILTIN_ID); setMenuOpen(false) }}><div><strong>TOS Standard</strong><small>Built-in XLSX fallback</small></div>{!selectedTemplate && <Check size={15} />}</button>{templates.map((template) => <button aria-selected={selectedId === template.id} key={template.id} role="option" type="button" onClick={() => { setSelectedId(template.id); setMenuOpen(false) }}><div><strong>{template.name}</strong><small>{template.originalFilename}{template.isDefault ? ' · Default' : ''}</small></div>{selectedId === template.id && <Check size={15} />}</button>)}</div>}</div>
      <div className="print-preview-actions"><button className="button ghost" disabled={Boolean(downloading)} onClick={() => window.print()}><Printer size={16} /> Print</button><button className="button primary" disabled={Boolean(downloading)} onClick={() => void download('docx')}><Download size={16} />{downloading === 'docx' ? 'Building Word…' : 'Word (.docx)'}</button><button className="button secondary" disabled={Boolean(downloading)} onClick={() => void download('pdf')}><Download size={16} />{downloading === 'pdf' ? 'Building…' : 'PDF'}</button><button className="button secondary" disabled={Boolean(downloading)} onClick={() => void download('xlsx')}><Download size={16} />{downloading === 'xlsx' ? 'Filling…' : 'XLSX'}</button></div>
    </div>
    {selectedTemplate && <div className="tos-template-preview-note no-print"><FileSpreadsheet size={16} /><span>The on-screen/PDF preview uses the built-in plain layout. XLSX download fills a fresh copy of <strong>{selectedTemplate.name}</strong>; the master is never modified.</span></div>}
    {error && <div className="custom-template-error no-print">{error}</div>}
    <div className="print-preview-stage tos-print-stage"><TosDocumentView model={model} /></div>
  </div>
}
