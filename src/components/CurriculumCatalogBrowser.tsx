import { BookOpenCheck, CheckCircle2, ExternalLink, LibraryBig, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { GRADE_LEVELS, SCHOOL_YEARS } from '../data/constants'
import {
  CURRICULUM_CATALOG_STATS,
  curriculumCatalogGroups,
  type CurriculumCatalogEntry,
  type CurriculumCatalogStatus,
} from '../data/curriculumCatalog'

const STATUS_LABELS: Record<CurriculumCatalogStatus, string> = {
  verified_competencies: 'Verified competencies loaded',
  official_guide_catalogued: 'Official guide catalogued',
  official_family_catalogued: 'Official curriculum family catalogued',
  transitional: 'Transitional curriculum',
}

function sourceStatusClass(status: CurriculumCatalogStatus) {
  if (status === 'verified_competencies') return 'verified'
  if (status === 'transitional') return 'transition'
  return 'catalogued'
}

function CurriculumCatalogItem({ entry }: { entry: CurriculumCatalogEntry }) {
  return (
    <article className="curriculum-catalog-item">
      <div className="curriculum-catalog-item-copy">
        <div className="curriculum-catalog-item-title">
          <strong>{entry.displayName}</strong>
          <span className={`catalog-status ${sourceStatusClass(entry.status)}`}>
            {entry.status === 'verified_competencies' ? <CheckCircle2 size={12} /> : <ShieldCheck size={12} />}
            {STATUS_LABELS[entry.status]}
          </span>
        </div>
        <small>{entry.curriculumName}</small>
        <p>{entry.notes}</p>
      </div>
      <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="catalog-source-link">
        Official DepEd source <ExternalLink size={13} />
      </a>
    </article>
  )
}

export function CurriculumCatalogBrowser({
  initialGradeLevel = 'Grade 7',
  initialSchoolYear = '2026-2027',
}: {
  initialGradeLevel?: string
  initialSchoolYear?: string
}) {
  const [gradeLevel, setGradeLevel] = useState(initialGradeLevel)
  const [schoolYear, setSchoolYear] = useState(initialSchoolYear)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (GRADE_LEVELS.includes(initialGradeLevel)) setGradeLevel(initialGradeLevel)
  }, [initialGradeLevel])

  useEffect(() => {
    if (SCHOOL_YEARS.includes(initialSchoolYear)) setSchoolYear(initialSchoolYear)
  }, [initialSchoolYear])

  const allGroups = useMemo(() => curriculumCatalogGroups(gradeLevel, schoolYear), [gradeLevel, schoolYear])
  const totalCount = allGroups.reduce((sum, group) => sum + group.entries.length, 0)
  const groups = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en')
    if (!needle) return allGroups
    return allGroups
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => [entry.displayName, entry.learningArea, entry.curriculumName, entry.group]
          .some((value) => value.toLocaleLowerCase('en').includes(needle))),
      }))
      .filter((group) => group.entries.length > 0)
  }, [allGroups, query])
  const count = groups.reduce((sum, group) => sum + group.entries.length, 0)

  return (
    <section className="panel curriculum-catalog-panel" aria-labelledby="national-curriculum-catalog-title">
      <header className="curriculum-catalog-header">
        <div className="curriculum-catalog-heading">
          <span className="summary-icon blue"><LibraryBig size={20} /></span>
          <div>
            <span className="eyebrow">National curriculum catalog · Phase 6</span>
            <h2 id="national-curriculum-catalog-title">DepEd curriculum coverage</h2>
            <p>
              Browse current catalogued curriculum offerings across K–12. A catalogued guide is not treated as an executable competency pack until its exact competencies are source-verified.
            </p>
          </div>
        </div>
        <div className="curriculum-catalog-stats" aria-label="Curriculum catalog coverage summary">
          <span><strong>{CURRICULUM_CATALOG_STATS.entries}</strong><small>catalog entries</small></span>
          <span><strong>{CURRICULUM_CATALOG_STATS.verifiedCompetencyPacks}</strong><small>verified packs</small></span>
        </div>
      </header>

      <div className="curriculum-catalog-controls">
        <label className="compact-select">
          <span>School year</span>
          <select value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)}>
            {SCHOOL_YEARS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="compact-select">
          <span>Grade level</span>
          <select value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)}>
            {GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <div className="catalog-selection-summary">
          <BookOpenCheck size={17} />
          <span><strong>{query ? `${count} of ${totalCount}` : count}</strong> catalogued offering{count === 1 ? '' : 's'} for {gradeLevel} · {schoolYear}</span>
        </div>
        <label className="catalog-search-field">
          <span>Find subject or elective</span>
          <div><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this grade's catalog" /></div>
        </label>
      </div>

      {groups.length ? (
        <div className="curriculum-catalog-groups">
          {groups.map(({ group, entries }, index) => (
            <details className="curriculum-catalog-group" key={group} open={index === 0}>
              <summary>
                <span>{group}</span>
                <small>{entries.length} offering{entries.length === 1 ? '' : 's'}</small>
              </summary>
              <div className="curriculum-catalog-list">
                {entries.map((entry) => <CurriculumCatalogItem key={entry.id} entry={entry} />)}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="curriculum-catalog-empty">
          <ShieldCheck size={18} />
          <div>
            <strong>{query ? 'No catalogued offering matches this search.' : 'No revised/current catalog entry is registered for this historical selection.'}</strong>
            <p>{query ? 'Try a subject name, elective title, or curriculum cluster.' : 'GuroDesk does not infer a curriculum version from memory. Existing legacy assignments remain usable while a verified transition source is registered.'}</p>
          </div>
        </div>
      )}
    </section>
  )
}
