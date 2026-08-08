import { Check, FilePlus2, FileText, Pencil, Search, Sparkles, Star, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { extractDocxTemplateStructure, sha256Hex } from '../lib/docxTemplate'
import {
  analyzeDocumentTemplate,
  clearDefaultDocumentTemplate,
  deleteDocumentTemplate,
  listDocumentTemplates,
  saveNewDocumentTemplate,
  setDefaultDocumentTemplate,
  updateDocumentTemplate,
} from '../lib/templateRepository'
import {
  LESSON_TEMPLATE_FIELDS,
  type DocumentTemplate,
  type DocumentTemplateElement,
  type DocumentTemplateMapping,
  type LessonTemplateFieldKey,
  type TemplateMappingMode,
} from '../types/documentTemplate'

type Draft = {
  id: string
  file: File
  buffer: ArrayBuffer
  name: string
  elements: DocumentTemplateElement[]
  mappings: DocumentTemplateMapping[]
  sourceHash: string
  analysisModel: string | null
  makeDefault: boolean
}

function targetLabel(element?: DocumentTemplateElement) {
  if (!element) return 'Not mapped'
  const text = element.text.trim()
  return text ? `${element.id} · ${text.slice(0, 72)}` : `${element.id} · [blank cell] · ${element.context.slice(0, 60)}`
}

export function DocumentTemplatesPanel({ userId, isDemo }: { userId: string; isDemo: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<DocumentTemplate | null>(null)
  const [pickerField, setPickerField] = useState<LessonTemplateFieldKey | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [loading, setLoading] = useState(!isDemo)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const activeElements = draft?.elements ?? editing?.elements ?? []
  const activeMappings = draft?.mappings ?? editing?.mappings ?? []

  async function refresh() {
    if (isDemo) return
    setLoading(true)
    try { setTemplates(await listDocumentTemplates(userId, 'lesson_plan')) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load document templates.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [userId, isDemo])

  async function chooseFile(file: File) {
    setError('')
    setMessage('')
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError('Phase 3.7 custom lesson templates must be Word .docx files. XLSX template import will activate with the TOS Builder in Phase 4.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Template is larger than 10 MB. Remove unnecessary media or use a smaller DOCX template.')
      return
    }
    try {
      const buffer = await file.arrayBuffer()
      const elements = extractDocxTemplateStructure(buffer)
      if (elements.length < 3) throw new Error('Not enough editable paragraphs/table cells were found in this DOCX.')
      setEditing(null)
      setDraft({
        id: crypto.randomUUID(),
        file,
        buffer,
        name: file.name.replace(/\.docx$/i, '').trim(),
        elements,
        mappings: [],
        sourceHash: await sha256Hex(buffer),
        analysisModel: null,
        makeDefault: templates.length === 0,
      })
      setMessage(`Template loaded locally. ${elements.length} possible destination fields were found. The original file has not been uploaded yet.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read this DOCX template.')
    }
  }

  async function analyze() {
    if (!draft) return
    setAnalyzing(true)
    setError('')
    setMessage('')
    try {
      const result = await analyzeDocumentTemplate(draft.elements, 'lesson_plan')
      const elementMap = new Map(draft.elements.map((item) => [item.id, item]))
      const mappings = result.mappings.flatMap((item) => {
        const element = elementMap.get(item.elementId)
        if (!element) return []
        return [{ fieldKey: item.fieldKey, elementId: item.elementId, locator: element.locator, mode: item.mode, confidence: item.confidence } satisfies DocumentTemplateMapping]
      })
      setDraft({ ...draft, mappings, analysisModel: result.model })
      setMessage(`Gemini suggested ${mappings.length} field mappings in one analysis call. Review/correct them below, then save the template.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze the template.')
    } finally { setAnalyzing(false) }
  }

  function setMapping(fieldKey: LessonTemplateFieldKey, element: DocumentTemplateElement | null, mode?: TemplateMappingMode) {
    const currentMappings = activeMappings.filter((item) => item.fieldKey !== fieldKey)
    const nextMappings = element ? [...currentMappings, {
      fieldKey,
      elementId: element.id,
      locator: element.locator,
      mode: mode ?? element.suggestedMode,
      confidence: null,
    } satisfies DocumentTemplateMapping] : currentMappings
    if (draft) setDraft({ ...draft, mappings: nextMappings })
    if (editing) setEditing({ ...editing, mappings: nextMappings })
    setPickerField(null)
    setPickerSearch('')
  }

  function updateMappingMode(fieldKey: LessonTemplateFieldKey, mode: TemplateMappingMode) {
    const next = activeMappings.map((item) => item.fieldKey === fieldKey ? { ...item, mode } : item)
    if (draft) setDraft({ ...draft, mappings: next })
    if (editing) setEditing({ ...editing, mappings: next })
  }

  async function saveDraft() {
    if (!draft) return
    if (!draft.name.trim()) { setError('Give this template a name first.'); return }
    if (draft.mappings.length < 3) { setError('Map at least three fields before saving this template.'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      await saveNewDocumentTemplate({
        id: draft.id,
        userId,
        name: draft.name,
        documentType: 'lesson_plan',
        originalFilename: draft.file.name,
        file: draft.file,
        fileSizeBytes: draft.file.size,
        sourceHash: draft.sourceHash,
        elements: draft.elements,
        mappings: draft.mappings,
        analysisModel: draft.analysisModel,
        makeDefault: draft.makeDefault,
      })
      setDraft(null)
      if (inputRef.current) inputRef.current.value = ''
      setMessage('Custom lesson template saved. Future exports can fill a copy of this original DOCX without another Gemini call.')
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save template.') }
    finally { setSaving(false) }
  }

  async function saveEditing() {
    if (!editing) return
    setSaving(true); setError(''); setMessage('')
    try {
      await updateDocumentTemplate(editing)
      setEditing(null)
      setMessage('Template mapping updated. The original uploaded DOCX was not changed.')
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update template.') }
    finally { setSaving(false) }
  }

  async function makeDefault(template: DocumentTemplate) {
    setError(''); setMessage('')
    try {
      await setDefaultDocumentTemplate(template)
      setMessage(`${template.name} is now the default lesson-plan template.`)
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to set the default template.') }
  }


  async function useBuiltInDefault() {
    setError(''); setMessage('')
    try {
      await clearDefaultDocumentTemplate(userId, 'lesson_plan')
      setMessage('ILAW Standard is now the default lesson-plan export. Your custom templates remain saved and selectable.')
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to change the default template.') }
  }

  async function remove(template: DocumentTemplate) {
    if (!window.confirm(`Delete the template “${template.name}”? The original uploaded master copy stored in GuroDesk will also be removed.`)) return
    setError(''); setMessage('')
    try {
      await deleteDocumentTemplate(template)
      setMessage('Template deleted.')
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete template.') }
  }

  const pickerElements = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return activeElements.slice(0, 160)
    return activeElements.filter((item) => `${item.id} ${item.text} ${item.context}`.toLowerCase().includes(q)).slice(0, 160)
  }, [activeElements, pickerSearch])

  const groupedFields = useMemo(() => {
    const groups = new Map<string, typeof LESSON_TEMPLATE_FIELDS>()
    LESSON_TEMPLATE_FIELDS.forEach((field) => groups.set(field.group, [...(groups.get(field.group) ?? []), field]))
    return [...groups.entries()]
  }, [])

  if (isDemo) {
    return <section className="panel template-panel"><div className="panel-heading"><div><span className="eyebrow">Document templates</span><h2>Use your school's own format</h2><p>Custom DOCX masters are available after signing in to the Supabase-backed workspace. Demo mode keeps the built-in ILAW export only.</p></div></div></section>
  }

  const mappingEditor = draft || editing

  return (
    <section className="panel template-panel">
      <div className="panel-heading template-panel-heading">
        <div><span className="eyebrow">Custom templates</span><h2>Use your existing ILAW Word file</h2><p>Upload the DOCX your school already uses. Gemini analyzes its field locations once; after you confirm the mapping, GuroDesk fills copies of the original file deterministically.</p></div>
        <span className="settings-feature-icon"><FileText size={20} /></span>
      </div>

      <div className="template-safety-note"><Sparkles size={17} /><div><strong>One-time AI mapping, not AI formatting</strong><p>The DOCX itself is never sent to Gemini. GuroDesk extracts a text-only list of paragraphs/cells for the one-time mapping call. Future exports use the saved mapping and original master file with no AI call.</p></div></div>

      {!mappingEditor && <>
        <input ref={inputRef} className="sr-only" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseFile(file) }} />
        <button className="template-upload-zone" type="button" onClick={() => inputRef.current?.click()}><Upload size={22} /><strong>Upload ILAW/DLP template (.docx)</strong><span>Maximum 10 MB · original formatting stays as the master</span></button>
      </>}

      {loading && <div className="settings-inline-loading">Loading templates…</div>}
      {!mappingEditor && templates.length > 0 && <div className="template-library">
        <div className="template-library-title"><strong>My lesson-plan templates</strong><span>{templates.length}</span></div>
        <div className="template-library-item builtin-template-row"><div className="template-file-icon"><FileText size={18} /></div><div className="template-library-copy"><div><strong>ILAW Standard</strong>{!templates.some((item) => item.isDefault) && <span className="phase-pill live"><Star size={11} /> Default</span>}</div><small>Built-in fallback · always available</small></div><div className="template-library-actions">{templates.some((item) => item.isDefault) && <button className="button mini" onClick={() => void useBuiltInDefault()}>Set default</button>}</div></div>
        {templates.map((template) => <div className="template-library-item" key={template.id}>
          <div className="template-file-icon"><FileText size={18} /></div>
          <div className="template-library-copy"><div><strong>{template.name}</strong>{template.isDefault && <span className="phase-pill live"><Star size={11} /> Default</span>}</div><small>{template.originalFilename} · {template.mappings.length} mapped fields{template.analysisModel ? ` · analyzed with ${template.analysisModel}` : ' · manually mapped'}</small></div>
          <div className="template-library-actions">
            {!template.isDefault && <button className="icon-button" title="Set as default" onClick={() => void makeDefault(template)}><Star size={16} /></button>}
            <button className="icon-button" title="Edit field mapping" onClick={() => { setDraft(null); setEditing(structuredClone(template)); setMessage(''); setError('') }}><Pencil size={16} /></button>
            <button className="icon-button danger" title="Delete template" onClick={() => void remove(template)}><Trash2 size={16} /></button>
          </div>
        </div>)}
      </div>}

      {draft && <div className="template-editor-head">
        <label>Template name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="check-chip"><input type="checkbox" checked={draft.makeDefault} onChange={(event) => setDraft({ ...draft, makeDefault: event.target.checked })} /> Make default for lesson plans</label>
        <div className="template-editor-file"><FilePlus2 size={17} /><div><strong>{draft.file.name}</strong><small>{draft.elements.length} possible destinations · {(draft.file.size / 1024).toFixed(0)} KB</small></div></div>
        <div className="inline-actions"><button className="button secondary" disabled={analyzing} onClick={() => void analyze()}><Sparkles size={15} /> {analyzing ? 'Analyzing…' : draft.analysisModel ? 'Analyze again' : 'Analyze once with Gemini'}</button><button className="button ghost" onClick={() => setDraft(null)}><X size={15} /> Cancel</button></div>
      </div>}

      {editing && <div className="template-editor-head"><label>Template name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><div className="template-editor-file"><Pencil size={17} /><div><strong>Editing saved mapping</strong><small>The original DOCX master will not be modified.</small></div></div><button className="button ghost" onClick={() => setEditing(null)}><X size={15} /> Cancel</button></div>}

      {mappingEditor && <div className="template-mapping-editor">
        <div className="template-mapping-heading"><div><strong>Confirm field mapping</strong><p>Anything left unmapped simply stays as it appears in your original template.</p></div><span>{activeMappings.length} mapped</span></div>
        {groupedFields.map(([group, fields]) => <div className="template-field-group" key={group}><strong>{group}</strong>{fields.map((field) => {
          const mapping = activeMappings.find((item) => item.fieldKey === field.key)
          const element = mapping ? activeElements.find((item) => item.id === mapping.elementId) : undefined
          return <div className={`template-field-row ${mapping ? 'mapped' : ''}`} key={field.key}>
            <div><span>{field.label}{field.important ? ' *' : ''}</span><small>{targetLabel(element)}</small></div>
            <div className="template-field-actions">
              {mapping && <button type="button" className={`mapping-mode ${mapping.mode === 'append_after_label' ? 'active' : ''}`} onClick={() => updateMappingMode(field.key, mapping.mode === 'replace' ? 'append_after_label' : 'replace')} title="Toggle whether GuroDesk replaces the whole destination or preserves its label">{mapping.mode === 'replace' ? 'Replace cell' : 'Keep label'}</button>}
              <button type="button" className="button mini" onClick={() => { setPickerField(field.key); setPickerSearch('') }}>{mapping ? 'Change' : 'Map'}</button>
            </div>
          </div>
        })}</div>)}
        <div className="inline-actions"><button className="button primary" disabled={saving} onClick={() => void (draft ? saveDraft() : saveEditing())}><Check size={16} /> {saving ? 'Saving…' : 'Save template'}</button></div>
      </div>}

      {message && <div className="form-message success">{message}</div>}
      {error && <div className="form-message error">{error}</div>}

      {pickerField && <div className="template-picker-backdrop" role="dialog" aria-modal="true">
        <div className="template-picker-panel">
          <div className="template-picker-head"><div><span className="eyebrow">Map field</span><h3>{LESSON_TEMPLATE_FIELDS.find((item) => item.key === pickerField)?.label}</h3></div><button className="icon-button" onClick={() => setPickerField(null)}><X size={18} /></button></div>
          <div className="template-picker-search"><Search size={16} /><input autoFocus value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} placeholder="Search template text or cell…" /></div>
          <button className="template-picker-option clear" onClick={() => setMapping(pickerField, null)}><strong>Leave unmapped</strong><small>Keep this part of the original template unchanged.</small></button>
          <div className="template-picker-list">{pickerElements.map((element) => <button className="template-picker-option" key={element.id} onClick={() => setMapping(pickerField, element)}><div><strong>{element.id} · {element.kind === 'table_cell' ? 'Table cell' : 'Paragraph'}</strong><small>{element.text || '[blank cell]'}</small></div><p>{element.context}</p></button>)}</div>
        </div>
      </div>}
    </section>
  )
}
