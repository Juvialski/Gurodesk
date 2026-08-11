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
import { CurriculumCatalogBrowser } from '../components/CurriculumCatalogBrowser'
import { CustomCurriculumPanel } from '../components/CustomCurriculumPanel'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { loadCurriculumNavigator, loadSchoolYearCalendar } from '../lib/repository'
import { normalizeDomainHeading } from '../lib/curriculumDisplay'
import type { CurriculumNavigatorBundle, SchoolYearCalendar } from '../types/curriculum'
import '../workflows.css'

export function CurriculumPage() {
  const { assignments, isDemo, user, profile, refreshWorkspace } = useApp()
  const { selection, updateSelection } = useWorkspaceSelection(user?.id)
  const [assignmentId, setAssignmentId] = useState(selection.assignmentId ?? assignments[0]?.id ?? '')
  const [bundle, setBundle] = useState<CurriculumNavigatorBundle | null>(null)
  const [calendar, setCalendar] = useState<SchoolYearCalendar | null>(null)
  const [periodId, setPeriodId] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCompetencyId, setSelectedCompetencyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(() => {
    try {
      return localStorage.getItem('gurodesk.curriculum.view-mode') === 'manage'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('gurodesk.curriculum.view-mode', manageOpen ? 'manage' : 'mine')
    } catch {
      // Local preference is optional; curriculum records remain unchanged.
    }
  }, [manageOpen])

  useEffect(() => {
    if (!assignments.length) {
      setAssignmentId('')
      return
    }
    if (!assignments.some((item) => item.id === assignmentId)) setAssignmentId(assignments[0].id)
  }, [assignmentId, assignments])

  useEffect(() => {
    if (assignmentId) updateSelection({ assignmentId })
  }, [assignmentId, updateSelection])

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
        assignment.curriculumVersionId,
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
          eyebrow="Curriculum"
          title="My Curriculum"
          description="Start with the curriculum attached to your classes. Full catalog and private-school tools are available under Manage curriculum."
          actions={<div className="workflow-view-tabs" role="tablist" aria-label="Curriculum view"><button type="button" role="tab" aria-selected={!manageOpen} className={!manageOpen ? 'active' : ''} onClick={() => setManageOpen(false)}>My curriculum</button><button type="button" role="tab" aria-selected={manageOpen} className={manageOpen ? 'active' : ''} onClick={() => setManageOpen(true)}>Manage curriculum</button></div>}
        />
        {manageOpen && <>
          <CurriculumCatalogBrowser initialSchoolYear={profile?.schoolYear ?? '2026-2027'} initialGradeLevel="Grade 7" />
          {user && <CustomCurriculumPanel userId={user.id} isDemo={isDemo} schoolName={profile?.schoolName ?? ''} defaultSchoolYear={profile?.schoolYear ?? '2026-2027'} onPublished={refreshWorkspace} />}
        </>}
        <EmptyState
          icon={BookMarked}
          title={manageOpen ? 'Add a class after choosing curriculum' : 'Add your first class'}
          description={manageOpen ? 'Use the national catalog or approve a private curriculum, then attach it to a class from Classes.' : 'Open Classes to attach an official curriculum to your grade and learning area, or manage a private-school curriculum first.'}
        >
          <Link className="button primary" to={manageOpen ? '/classes' : '/classes'}>{manageOpen ? 'Open Classes' : 'Set up a class'}</Link>
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Curriculum · Phase 6"
        title="My Curriculum"
        description="Browse the verified curriculum attached to each class. National catalog, private-school, and hybrid tools stay under Manage curriculum."
        actions={
          <div className="workflow-header-actions"><div className="workflow-view-tabs" role="tablist" aria-label="Curriculum view"><button type="button" role="tab" aria-selected={!manageOpen} className={!manageOpen ? 'active' : ''} onClick={() => setManageOpen(false)}>My curriculum</button><button type="button" role="tab" aria-selected={manageOpen} className={manageOpen ? 'active' : ''} onClick={() => setManageOpen(true)}>Manage curriculum</button></div><label className="compact-select curriculum-assignment-select"><span>Class</span><select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>{assignments.map((item) => <option key={item.id} value={item.id}>{item.gradeLevel} · {item.learningArea}{item.curriculumSourceKind === 'official' ? '' : item.curriculumSourceKind === 'hybrid' ? ' · Hybrid' : ' · School'}</option>)}</select></label></div>
        }
      />

      {manageOpen && <>
        <CurriculumCatalogBrowser initialSchoolYear={assignment?.schoolYear ?? profile?.schoolYear ?? '2026-2027'} initialGradeLevel={assignment?.gradeLevel} highlightedLearningArea={assignment?.curriculumSourceKind === 'official' ? assignment.learningArea : null} />
        {user && <CustomCurriculumPanel userId={user.id} isDemo={isDemo} schoolName={profile?.schoolName ?? ''} defaultSchoolYear={assignment?.schoolYear ?? profile?.schoolYear ?? '2026-2027'} defaultGradeLevel={assignment?.gradeLevel} defaultLearningArea={assignment?.learningArea} baseCurriculumVersionId={assignment?.curriculumSourceKind === 'official' ? bundle?.version?.id ?? null : bundle?.version?.baseCurriculumVersionId ?? null} baseCurriculumLabel={assignment?.curriculumSourceKind === 'official' ? bundle?.version?.name ?? null : null} onPublished={refreshWorkspace} />}
      </>}

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
                <small>{bundle.version.originKind === 'official' ? 'Official source' : 'Private curriculum source'}</small>
                <strong>{bundle.source?.title ?? (bundle.version.originKind === 'official' ? 'Verified DepEd source' : 'Teacher-approved school source')}</strong>
                <p>{bundle.version.originKind === 'official' ? (bundle.source?.verificationStatus === 'verified' ? 'Official source provenance verified' : 'Source metadata available') : `${bundle.version.organizationName ?? 'Teacher/school'} · revision ${bundle.version.revisionNumber ?? 1}`}</p>
                <details className="workflow-source-details"><summary>Source details</summary><p>{bundle.source?.title ?? 'No source title available'}{bundle.source?.issuanceCode ? ` · ${bundle.source.issuanceCode}` : ''}</p>{bundle.source?.sourceUrl && <a className="source-link" href={bundle.source.sourceUrl} target="_blank" rel="noreferrer">Open source <ExternalLink size={13} /></a>}</details>
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
                      <div><h3 title={normalizeDomainHeading(domain.name).raw}>{normalizeDomainHeading(domain.name).display}</h3><small>{competencies.length} competencies in this view</small></div>
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
                            <span><CheckCircle2 size={12} /> {competency.provenanceKind === 'custom' ? 'School-approved' : competency.provenanceKind === 'inherited' ? 'Inherited verified base' : 'Verified'}</span>
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
                      <small>{selectedCompetency.provenanceKind === 'custom' ? 'Teacher-approved school source' : selectedCompetency.provenanceKind === 'inherited' ? 'Inherited verified base source' : 'Verified source'}{selectedCompetency.sourcePage ? ` · page ${selectedCompetency.sourcePage}` : ''}</small>
                    </div>
                    <p>GuroDesk will pass this exact approved competency into the teacher-led ILAW planner. Gemini is limited to permitted text-support tasks after the teacher makes the core instructional decisions.</p>
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
