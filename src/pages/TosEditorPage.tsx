import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, ChevronUp, CircleAlert, FileDown, Plus, Save, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { createBlankTos, createTosCompetencyRow, recalculateTosContent } from '../lib/tosFactory'
import { validateTos } from '../lib/tosValidation'
import { loadCurriculumNavigator, loadSchoolYearCalendar } from '../lib/repository'
import { loadTosDocument, loadVerifiedInstructionalPacing, saveTosDocument } from '../lib/tosRepository'
import type { CurriculumNavigatorBundle, SchoolYearCalendar } from '../types/curriculum'
import type { InstructionalPacingBundle, TosContent, TosRecord } from '../types/tos'

function sameVerifiedSnapshot(
  row: TosContent['rows'][number],
  competency: CurriculumNavigatorBundle['competencies'][number],
) {
  return competency.verificationStatus === 'verified'
    && competency.competencyText === row.competency.text
    && competency.sourcePage === row.competency.sourcePage
}

export function TosEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, assignments, isDemo } = useApp()
  const requestedAssignment = searchParams.get('assignment') ?? ''
  const requestedCompetency = searchParams.get('competency') ?? ''
  const [assignmentId, setAssignmentId] = useState(requestedAssignment || assignments[0]?.id || '')
  const [record, setRecord] = useState<TosRecord | null>(null)
  const [bundle, setBundle] = useState<CurriculumNavigatorBundle | null>(null)
  const [calendar, setCalendar] = useState<SchoolYearCalendar | null>(null)
  const [pacing, setPacing] = useState<InstructionalPacingBundle>({ available: false, planId: null, planTitle: null, entries: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [validationDetailsOpen, setValidationDetailsOpen] = useState(false)
  const [totalItemsInput, setTotalItemsInput] = useState('40')
  const preselectedRef = useRef(false)
  const assignment = assignments.find((item) => item.id === assignmentId) ?? null
  const readOnly = record?.status !== 'draft'

  useEffect(() => {
    if (record) setTotalItemsInput(String(record.content.totalItems))
  }, [record?.id, record?.content.totalItems])

  useEffect(() => {
    if (!user || !assignments.length) return
    let active = true
    setLoading(true)
    const initialize = async () => {
      if (!isNew && id) {
        const existing = await loadTosDocument(id, user.id, isDemo)
        if (!existing) throw new Error('This TOS was not found or you do not have access to it.')
        if (!active) return
        setRecord(existing)
        setAssignmentId(existing.assignmentId ?? assignments[0].id)
      } else {
        const target = assignments.find((item) => item.id === (requestedAssignment || assignmentId)) ?? assignments[0]
        if (!active) return
        setAssignmentId(target.id)
        setRecord(createBlankTos(user.id, target))
      }
    }
    void initialize().catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to open the TOS editor.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, isNew, user?.id, isDemo])

  useEffect(() => {
    if (!assignment) return
    let active = true
    Promise.all([
      loadCurriculumNavigator(assignment.schoolYear, assignment.gradeLevel, assignment.learningArea, isDemo, assignment.curriculumVersionId),
      loadSchoolYearCalendar(assignment.schoolYear, isDemo),
    ]).then(async ([nextBundle, nextCalendar]) => {
      if (!active) return
      setBundle(nextBundle)
      setCalendar(nextCalendar)
      const nextPacing = nextBundle.subject ? await loadVerifiedInstructionalPacing(assignment.schoolYear, nextBundle.subject.id, isDemo) : { available: false, planId: null, planTitle: null, entries: [] }
      if (active) setPacing(nextPacing)
      setRecord((current) => {
        if (!current || current.status !== 'draft' || !nextBundle.available || !nextBundle.version || !nextBundle.subject) return current
        const content = { ...current.content }
        content.curriculumVersionId = nextBundle.version.id
        content.curriculumVersionCode = nextBundle.version.code
        content.curriculumVersionName = nextBundle.version.name
        content.curriculumSubjectId = nextBundle.subject.id
        content.sourceTitle = nextBundle.source?.title ?? ''
        content.sourceUrl = nextBundle.source?.sourceUrl ?? ''
        const periodsBySavedLabel = nextBundle.periods.filter((period) => content.curriculumPeriodLabels.includes(period.label))
        if (periodsBySavedLabel.length) {
          content.curriculumPeriodIds = periodsBySavedLabel.map((period) => period.id)
          content.curriculumPeriodLabels = periodsBySavedLabel.map((period) => period.label)
        } else if (!content.curriculumPeriodIds.length) {
          const first = nextBundle.periods[0]
          content.curriculumPeriodIds = first ? [first.id] : []
          content.curriculumPeriodLabels = first ? [first.label] : []
        }
        content.rows = content.rows.map((row) => {
          const verified = nextBundle.competencies.find((item) => item.id === row.competency.id && sameVerifiedSnapshot(row, item))
            ?? nextBundle.competencies.find((item) => sameVerifiedSnapshot(row, item))
          if (!verified) return row
          const period = nextBundle.periods.find((item) => item.id === verified.academicPeriodId)
          return {
            ...row,
            competency: {
              ...row.competency,
              id: verified.id,
              code: verified.competencyCode,
              text: verified.competencyText,
              sourcePage: verified.sourcePage,
              academicPeriodId: verified.academicPeriodId,
              curriculumPeriodLabel: period?.label ?? row.competency.curriculumPeriodLabel,
            },
          }
        })
        if (requestedCompetency && !preselectedRef.current) {
          const competency = nextBundle.competencies.find((item) => item.id === requestedCompetency)
          if (competency) {
            const period = nextBundle.periods.find((item) => item.id === competency.academicPeriodId)
            if (period) {
              content.curriculumPeriodIds = [period.id]
              content.curriculumPeriodLabels = [period.label]
            }
            content.rows = [createTosCompetencyRow(competency, nextBundle, content.cognitiveCategories, 1)]
            preselectedRef.current = true
          }
        }
        return { ...current, content: recalculateTosContent(content) }
      })
    }).catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to load verified curriculum context.') })
    return () => { active = false }
  }, [assignmentId, isDemo])

  const validation = useMemo(() => record ? validateTos(record.content, bundle) : null, [record, bundle])
  const visibleCompetencies = useMemo(() => {
    if (!record || !bundle) return []
    const selectedPeriods = new Set(record.content.curriculumPeriodIds)
    const needle = search.trim().toLocaleLowerCase('en')
    return bundle.competencies.filter((item) => selectedPeriods.has(item.academicPeriodId ?? '') && (!needle || item.competencyText.toLocaleLowerCase('en').includes(needle) || item.competencyCode?.toLocaleLowerCase('en').includes(needle)))
  }, [bundle, record?.content.curriculumPeriodIds, search])

  function updateContent(update: (content: TosContent) => void) {
    if (readOnly) return
    setSavedMessage('')
    setRecord((current) => {
      if (!current) return current
      const content = structuredClone(current.content)
      update(content)
      return { ...current, title: content.title, schoolYear: content.schoolYear, academicPeriodLabel: content.gradingTermLabel || null, content: recalculateTosContent(content) }
    })
  }

  function changeAssignment(nextId: string) {
    if (!user) return
    const next = assignments.find((item) => item.id === nextId)
    if (!next) return
    setAssignmentId(next.id)
    setBundle(null)
    setCalendar(null)
    setPacing({ available: false, planId: null, planTitle: null, entries: [] })
    preselectedRef.current = false
    setRecord(createBlankTos(user.id, next))
  }

  function togglePeriod(periodId: string) {
    if (!bundle) return
    updateContent((content) => {
      const selected = content.curriculumPeriodIds.includes(periodId)
      if (selected && content.curriculumPeriodIds.length === 1) return
      const nextIds = selected ? content.curriculumPeriodIds.filter((item) => item !== periodId) : [...content.curriculumPeriodIds, periodId]
      content.curriculumPeriodIds = nextIds
      const nextLabels = bundle.periods.filter((item) => nextIds.includes(item.id)).map((item) => item.label)
      content.curriculumPeriodLabels = nextLabels
      content.rows = content.rows.filter((row) => nextIds.includes(row.competency.academicPeriodId ?? '') || nextLabels.includes(row.competency.curriculumPeriodLabel))
    })
  }

  function toggleCompetency(competencyId: string) {
    if (!bundle) return
    updateContent((content) => {
      const selectedCompetency = bundle.competencies.find((item) => item.id === competencyId)
      const existingIndex = content.rows.findIndex((row) => row.competency.id === competencyId
        || Boolean(selectedCompetency && sameVerifiedSnapshot(row, selectedCompetency)))
      if (existingIndex >= 0) content.rows.splice(existingIndex, 1)
      else {
        const competency = selectedCompetency
        if (!competency) return
        const pacingEntry = pacing.entries.find((entry) => entry.competencyId === competency.id) ?? null
        content.rows.push(createTosCompetencyRow(competency, bundle, content.cognitiveCategories, content.rows.length + 1, pacingEntry))
      }
      content.rows.forEach((row, index) => { row.sortOrder = index + 1 })
    })
  }

  function moveRow(index: number, direction: -1 | 1) {
    updateContent((content) => {
      const destination = index + direction
      if (destination < 0 || destination >= content.rows.length) return
      const [row] = content.rows.splice(index, 1)
      content.rows.splice(destination, 0, row)
      content.rows.forEach((item, rowIndex) => { item.sortOrder = rowIndex + 1 })
    })
  }

  function addCategory() {
    updateContent((content) => {
      const id = crypto.randomUUID()
      content.cognitiveCategories.push({ id, label: 'New category', shortLabel: 'N', weight: '1', sortOrder: content.cognitiveCategories.length + 1 })
      content.rows.forEach((row) => { row.cognitiveWeights[id] = '1' })
    })
  }

  function removeCategory(id: string) {
    updateContent((content) => {
      if (content.cognitiveCategories.length === 1) return
      content.cognitiveCategories = content.cognitiveCategories.filter((item) => item.id !== id).map((item, index) => ({ ...item, sortOrder: index + 1 }))
      content.rows.forEach((row) => { delete row.cognitiveWeights[id] })
    })
  }

  function stagedTotalItems() {
    const parsed = totalItemsInput.trim() === '' ? 0 : Number(totalItemsInput)
    return Number.isFinite(parsed) ? parsed : 0
  }

  async function persist(status: 'draft' | 'final') {
    if (!record) return
    const content = recalculateTosContent({ ...record.content, totalItems: stagedTotalItems() })
    const checked = validateTos(content, bundle)
    if (status === 'final' && !checked.ready) {
      setError('Resolve the validation errors before finalizing this TOS.')
      document.getElementById('tos-validation')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSaving(true)
    setError('')
    try {
      const saved = await saveTosDocument({ ...record, status, content, title: content.title, schoolYear: content.schoolYear, academicPeriodLabel: content.gradingTermLabel || null }, isDemo)
      setRecord(saved)
      setSavedMessage(status === 'final' ? 'TOS finalized. Its content and allocations are now locked.' : `Draft saved · version ${saved.versionNumber}`)
      if (!record.id) navigate(`/tos/${saved.id}`, { replace: true })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save this TOS.')
    } finally {
      setSaving(false)
    }
  }

  if (!assignments.length) return <><PageHeader eyebrow="Assessment planning" title="TOS Builder" description="Create a verified, mathematically reconciled Table of Specifications." /><EmptyState icon={ShieldCheck} title="Add a teaching assignment first" description="TOS documents are tied to your real grade level, learning area, sections, and school year." /></>
  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Opening TOS builder…</strong></div>
  if (!record) return <EmptyState icon={CircleAlert} title="TOS unavailable" description={error || 'The document could not be opened.'} />

  return <>
    <PageHeader eyebrow="Assessment planning · Phase 4" title={record.status === 'draft' ? (isNew ? 'New TOS' : 'Edit TOS') : 'Final TOS'} description="Verified curriculum coverage, teacher-controlled weighting, and deterministic item placement." actions={<div className="tos-header-actions"><Link className="button ghost" to="/tos"><ArrowLeft size={16} /> All TOS</Link>{record.id && <Link className="button ghost" to={`/tos/${record.id}/print`}><FileDown size={16} /> Export</Link>}</div>} />
    {readOnly && <div className="tos-locked panel"><ShieldCheck size={19} /><div><strong>This TOS is final and locked.</strong><p>Duplicate it from the TOS list to make a new editable draft.</p></div></div>}
    {error && <div className="form-error"><CircleAlert size={16} /> {error}</div>}
    {savedMessage && <div className="form-success"><Check size={16} /> {savedMessage}</div>}

    <div className="tos-editor-grid">
      <main className="tos-editor-main">
        <section className="panel tos-section">
          <div className="tos-section-heading"><span>1</span><div><h2>Assessment context</h2><p>School grading term and curriculum-guide period stay separate.</p></div></div>
          <div className="form-grid two-column">
            <label>Teaching assignment<select disabled={readOnly} value={assignmentId} onChange={(event) => changeAssignment(event.target.value)}>{assignments.map((item) => <option value={item.id} key={item.id}>{item.gradeLevel} · {item.learningArea} · {item.schoolYear}</option>)}</select></label>
            <label>TOS title<input disabled={readOnly} value={record.content.title} onChange={(event) => updateContent((content) => { content.title = event.target.value })} placeholder="e.g. Term 1 Mathematics TOS" /></label>
            <label>Assessment title <small>(optional)</small><input disabled={readOnly} value={record.content.assessmentTitle} onChange={(event) => updateContent((content) => { content.assessmentTitle = event.target.value })} placeholder="e.g. First Summative Test" /></label>
            <label>Total test items<input disabled={readOnly} type="number" inputMode="numeric" min="0" max="10000" value={totalItemsInput} onChange={(event) => setTotalItemsInput(event.target.value)} onBlur={() => updateContent((content) => { content.totalItems = stagedTotalItems() })} /></label>
          </div>
          <div className="tos-context-choices">
            <fieldset><legend>School grading term</legend><p>Reporting calendar</p><div className="choice-row">{calendar?.periods.map((period) => <button aria-pressed={record.content.gradingTermId === period.id} disabled={readOnly} className={`choice-chip ${record.content.gradingTermId === period.id ? 'selected' : ''}`} type="button" key={period.id} onClick={() => updateContent((content) => { content.gradingTermId = period.id; content.gradingTermLabel = period.label })}>{period.label}</button>) ?? <span className="muted-copy">No verified grading calendar is loaded.</span>}</div></fieldset>
            <fieldset><legend>Curriculum-guide period</legend><p>Source sequence; not automatically mapped to the term</p><div className="choice-row">{bundle?.periods.map((period) => <button aria-pressed={record.content.curriculumPeriodIds.includes(period.id)} disabled={readOnly} className={`choice-chip ${record.content.curriculumPeriodIds.includes(period.id) ? 'selected' : ''}`} type="button" key={period.id} onClick={() => togglePeriod(period.id)}>{record.content.curriculumPeriodIds.includes(period.id) && <Check size={13} />}{period.label}</button>)}</div></fieldset>
          </div>
        </section>

        <section className="panel tos-section">
          <div className="tos-section-heading"><span>2</span><div><h2>Verified competencies</h2><p>Select only the competencies actually covered for this assessment.</p></div></div>
          {!bundle?.available ? <div className="tos-inline-warning"><CircleAlert size={17} /> No verified curriculum bundle is available for this assignment.</div> : <div className="tos-competency-picker">
            <button aria-controls="tos-competency-options" aria-expanded={pickerOpen} aria-haspopup="listbox" className={`competency-picker-trigger ${pickerOpen ? 'open' : ''}`} disabled={readOnly} type="button" onClick={() => setPickerOpen((value) => !value)}><span>{record.content.rows.length ? `${record.content.rows.length} verified competenc${record.content.rows.length === 1 ? 'y' : 'ies'} selected` : 'Choose verified competencies'}</span><ChevronDown size={17} /></button>
            {pickerOpen && <div className="competency-picker-panel"><label className="tos-picker-search"><Search size={15} /><span className="sr-only">Search verified competencies</span><input aria-label="Search verified competencies" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code or competency" /></label><div className="competency-picker-summary"><span>{visibleCompetencies.length} in selected curriculum period(s)</span><button type="button" onClick={() => setPickerOpen(false)}>Done</button></div><div aria-multiselectable="true" className="competency-picker-list" id="tos-competency-options" role="listbox">{visibleCompetencies.map((competency) => { const selected = record.content.rows.some((row) => row.competency.id === competency.id || sameVerifiedSnapshot(row, competency)); return <button aria-selected={selected} className={`competency-picker-option ${selected ? 'selected' : ''}`} role="option" type="button" key={competency.id} onClick={() => toggleCompetency(competency.id)}><span className="competency-picker-number">{selected ? <Check size={15} /> : competency.sortOrder}</span><span className="competency-picker-copy"><small>{competency.competencyCode || 'Verified competency'}{competency.sourcePage ? ` · source p. ${competency.sourcePage}` : ''}</small><strong>{competency.competencyText}</strong></span></button>})}{!visibleCompetencies.length && <div className="competency-picker-empty">No verified competencies match this period and search.</div>}</div></div>}
          </div>}
        </section>

        <section className="panel tos-section">
          <div className="tos-section-heading"><span>3</span><div><h2>Weighting and item allocation</h2><p>Choose a starting method. Manual item overrides remain available.</p></div></div>
          <div className="tos-method-options">{[
            ['equal', 'Equal weighting', 'Fast starting point across selected competencies.'],
            ['instructional_time', 'Instructional time', pacing.available ? `Uses available verified pacing from ${pacing.planTitle}.` : 'Enter actual minutes for each competency.'],
            ['manual_percentage', 'Manual percentage', 'Enter teacher-controlled weights totaling exactly 100%.'],
          ].map(([method, label, detail]) => <button aria-pressed={record.content.weightingMethod === method} disabled={readOnly} className={record.content.weightingMethod === method ? 'selected' : ''} type="button" key={method} onClick={() => updateContent((content) => { content.weightingMethod = method as TosContent['weightingMethod'] })}><strong>{label}</strong><small>{detail}</small></button>)}</div>

          <div className="tos-row-list">{record.content.rows.map((row, index) => <article className="tos-row-card" key={row.id}>
            <header><span className="tos-row-number">{index + 1}</span><div><small>{row.competency.code || row.competency.curriculumPeriodLabel || 'Verified competency'}</small><strong>{row.competency.text}</strong></div>{!readOnly && <div className="tos-row-tools"><button type="button" disabled={index === 0} onClick={() => moveRow(index, -1)} aria-label="Move up"><ArrowUp size={15} /></button><button type="button" disabled={index === record.content.rows.length - 1} onClick={() => moveRow(index, 1)} aria-label="Move down"><ArrowDown size={15} /></button><button type="button" onClick={() => updateContent((content) => { content.rows.splice(index, 1) })} aria-label="Remove competency"><Trash2 size={15} /></button></div>}</header>
            <div className="tos-row-allocation">
              {record.content.weightingMethod === 'instructional_time' && <label>Minutes taught<input disabled={readOnly} inputMode="decimal" value={row.instructionalMinutes} onChange={(event) => updateContent((content) => { content.rows[index].instructionalMinutes = event.target.value })} placeholder="0" /></label>}
              {record.content.weightingMethod === 'manual_percentage' && <label>Manual weight %<input disabled={readOnly} inputMode="decimal" value={row.manualWeight} onChange={(event) => updateContent((content) => { content.rows[index].manualWeight = event.target.value })} placeholder="0" /></label>}
              {record.content.weightingMethod === 'equal' && <div className="tos-readout"><small>Source weight</small><strong>Equal</strong></div>}
              <label>Item override <small>(optional)</small><input disabled={readOnly} inputMode="numeric" value={row.itemCountOverride} onChange={(event) => updateContent((content) => { content.rows[index].itemCountOverride = event.target.value })} placeholder="Auto" /></label>
              <div className="tos-readout"><small>Computed weight</small><strong>{row.computedWeightPercent}%</strong></div><div className="tos-readout"><small>Items</small><strong>{row.itemCount}</strong></div><div className="tos-readout range"><small>Placement</small><strong>{row.itemRangeLabel || '—'}</strong></div>
            </div>
            <button aria-controls={`tos-row-details-${row.id}`} aria-expanded={expandedRows.has(row.id)} className="tos-expand-button" type="button" onClick={() => setExpandedRows((current) => { const next = new Set(current); next.has(row.id) ? next.delete(row.id) : next.add(row.id); return next })}><span>Cognitive allocation and notes</span>{expandedRows.has(row.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
            {expandedRows.has(row.id) && <div className="tos-row-details" id={`tos-row-details-${row.id}`}><div className="tos-cognitive-inputs">{record.content.cognitiveCategories.map((category) => <label key={category.id}><span>{category.shortLabel} · {category.label}</span><input disabled={readOnly} inputMode="decimal" value={row.cognitiveWeights[category.id] ?? category.weight} onChange={(event) => updateContent((content) => { content.rows[index].cognitiveWeights[category.id] = event.target.value })} /><small>{row.cognitiveAllocations.find((item) => item.categoryId === category.id)?.itemCount ?? 0} item(s) · {row.cognitiveAllocations.find((item) => item.categoryId === category.id)?.rangeLabel || '—'}</small></label>)}</div><label>Row notes<textarea disabled={readOnly} rows={2} value={row.notes} onChange={(event) => updateContent((content) => { content.rows[index].notes = event.target.value })} placeholder="Optional school-specific note" /></label></div>}
          </article>)}</div>
          {!record.content.rows.length && <div className="tos-empty-rows">Choose verified competencies above to begin allocating items.</div>}
        </section>

        <section className="panel tos-section">
          <div className="tos-section-heading"><span>4</span><div><h2>Cognitive categories</h2><p>Labels are configurable so the saved model can adapt to school-specific TOS formats.</p></div></div>
          <div className="tos-category-list">{record.content.cognitiveCategories.map((category, index) => <div className="tos-category-row" key={category.id}><label>Label<input disabled={readOnly} value={category.label} onChange={(event) => updateContent((content) => { content.cognitiveCategories[index].label = event.target.value })} /></label><label>Short label<input disabled={readOnly} value={category.shortLabel} onChange={(event) => updateContent((content) => { content.cognitiveCategories[index].shortLabel = event.target.value })} /></label><label>Default relative weight<input disabled={readOnly} inputMode="decimal" value={category.weight} onChange={(event) => updateContent((content) => { content.cognitiveCategories[index].weight = event.target.value })} /></label>{!readOnly && <button className="icon-button danger" disabled={record.content.cognitiveCategories.length === 1} type="button" onClick={() => removeCategory(category.id)} aria-label={`Remove ${category.label}`}><X size={16} /></button>}</div>)}</div>
          {!readOnly && <button className="button ghost" type="button" onClick={addCategory}><Plus size={15} /> Add category</button>}
          <label className="tos-notes-field">TOS notes<textarea disabled={readOnly} rows={4} value={record.content.notes} onChange={(event) => updateContent((content) => { content.notes = event.target.value })} placeholder="Optional notes for reviewers or signatories" /></label>
        </section>
      </main>

      <aside className={`tos-editor-side ${validationDetailsOpen ? 'issues-open' : ''}`}>
        <section className={`panel tos-validation-card ${validation?.ready ? 'ready' : ''}`} id="tos-validation">
          <div className="tos-validation-total"><span>{record.content.calculation.totalAllocated}</span><small>of {record.content.totalItems} items allocated</small></div>
          <div className="tos-progress"><span style={{ width: `${record.content.totalItems > 0 ? Math.min(100, (record.content.calculation.totalAllocated / record.content.totalItems) * 100) : 0}%` }} /></div>
          <strong>{validation?.ready ? 'Ready to finalize' : `${validation?.errors.length ?? 0} issue${validation?.errors.length === 1 ? '' : 's'} to resolve`}</strong>
          {Boolean((validation?.errors.length ?? 0) + (validation?.warnings.length ?? 0)) && <button aria-expanded={validationDetailsOpen} className="tos-validation-mobile-toggle" type="button" onClick={() => setValidationDetailsOpen((value) => !value)}>{validationDetailsOpen ? 'Hide details' : 'Review issues'}</button>}
          <div className={`tos-validation-issues ${validationDetailsOpen ? 'mobile-open' : ''}`}>{validation?.errors.slice(0, 8).map((item) => <p key={item.key}><CircleAlert size={13} />{item.message}</p>)}{validation?.warnings.map((item) => <p className="warning" key={item.key}><CircleAlert size={13} />{item.message}</p>)}</div>
        </section>
        {!readOnly && <section className="panel tos-save-card"><button className="button secondary" disabled={saving} type="button" onClick={() => void persist('draft')}><Save size={16} /> {saving ? 'Saving…' : 'Save draft'}</button><button className="button primary" disabled={saving || !validation?.ready} type="button" onClick={() => void persist('final')}><ShieldCheck size={16} /> Finalize TOS</button><small>Finalizing locks this version. Duplicate it later to create an editable copy.</small></section>}
      </aside>
    </div>
  </>
}
