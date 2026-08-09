import {
  BookMarked,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileQuestion,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  TableProperties,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { loadCurriculumNavigator, loadSchoolYearCalendar } from '../lib/repository'
import type { CurriculumNavigatorBundle, SchoolYearCalendar } from '../types/curriculum'

export function CurriculumPage() {
  const { assignments, isDemo } = useApp()
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? '')
  const [bundle, setBundle] = useState<CurriculumNavigatorBundle | null>(null)
  const [calendar, setCalendar] = useState<SchoolYearCalendar | null>(null)
  const [periodId, setPeriodId] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCompetencyId, setSelectedCompetencyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!assignments.length) {
      setAssignmentId('')
      return
    }
    if (!assignments.some((item) => item.id === assignmentId)) setAssignmentId(assignments[0].id)
  }, [assignmentId, assignments])

  const assignment = assignments.find((item) => item.id === assignmentId) ?? null

  useEffect(() => {
    if (!assignment) {
      setBundle(null)
      setCalendar(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setQuery('')
    setSelectedCompetencyId('')

    Promise.all([
      loadCurriculumNavigator(
        assignment.schoolYear,
        assignment.gradeLevel,
        assignment.learningArea,
        isDemo,
      ),
      loadSchoolYearCalendar(assignment.schoolYear, isDemo),
    ])
      .then(([nextBundle, nextCalendar]) => {
        if (cancelled) return
        setBundle(nextBundle)
        setCalendar(nextCalendar)
        setPeriodId(nextBundle.periods[0]?.id ?? '')
      })
      .catch((nextError) => {
        if (cancelled) return
        setError(nextError instanceof Error ? nextError.message : 'Unable to load curriculum records.')
        setBundle(null)
        setCalendar(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [assignment, isDemo])

  const selectedPeriod = bundle?.periods.find((period) => period.id === periodId) ?? bundle?.periods[0] ?? null

  const selectedCompetencies = useMemo(() => {
    if (!bundle || !selectedPeriod) return []
    const needle = query.trim().toLowerCase()
    return bundle.competencies.filter((competency) => {
      if (competency.academicPeriodId !== selectedPeriod.id) return false
      if (!needle) return true
      return competency.competencyText.toLowerCase().includes(needle)
        || competency.competencyCode?.toLowerCase().includes(needle)
    })
  }, [bundle, query, selectedPeriod])

  const selectedCompetency = useMemo(
    () => bundle?.competencies.find((item) => item.id === selectedCompetencyId) ?? null,
    [bundle, selectedCompetencyId],
  )

  const standards = useMemo(
    () => bundle?.standards.filter((item) => item.academicPeriodId === selectedPeriod?.id) ?? [],
    [bundle, selectedPeriod],
  )

  const groups = useMemo(() => {
    if (!bundle) return []
    return bundle.domains
      .map((domain) => ({
        domain,
        competencies: selectedCompetencies.filter((item) => item.domainId === domain.id),
      }))
      .filter((group) => group.competencies.length > 0)
  }, [bundle, selectedCompetencies])

  if (!assignments.length) {
    return (
      <>
        <PageHeader
          eyebrow="DepEd knowledge"
          title="Curriculum Navigator"
          description="Verified curriculum records are filtered through your teaching assignments."
        />
        <EmptyState
          icon={BookMarked}
          title="Add a teaching assignment first"
          description="Go to My Classes and add the grade level and learning area you teach. GuroDesk will use that assignment to resolve the applicable curriculum version."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="DepEd knowledge · Phase 2"
        title="Curriculum Navigator"
        description="Browse verified competencies by school year, teaching assignment, curriculum version, and the source guide's own sequence."
        actions={
          <label className="compact-select curriculum-assignment-select">
            <span>Teaching assignment</span>
            <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
              {assignments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.gradeLevel} · {item.learningArea}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {calendar && (
        <div className="calendar-context panel">
          <span className="calendar-context-icon"><CalendarRange size={20} /></span>
          <div>
            <strong>{calendar.schoolYear} uses {calendar.gradingPeriodCount} grading periods</strong>
            <p>
              {calendar.periods.map((period) => period.label).join(' · ')}. This grading calendar is intentionally separate from curriculum-guide sequencing below.
            </p>
          </div>
          <span className="verified-chip"><ShieldCheck size={14} /> {calendar.source?.issuanceCode ?? 'Verified policy'}</span>
        </div>
      )}

      {loading && (
        <div className="curriculum-loading panel">
          <span className="loader" />
          <div><strong>Resolving curriculum…</strong><small>Checking version, subject, periods, and verified competencies.</small></div>
        </div>
      )}

      {!loading && error && (
        <EmptyState icon={FileQuestion} title="Curriculum could not be loaded" description={error} />
      )}

      {!loading && !error && bundle && !bundle.available && (
        <EmptyState
          icon={Layers3}
          title="Verified curriculum not loaded yet"
          description={bundle.coverageNote ?? 'This teaching assignment has not been imported into the verified curriculum knowledge base yet.'}
        >
          <div className="assignment-tags">
            <span className="tag">{bundle.schoolYear}</span>
            <span className="tag">{bundle.gradeLevel}</span>
            <span className="tag">{bundle.learningArea}</span>
          </div>
        </EmptyState>
      )}

      {!loading && !error && bundle?.available && bundle.version && bundle.subject && (
        <div className="curriculum-workspace">
          <section className="curriculum-summary-grid">
            <div className="panel curriculum-version-card">
              <span className="summary-icon blue"><Layers3 size={20} /></span>
              <div>
                <small>Applicable curriculum</small>
                <strong>{bundle.version.name}</strong>
                <p>{bundle.version.implementationNotes ?? bundle.version.framework}</p>
              </div>
            </div>
            <div className="panel curriculum-version-card">
              <span className="summary-icon green"><CheckCircle2 size={20} /></span>
              <div>
                <small>Verified coverage</small>
                <strong>{bundle.competencies.length} competencies</strong>
                <p>{bundle.subject.gradeLevel} · {bundle.subject.name} · {bundle.periods.length} curriculum periods</p>
              </div>
            </div>
            <div className="panel curriculum-version-card source-card">
              <span className="summary-icon amber"><ShieldCheck size={20} /></span>
              <div>
                <small>Official source</small>
                <strong>{bundle.source?.title ?? 'Verified DepEd source'}</strong>
                <p>{bundle.source?.verificationStatus === 'verified' ? 'Source provenance verified' : 'Source metadata available'}</p>
                {bundle.source?.sourceUrl && (
                  <a className="source-link" href={bundle.source.sourceUrl} target="_blank" rel="noreferrer">
                    Open DepEd source <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          </section>

          {bundle.coverageNote && <div className="coverage-note"><ShieldCheck size={15} /><span>{bundle.coverageNote}</span></div>}

          <div className="period-tabs" role="tablist" aria-label="Curriculum periods">
            {bundle.periods.map((period) => {
              const count = bundle.competencies.filter((item) => item.academicPeriodId === period.id).length
              return (
                <button
                  key={period.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedPeriod?.id === period.id}
                  className={`period-tab ${selectedPeriod?.id === period.id ? 'active' : ''}`}
                  onClick={() => {
                    setPeriodId(period.id)
                    setQuery('')
                    setSelectedCompetencyId('')
                  }}
                >
                  <span>{period.label}</span>
                  <small>{count} competencies</small>
                </button>
              )
            })}
          </div>

          <div className="curriculum-main-grid">
            <section className="curriculum-list-column">
              <div className="curriculum-toolbar panel">
                <div>
                  <span className="eyebrow">{selectedPeriod?.label}</span>
                  <h2>Learning competencies</h2>
                </div>
                <label className="curriculum-search">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search competencies"
                    aria-label="Search competencies"
                  />
                </label>
              </div>

              {groups.length ? groups.map(({ domain, competencies }) => (
                <section className="domain-panel panel" key={domain.id}>
                  <header className="domain-heading">
                    <div>
                      <span className="domain-code">{domain.code ?? 'Domain'}</span>
                      <div><h3>{domain.name}</h3><small>{competencies.length} competencies in this view</small></div>
                    </div>
                  </header>
                  <div className="competency-list">
                    {competencies.map((competency) => (
                      <button
                        type="button"
                        className={`competency-row ${selectedCompetency?.id === competency.id ? 'selected' : ''}`}
                        key={competency.id}
                        onClick={() => setSelectedCompetencyId(competency.id)}
                        aria-pressed={selectedCompetency?.id === competency.id}
                      >
                        <span className="competency-number">{competency.sortOrder}</span>
                        <span className="competency-copy">
                          <span className="competency-text">{competency.competencyText}</span>
                          <span className="competency-meta">
                            {competency.competencyCode && <span>{competency.competencyCode}</span>}
                            <span><CheckCircle2 size={12} /> Verified</span>
                            {competency.sourcePage && <span>Source p. {competency.sourcePage}</span>}
                          </span>
                        </span>
                        <ChevronRight className="competency-chevron" size={17} />
                      </button>
                    ))}
                  </div>
                </section>
              )) : (
                <div className="panel mini-curriculum-empty">No competencies match “{query}”.</div>
              )}
            </section>

            <aside className="curriculum-side-column">
              <section className="panel standard-panel">
                <span className="eyebrow">Period outcome</span>
                <h2>Performance standard</h2>
                {standards.length ? standards.map((standard) => (
                  <div key={standard.id} className="standard-copy">
                    <p>{standard.standardText}</p>
                    {standard.sourcePage && <small>Official guide · page {standard.sourcePage}</small>}
                  </div>
                )) : <p className="muted-copy">No performance standard is loaded for this period yet.</p>}
              </section>

              <section className="panel future-actions-panel">
                <span className="eyebrow">Selected competency</span>
                <h2>{selectedCompetency ? 'Ready for the next workflow' : 'Choose a competency'}</h2>
                {selectedCompetency ? (
                  <>
                    <div className="selected-competency-preview">
                      <p>{selectedCompetency.competencyText}</p>
                      <small>Verified source{selectedCompetency.sourcePage ? ` · page ${selectedCompetency.sourcePage}` : ''}</small>
                    </div>
                    <p>GuroDesk will pass this exact verified competency into the teacher-led ILAW planner. Gemini is limited to permitted text-support tasks after the teacher makes the core instructional decisions.</p>
                  </>
                ) : (
                  <p>Select any competency in the list. GuroDesk will preserve that selection as the grounding target for lesson and assessment creation.</p>
                )}
                {selectedCompetency && assignment ? <Link className="future-action active-action" to={`/lesson-plans/new?assignment=${assignment.id}&competency=${selectedCompetency.id}`}><Sparkles size={16} /><span><strong>Create lesson plan</strong><small>Open ILAW planner</small></span></Link> : <button className="future-action" disabled><Sparkles size={16} /><span><strong>Create lesson plan</strong><small>Select a competency</small></span></button>}
                {selectedCompetency && assignment ? <Link className="future-action active-action" to={`/tos/new?assignment=${assignment.id}&competency=${selectedCompetency.id}`}><TableProperties size={16} /><span><strong>Add to TOS</strong><small>Open Phase 4 builder</small></span></Link> : <button className="future-action" disabled><TableProperties size={16} /><span><strong>Add to TOS</strong><small>Select a competency</small></span></button>}
                <Link className="future-action active-action" to="/assessments/new"><FileQuestion size={16} /><span><strong>Create assessment</strong><small>Choose a finalized TOS</small></span></Link>
              </section>
            </aside>
          </div>
        </div>
      )}
    </>
  )
}
