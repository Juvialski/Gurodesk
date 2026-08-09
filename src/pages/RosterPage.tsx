import { Check, Edit3, RotateCcw, Trash2, Upload, UserPlus, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { buildTabularRows, parseCsv, previewRosterTabularRows, type RosterImportPreview, type TabularRows } from '../lib/resultsImport'
import { loadClassLearners, removeClassLearner, saveClassLearner, saveClassLearnersBulk } from '../lib/resultsRepository'
import { validateClassLearners } from '../lib/resultsValidation'
import { inspectResultsXlsx, listResultsXlsxSheets } from '../lib/resultsWorkbook'
import type { ClassLearner, RosterImportMapping } from '../types/results'

function safeDecode(value: string | undefined) {
  if (!value) return ''
  try { return decodeURIComponent(value) } catch { return value }
}

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_ROWS = 10000

function utf8Length(value: string) {
  return new TextEncoder().encode(value).byteLength
}

function finalizeRosterPreview(next: RosterImportPreview, parserErrors: readonly string[] = []): RosterImportPreview {
  const rows = next.rows.map((row) => {
    const messages = [...row.messages]
    if (utf8Length(row.displayName) > 200) messages.push('Display name must be 200 UTF-8 bytes or fewer.')
    if (row.localReference && utf8Length(row.localReference) > 100) messages.push('Teacher-local reference must be 100 UTF-8 bytes or fewer.')
    return messages.length === row.messages.length ? row : { ...row, status: (row.status === 'duplicate' ? row.status : 'invalid') as 'ready' | 'duplicate' | 'invalid', messages }
  })
  const lengthErrors = rows.some((row) => row.status === 'invalid' && row.messages.some((message) => /UTF-8 bytes/u.test(message)))
    ? ['One or more learner fields exceed the safe length limit. Correct them before saving.']
    : []
  const errors = [...parserErrors.map((message) => `CSV: ${message}`), ...next.errors, ...lengthErrors]
  return { ...next, rows, errors, ready: errors.length === 0 && rows.length > 0 }
}

export function RosterPage() {
  const { assignmentId: routeAssignmentId, sectionName: routeSectionName } = useParams()
  const navigate = useNavigate()
  const { user, assignments, isDemo } = useApp()
  const [assignmentId, setAssignmentId] = useState(routeAssignmentId ?? '')
  const [sectionName, setSectionName] = useState(safeDecode(routeSectionName))
  const [learners, setLearners] = useState<ClassLearner[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [localReference, setLocalReference] = useState('')
  const [status, setStatus] = useState<ClassLearner['status']>('active')
  const [importOpen, setImportOpen] = useState(false)
  const [rawImport, setRawImport] = useState<(TabularRows & { errors?: string[] }) | null>(null)
  const [importMapping, setImportMapping] = useState<RosterImportMapping>({})
  const [importPreview, setImportPreview] = useState<RosterImportPreview | null>(null)
  const [xlsxBuffer, setXlsxBuffer] = useState<ArrayBuffer | null>(null)
  const [xlsxSheets, setXlsxSheets] = useState<string[]>([])
  const [xlsxWorksheet, setXlsxWorksheet] = useState('')

  const assignment = assignments.find((item) => item.id === assignmentId)
  const selectedSection = assignment?.sections.includes(sectionName) ? sectionName : assignment?.sections[0] ?? ''
  const rosterValidation = useMemo(() => {
    return validateClassLearners(learners, assignmentId, selectedSection)
  }, [assignmentId, learners, selectedSection])

  useEffect(() => {
    if (!assignmentId) {
      const first = assignments.find((item) => item.isActive) ?? assignments[0]
      if (first) setAssignmentId(first.id)
    }
  }, [assignmentId, assignments])

  useEffect(() => {
    if (!assignment) return
    if (!assignment.sections.includes(sectionName)) setSectionName(assignment.sections[0] ?? '')
  }, [assignment, sectionName])

  useEffect(() => {
    if (!user || !assignmentId || !selectedSection) {
      setLearners([])
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    void loadClassLearners(user.id, assignmentId, selectedSection, isDemo)
      .then((nextLearners) => { if (active) { setLearners(nextLearners); setError('') } })
      .catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to load the roster.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [assignmentId, isDemo, selectedSection, user?.id])

  function chooseScope(nextAssignmentId: string, nextSectionName: string) {
    setAssignmentId(nextAssignmentId)
    setSectionName(nextSectionName)
    navigate(`/results/roster/${nextAssignmentId}/${encodeURIComponent(nextSectionName)}`, { replace: true })
  }

  function beginAdd() {
    setEditingId(null)
    setName('')
    setLocalReference('')
    setStatus('active')
    setMessage('')
  }

  function beginEdit(learner: ClassLearner) {
    setEditingId(learner.id)
    setName(learner.displayName)
    setLocalReference(learner.localReference ?? '')
    setStatus(learner.status)
    setMessage('')
  }

  async function save() {
    if (!user || !assignmentId || !selectedSection || !name.trim()) {
      setMessage('Display name and section are required.')
      return
    }
    setWorking(true)
    setMessage('')
    try {
      const saved = await saveClassLearner({ id: editingId ?? undefined, assignmentId, sectionName: selectedSection, displayName: name.trim(), localReference: localReference.trim() || null, status }, user.id, isDemo)
      setLearners((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })))
      setMessage(editingId ? 'Learner updated.' : 'Learner added.')
      beginAdd()
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Unable to save this learner.')
    } finally { setWorking(false) }
  }

  async function toggleStatus(learner: ClassLearner) {
    if (!user) return
    setWorking(true)
    try {
      const saved = await saveClassLearner({ id: learner.id, assignmentId: learner.assignmentId, sectionName: learner.sectionName, displayName: learner.displayName, localReference: learner.localReference, status: learner.status === 'active' ? 'inactive' : 'active' }, user.id, isDemo)
      setLearners((current) => current.map((item) => item.id === saved.id ? saved : item))
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to change learner status.') } finally { setWorking(false) }
  }

  async function remove(learner: ClassLearner) {
    if (!user || !window.confirm(`Remove ${learner.displayName}? Historical result participants are preserved and must be deactivated instead.`)) return
    setWorking(true)
    try {
      await removeClassLearner(learner.id, user.id, isDemo)
      setLearners((current) => current.filter((item) => item.id !== learner.id))
      setMessage('Learner removed.')
    } catch (nextError) { setMessage(nextError instanceof Error ? nextError.message : 'This learner cannot be removed safely; deactivate instead.') } finally { setWorking(false) }
  }

  function refreshImport(nextMapping = importMapping) {
    if (!rawImport) return
    const next = finalizeRosterPreview(previewRosterTabularRows(buildTabularRows(rawImport.headers, rawImport.rows, rawImport.source ?? 'other'), { sectionName: selectedSection, mapping: nextMapping, existingLearners: learners }), rawImport.errors ?? [])
    setImportPreview(next)
  }

  function inspectRosterSheet(buffer: ArrayBuffer, worksheetName: string) {
    const inspected = inspectResultsXlsx(buffer, worksheetName, { maxRows: 5000, maxColumns: 100 })
    if (inspected.selectedSheet.truncated) throw new Error('This worksheet is larger than the safe preview limit. Narrow the worksheet or use a smaller roster import; no rows were imported.')
    const table = buildTabularRows(inspected.selectedSheet.headers, inspected.selectedSheet.rows, 'xlsx')
    const next = finalizeRosterPreview(previewRosterTabularRows(table, { sectionName: selectedSection, existingLearners: learners }))
    setRawImport(table); setXlsxWorksheet(worksheetName); setImportMapping(next.mapping); setImportPreview(next)
  }

  function chooseXlsxWorksheet(worksheetName: string) {
    if (!xlsxBuffer || !worksheetName) return
    try { inspectRosterSheet(xlsxBuffer, worksheetName); setMessage('') } catch (nextError) { setMessage(nextError instanceof Error ? nextError.message : 'Unable to inspect this worksheet.') }
  }

  async function readImport(file: File) {
    setMessage('')
    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      setMessage('Choose a CSV or XLSX file.')
      return
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage('This file is larger than the safe 10 MB import limit.')
      return
    }
    if (lowerName.endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer()
      setRawImport(null); setImportPreview(null); setXlsxSheets([]); setXlsxWorksheet(''); setXlsxBuffer(buffer)
      try {
        const names = listResultsXlsxSheets(buffer)
        if (!names.length) throw new Error('No readable worksheets were found in this XLSX.')
        setXlsxSheets(names)
        if (names.length === 1) inspectRosterSheet(buffer, names[0])
        else setMessage('Select one worksheet before mapping roster columns.')
      } catch (nextError) {
        setMessage(nextError instanceof Error ? nextError.message : 'Unable to inspect this XLSX.')
      }
      return
    }
    setXlsxBuffer(null); setXlsxSheets([]); setXlsxWorksheet('')
    const parsed = parseCsv(await file.text())
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      setMessage(`This CSV contains more than ${MAX_IMPORT_ROWS} data rows; no rows were imported.`)
      return
    }
    setRawImport(parsed)
    const initial = finalizeRosterPreview(previewRosterTabularRows(parsed, { sectionName: selectedSection, existingLearners: learners }), parsed.errors)
    setImportMapping(initial.mapping)
    setImportPreview(initial)
  }

  function editImportCell(index: number, field: 'displayName' | 'localReference', value: string) {
    if (!rawImport || !importPreview) return
    const displayColumn = Object.entries(importMapping).find(([, role]) => role === 'display_name')?.[0]
    const localColumn = Object.entries(importMapping).find(([, role]) => role === 'local_reference')?.[0]
    const nextRows = rawImport.rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row
      const next = [...row]
      const column = field === 'displayName' ? displayColumn : localColumn
      if (column) next[rawImport.headers.indexOf(column)] = value
      return next
    })
    const nextRaw = { ...rawImport, rows: nextRows }
    setRawImport(nextRaw)
    setImportPreview(finalizeRosterPreview(previewRosterTabularRows(buildTabularRows(nextRaw.headers, nextRaw.rows, nextRaw.source ?? 'other'), { sectionName: selectedSection, mapping: importMapping, existingLearners: learners }), nextRaw.errors ?? []))
  }

  async function confirmImport() {
    if (!user || !importPreview || !rawImport) return
    const hasInvalid = importPreview.rows.some((row) => row.status === 'invalid')
    const blockingErrors = importPreview.errors.filter((issue) => !/duplicate/iu.test(issue))
    if (hasInvalid || blockingErrors.length > 0) { setMessage('Correct invalid rows and mappings before importing. Duplicate display names are allowed with a visible warning.'); return }
    setWorking(true)
    try {
      // This is one bounded roster batch; no learner identity is sent to AI.
      await saveClassLearnersBulk(importPreview.rows.map((row) => ({ assignmentId, sectionName: selectedSection, displayName: row.displayName, localReference: row.localReference, status: 'active' as const })), user.id, isDemo)
      const nextLearners = await loadClassLearners(user.id, assignmentId, selectedSection, isDemo)
      setLearners(nextLearners)
      setImportOpen(false); setRawImport(null); setImportPreview(null)
      setMessage(importPreview.rows.some((row) => row.status === 'duplicate') ? 'Imported with duplicate-name warnings. Review the roster.' : 'Roster imported.')
    } catch (nextError) { setMessage(nextError instanceof Error ? nextError.message : 'Unable to import this roster.') } finally { setWorking(false) }
  }

  const displayColumn = Object.entries(importMapping).find(([, role]) => role === 'display_name')?.[0] ?? ''
  const referenceColumn = Object.entries(importMapping).find(([, role]) => role === 'local_reference')?.[0] ?? ''

  return <>
    <PageHeader eyebrow="Teacher-owned roster" title="Class learners" description="Keep only the lightweight identity needed to identify learners inside this assignment section. No LRN, contact, guardian, health, or demographic data is required." actions={<button className="button primary" type="button" onClick={beginAdd}><UserPlus size={16} /> Add learner</button>} />
    <section className="panel results-scope-bar"><label>Assignment<select value={assignmentId} onChange={(event) => { const next = assignments.find((item) => item.id === event.target.value); chooseScope(event.target.value, next?.sections[0] ?? '') }}>{assignments.map((item) => <option key={item.id} value={item.id}>{item.gradeLevel} · {item.learningArea}</option>)}</select></label><label>Section<select value={selectedSection} onChange={(event) => chooseScope(assignmentId, event.target.value)}>{assignment?.sections.map((section) => <option key={section}>{section}</option>)}</select></label><Link className="button ghost" to={`/results?assignment=${assignmentId}&section=${encodeURIComponent(selectedSection)}`}>Back to results</Link></section>
    {message && <div className="form-message results-alert">{message}</div>}
    {error && <div className="form-message error results-alert">{error}</div>}
    {rosterValidation.errors.some((issue) => issue.key === 'section-ownership') && <div className="form-message error results-alert">The selected roster contains data from a different assignment section. Reload or choose the correct section before editing.</div>}
    <div className="results-two-column">
      <section className="panel results-roster-panel"><div className="results-section-heading"><div><span className="eyebrow">{selectedSection || 'Section'}</span><h2>{learners.length} learner{learners.length === 1 ? '' : 's'}</h2><p>{learners.filter((learner) => learner.status === 'active').length} active · {learners.filter((learner) => learner.status === 'inactive').length} inactive</p></div><button className="button secondary" type="button" onClick={() => setImportOpen((open) => !open)}><Upload size={15} /> Import CSV / XLSX</button></div>
        {loading && <div className="results-loading small"><span className="loader" /></div>}
        {!loading && !learners.length && <EmptyState icon={UserRound} title="No learners in this section" description="Add one learner manually or import a CSV after checking its preview." />}
        {!loading && learners.length > 0 && <div className="results-roster-list">{learners.map((learner) => <div className={`results-roster-row ${learner.status}`} key={learner.id}><span className="results-roster-avatar">{learner.displayName.slice(0, 1).toUpperCase() || '?'}</span><div className="results-roster-name"><strong>{learner.displayName}</strong><small>{learner.localReference || 'No teacher-local reference'} · {learner.status}</small></div><div className="results-roster-actions"><button className="icon-button" type="button" onClick={() => beginEdit(learner)} aria-label={`Edit ${learner.displayName}`}><Edit3 size={15} /></button><button className="icon-button" type="button" disabled={working} onClick={() => void toggleStatus(learner)} aria-label={learner.status === 'active' ? `Deactivate ${learner.displayName}` : `Reactivate ${learner.displayName}`}>{learner.status === 'active' ? <X size={15} /> : <RotateCcw size={15} />}</button><button className="icon-button danger" type="button" disabled={working} onClick={() => void remove(learner)} aria-label={`Remove ${learner.displayName}`}><Trash2 size={15} /></button></div></div>)}</div>}
        {rosterValidation.warnings.length > 0 && <div className="results-warning-note"><strong>Review duplicate display names</strong><p>Names are teacher-local labels, so the database does not force uniqueness. Confirm that same-name learners remain distinct before encoding.</p></div>}
      </section>
      <section className="panel results-roster-form"><div className="results-section-heading"><div><span className="eyebrow">Manual maintenance</span><h2>{editingId ? 'Edit learner' : 'Add learner'}</h2><p>Use a local reference only if it helps you distinguish learners.</p></div>{editingId && <button className="icon-button" type="button" onClick={beginAdd} aria-label="Cancel edit"><X size={16} /></button>}</div><div className="stack-form"><label>Display name<input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} placeholder="e.g., Ana Cruz" autoComplete="off" /></label><label>Teacher-local reference <span className="label-optional">optional</span><input value={localReference} maxLength={100} onChange={(event) => setLocalReference(event.target.value)} placeholder="e.g., A-01" autoComplete="off" /></label>{editingId && <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as ClassLearner['status'])}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}<button className="button primary full" type="button" disabled={working} onClick={() => void save()}>{working ? 'Saving…' : editingId ? 'Save changes' : 'Add learner'} <Check size={15} /></button></div></section>
    </div>
    {importOpen && <section className="panel results-import-card roster-import-card"><div className="results-section-heading"><div><span className="eyebrow">Preview before saving</span><h2>Roster CSV / XLSX import</h2><p>Empty rows and invalid mappings block saving. Duplicate display names remain visible warnings and can be imported after teacher confirmation.</p></div><button className="icon-button" type="button" onClick={() => setImportOpen(false)} aria-label="Close import"><X size={16} /></button></div><label className="results-file-input">Choose CSV or XLSX<input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImport(file) }} /></label>{xlsxSheets.length > 1 && <label className="results-xlsx-sheet-picker">Worksheet<select value={xlsxWorksheet} onChange={(event) => chooseXlsxWorksheet(event.target.value)}><option value="">Choose worksheet</option>{xlsxSheets.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>}{rawImport && <div className="results-import-map"><label>Display-name column<select value={displayColumn} onChange={(event) => { const next = { ...importMapping, [event.target.value]: 'display_name' as const }; Object.keys(next).forEach((key) => { if (key !== event.target.value && next[key] === 'display_name') next[key] = 'ignore' }); setImportMapping(next); refreshImport(next) }}><option value="">Choose column</option>{rawImport.headers.map((header) => <option key={header}>{header}</option>)}</select></label><label>Local-reference column<select value={referenceColumn} onChange={(event) => { const next = { ...importMapping, [event.target.value]: 'local_reference' as const }; Object.keys(next).forEach((key) => { if (key !== event.target.value && next[key] === 'local_reference') next[key] = 'ignore' }); setImportMapping(next); refreshImport(next) }}><option value="">None</option>{rawImport.headers.map((header) => <option key={header}>{header}</option>)}</select></label></div>}{importPreview && <><div className={`results-import-status ${importPreview.ready ? 'ready' : 'blocked'}`}><span>{importPreview.ready ? <Check size={15} /> : <X size={15} />}</span><strong>{importPreview.ready ? `${importPreview.rows.length} rows ready` : 'Correction needed'}</strong><small>{importPreview.errors[0] || 'Review each row.'}</small></div><div className="results-import-preview roster-preview">{importPreview.rows.map((row, index) => <div className="results-import-row roster-preview-row" key={row.rowNumber}><span>{row.rowNumber}</span><input value={row.displayName} onChange={(event) => editImportCell(index, 'displayName', event.target.value)} aria-label={`Display name row ${row.rowNumber}`} /><input value={row.localReference ?? ''} onChange={(event) => editImportCell(index, 'localReference', event.target.value)} aria-label={`Local reference row ${row.rowNumber}`} placeholder="Local ref" /><span className={`results-row-status ${row.status}`}>{row.status}</span><small>{row.messages[0] || 'Ready'}</small></div>)}</div><div className="results-import-actions"><button className="button ghost" type="button" onClick={() => { setRawImport(null); setImportPreview(null) }}>Start over</button><button className="button primary" type="button" disabled={importPreview.rows.some((row) => row.status === 'invalid') || !importPreview.rows.length} onClick={() => void confirmImport()}><Check size={15} /> Confirm import</button></div></>}</section>}
  </>
}
