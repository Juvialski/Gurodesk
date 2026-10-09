import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { downloadBlob } from '../lib/docxTemplate'
import { inspectMailMerge, mergeWord, mergeWorkbook, type MergeData, type MergeField, type MergeRecord } from '../lib/mailMerge'
import { listMergeTemplates, loadMergeMaster, saveMergeTemplate, type SavedMergeTemplate } from '../lib/mailMergeRepository'

const label = (key: string) => key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
export function MailMergePage() {
  const { user, profile, assignments, isDemo } = useApp()
  const [saved, setSaved] = useState<SavedMergeTemplate[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [master, setMaster] = useState<ArrayBuffer | null>(null)
  const [type, setType] = useState<'docx' | 'xlsx'>('docx')
  const [name, setName] = useState('')
  const [fields, setFields] = useState<Array<MergeField & { source: string }>>([])
  const [values, setValues] = useState<MergeRecord>({})
  const [rows, setRows] = useState<MergeData['rows']>({})
  const [audience, setAudience] = useState<MergeData['audience']>('teacher')
  const [output, setOutput] = useState<Blob | null>(null)
  const [generatedData, setGeneratedData] = useState<MergeData | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const selectedAssignment = assignments.find(item => item.isActive) ?? assignments[0]
  const teacherFields: MergeRecord = { school_name: profile?.schoolName ?? '', teacher_name: profile?.fullName ?? '', district: profile?.district ?? '', region: profile?.region ?? '', division: profile?.division ?? '', school_year: profile?.schoolYear ?? '', grade_level: selectedAssignment?.gradeLevel ?? '', learning_area: selectedAssignment?.learningArea ?? '' }
  const groups = [...new Set(fields.flatMap(field => field.group ? [field.group] : []))]

  useEffect(() => {
    if (!user || isDemo) return
    let active = true
    listMergeTemplates(user.id).then(result => { if (active) setSaved(result) }).catch(error => { if (active) setMessage(error.message) })
    return () => { active = false }
  }, [user, isDemo])
  useEffect(() => { setOutput(null) }, [master, values, rows, audience, fields])
  useEffect(() => {
    if (!output || !previewRef.current || type !== 'docx') return
    const target = previewRef.current
    let active = true
    void import('docx-preview').then(async ({ renderAsync }) => {
      if (!active) return
      const container = document.createElement('div')
      await renderAsync(output, container, undefined, { inWrapper: true, ignoreWidth: false, ignoreHeight: false, renderHeaders: true, renderFooters: true, useBase64URL: true })
      if (active) target.replaceChildren(...Array.from(container.childNodes))
    }).catch(error => { if (active) setMessage(`Preview unavailable: ${error.message}. The editable download remains available.`) })
    return () => { active = false; target.replaceChildren() }
  }, [output, type])

  function initialize(buffer: ArrayBuffer, fileType: 'docx' | 'xlsx', mappings?: typeof fields) {
    const scanned = inspectMailMerge(buffer, fileType)
    if (!scanned.length) throw new Error('No merge placeholders were found. Existing lesson and TOS templates without placeholders can still use Settings → Documents mapping.')
    const next = scanned.map(field => ({ ...field, valueType: mappings?.find(mapping => mapping.key === field.key && mapping.group === field.group)?.valueType ?? (/^(number|points|score|item_?count|total_?items|minutes|weight_?percent)$/i.test(field.key) ? 'number' as const : 'text' as const), source: mappings?.find(mapping => mapping.key === field.key && mapping.group === field.group)?.source ?? (!field.group && field.key in teacherFields ? field.key : 'manual') }))
    setMaster(buffer); setType(fileType); setFields(next)
    setValues(Object.fromEntries(next.filter(field => !field.group).map(field => [field.key, teacherFields[field.source] ?? ''])))
    setRows(Object.fromEntries([...new Set(next.flatMap(field => field.group ? [field.group] : []))].map(group => [group, []])))
    setMessage('Template inspected. Review the mappings and fill its fields.')
  }
  async function upload(next: File) {
    setBusy(true); setMessage(''); setOutput(null)
    try {
      const fileType = next.name.toLowerCase().endsWith('.docx') ? 'docx' : next.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : null
      if (!fileType) throw new Error('Only DOCX and XLSX templates are supported.')
      if (next.size > 10 * 1024 * 1024) throw new Error('Templates must be 10 MB or smaller.')
      initialize(await next.arrayBuffer(), fileType); setFile(next); setName(next.name.replace(/\.[^.]+$/, ''))
    } catch (error) { setMaster(null); setFile(null); setFields([]); setMessage(error instanceof Error ? error.message : 'Template inspection failed.') }
    finally { setBusy(false) }
  }
  async function load(template: SavedMergeTemplate) {
    setBusy(true); setMessage(''); setOutput(null)
    try { initialize(await loadMergeMaster(template), template.type, template.mappings); setFile(null); setName(template.name) }
    catch (error) { setMaster(null); setFields([]); setMessage(error instanceof Error ? error.message : 'Template load failed.') }
    finally { setBusy(false) }
  }
  async function save() {
    if (!file || !user) return
    setBusy(true)
    try { const template = await saveMergeTemplate(user.id, name, file, fields); setSaved(current => [template, ...current]); setFile(null); setMessage('Master and field mappings saved for reuse. Filled values are not saved in the master.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Template save failed.') }
    finally { setBusy(false) }
  }
  function generate() {
    if (!master) return
    try {
      const typed = (field: typeof fields[number], value: string | number) => {
        if (field.valueType !== 'number' || value === '') return value
        const number = Number(value)
        if (!Number.isFinite(number)) throw new Error(`${label(field.key)} requires a valid number.`)
        return number
      }
      const resolved = Object.fromEntries(fields.filter(field => !field.group).map(field => [field.key, typed(field, field.source === 'manual' ? values[field.key] ?? '' : teacherFields[field.source] ?? '')]))
      const resolvedRows = Object.fromEntries(groups.map(group => [group, (rows[group] ?? []).map(record => Object.fromEntries(fields.filter(field => field.group === group).map(field => [field.key, typed(field, record[field.key] ?? '')])))]))
      const data = { fields: resolved, rows: resolvedRows, audience }
      setOutput(type === 'docx' ? mergeWord(master, data) : mergeWorkbook(master, data)); setGeneratedData(data); setMessage('Completed document ready. Review it before sharing.')
    } catch (error) { setOutput(null); setMessage(error instanceof Error ? error.message : 'Document merge failed.') }
  }
  return <>
    <PageHeader title="Fill your document" eyebrow="Reusable mail merge" description="Use your school’s Word or Excel layout for questionnaires, lesson plans, TOS, answer sheets, and reports." actions={<Link className="button ghost" to="/documents">Back to Documents</Link>} />
    <section className="panel merge-controls">
      <label>Upload master template<input type="file" accept=".docx,.xlsx" disabled={busy} onChange={event => { const selected = event.target.files?.[0]; if (selected) void upload(selected); event.target.value = '' }} /></label>
      <label>Saved template<select value="" disabled={busy} onChange={event => { const template = saved.find(item => item.id === event.target.value); if (template) void load(template) }}><option value="">Choose a saved template</option>{saved.map(template => <option key={template.id} value={template.id}>{template.name} ({template.type.toUpperCase()})</option>)}</select></label>
      <details><summary>Prepare a template</summary><p>Use fields such as {'{{school_name}}'}, {'{{teacher_name}}'}, and {'{{district}}'} in your original document. Map them below or enter values manually.</p><p>For Word questions, place {'{{#questions}}'} and {'{{/questions}}'} around a table row or a group of paragraphs containing fields such as {'{{number}}'}, {'{{prompt}}'}, and {'{{options}}'}. Word will repeat the block for each record.</p><p>In Excel, put those opening and closing markers on separate rows and place the same record placeholders in every existing data row between them. Include enough styled rows for your records. Formulas, print areas, and named ranges stay in place.</p><p>Student masters must contain no printed sample answers. Answer, solution, and scoring merge fields are blocked for student output.</p></details>
      {message && <p role="status" className="form-message">{message}</p>}
    </section>
    {master && <section className="panel merge-controls">
      <div className="form-grid two"><label>Template name<input value={name} maxLength={120} onChange={event => setName(event.target.value)} /></label><label>Document audience<select value={audience} onChange={event => setAudience(event.target.value as MergeData['audience'])}><option value="teacher">Teacher / report</option><option value="student">Student copy</option></select></label></div>
      <h2>Field mappings</h2><details><summary>Text and number formats</summary>{fields.map((field, index) => <label key={`${field.group ?? 'scalar'}.${field.key}`}>{field.group ? label(field.group) + ' / ' : ''}{label(field.key)}<select value={field.valueType ?? 'text'} onChange={event => setFields(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, valueType: event.target.value as 'text' | 'number' } : item))}><option value="text">Text (preserves identifiers and leading zeros)</option><option value="number">Number (usable by Excel formulas)</option></select></label>)}</details>
      {fields.filter(field => !field.group).map(field => <div className="merge-field" key={field.key}><label>{label(field.key)} → {'{{' + field.key + '}}'}<select value={field.source} onChange={event => setFields(current => current.map(item => item === field ? { ...item, source: event.target.value } : item))}><option value="manual">Enter manually</option>{Object.keys(teacherFields).map(key => <option key={key} value={key}>{label(key)}</option>)}</select></label><label>Value<textarea value={field.source === 'manual' ? values[field.key] ?? '' : teacherFields[field.source] ?? ''} readOnly={field.source !== 'manual'} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} /></label></div>)}
      {groups.map(group => <section key={group}><h3>{label(group)} — repeating section</h3>{rows[group]?.map((record, index) => <fieldset key={index} className="merge-record"><legend>Record {index + 1}</legend>{fields.filter(field => field.group === group).map(field => <label key={field.key}>{label(field.key)}<textarea value={record[field.key] ?? ''} onChange={event => setRows(current => ({ ...current, [group]: current[group].map((item, rowIndex) => rowIndex === index ? { ...item, [field.key]: event.target.value } : item) }))} /></label>)}<button type="button" className="button ghost" onClick={() => setRows(current => ({ ...current, [group]: current[group].filter((_, rowIndex) => rowIndex !== index) }))}>Remove record</button></fieldset>)}<button className="button secondary" disabled={(rows[group]?.length ?? 0) >= 500} onClick={() => setRows(current => ({ ...current, [group]: [...(current[group] ?? []), {}] }))}>Add {label(group)} record</button></section>)}
      <div className="inline-actions"><button className="button secondary" disabled={busy || !file || isDemo} onClick={() => void save()}>Save reusable master and mappings</button><button className="button primary" disabled={busy} onClick={generate}>Generate and preview</button>{output && <button className="button primary" onClick={() => downloadBlob(output, `${name || 'completed-document'}.${type}`)}>Download editable {type.toUpperCase()}</button>}</div>
      {isDemo && <p>Demo mode supports local merging. Sign in to save masters for reuse.</p>}
      <p>For a faithful PDF, download the editable file and export it through Word, Excel, or LibreOffice. Exact Office-to-PDF conversion is not available on the current static host.</p>
    </section>}
    {output && <section className="panel merge-preview"><h2>Output preview</h2>{type === 'docx' ? <div ref={previewRef} className="merge-word-preview" /> : <><p>Data preview. Open the downloaded workbook to see its original styles, formulas, and print layout.</p><dl>{Object.entries(generatedData?.fields ?? {}).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{String(value)}</dd></div>)}</dl>{groups.map(group => <div key={group}><h3>{label(group)}</h3>{generatedData?.rows[group]?.map((record, index) => <pre key={index}>{Object.values(record).join(' · ')}</pre>)}</div>)}</>}</section>}
  </>
}
