import {
  Archive,
  CheckCircle2,
  FileText,
  Layers3,
  PencilLine,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { GRADE_LEVELS, SCHOOL_YEARS } from '../data/constants'
import {
  analyzeCustomCurriculumImport,
  archiveCustomCurriculum,
  createCustomCurriculumImport,
  deleteCustomCurriculumImport,
  listCustomCurriculumImports,
  publishCustomCurriculum,
  saveCustomCurriculumReview,
} from '../lib/customCurriculumRepository'
import {
  inspectCurriculumFile,
  normalizeCustomCurriculumReview,
  sha256Text,
  validateCustomCurriculumReview,
} from '../lib/curriculumImport'
import {
  createManualCurriculumReview,
  type CustomCurriculumImport,
  type CustomCurriculumMode,
  type CustomCurriculumReview,
  type CustomCurriculumSourceKind,
} from '../types/customCurriculum'

type Props = {
  userId: string
  isDemo: boolean
  schoolName: string
  defaultSchoolYear: string
  defaultGradeLevel?: string | null
  defaultLearningArea?: string | null
  baseCurriculumVersionId?: string | null
  baseCurriculumLabel?: string | null
  onPublished?: () => Promise<void> | void
}

type CreationDraft = {
  sourceKind: CustomCurriculumSourceKind
  curriculumMode: CustomCurriculumMode
  title: string
  organizationName: string
  schoolYear: string
  gradeLevel: string
  learningArea: string
  pastedText: string
  file: File | null
}

const createDraft = (props: Props): CreationDraft => ({
  sourceKind: 'upload',
  curriculumMode: 'custom',
  title: '',
  organizationName: props.schoolName,
  schoolYear: props.defaultSchoolYear,
  gradeLevel: props.defaultGradeLevel || 'Grade 7',
  learningArea: props.defaultLearningArea || 'Mathematics',
  pastedText: '',
  file: null,
})

function lines(value: string) {
  return value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean)
}

function periodsToText(review: CustomCurriculumReview) {
  return review.periods.map((item) => `${item.key} || ${item.label} || ${item.periodType}`).join('\n')
}

function domainsToText(review: CustomCurriculumReview) {
  return review.domains.map((item) => `${item.key} || ${item.code ?? ''} || ${item.name}`).join('\n')
}

function standardsToText(review: CustomCurriculumReview) {
  return review.standards.map((item) => `${item.standardType} || ${item.standardText} || ${item.periodKey ?? ''} || ${item.domainKey ?? ''} || ${item.sourcePage ?? ''}`).join('\n')
}

function competenciesToText(review: CustomCurriculumReview) {
  return review.competencies.map((item) => `${item.competencyCode ?? ''} || ${item.competencyText} || ${item.periodKey ?? ''} || ${item.domainKey ?? ''} || ${item.sourcePage ?? ''}`).join('\n')
}

function reviewFromTextFields(
  review: CustomCurriculumReview,
  values: { periods: string; domains: string; standards: string; competencies: string },
) {
  const periods = lines(values.periods).map((line, index) => {
    const [key = '', label = '', periodType = 'quarter'] = line.split('||').map((item) => item.trim())
    return { key: key || `period-${index + 1}`, label: label || key || `Period ${index + 1}`, sequence: index + 1, periodType: (['term', 'quarter', 'semester', 'year'].includes(periodType) ? periodType : 'quarter') as CustomCurriculumReview['periods'][number]['periodType'] }
  })
  const domains = lines(values.domains).map((line, index) => {
    const [key = '', code = '', name = ''] = line.split('||').map((item) => item.trim())
    return { key: key || `domain-${index + 1}`, code: code || null, name: name || key || `Domain ${index + 1}`, sortOrder: index }
  })
  const periodKeys = new Set(periods.map((item) => item.key))
  const domainKeys = new Set(domains.map((item) => item.key))
  const standards = lines(values.standards).map((line, index) => {
    const [standardType = 'other', standardText = '', periodKey = '', domainKey = '', sourcePage = ''] = line.split('||').map((item) => item.trim())
    const page = Number(sourcePage)
    return {
      standardType: (['content', 'performance', 'stage', 'key_stage', 'other'].includes(standardType) ? standardType : 'other') as CustomCurriculumReview['standards'][number]['standardType'],
      standardText,
      periodKey: periodKey && periodKeys.has(periodKey) ? periodKey : null,
      domainKey: domainKey && domainKeys.has(domainKey) ? domainKey : null,
      sortOrder: index,
      sourcePage: Number.isInteger(page) && page > 0 ? page : null,
    }
  }).filter((item) => item.standardText)
  const competencies = lines(values.competencies).map((line, index) => {
    const [competencyCode = '', competencyText = '', periodKey = '', domainKey = '', sourcePage = ''] = line.split('||').map((item) => item.trim())
    const page = Number(sourcePage)
    return {
      competencyCode: competencyCode || null,
      competencyText,
      periodKey: periodKey && periodKeys.has(periodKey) ? periodKey : null,
      domainKey: domainKey && domainKeys.has(domainKey) ? domainKey : null,
      sortOrder: index,
      sourcePage: Number.isInteger(page) && page > 0 ? page : null,
    }
  }).filter((item) => item.competencyText)
  return normalizeCustomCurriculumReview({ ...review, periods, domains, standards, competencies }, review)
}

