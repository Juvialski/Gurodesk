import {
  ArrowRight,
  BookOpenCheck,
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  FileDown,
  Files,
  Plus,
  TableProperties,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { loadAssessmentDocuments } from '../lib/assessmentRepository'
import { loadLessonPlans } from '../lib/repository'
import { loadResultSessions, type ResultSessionListSummary } from '../lib/resultsRepository'
import { loadTosDocuments } from '../lib/tosRepository'

type DocumentKind = 'lesson' | 'tos' | 'assessment' | 'results'

type WorkspaceDocument = {
  id: string
  kind: DocumentKind
  title: string
  status: string
  detail: string
  updatedAt: string
  to: string
  exportTo?: string
}

const TYPE_META: Record<DocumentKind, { label: string; icon: LucideIcon }> = {
  lesson: { label: 'Lesson plan', icon: BookOpenCheck },
  tos: { label: 'TOS', icon: TableProperties },
  assessment: { label: 'Assessment', icon: ClipboardCheck },
  results: { label: 'Results', icon: ChartNoAxesColumnIncreasing },
}

function formatDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Not dated' : parsed.toLocaleDateString()
}

export function DocumentsPage() {
  const { user, isDemo } = useApp()
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [loadWarnings, setLoadWarnings] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | DocumentKind>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'final' | 'draft'>('all')
  const [sortBy, setSortBy] = useState<'updated_desc' | 'updated_asc' | 'title_asc' | 'title_desc'>('updated_desc')

  useEffect(() => {
    if (!user) {
      setDocuments([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    void Promise.allSettled([
      loadLessonPlans(user.id, isDemo),
      loadTosDocuments(user.id, isDemo),
      loadAssessmentDocuments(user.id, isDemo),
      loadResultSessions(user.id, isDemo),
    ]).then(([lessonResult, tosResult, assessmentResult, resultResult]) => {
      if (!active) return

      const next: WorkspaceDocument[] = []
      const warnings: string[] = []

      if (lessonResult.status === 'fulfilled') {
        next.push(...lessonResult.value.map((plan) => ({
          id: plan.id,
          kind: 'lesson' as const,
          title: plan.title || 'Untitled lesson plan',
          status: plan.status,
          detail: [plan.content.gradeLevel, plan.content.learningArea, plan.content.lessonFocus || plan.content.lessonTitle].filter(Boolean).join(' · '),
          updatedAt: plan.updatedAt,
          to: `/lesson-plans/${plan.id}`,
          exportTo: `/lesson-plans/${plan.id}/print`,
        })))
      } else warnings.push('Lesson plans could not be loaded.')

      if (tosResult.status === 'fulfilled') {
        next.push(...tosResult.value.map((tos) => ({
          id: tos.id,
          kind: 'tos' as const,
          title: tos.title || 'Untitled TOS',
          status: tos.status,
          detail: `${tos.content.gradeLevel} · ${tos.content.learningArea} · ${tos.content.totalItems} items`,
          updatedAt: tos.updatedAt,
          to: `/tos/${tos.id}`,
          exportTo: `/tos/${tos.id}/print`,
        })))
      } else warnings.push('TOS documents could not be loaded.')

      if (assessmentResult.status === 'fulfilled') {
        next.push(...assessmentResult.value.map((assessment) => {
          const isPerfTask = assessment.mode === 'performance_task' || Boolean(assessment.performanceTask)
          const detail = isPerfTask
            ? `${assessment.performanceTask?.rubric.criteria.length ?? 0} rubric criteria · ${assessment.performanceTask?.rubric.totalPoints ?? assessment.totalPoints ?? 0} pts`
            : `${assessment.items.length} question${assessment.items.length === 1 ? '' : 's'}`
          return {
            id: assessment.id,
            kind: 'assessment' as const,
            title: assessment.title || 'Untitled assessment',
            status: assessment.status,
            detail,
            updatedAt: assessment.updatedAt,
            to: `/assessments/${assessment.id}`,
            exportTo: `/assessments/${assessment.id}/print`,
          }
        }))
      } else warnings.push('Assessments could not be loaded.')

      if (resultResult.status === 'fulfilled') {
        next.push(...resultResult.value.map((session: ResultSessionListSummary) => ({
          id: session.id,
          kind: 'results' as const,
          title: session.title || 'Untitled result set',
          status: session.status,
          detail: `${session.encodedLearnerCount} of ${session.learnerCount} learners encoded`,
          updatedAt: session.updatedAt,
          to: `/results/${session.id}`,
          exportTo: `/results/${session.id}/print`,
        })))
      } else warnings.push('Result sets could not be loaded.')

      setDocuments(next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)))
      setLoadWarnings(warnings)
      setLoading(false)
    })

    return () => { active = false }
  }, [isDemo, user?.id])

  const visibleDocuments = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const filtered = documents.filter((document) => {
      if (kind !== 'all' && document.kind !== kind) return false
      if (statusFilter === 'final' && !document.status.toLowerCase().includes('final') && !document.status.toLowerCase().includes('complete') && !document.status.toLowerCase().includes('approved')) return false
      if (statusFilter === 'draft' && (document.status.toLowerCase().includes('final') || document.status.toLowerCase().includes('complete') || document.status.toLowerCase().includes('approved'))) return false
      if (!needle) return true
      return `${document.title} ${document.detail} ${TYPE_META[document.kind].label}`.toLocaleLowerCase().includes(needle)
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'updated_asc') return a.updatedAt.localeCompare(b.updatedAt)
      if (sortBy === 'title_asc') return a.title.localeCompare(b.title)
      if (sortBy === 'title_desc') return b.title.localeCompare(a.title)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [documents, kind, query, sortBy, statusFilter])

  return (
    <>
      <PageHeader
        eyebrow="Workspace library"
        title="Documents"
        description="Browse saved lesson plans, TOS documents, assessments, and result sets from one place."
        actions={<><Link className="button secondary" to="/documents/merge">Fill your template</Link><Link className="button primary" to="/create"><Plus size={16} /> Create</Link></>}
      />

      <section className="panel">
        <div className="form-grid four">
          <label>
            Search documents
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, subject, topic, or type" />
          </label>
          <label>
            Document type
            <select value={kind} onChange={(event) => setKind(event.target.value as 'all' | DocumentKind)}>
              <option value="all">All saved work</option>
              <option value="lesson">Lesson plans</option>
              <option value="tos">TOS</option>
              <option value="assessment">Assessments</option>
              <option value="results">Results</option>
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'final' | 'draft')}>
              <option value="all">All statuses</option>
              <option value="draft">Drafts in progress</option>
              <option value="final">Finalized / Complete</option>
            </select>
          </label>
          <label>
            Sort by
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
              <option value="updated_desc">Recently updated</option>
              <option value="updated_asc">Oldest first</option>
              <option value="title_asc">Title (A to Z)</option>
              <option value="title_desc">Title (Z to A)</option>
            </select>
          </label>
        </div>
      </section>

      {loadWarnings.length > 0 && (
        <div className="form-message results-alert" role="status">
          Some saved work could not be loaded. The available document types are still shown.
        </div>
      )}

      {loading && <div className="panel lesson-loading"><span className="loader" /><strong>Loading saved work…</strong></div>}

      {!loading && documents.length === 0 && (
        <EmptyState
          icon={Files}
          title="No saved documents yet"
          description="Create a lesson plan, TOS, assessment, or result set and it will appear here automatically."
        >
          <Link className="button primary" to="/create"><Plus size={16} /> Create your first document</Link>
        </EmptyState>
      )}

      {!loading && documents.length > 0 && visibleDocuments.length === 0 && (
        <EmptyState
          icon={Files}
          title="No documents match this filter"
          description="Try a different search or show all saved work."
        >
          <button className="button secondary" type="button" onClick={() => { setQuery(''); setKind('all') }}>Clear filters</button>
        </EmptyState>
      )}

      {!loading && visibleDocuments.length > 0 && (
        <section className="lesson-card-grid" aria-label="Saved documents">
          {visibleDocuments.map((document) => {
            const meta = TYPE_META[document.kind]
            const Icon = meta.icon
            return (
              <article className="panel lesson-card" key={`${document.kind}-${document.id}`}>
                <div className="lesson-card-top">
                  <span className={`plan-status ${document.status}`}>{document.status.replaceAll('_', ' ')}</span>
                  <span className="tos-method-chip"><Icon size={13} /> {meta.label}</span>
                </div>
                <h2>{document.title}</h2>
                <p>{document.detail || 'Saved teacher document'}</p>
                <div className="lesson-card-meta">
                  <span>Updated {formatDate(document.updatedAt)}</span>
                </div>
                <div className="lesson-card-actions">
                  {document.exportTo && <Link className="button ghost" to={document.exportTo}><FileDown size={14} /> Export</Link>}
                  <Link className="button secondary" to={document.to}>Open <ArrowRight size={14} /></Link>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </>
  )
}
