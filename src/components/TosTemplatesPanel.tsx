import { Check, CircleAlert, FileSpreadsheet, Pencil, Search, Sparkles, Star, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { sha256Hex } from '../lib/docxTemplate'
import {
  analyzeTosTemplate,
  clearDefaultTosTemplate,
  deleteTosTemplate,
  listTosTemplates,
  saveNewTosTemplate,
  setDefaultTosTemplate,
  updateTosTemplate,
} from '../lib/tosTemplateRepository'
import {
  columnLocatorFromHeader,
  detectTosCandidates,
  extractXlsxTemplateStructure,
  inferTosTableRange,
  validateXlsxTemplateMappings,
} from '../lib/xlsxTemplate'
import {
  TOS_TEMPLATE_FIELDS,
  type TosDocumentTemplate,
  type TosTemplateElement,
  type TosTemplateMapping,
  type TosTemplateFieldKey,
  type XlsxCellLocator,
} from '../types/tosTemplate'

type Draft = {
  id: string
  file: File
  name: string
  elements: TosTemplateElement[]
  mappings: TosTemplateMapping[]
  sourceHash: string
  analysisModel: string | null
  makeDefault: boolean
  firstDataRow: number
  lastDataRow: number
}

function rowFromAddress(address: string) {
  return Number(address.match(/\d+$/)?.[0] ?? 1)
}

function targetLabel(element?: TosTemplateElement, mapping?: TosTemplateMapping) {
  if (!element || !mapping) return 'Not mapped'
  if (mapping.locator.kind === 'worksheet_column') return `${mapping.locator.sheetName}!${mapping.locator.columnAddress}${mapping.locator.firstDataRow}:${mapping.locator.columnAddress}${mapping.locator.lastDataRow}`
  return `${element.id} · ${element.text || '[blank cell]'}`
}

export function TosTemplatesPanel({ userId, isDemo }: { userId: string; isDemo: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const lastFocusRef = useRef<HTMLElement | null>(null)
  const [templates, setTemplates] = useState<TosDocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<TosDocumentTemplate | null>(null)
  const [pickerField, setPickerField] = useState<TosTemplateFieldKey | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [sheetFilter, setSheetFilter] = useState('all')
  const [firstDataRowInput, setFirstDataRowInput] = useState('2')
  const [lastDataRowInput, setLastDataRowInput] = useState('41')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const active = draft ?? editing
  const activeElements = active?.elements ?? []
  const activeMappings = active?.mappings ?? []
  const activeFirstRow = draft ? draft.firstDataRow : editing?.mappings.find((item) => item.locator.kind === 'worksheet_column')?.locator.kind === 'worksheet_column' ? (editing?.mappings.find((item) => item.locator.kind === 'worksheet_column')?.locator as { firstDataRow: number }).firstDataRow : 2
  const activeLastRow = draft ? draft.lastDataRow : editing?.mappings.find((item) => item.locator.kind === 'worksheet_column')?.locator.kind === 'worksheet_column' ? (editing?.mappings.find((item) => item.locator.kind === 'worksheet_column')?.locator as { lastDataRow: number }).lastDataRow : 41

  const requiredUnmapped = useMemo(() => {
    return TOS_TEMPLATE_FIELDS.filter((f) => f.important && !activeMappings.some((m) => m.fieldKey === f.key))
  }, [activeMappings])

  const availableSheets = useMemo(() => {
    const sheets = new Set<string>()
    activeElements.forEach((el) => { if (el.locator.sheetName) sheets.add(el.locator.sheetName) })
    return Array.from(sheets)
  }, [activeElements])

  useEffect(() => {
    if (!pickerField) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePicker()
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [pickerField])

  async function refresh() {
    if (!userId || isDemo) { setLoading(false); return }
    setLoading(true)
    try { setTemplates(await listTosTemplates(userId)) }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to load saved TOS templates.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [userId, isDemo])

  async function chooseFile(file: File) {
    setError(''); setMessage('')
    if (!file.name.toLocaleLowerCase('en').endsWith('.xlsx')) { setError('Choose an Excel .xlsx workbook. Legacy .xls, macro-enabled .xlsm, and encrypted files are not supported.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Template is larger than 10 MB. Use a smaller workbook master.'); return }
    try {
      const buffer = await file.arrayBuffer()
      const elements = extractXlsxTemplateStructure(buffer)
      if (elements.length < 3) throw new Error('Not enough existing workbook cells were found for reliable mapping.')
      setEditing(null)

      const initialCandidates = detectTosCandidates(elements)
      const fieldMap = new Map(TOS_TEMPLATE_FIELDS.map((item) => [item.key, item]))
      const elementMap = new Map(elements.map((item) => [item.id, item]))

      let detectedHeaderRow = 1
      let detectedSheet = elements[0]?.locator.sheetName || 'Sheet1'
      for (const item of initialCandidates) {
        const field = fieldMap.get(item.fieldKey as TosTemplateFieldKey)
        const element = elementMap.get(item.elementId)
        if (field?.tableColumn && element?.locator.kind === 'worksheet_cell') {
          const parsed = rowFromAddress(element.locator.cellAddress)
          if (parsed) {
            detectedHeaderRow = parsed
            detectedSheet = element.locator.sheetName
            break
          }
        }
      }

      const inferred = inferTosTableRange(elements, detectedHeaderRow, detectedSheet)
      const firstDataRow = inferred.firstDataRow
      const lastDataRow = inferred.lastDataRow

      const initialMappings = initialCandidates.flatMap((item) => {
        const field = fieldMap.get(item.fieldKey as TosTemplateFieldKey)
        const element = elementMap.get(item.elementId)
        if (!field || !element || element.locator.kind !== 'worksheet_cell'
          || element.isFormula || element.text.startsWith('=') || (element.isMerged && !element.isMergedAnchor)) return []
        const locator = field.tableColumn ? columnLocatorFromHeader(element, firstDataRow, lastDataRow) : element.locator
        return [{ fieldKey: field.key, elementId: element.id, locator, mode: field.tableColumn ? 'table_column' : 'replace', confidence: item.confidence } satisfies TosTemplateMapping]
      })

      setDraft({
        id: crypto.randomUUID(),
        file,
        name: file.name.replace(/\.xlsx$/i, '').trim(),
        elements,
        mappings: initialMappings,
        sourceHash: await sha256Hex(buffer),
        analysisModel: null,
        makeDefault: templates.length === 0,
        firstDataRow,
        lastDataRow,
      })
      setFirstDataRowInput(String(firstDataRow))
      setLastDataRowInput(String(lastDataRow))
      setMessage(`Workbook inspected locally across ${elements.length} cells. ${initialMappings.length} candidate fields mapped (Data rows ${firstDataRow}–${lastDataRow}).`)
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to inspect this XLSX workbook.') }
  }

  function updateActiveMappings(mappings: TosTemplateMapping[]) {
    if (draft) setDraft({ ...draft, mappings })
    if (editing) setEditing({ ...editing, mappings })
  }

  function mapField(fieldKey: TosTemplateFieldKey, element: TosTemplateElement | null) {
    const field = TOS_TEMPLATE_FIELDS.find((item) => item.key === fieldKey)
    const retained = activeMappings.filter((item) => item.fieldKey !== fieldKey)
    if (!element || !field || element.locator.kind !== 'worksheet_cell') updateActiveMappings(retained)
    else {
      const locator = field.tableColumn
        ? columnLocatorFromHeader(element, activeFirstRow, activeLastRow)
        : element.locator as XlsxCellLocator
      updateActiveMappings([...retained, { fieldKey, elementId: element.id, locator, mode: field.tableColumn ? 'table_column' : 'replace', confidence: null } satisfies TosTemplateMapping])
    }
    closePicker()
  }

  function updateDataRows(firstDataRow: number, lastDataRow: number) {
    const first = Math.max(1, Math.trunc(firstDataRow || 1))
    const last = Math.max(first, Math.trunc(lastDataRow || first))
    setFirstDataRowInput(String(first)); setLastDataRowInput(String(last))
    const mappings = activeMappings.map((mapping) => mapping.locator.kind === 'worksheet_column'
      ? { ...mapping, locator: { ...mapping.locator, firstDataRow: first, lastDataRow: last } }
      : mapping)
    if (draft) setDraft({ ...draft, firstDataRow: first, lastDataRow: last, mappings })
    if (editing) setEditing({ ...editing, mappings })
  }

  function openPicker(field: TosTemplateFieldKey) {
    lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPickerField(field); setPickerSearch(''); setSheetFilter('all')
  }

  function closePicker() {
    setPickerField(null); setPickerSearch(''); setSheetFilter('all')
    window.requestAnimationFrame(() => lastFocusRef.current?.focus())
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  function beginEditing(template: TosDocumentTemplate) {
    const copy = structuredClone(template)
    const column = copy.mappings.find((item) => item.locator.kind === 'worksheet_column')
    const first = column?.locator.kind === 'worksheet_column' ? column.locator.firstDataRow : 2
    const last = column?.locator.kind === 'worksheet_column' ? column.locator.lastDataRow : 41
    setDraft(null); setEditing(copy); setFirstDataRowInput(String(first)); setLastDataRowInput(String(last)); setError(''); setMessage('')
  }

  async function analyze() {
    if (!draft) return
    setAnalyzing(true); setError(''); setMessage('')
    try {
      const result = await analyzeTosTemplate(draft.elements)
      const elementMap = new Map(draft.elements.map((item) => [item.id, item]))
      const fieldMap = new Map(TOS_TEMPLATE_FIELDS.map((item) => [item.key, item]))

      let detectedHeaderRow = draft.firstDataRow > 1 ? draft.firstDataRow - 1 : 1
      let detectedSheet = draft.elements[0]?.locator.sheetName || 'Sheet1'
      for (const item of result.mappings) {
        const field = fieldMap.get(item.fieldKey as TosTemplateFieldKey)
        const element = elementMap.get(item.elementId)
        if (field?.tableColumn && element?.locator.kind === 'worksheet_cell') {
          const parsed = rowFromAddress(element.locator.cellAddress)
          if (parsed) {
            detectedHeaderRow = parsed
            detectedSheet = element.locator.sheetName
            break
          }
        }
      }

      const inferred = inferTosTableRange(draft.elements, detectedHeaderRow, detectedSheet)
      const firstDataRow = inferred.firstDataRow
      const lastDataRow = inferred.lastDataRow

      const mappings = result.mappings.flatMap((item) => {
        const field = fieldMap.get(item.fieldKey as TosTemplateFieldKey)
        const element = elementMap.get(item.elementId)
        if (!field || !element || element.locator.kind !== 'worksheet_cell'
          || element.isFormula || element.text.startsWith('=') || (element.isMerged && !element.isMergedAnchor)) return []
        const locator = field.tableColumn ? columnLocatorFromHeader(element, firstDataRow, lastDataRow) : element.locator
        return [{ fieldKey: field.key, elementId: element.id, locator, mode: field.tableColumn ? 'table_column' : 'replace', confidence: item.confidence } satisfies TosTemplateMapping]
      })

      setDraft({ ...draft, mappings, analysisModel: result.model, firstDataRow, lastDataRow })
      setFirstDataRowInput(String(firstDataRow))
      setLastDataRowInput(String(lastDataRow))
      setMessage(`Suggested ${mappings.length} destinations (Data rows ${firstDataRow}–${lastDataRow}). Confirm every cell and table range before saving.`)
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to analyze the workbook structure.') }
    finally { setAnalyzing(false) }
  }

  async function saveDraft() {
    if (!draft) return
    const keys = new Set(draft.mappings.map((item) => item.fieldKey))
    if (!draft.name.trim()) { setError('Give this TOS template a name.'); return }
    if (!keys.has('competency') || !keys.has('itemCount') || !keys.has('itemPlacement')) { setError('Map the competency, item-count, and item-placement columns before saving.'); return }
    if (!/^[0-9a-f]{64}$/i.test(draft.sourceHash)) { setError('The workbook master could not be fingerprinted safely. Inspect the file again.'); return }
    const mappingErrors = validateXlsxTemplateMappings(draft.elements, draft.mappings)
    if (mappingErrors.length) { setError(`Fix the workbook mapping before saving: ${mappingErrors[0]}`); return }
    setSaving(true); setError(''); setMessage('')
    try {
      await saveNewTosTemplate({ id: draft.id, userId, name: draft.name, originalFilename: draft.file.name, file: draft.file, fileSizeBytes: draft.file.size, sourceHash: draft.sourceHash, elements: draft.elements, mappings: draft.mappings, analysisModel: draft.analysisModel, makeDefault: draft.makeDefault })
      setDraft(null); if (inputRef.current) inputRef.current.value = ''
      setMessage('Custom TOS workbook saved. Future exports fill fresh copies of this exact master with no recurring Gemini call.')
      await refresh()
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to save this template.') }
    finally { setSaving(false) }
  }

  async function saveEditing() {
    if (!editing) return
    const mappingErrors = validateXlsxTemplateMappings(editing.elements, editing.mappings)
    if (mappingErrors.length) { setError(`Fix the workbook mapping before saving: ${mappingErrors[0]}`); return }
    if (!/^[0-9a-f]{64}$/i.test(editing.sourceHash)) { setError('This saved master has no valid SHA-256 fingerprint. Re-upload it before use.'); return }
    setSaving(true); setError(''); setMessage('')
    try { await updateTosTemplate(editing); setEditing(null); setMessage('Workbook mapping updated. The original XLSX master was not changed.'); await refresh() }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to update this mapping.') }
    finally { setSaving(false) }
  }

  async function makeDefault(template: TosDocumentTemplate) {
    try { await setDefaultTosTemplate(template); setMessage(`${template.name} is now the default TOS workbook.`); await refresh() }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to set the default workbook.') }
  }
  async function useBuiltIn() {
    try { await clearDefaultTosTemplate(userId); setMessage('TOS Standard is now the default. Custom workbook masters remain saved.'); await refresh() }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to change the default workbook.') }
  }
  async function remove(template: TosDocumentTemplate) {
    if (!window.confirm(`Delete the template “${template.name}”? Its private master copy will also be removed.`)) return
    try { await deleteTosTemplate(template); setMessage('Template deleted.'); await refresh() }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to delete the template.') }
  }

  const pickerElements = useMemo(() => {
    const needle = pickerSearch.trim().toLocaleLowerCase('en')
    let list = activeElements.filter((item) => item.kind === 'worksheet_cell')
    if (sheetFilter !== 'all') {
      list = list.filter((item) => item.locator.sheetName === sheetFilter)
    }
    if (needle) {
      list = list.filter((item) => `${item.id} ${item.text} ${item.context}`.toLocaleLowerCase('en').includes(needle))
    }
    return list.slice(0, 300)
  }, [activeElements, pickerSearch, sheetFilter])

  const groups = useMemo(() => {
    const map = new Map<string, typeof TOS_TEMPLATE_FIELDS>()
    TOS_TEMPLATE_FIELDS.forEach((field) => map.set(field.group, [...(map.get(field.group) ?? []), field]))
    return [...map.entries()]
  }, [])

  if (isDemo) return <section className="panel template-panel"><div className="panel-heading"><div><span className="eyebrow">TOS workbook templates</span><h2>Use your school’s spreadsheet</h2><p>Private XLSX masters and one-time Gemini mapping are available in a signed-in Supabase workspace. Demo mode keeps the built-in printable/XLSX export.</p></div></div></section>

  return <section className="panel template-panel">
    <div className="panel-heading template-panel-heading"><div><span className="eyebrow">Phase 4 · XLSX templates</span><h2>Use your existing TOS workbook</h2><p>GuroDesk patches mapped existing cells in a fresh copy. It does not rebuild or directly modify your master workbook.</p></div><span className="settings-feature-icon"><FileSpreadsheet size={20} /></span></div>
    <div className="template-safety-note"><Sparkles size={17} /><div><strong>One-time mapping; deterministic exports</strong><p>Gemini receives only extracted sheet/cell text and never calculates the TOS. Normal future exports use the saved mapping, verified source hash, and exact application-calculated values without AI.</p></div></div>
    {!active && <><input ref={inputRef} className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseFile(file) }} /><button className="template-upload-zone" type="button" onClick={() => inputRef.current?.click()}><Upload size={22} /><strong>Upload TOS template (.xlsx)</strong><span>Maximum 10 MB · fixed existing row capacity · formulas remain read-only</span></button></>}
    {loading && <div className="settings-inline-loading">Loading TOS templates…</div>}
    {!active && templates.length > 0 && <div className="template-library"><div className="template-library-title"><strong>My TOS workbooks</strong><span>{templates.length}</span></div><div className="template-library-item"><div className="template-file-icon"><FileSpreadsheet size={18} /></div><div className="template-library-copy"><div><strong>TOS Standard</strong>{!templates.some((item) => item.isDefault) && <span className="phase-pill live"><Star size={11} /> Default</span>}</div><small>Built-in printable and XLSX fallback</small></div><div className="template-library-actions">{templates.some((item) => item.isDefault) && <button className="button mini" onClick={() => void useBuiltIn()}>Set default</button>}</div></div>{templates.map((template) => <div className="template-library-item" key={template.id}><div className="template-file-icon"><FileSpreadsheet size={18} /></div><div className="template-library-copy"><div><strong>{template.name}</strong>{template.isDefault && <span className="phase-pill live"><Star size={11} /> Default</span>}</div><small>{template.originalFilename} · {template.mappings.length} mappings{template.analysisModel ? ` · ${template.analysisModel}` : ' · manual'}</small></div><div className="template-library-actions">{!template.isDefault && <button aria-label={`Set ${template.name} as default`} className="icon-button" title="Set default" onClick={() => void makeDefault(template)}><Star size={16} /></button>}<button aria-label={`Edit ${template.name} mapping`} className="icon-button" title="Edit mapping" onClick={() => beginEditing(template)}><Pencil size={16} /></button><button aria-label={`Delete ${template.name}`} className="icon-button danger" title="Delete" onClick={() => void remove(template)}><Trash2 size={16} /></button></div></div>)}</div>}
    {draft && <div className="template-editor-head"><label>Template name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="check-chip"><input type="checkbox" checked={draft.makeDefault} onChange={(event) => setDraft({ ...draft, makeDefault: event.target.checked })} /> Make default for TOS exports</label><div className="template-editor-file"><FileSpreadsheet size={17} /><div><strong>{draft.file.name}</strong><small>{draft.elements.length} existing cells · {(draft.file.size / 1024).toFixed(0)} KB</small></div></div><div className="inline-actions"><button className="button secondary" disabled={analyzing} onClick={() => void analyze()}><Sparkles size={15} />{analyzing ? 'Analyzing…' : 'Analyze once with Gemini'}</button><button className="button ghost" onClick={() => setDraft(null)}><X size={15} /> Cancel</button></div></div>}
    {editing && <div className="template-editor-head"><label>Template name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><div className="template-editor-file"><Pencil size={17} /><div><strong>Editing saved mapping</strong><small>The original XLSX master remains unchanged.</small></div></div><button className="button ghost" onClick={() => setEditing(null)}><X size={15} /> Cancel</button></div>}
    {active && <div className="template-mapping-editor">
      <div className="template-mapping-heading">
        <div>
          <strong>Confirm workbook mapping</strong>
          <p>Table columns fill only existing cells within the fixed row range. No rows or columns are inserted.</p>
        </div>
        <span>Mapped: {activeMappings.length} / Still unmapped: {TOS_TEMPLATE_FIELDS.length - activeMappings.length}</span>
      </div>

      {requiredUnmapped.length > 0 && (
        <div className="template-safety-note" style={{ borderColor: '#f59e0b', background: '#fffbeb' }}>
          <CircleAlert size={17} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#92400e' }}>Required unmapped fields ({requiredUnmapped.length}):</strong>
            <p style={{ color: '#b45309', margin: '4px 0 8px' }}>These fields must be mapped before saving for accurate TOS generation.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {requiredUnmapped.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  className="button mini secondary"
                  onClick={() => openPicker(field.key)}
                >
                  + Map {field.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="tos-template-range">
        <label>First competency data row<input type="number" inputMode="numeric" min="1" value={firstDataRowInput} onChange={(event) => setFirstDataRowInput(event.target.value)} onBlur={() => updateDataRows(Number(firstDataRowInput), Number(lastDataRowInput))} /></label>
        <label>Last available data row<input type="number" inputMode="numeric" min={activeFirstRow} value={lastDataRowInput} onChange={(event) => setLastDataRowInput(event.target.value)} onBlur={() => updateDataRows(Number(firstDataRowInput), Number(lastDataRowInput))} /></label>
        <small>Capacity: {Math.max(0, activeLastRow - activeFirstRow + 1)} rows</small>
      </div>

      {groups.map(([group, fields]) => (
        <div className="template-field-group" key={group}>
          <strong>{group}</strong>
          {fields.map((field) => {
            const mapping = activeMappings.find((item) => item.fieldKey === field.key)
            const element = mapping ? activeElements.find((item) => item.id === mapping.elementId) : undefined
            return (
              <div className={`template-field-row ${mapping ? 'mapped' : ''}`} key={field.key}>
                <div>
                  <span>{field.label}{field.important ? ' *' : ''}</span>
                  <small>{targetLabel(element, mapping)}</small>
                </div>
                <div className="template-field-actions">
                  {field.tableColumn && <span className="mapping-mode active">Table column</span>}
                  <button className="button mini" type="button" onClick={() => openPicker(field.key)}>{mapping ? 'Change' : 'Map'}</button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
      <div className="inline-actions"><button className="button primary" disabled={saving} onClick={() => void (draft ? saveDraft() : saveEditing())}><Check size={16} /> {saving ? 'Saving…' : 'Save template'}</button></div>
    </div>}
    {message && <div className="form-message success">{message}</div>}{error && <div className="form-message error">{error}</div>}
    {pickerField && <div className="template-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker() }}><div aria-labelledby="tos-template-picker-title" aria-modal="true" className="template-picker-panel" onKeyDown={handleDialogKeyDown} ref={dialogRef} role="dialog"><div className="template-picker-head"><div><span className="eyebrow">Map XLSX field</span><h3 id="tos-template-picker-title">{TOS_TEMPLATE_FIELDS.find((item) => item.key === pickerField)?.label}</h3></div><button aria-label="Close workbook mapping picker" className="icon-button" onClick={closePicker}><X size={18} /></button></div>
      {availableSheets.length > 1 && (
        <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Filter worksheet:</span>
          <select value={sheetFilter} onChange={(e) => setSheetFilter(e.target.value)} style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px' }}>
            <option value="all">All sheets ({availableSheets.length})</option>
            {availableSheets.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      )}
      <div className="template-picker-search"><Search size={16} /><input aria-label="Search workbook cells" autoFocus value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} placeholder="Search sheet, cell address, or text…" /></div><button className="template-picker-option clear" type="button" onClick={() => mapField(pickerField, null)}><strong>Leave unmapped</strong><small>Keep these cells unchanged in the master copy.</small></button><div className="template-picker-list">{pickerElements.map((element) => { const readOnly = element.isFormula || element.text.startsWith('=') || (element.isMerged && !element.isMergedAnchor); return <button className="template-picker-option" disabled={readOnly} key={element.id} type="button" onClick={() => mapField(pickerField, element)}><div><strong>{element.id}</strong><small>{element.isFormula || element.text.startsWith('=') ? 'Formula cell · read-only' : element.isMerged && !element.isMergedAnchor ? 'Merged non-anchor · read-only' : element.text || '[blank styled cell]'}</small></div><p>{element.context}</p></button> })}</div></div></div>}
  </section>
}
