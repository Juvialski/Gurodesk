import { Check, FileUp, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildTabularRows, parseCsv, previewResultsTabularRows, type ResultsImportPreview, type TabularRows } from '../../lib/resultsImport'
import { inspectResultsXlsx, listResultsXlsxSheets } from '../../lib/resultsWorkbook'
import type { ResultAssessmentItemSnapshot, ResultEntryMode } from '../../types/results'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_ROWS = 10000

export function ResultsImportPanel({
  mode,
  sectionName,
  itemCount,
  possiblePoints,
  items,
  onConfirm,
}: {
  mode: ResultEntryMode
  sectionName: string
  itemCount: number
  possiblePoints: number
  items: readonly ResultAssessmentItemSnapshot[]
  onConfirm: (preview: ResultsImportPreview) => boolean | void
}) {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState<(TabularRows & { errors?: string[] }) | null>(null)
  const [preview, setPreview] = useState<ResultsImportPreview | null>(null)
  const [learnerColumn, setLearnerColumn] = useState('')
  const [scoreColumn, setScoreColumn] = useState('')
  const [itemMapping, setItemMapping] = useState<Record<string, number>>({})
  const [xlsxBuffer, setXlsxBuffer] = useState<ArrayBuffer | null>(null)
  const [xlsxSheets, setXlsxSheets] = useState<string[]>([])
  const [xlsxWorksheet, setXlsxWorksheet] = useState('')
  const [message, setMessage] = useState('')
  const headers = raw?.headers ?? []
  const itemHeaders = useMemo(() => headers.filter((header) => /^(?:item|question|q)?\s*\d+$/iu.test(header.trim())), [headers])

  function applyParserErrors(next: ResultsImportPreview, parserErrors: readonly string[] = []) {
    if (!parserErrors.length) return next
    return { ...next, errors: [...parserErrors.map((message) => `CSV: ${message}`), ...next.errors], ready: false }
  }

  function validateImportedAnswers(next: ResultsImportPreview): ResultsImportPreview {
    const invalidRows = new Map<number, string[]>()
    const itemByNumber = new Map(items.map((item) => [item.itemNumber, item]))
    for (const row of next.rows) {
      for (const [itemNumberText, value] of Object.entries(row.answers)) {
        const valueText = value?.normalize('NFKC').trim() ?? ''
        if (!valueText) continue
        const item = itemByNumber.get(Number(itemNumberText))
        if (!item) continue
        let valid = true
        if (item.questionType === 'multiple_choice' && item.answer.type === 'multiple_choice') {
          const normalized = valueText.toLocaleUpperCase('en-US')
          valid = item.answer.choices.some((choice, index) => choice.id === valueText || String.fromCharCode(65 + index) === normalized)
        } else if (item.questionType === 'true_false') {
          valid = ['true', 't', 'yes', 'y', '1', 'false', 'f', 'no', 'n', '0'].includes(valueText.toLocaleLowerCase('en-US'))
        }
        if (!valid) invalidRows.set(row.rowNumber, [...(invalidRows.get(row.rowNumber) ?? []), `Item ${item.itemNumber} has an unrecognized answer.`])
      }
    }
    if (!invalidRows.size) return next
    return {
      ...next,
      rows: next.rows.map((row) => {
        const messages = invalidRows.get(row.rowNumber)
        if (!messages) return row
        return { ...row, status: (row.status === 'duplicate' ? row.status : 'invalid') as 'ready' | 'duplicate' | 'invalid', messages: [...row.messages, ...messages] }
      }),
      errors: [...next.errors, 'Some MCQ or true/false cells do not match the saved answer choices. Correct them before importing.'],
      ready: false,
    }
  }

  function refresh(nextLearnerColumn = learnerColumn, nextScoreColumn = scoreColumn, nextItemMapping = itemMapping) {
    if (!raw) return
    let next = previewResultsTabularRows(buildTabularRows(raw.headers, raw.rows, raw.source ?? 'other'), {
      sectionName,
      mode,
      itemCount,
      totalPossiblePoints: possiblePoints,
      mapping: {
        learnerColumn: nextLearnerColumn || undefined,
        scoreColumn: mode === 'score_only' ? (nextScoreColumn || undefined) : nextScoreColumn,
        itemColumns: Object.keys(nextItemMapping).length ? nextItemMapping : undefined,
      },
    })
    next = applyParserErrors(validateImportedAnswers(next), raw.errors ?? [])
    if (mode !== 'score_only' && next.mapping.scoreColumn && Object.keys(next.mapping.itemColumns).length > 0) {
      next = { ...next, ready: false, errors: [...next.errors, 'Both item-answer and raw-score columns were detected. Choose one format explicitly: ignore the score column for item mode, or use Score-only mode.'] }
    }
    setPreview(next)
  }

  function inspectSheet(buffer: ArrayBuffer, worksheetName: string) {
    const inspected = inspectResultsXlsx(buffer, worksheetName, { maxRows: 5000, maxColumns: 200 })
    if (inspected.selectedSheet.truncated) throw new Error('This worksheet is larger than the safe preview limit. Narrow the worksheet or use a smaller import; no rows were imported.')
    const table = buildTabularRows(inspected.selectedSheet.headers, inspected.selectedSheet.rows, 'xlsx')
    setRaw(table)
    setXlsxWorksheet(worksheetName)
    setLearnerColumn('')
    setScoreColumn('')
    const next = validateImportedAnswers(previewResultsTabularRows(table, { sectionName, mode, itemCount, totalPossiblePoints: possiblePoints, mapping: { scoreColumn: mode === 'score_only' ? undefined : '' } }))
    setItemMapping(next.mapping.itemColumns)
    setPreview(next)
  }

  function chooseXlsxWorksheet(worksheetName: string) {
    if (!xlsxBuffer || !worksheetName) return
    try { inspectSheet(xlsxBuffer, worksheetName); setMessage('') } catch (nextError) { setMessage(nextError instanceof Error ? nextError.message : 'Unable to inspect this worksheet.') }
  }

  async function readFile(file: File) {
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
      setRaw(null); setPreview(null); setXlsxSheets([]); setXlsxWorksheet('')
      setXlsxBuffer(buffer)
      try {
        const names = listResultsXlsxSheets(buffer)
        if (!names.length) throw new Error('No readable worksheets were found in this XLSX.')
        setXlsxSheets(names)
        if (names.length === 1) inspectSheet(buffer, names[0])
        else setMessage('Select one worksheet before mapping columns.')
      } catch (nextError) {
        setMessage(nextError instanceof Error ? nextError.message : 'Unable to inspect this XLSX.')
      }
      return
    }
    setXlsxBuffer(null); setXlsxSheets([]); setXlsxWorksheet('')
    const parsed = parseCsv(await file.text())
    const inferredLearner = parsed.headers.find((header) => /^(?:learner|student|name|display name|pangalan)$/iu.test(header.trim())) ?? ''
    const inferredScore = parsed.headers.find((header) => /^(?:score|raw score|points|total)$/iu.test(header.trim())) ?? ''
    setLearnerColumn(inferredLearner)
    setScoreColumn(mode === 'score_only' ? inferredScore : '')
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      setMessage(`This CSV contains more than ${MAX_IMPORT_ROWS} data rows; no rows were imported.`)
      return
    }
    setRaw(parsed)
    let initial = applyParserErrors(validateImportedAnswers(previewResultsTabularRows(parsed, { sectionName, mode, itemCount, totalPossiblePoints: possiblePoints, mapping: { learnerColumn: inferredLearner || undefined, scoreColumn: mode === 'score_only' ? inferredScore || undefined : '' } })), parsed.errors)
    if (mode !== 'score_only' && initial.mapping.scoreColumn && Object.keys(initial.mapping.itemColumns).length > 0) initial = { ...initial, ready: false, errors: [...initial.errors, 'Both item-answer and raw-score columns were detected. Choose one format explicitly.'] }
    setItemMapping(initial.mapping.itemColumns)
    setPreview(initial)
  }

  return <section className="results-import-panel">
    {!open ? <button className="button ghost" type="button" onClick={() => setOpen(true)}><FileUp size={16} /> Import CSV / XLSX</button> : <div className="results-import-card">
      <div className="results-import-heading"><div><strong>Import results</strong><p>Upload → map → inspect → confirm. Nothing is saved until you confirm.</p></div><button className="icon-button" type="button" aria-label="Close import" onClick={() => { setOpen(false); setPreview(null); setRaw(null); setXlsxBuffer(null); setXlsxSheets([]); setXlsxWorksheet('') }}><X size={16} /></button></div>
      <label className="results-file-input">Choose CSV or XLSX<input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file) }} /></label>
      {message && <div className="form-message error">{message}</div>}
      {xlsxSheets.length > 1 && <label className="results-xlsx-sheet-picker">Worksheet<select value={xlsxWorksheet} onChange={(event) => chooseXlsxWorksheet(event.target.value)}><option value="">Choose worksheet</option>{xlsxSheets.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>}
      {raw && <div className="results-import-map">
        <label>Learner column<select value={learnerColumn} onChange={(event) => { setLearnerColumn(event.target.value); refresh(event.target.value, scoreColumn) }}><option value="">Choose column</option>{headers.map((header) => <option key={header}>{header}</option>)}</select></label>
        <label>Score column<select value={scoreColumn} onChange={(event) => { setScoreColumn(event.target.value); refresh(learnerColumn, event.target.value) }}><option value="">{mode === 'score_only' ? 'Choose score column' : 'Ignore score column'}</option>{headers.map((header) => <option key={header}>{header}</option>)}</select></label>
        <div className="results-import-map-note"><strong>{Object.keys(preview?.mapping.itemColumns ?? {}).length || itemHeaders.length}</strong> item columns mapped. Use headers like <code>1</code>, <code>Item 2</code>, or <code>Q3</code>, or map a custom header below.</div>
        <details className="results-item-mapping"><summary>Map item columns explicitly</summary><div>{headers.filter((header) => header !== learnerColumn && header !== scoreColumn).map((header) => <label key={header}>{header}<input type="number" min="1" max={itemCount} inputMode="numeric" value={itemMapping[header] ?? ''} placeholder="Ignore" onChange={(event) => { const next = { ...itemMapping }; if (!event.target.value) delete next[header]; else next[header] = Number(event.target.value); setItemMapping(next); refresh(learnerColumn, scoreColumn, next) }} /></label>)}</div></details>
      </div>}
      {preview && <>
        <div className={`results-import-status ${preview.ready ? 'ready' : 'blocked'}`}><span>{preview.ready ? <Check size={15} /> : <X size={15} />}</span><strong>{preview.ready ? `${preview.rows.length} rows ready` : 'Correction needed'}</strong><small>{preview.errors[0] || preview.warnings[0] || 'Review the preview before saving.'}</small></div>
        <div className="results-import-preview" aria-label="Results import preview">
          {preview.rows.slice(0, 8).map((row) => <div className="results-import-row" key={row.rowNumber}><span>{row.rowNumber}</span><strong>{row.learnerKey || 'Unnamed'}</strong><span className={`results-row-status ${row.status}`}>{row.status}</span><small>{row.messages[0] || 'Ready'}</small></div>)}
          {preview.rows.length > 8 && <small className="results-preview-more">Showing first 8 rows of {preview.rows.length}.</small>}
        </div>
        <div className="results-import-actions"><button className="button ghost" type="button" onClick={() => { setPreview(null); setRaw(null) }}>Start over</button><button className="button primary" type="button" disabled={!preview.ready} onClick={() => { const accepted = onConfirm(preview); if (accepted !== false) setOpen(false) }}><Check size={15} /> Confirm import</button></div>
      </>}
    </div>}
  </section>
}
