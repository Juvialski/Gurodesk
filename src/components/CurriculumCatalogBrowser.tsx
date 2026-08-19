import { BookOpenCheck, ExternalLink, Filter, Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  CURRICULUM_CATALOG_STATS,
  curriculumCatalogGroups,
  curriculumEntriesForGrade,
  type CurriculumCatalogEntry,
} from '../data/curriculumCatalog'
import { GRADE_LEVELS, SCHOOL_YEARS } from '../data/constants'

type Props = {
  initialSchoolYear?: string | null
  initialGradeLevel?: string | null
  highlightedLearningArea?: string | null
}

function statusLabel(entry: CurriculumCatalogEntry) {
  if (entry.status === 'verified_competencies') return 'Competencies verified'
  if (entry.status === 'transitional') return 'Transition catalog'
  if (entry.status === 'official_guide_catalogued') return 'Official guide catalogued'
  return 'Official family catalogued'
}

export function CurriculumCatalogBrowser({ initialSchoolYear, initialGradeLevel, highlightedLearningArea }: Props) {
  const [schoolYear, setSchoolYear] = useState(initialSchoolYear && SCHOOL_YEARS.includes(initialSchoolYear) ? initialSchoolYear : '2026-2027')
  const [gradeLevel, setGradeLevel] = useState(initialGradeLevel && GRADE_LEVELS.includes(initialGradeLevel) ? initialGradeLevel : 'Grade 7')
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const groups = useMemo(() => curriculumCatalogGroups(gradeLevel, schoolYear), [gradeLevel, schoolYear])
  const entries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en')
    return curriculumEntriesForGrade(gradeLevel, schoolYear).filter((entry) => {
      if (group !== 'all' && entry.group !== group) return false
      if (!needle) return true
      return [entry.learningArea, entry.displayName, entry.group, entry.curriculumName, entry.notes]
        .some((value) => value.toLocaleLowerCase('en').includes(needle))
    })
  }, [gradeLevel, group, query, schoolYear])

  return (
    <section className="panel national-curriculum-catalog" aria-labelledby="national-curriculum-catalog-title">
      <header className="catalog-heading">
        <div>
          <span className="eyebrow">Official curriculum catalog</span>
          <h2 id="national-curriculum-catalog-title">DepEd curriculum coverage</h2>
          <p>Browse source-grounded official offerings separately from competency-level imports. Only a verified competency pack can directly ground lesson plans, TOS, and assessments.</p>
        </div>
        <div className="catalog-stat-strip" aria-label="Curriculum catalog summary">
          <span><strong>{GRADE_LEVELS.length}</strong><small>grade levels</small></span>
          <span><strong>{CURRICULUM_CATALOG_STATS.entries}</strong><small>catalog entries</small></span>
          <span><strong>{CURRICULUM_CATALOG_STATS.verifiedCompetencyPacks}</strong><small>verified packs</small></span>
        </div>
      </header>

      <div className="catalog-controls">
        <label className="compact-select"><span>School year</span><select value={schoolYear} onChange={(event) => { setSchoolYear(event.target.value); setGroup('all') }}>{SCHOOL_YEARS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="compact-select"><span>Grade level</span><select value={gradeLevel} onChange={(event) => { setGradeLevel(event.target.value); setGroup('all') }}>{GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="compact-select"><span><Filter size={11} /> Group</span><select value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">All groups</option>{groups.map((item) => <option key={item.group} value={item.group}>{item.group}</option>)}</select></label>
        <div className="curriculum-search catalog-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects" aria-label="Search official curriculum catalog" /></div>
      </div>

      <div className="catalog-integrity-note"><ShieldCheck size={15} /><span><strong>Source integrity:</strong> catalogued means GuroDesk has a source-grounded official offering/rollout record. It does not mean the official competency text has already been transcribed. Pending subjects remain unavailable to competency-grounded workflows until a verified pack is imported.</span></div>

      <div className="catalog-entry-grid">
        {entries.map((entry) => {
          const highlighted = gradeLevel === initialGradeLevel && schoolYear === initialSchoolYear && entry.learningArea === highlightedLearningArea
          return (
            <article className={`catalog-entry ${highlighted ? 'highlighted' : ''}`} key={entry.id}>
              <span className={`catalog-status ${entry.status === 'verified_competencies' ? 'verified' : entry.status === 'transitional' ? 'transition' : 'pending'}`}>
                {entry.status === 'verified_competencies' ? <BookOpenCheck size={12} /> : <ShieldCheck size={12} />}{statusLabel(entry)}
              </span>
              <h3>{entry.displayName}</h3>
              <p>{entry.curriculumName}</p>
              <div className="catalog-entry-meta"><span>{entry.group}</span><span>{schoolYear}</span></div>
              <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="source-link">Official DepEd reference <ExternalLink size={12} /></a>
            </article>
          )
        })}
      </div>
      {!entries.length && <div className="mini-curriculum-empty">No official catalog entries match this grade, school year, and filter.</div>}
    </section>
  )
}
