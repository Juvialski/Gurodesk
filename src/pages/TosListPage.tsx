import { Archive, ArrowRight, Copy, Download, Plus, TableProperties } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { archiveTosDocument, duplicateTosDocument, loadTosDocuments } from '../lib/tosRepository'
import type { TosRecord } from '../types/tos'

const METHOD_LABELS = { equal: 'Equal', instructional_time: 'Instructional time', manual_percentage: 'Manual %' } as const

export function TosListPage() {
  const { user, isDemo } = useApp()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<TosRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')

  async function refresh() {
    if (!user) return
    setLoading(true)
    try {
      setDocuments(await loadTosDocuments(user.id, isDemo))
      setError('')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load TOS documents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [user?.id, isDemo])

  async function duplicate(document: TosRecord) {
    setWorkingId(document.id)
    try {
      const created = await duplicateTosDocument(document, isDemo)
      navigate(`/tos/${created.id}`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to duplicate this TOS.')
    } finally {
      setWorkingId('')
    }
  }

  async function archive(document: TosRecord) {
    if (!user) return
    if (!window.confirm(`Archive “${document.title || 'Untitled TOS'}”? You can retain its version history, but it will leave the active TOS list.`)) return
    setWorkingId(document.id)
    try {
      await archiveTosDocument(document.id, user.id, isDemo)
      await refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to archive this TOS.')
    } finally {
      setWorkingId('')
    }
  }

  return <>
    <PageHeader
      eyebrow="Assessment planning · Phase 4"
      title="Table of Specifications"
      description="Plan assessment coverage from verified competencies. GuroDesk calculates every allocation and item range without AI."
      actions={<Link className="button primary" to="/tos/new"><Plus size={16} /> New TOS</Link>}
    />
    <div className="tos-principle panel"><TableProperties size={20} /><div><strong>Curriculum → TOS → Assessment</strong><p>Finalize a specification here, then use it to create deterministic assessment items and printable student, teacher, and answer-key copies.</p></div></div>
    {loading && <div className="panel lesson-loading"><span className="loader" /><strong>Loading TOS documents…</strong></div>}
    {!loading && error && <EmptyState icon={TableProperties} title="TOS documents could not be loaded" description={error} />}
    {!loading && !error && !documents.length && <EmptyState icon={TableProperties} title="No TOS documents yet" description="Start with a teaching assignment, select actual covered competencies, and choose how their item weight should be calculated."><Link className="button primary" to="/tos/new"><Plus size={16} /> Create first TOS</Link></EmptyState>}
    {!loading && !error && documents.length > 0 && <section className="lesson-card-grid">
      {documents.map((document) => <article className="panel lesson-card tos-list-card" key={document.id}>
        <div className="lesson-card-top"><span className={`plan-status ${document.status}`}>{document.status}</span><span className="tos-method-chip">{METHOD_LABELS[document.content.weightingMethod]}</span></div>
        <h2>{document.title || 'Untitled TOS'}</h2>
        <p>{document.content.gradeLevel} · {document.content.learningArea} · {document.content.schoolYear}</p>
        <div className="tos-list-metrics"><span><strong>{document.content.totalItems}</strong><small>items</small></span><span><strong>{document.content.rows.length}</strong><small>competencies</small></span><span><strong>{document.versionNumber}</strong><small>version</small></span></div>
        <div className="tos-context-pair"><span><small>School grading term</small>{document.content.gradingTermLabel || '—'}</span><span><small>Curriculum-guide period</small>{document.content.curriculumPeriodLabels.join(', ') || '—'}</span></div>
        <div className="lesson-card-meta"><span>Updated {new Date(document.updatedAt).toLocaleDateString()}</span><span>{document.content.calculation.valid ? `${document.content.calculation.totalAllocated}/${document.content.totalItems} reconciled` : 'Draft needs validation'}</span></div>
        <div className="lesson-card-actions">
          <button aria-label={`Archive ${document.title || 'Untitled TOS'}`} className="icon-button danger" disabled={workingId === document.id} type="button" onClick={() => void archive(document)} title="Archive"><Archive size={16} /></button>
          <button className="button ghost" disabled={workingId === document.id} type="button" onClick={() => void duplicate(document)}><Copy size={14} /> Duplicate</button>
          <Link className="button ghost" to={`/tos/${document.id}/print`}><Download size={14} /> Export</Link>
          <Link className="button secondary" to={`/tos/${document.id}`}>{document.status === 'draft' ? 'Open editor' : 'View TOS'} <ArrowRight size={14} /></Link>
        </div>
      </article>)}
    </section>}
  </>
}