export function CustomCurriculumPanel(props: Props) {
  const [imports, setImports] = useState<CustomCurriculumImport[]>([])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CreationDraft>(() => createDraft(props))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CustomCurriculumImport | null>(null)
  const [review, setReview] = useState<CustomCurriculumReview | null>(null)
  const [periodText, setPeriodText] = useState('')
  const [domainText, setDomainText] = useState('')
  const [standardText, setStandardText] = useState('')
  const [competencyText, setCompetencyText] = useState('')

  async function refresh() {
    if (props.isDemo) return
    setImports(await listCustomCurriculumImports(props.userId))
  }

  useEffect(() => { void refresh().catch(() => {}) }, [props.userId, props.isDemo])

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      organizationName: current.organizationName || props.schoolName,
      schoolYear: current.schoolYear || props.defaultSchoolYear,
      gradeLevel: current.gradeLevel || props.defaultGradeLevel || 'Grade 7',
      learningArea: current.learningArea || props.defaultLearningArea || 'Mathematics',
    }))
  }, [props.schoolName, props.defaultSchoolYear, props.defaultGradeLevel, props.defaultLearningArea])

  function openReview(item: CustomCurriculumImport) {
    const next = item.review ?? item.analysis
    if (!next) return
    setEditing(item)
    setReview(structuredClone(next))
    setPeriodText(periodsToText(next))
    setDomainText(domainsToText(next))
    setStandardText(standardsToText(next))
    setCompetencyText(competenciesToText(next))
    setError(null)
    setMessage(null)
  }

  function closeReview() {
    setEditing(null)
    setReview(null)
    setPeriodText('')
    setDomainText('')
    setStandardText('')
    setCompetencyText('')
  }

  function materializedReview() {
    if (!review) throw new Error('No curriculum draft is open.')
    return reviewFromTextFields(review, { periods: periodText, domains: domainText, standards: standardText, competencies: competencyText })
  }

  async function create() {
    if (props.isDemo) return
    setBusy(true); setError(null); setMessage(null)
    try {
      if (!draft.title.trim()) throw new Error('Give the curriculum a title.')
      if (!draft.organizationName.trim()) throw new Error('Add the school or organization name.')
      if (draft.curriculumMode === 'hybrid' && !props.baseCurriculumVersionId) {
        throw new Error('Choose an official teaching assignment in Curriculum Navigator before creating a DepEd + school enrichment curriculum.')
      }

      const id = crypto.randomUUID()
      let sourceHash = ''
      let mimeType: string | null = null
      let extractedText: string | null = null
      let file: File | null = null
      let initialReview: CustomCurriculumReview | null = null

      if (draft.sourceKind === 'upload') {
        if (!draft.file) throw new Error('Choose a curriculum file first.')
        const inspected = await inspectCurriculumFile(draft.file)
        sourceHash = inspected.sourceHash
        mimeType = inspected.mimeType
        extractedText = inspected.extractedText
        file = draft.file
      } else if (draft.sourceKind === 'paste') {
        const pasted = draft.pastedText.normalize('NFKC').trim()
        if (pasted.length < 20) throw new Error('Paste enough curriculum text to analyze.')
        if (pasted.length > 350_000) throw new Error('Pasted curriculum text is too large. Upload the source document instead.')
        sourceHash = await sha256Text(pasted)
        mimeType = 'text/plain'
        extractedText = pasted
      } else {
        initialReview = createManualCurriculumReview({
          mode: draft.curriculumMode,
          title: draft.title.trim(),
          organizationName: draft.organizationName.trim(),
          schoolYear: draft.schoolYear,
          gradeLevel: draft.gradeLevel,
          learningArea: draft.learningArea,
        })
        sourceHash = await sha256Text(JSON.stringify(initialReview))
      }

      let created = await createCustomCurriculumImport({
        id,
        userId: props.userId,
        sourceKind: draft.sourceKind,
        curriculumMode: draft.curriculumMode,
        baseCurriculumVersionId: draft.curriculumMode === 'hybrid' ? props.baseCurriculumVersionId ?? null : null,
        title: draft.title.trim(),
        organizationName: draft.organizationName.trim(),
        schoolYear: draft.schoolYear,
        gradeLevel: draft.gradeLevel,
        learningArea: draft.learningArea,
        file,
        mimeType,
        sourceHash,
        initialReview,
      })

      if (draft.sourceKind !== 'manual') {
        const analyzed = await analyzeCustomCurriculumImport(created.id, extractedText)
        created = { ...created, status: 'analyzed', analysis: analyzed, review: analyzed }
        setMessage(`AI prepared a draft with ${analyzed.competencies.length} competency/objective records. Review it before approval.`)
      } else {
        setMessage('Manual curriculum draft created. Add competencies/objectives, then approve it.')
      }

      await refresh()
      setOpen(false)
      setDraft(createDraft(props))
      openReview(created)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create this curriculum draft.')
    } finally { setBusy(false) }
  }

  async function saveReview() {
    if (!editing) return
    setBusy(true); setError(null); setMessage(null)
    try {
      const next = materializedReview()
      const saved = await saveCustomCurriculumReview(editing.id, props.userId, next)
      setEditing(saved)
      setReview(saved.review ?? next)
      setMessage('Draft review saved. Nothing has been published yet.')
      await refresh()
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to save this curriculum review.') }
    finally { setBusy(false) }
  }

  async function approve() {
    if (!editing) return
    setBusy(true); setError(null); setMessage(null)
    try {
      const next = materializedReview()
      const validation = validateCustomCurriculumReview(next)
      if (validation.length) throw new Error(validation[0])
      await saveCustomCurriculumReview(editing.id, props.userId, next)
      await publishCustomCurriculum(editing.id, next)
      await refresh()
      await props.onPublished?.()
      closeReview()
      setMessage('Curriculum approved and published privately. It is now available when adding a class assignment.')
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to approve this curriculum.') }
    finally { setBusy(false) }
  }

  async function newRevision(item: CustomCurriculumImport) {
    if (!item.publishedVersionId || !item.review) return
    setBusy(true); setError(null); setMessage(null)
    try {
      const id = crypto.randomUUID()
      const nextReview = structuredClone(item.review)
      nextReview.warnings = [...nextReview.warnings, 'Revision draft created from the previously approved version. Review every change before publishing.']
      const sourceHash = await sha256Text(JSON.stringify(nextReview))
      const created = await createCustomCurriculumImport({
        id,
        userId: props.userId,
        sourceKind: 'manual',
        curriculumMode: item.curriculumMode,
        baseCurriculumVersionId: item.baseCurriculumVersionId,
        revisionOfVersionId: item.publishedVersionId,
        title: item.title,
        organizationName: item.organizationName,
        schoolYear: item.schoolYear,
        gradeLevel: item.gradeLevel,
        learningArea: item.learningArea,
        sourceHash,
        initialReview: nextReview,
      })
      await refresh()
      openReview(created)
      setMessage('Revision draft created from the approved version. The current published curriculum remains active until you approve this revision.')
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to create a curriculum revision.') }
    finally { setBusy(false) }
  }

  async function remove(item: CustomCurriculumImport) {
    if (!window.confirm(`Delete the draft “${item.title || item.originalFilename || 'Curriculum'}”?`)) return
    setBusy(true); setError(null)
    try { await deleteCustomCurriculumImport(item); await refresh(); if (editing?.id === item.id) closeReview() }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to delete this draft.') }
    finally { setBusy(false) }
  }

  async function archive(item: CustomCurriculumImport) {
    if (!item.publishedVersionId || !window.confirm(`Archive “${item.title}”? Existing documents keep their saved curriculum snapshot, but new classes should use another active version.`)) return
    setBusy(true); setError(null)
    try { await archiveCustomCurriculum(item.publishedVersionId); setMessage('Curriculum version archived.'); await refresh(); await props.onPublished?.() }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to archive this curriculum.') }
    finally { setBusy(false) }
  }

  const reviewValidation = useMemo(() => {
    if (!review) return []
    try { return validateCustomCurriculumReview(materializedReview()) } catch (nextError) { return [nextError instanceof Error ? nextError.message : 'Review is invalid.'] }
  }, [review, periodText, domainText, standardText, competencyText])

  if (props.isDemo) {
    return <section className="panel custom-curriculum-panel"><div className="panel-heading"><div><span className="eyebrow">Private-school curriculum</span><h2>Bring your own curriculum</h2><p>Signed-in Supabase workspaces can upload a private curriculum, review a one-time Gemini structure draft, and use the approved competencies in the same lesson/TOS/assessment workflow.</p></div></div></section>
  }

  return <section className="panel custom-curriculum-panel" aria-labelledby="custom-curriculum-title">
    <div className="panel-heading custom-curriculum-heading">
      <div><span className="eyebrow">Phase 6 · universal curriculum</span><h2 id="custom-curriculum-title">My / School Curricula</h2><p>Upload, paste, or manually build a private curriculum. AI only prepares a draft; your approval is required before it can drive lessons, TOS, or assessments.</p></div>
      <button className="button secondary" type="button" onClick={() => { setOpen((value) => !value); setError(null) }}><Plus size={16} /> New curriculum</button>
    </div>

    <div className="custom-curriculum-safety"><ShieldCheck size={17} /><div><strong>Private by default · official DepEd records stay immutable</strong><p>Custom files live in a private Storage bucket. Hybrid mode clones the official base into your private version and adds school enrichment without changing the official source.</p></div></div>

    {open && <div className="custom-curriculum-create">
      <div className="form-grid three">
        <label>Source method<select value={draft.sourceKind} onChange={(event) => setDraft({ ...draft, sourceKind: event.target.value as CustomCurriculumSourceKind, file: null })}><option value="upload">Upload document</option><option value="paste">Paste text</option><option value="manual">Create manually</option></select></label>
        <label>Curriculum mode<select value={draft.curriculumMode} onChange={(event) => setDraft({ ...draft, curriculumMode: event.target.value as CustomCurriculumMode })}><option value="custom">My / School curriculum</option><option value="hybrid" disabled={!props.baseCurriculumVersionId}>DepEd + School enrichment</option></select></label>
        <label>School year<select value={draft.schoolYear} onChange={(event) => setDraft({ ...draft, schoolYear: event.target.value })}>{SCHOOL_YEARS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="span-two">Curriculum title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Grade 7 Mathematics — School Curriculum" /></label>
        <label>School / organization<input value={draft.organizationName} onChange={(event) => setDraft({ ...draft, organizationName: event.target.value })} placeholder="Your school" /></label>
        <label>Grade level<select value={draft.gradeLevel} onChange={(event) => setDraft({ ...draft, gradeLevel: event.target.value })}>{GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Learning area / subject<input value={draft.learningArea} onChange={(event) => setDraft({ ...draft, learningArea: event.target.value })} placeholder="Mathematics, Robotics, Cambridge Science…" /></label>
      </div>
      {draft.curriculumMode === 'hybrid' && <div className="hybrid-base-note"><Layers3 size={15} /><span>Base: {props.baseCurriculumLabel ?? 'Current verified curriculum assignment'}. Only school-specific additions should be present in the uploaded enrichment source.</span></div>}
      {draft.sourceKind === 'upload' && <label className="curriculum-file-drop"><Upload size={18} /><span><strong>{draft.file?.name ?? 'Choose PDF, DOCX, XLSX, CSV, TXT, or Markdown'}</strong><small>Maximum 15 MB. PDFs are analyzed from original document pages; other supported formats are safely text-extracted before AI analysis.</small></span><input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.md,application/pdf,text/plain,text/csv,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setDraft({ ...draft, file: event.target.files?.[0] ?? null })} /></label>}
      {draft.sourceKind === 'paste' && <label className="custom-curriculum-paste">Paste curriculum text<textarea rows={9} value={draft.pastedText} onChange={(event) => setDraft({ ...draft, pastedText: event.target.value })} placeholder="Paste scope and sequence, standards, competencies, learning objectives, or school curriculum text here…" /></label>}
      {draft.sourceKind !== 'manual' && <div className="ai-consent-note"><Sparkles size={15} /><span>Analysis sends the curriculum source content to Gemini using your own saved API key. The AI result stays a draft until you review and approve it.</span></div>}
      <div className="inline-actions"><button className="button ghost" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button primary" type="button" disabled={busy} onClick={() => void create()}>{draft.sourceKind === 'manual' ? <PencilLine size={16} /> : <Sparkles size={16} />} {draft.sourceKind === 'manual' ? 'Create draft' : 'Analyze once'}</button></div>
    </div>}

    {message && <div className="form-message success">{message}</div>}
    {error && <div className="form-message error">{error}</div>}

    <div className="custom-curriculum-list">
      {!imports.length ? <div className="mini-empty">No private-school/custom curricula yet.</div> : imports.map((item) => <article className="custom-curriculum-row" key={item.id}>
        <div className="custom-curriculum-icon">{item.status === 'approved' ? <CheckCircle2 size={18} /> : item.sourceKind === 'upload' ? <FileText size={18} /> : <PencilLine size={18} />}</div>
        <div className="custom-curriculum-copy"><strong>{item.title || item.originalFilename || 'Untitled curriculum'}</strong><span>{item.gradeLevel} · {item.learningArea} · {item.schoolYear}</span><small>{item.curriculumMode === 'hybrid' ? 'DepEd + school enrichment' : 'School custom'} · {item.status === 'approved' ? 'Approved/private' : item.status === 'analyzed' ? 'Draft ready for review' : 'Draft'}{item.analysisModel ? ` · ${item.analysisModel}` : ''}</small></div>
        <div className="custom-curriculum-actions">{item.status !== 'approved' && (item.review || item.analysis) && <button className="button ghost compact" type="button" onClick={() => openReview(item)}>Review</button>}{item.status === 'approved' && item.publishedVersionId && item.review && <button className="button ghost compact" type="button" onClick={() => void newRevision(item)}><PencilLine size={14} /> New revision</button>}{item.status === 'approved' && item.publishedVersionId && <button className="icon-button" type="button" aria-label="Archive curriculum version" onClick={() => void archive(item)}><Archive size={15} /></button>}{item.status !== 'approved' && <button className="icon-button danger" type="button" aria-label="Delete curriculum draft" onClick={() => void remove(item)}><Trash2 size={15} /></button>}</div>
      </article>)}
    </div>

    {editing && review && <div className="custom-curriculum-review-backdrop" role="presentation"><section className="custom-curriculum-review panel" role="dialog" aria-modal="true" aria-labelledby="curriculum-review-title">
      <div className="custom-review-heading"><div><span className="eyebrow">Teacher approval required</span><h2 id="curriculum-review-title">Review curriculum structure</h2><p>Correct AI extraction errors here. Approval creates a private immutable curriculum version for downstream GuroDesk workflows.</p></div><button className="icon-button" type="button" aria-label="Close curriculum review" onClick={closeReview}><X size={17} /></button></div>
      <div className="form-grid three">
        <label className="span-two">Title<input value={review.title} onChange={(event) => setReview({ ...review, title: event.target.value })} /></label>
        <label>Organization<input value={review.organizationName} onChange={(event) => setReview({ ...review, organizationName: event.target.value })} /></label>
        <label>School year<input value={review.schoolYear} onChange={(event) => setReview({ ...review, schoolYear: event.target.value })} /></label>
        <label>Grade level<input value={review.gradeLevel} onChange={(event) => setReview({ ...review, gradeLevel: event.target.value })} /></label>
        <label>Learning area<input value={review.learningArea} onChange={(event) => setReview({ ...review, learningArea: event.target.value })} /></label>
      </div>
      {review.warnings.length > 0 && <div className="curriculum-review-warnings"><strong>AI review notes</strong>{review.warnings.map((warning, index) => <p key={`${index}:${warning}`}>{warning}</p>)}</div>}
      <div className="curriculum-review-grid">
        <label><span>Periods <small className="field-optional">key || label || quarter/term/semester/year</small></span><textarea rows={5} value={periodText} onChange={(event) => setPeriodText(event.target.value)} /></label>
        <label><span>Domains / strands <small className="field-optional">key || code || name</small></span><textarea rows={5} value={domainText} onChange={(event) => setDomainText(event.target.value)} /></label>
        <label className="span-two"><span>Standards <small className="field-optional">type || text || periodKey || domainKey || sourcePage</small></span><textarea rows={7} value={standardText} onChange={(event) => setStandardText(event.target.value)} /></label>
        <label className="span-two"><span>Competencies / learning objectives <small className="field-optional">code || exact text || periodKey || domainKey || sourcePage · one record per line</small></span><textarea rows={14} value={competencyText} onChange={(event) => setCompetencyText(event.target.value)} /></label>
      </div>
      <div className="custom-review-summary"><span><strong>{lines(competencyText).length}</strong> competencies/objectives</span><span><strong>{lines(periodText).length}</strong> periods</span><span><strong>{lines(domainText).length}</strong> domains</span></div>
      {reviewValidation.length > 0 && <div className="form-message error">{reviewValidation[0]}</div>}
      <div className="custom-review-actions"><button className="button ghost" type="button" disabled={busy} onClick={closeReview}>Close</button><button className="button secondary" type="button" disabled={busy} onClick={() => void saveReview()}><Save size={15} /> Save draft</button><button className="button primary" type="button" disabled={busy || reviewValidation.length > 0} onClick={() => void approve()}><CheckCircle2 size={15} /> Approve & publish privately</button></div>
    </section></div>}
  </section>
}
