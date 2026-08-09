import { ArrowLeft, ArrowRight, Check, ClipboardCheck, FileCheck2, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { createAssessmentFromFinalTos } from '../lib/assessmentRepository'
import { loadTosDocuments } from '../lib/tosRepository'
import type { TosRecord } from '../types/tos'
import { extractErrorMessage } from './assessmentUi'

export function AssessmentNewPage() {
  const { user, isDemo } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tosDocuments, setTosDocuments] = useState<TosRecord[]>([])
  const [selectedId, setSelectedId] = useState(searchParams.get('tos') ?? '')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    void loadTosDocuments(user.id, isDemo)
      .then((documents) => {
        if (!active) return
        const finals = documents.filter((document) => document.status === 'final')
        setTosDocuments(finals)
        const requested = finals.find((document) => document.id === (searchParams.get('tos') ?? ''))
        setSelectedId((current) => requested?.id ?? finals.find((document) => document.id === current)?.id ?? finals[0]?.id ?? '')
      })
      .catch((nextError) => { if (active) setError(extractErrorMessage(nextError, 'Unable to load finalized TOS documents.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.id, isDemo, searchParams])

  const selected = useMemo(() => tosDocuments.find((document) => document.id === selectedId) ?? null, [tosDocuments, selectedId])

  async function create() {
    if (!user || !selected) return
    setCreating(true)
    setError('')
    try {
      const created = await createAssessmentFromFinalTos(selected, user.id, isDemo, title.trim() || undefined, instructions.trim() || undefined)
      navigate(`/assessments/${created.id}`)
    } catch (nextError) {
      setError(extractErrorMessage(nextError, 'Unable to create assessment from this TOS.'))
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Loading finalized TOS documents…</strong></div>
  if (error && !tosDocuments.length) return <EmptyState icon={ClipboardCheck} title="Assessment setup unavailable" description={error}><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Back to assessments</Link></EmptyState>
  if (!tosDocuments.length) return <>
    <PageHeader eyebrow="Assessment studio" title="New assessment" description="Assessment items must be grounded in a finalized Table of Specifications." actions={<Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> All assessments</Link>} />
    <EmptyState icon={ShieldCheck} title="Finalize a TOS first" description="There are no finalized TOS documents available. Draft TOS documents are intentionally not selectable as assessment sources."><Link className="button primary" to="/tos"><ShieldCheck size={16} /> Open TOS Builder</Link></EmptyState>
  </>

  return <>
    <PageHeader eyebrow="Assessment studio · Phase 4" title="New assessment" description="Choose one finalized TOS. Its competency, cognitive category, and item-number mappings will be copied into an editable assessment draft." actions={<Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> All assessments</Link>} />
    <div className="assessment-new-layout">
      <section className="panel assessment-source-picker">
        <div className="assessment-section-heading"><span>1</span><div><h2>Choose a finalized TOS</h2><p>Only finalized TOS documents appear here.</p></div></div>
        <div className="assessment-source-list" role="listbox" aria-label="Finalized TOS documents">
          {tosDocuments.map((document) => {
            const selectedSource = selectedId === document.id
            return <button key={document.id} type="button" role="option" aria-selected={selectedSource} className={`assessment-source-option ${selectedSource ? 'selected' : ''}`} onClick={() => setSelectedId(document.id)}>
              <span className="assessment-source-option-icon">{selectedSource ? <Check size={17} /> : <FileCheck2 size={17} />}</span>
              <span><strong>{document.title || 'Untitled TOS'}</strong><small>{[document.content.gradeLevel, document.content.learningArea, document.content.schoolYear].filter(Boolean).join(' · ')}</small><small>{document.content.totalItems} items · {document.content.rows.length} competencies</small></span>
            </button>
          })}
        </div>
      </section>

      <section className="panel assessment-new-details">
        <div className="assessment-section-heading"><span>2</span><div><h2>Assessment details</h2><p>These fields remain teacher-authored.</p></div></div>
        <div className="assessment-selected-source"><ShieldCheck size={17} /><div><small>Grounded in finalized TOS</small><strong>{selected?.title || 'Select a TOS'}</strong></div></div>
        <div className="assessment-form-grid">
          <label>Assessment title <small>(optional)</small><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selected?.content.assessmentTitle || 'e.g. First summative test'} /></label>
          <label>Directions / instructions <small>(optional)</small><textarea rows={5} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Teacher-authored directions for learners" /></label>
        </div>
        {error && <div className="form-message error" role="alert">{error}</div>}
        <div className="assessment-new-actions"><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Cancel</Link><button className="button primary" type="button" disabled={!selected || creating} onClick={() => void create()}>{creating ? 'Creating…' : 'Create draft'} <ArrowRight size={16} /></button></div>
        <p className="assessment-immutable-note"><ShieldCheck size={14} /> Item mappings are copied from the selected TOS and cannot be edited here.</p>
      </section>
    </div>
  </>
}

