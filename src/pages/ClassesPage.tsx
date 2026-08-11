import { BookMarked, Plus, School, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { GRADE_LEVELS } from '../data/constants'
import { curriculumCatalogGroups, findCurriculumCatalogEntry, learningAreasForGrade } from '../data/curriculumCatalog'
import { listCustomCurriculumChoices } from '../lib/customCurriculumRepository'
import type { CurriculumSourceKind, CustomCurriculumChoice } from '../types/customCurriculum'
import '../workflows.css'

function sourceLabel(kind: CurriculumSourceKind) {
  if (kind === 'hybrid') return 'DepEd + school enrichment'
  if (kind === 'custom') return 'School curriculum'
  return 'Official DepEd'
}

export function ClassesPage() {
  const { user, profile, assignments, createAssignment, removeAssignment } = useApp()
  const [open, setOpen] = useState(false)
  const [gradeLevel, setGradeLevel] = useState('Grade 7')
  const [learningArea, setLearningArea] = useState('Mathematics')
  const [sectionDraft, setSectionDraft] = useState('')
  const [sections, setSections] = useState<string[]>([])
  const [sourceKind, setSourceKind] = useState<CurriculumSourceKind>('official')
  const [curriculumVersionId, setCurriculumVersionId] = useState('')
  const [customChoices, setCustomChoices] = useState<CustomCurriculumChoice[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [customizeCurriculum, setCustomizeCurriculum] = useState(false)
  const schoolYear = profile?.schoolYear ?? '2026-2027'
  const officialAreas = useMemo(() => learningAreasForGrade(gradeLevel, schoolYear), [gradeLevel, schoolYear])
  const officialGroups = useMemo(() => curriculumCatalogGroups(gradeLevel, schoolYear), [gradeLevel, schoolYear])
  const selectedOfficialEntry = sourceKind === 'official' ? findCurriculumCatalogEntry(gradeLevel, learningArea, schoolYear) : null
  const filteredChoices = useMemo(
    () => customChoices.filter((choice) => choice.originKind === sourceKind),
    [customChoices, sourceKind],
  )
  const selectedChoice = customChoices.find((choice) => choice.versionId === curriculumVersionId) ?? null

  useEffect(() => {
    if (!user) return
    let active = true
    void listCustomCurriculumChoices(user.id, schoolYear)
      .then((items) => { if (active) setCustomChoices(items) })
      .catch(() => { if (active) setCustomChoices([]) })
    return () => { active = false }
  }, [schoolYear, user])

  useEffect(() => {
    if (sourceKind !== 'official' || !officialAreas.length) return
    if (!officialAreas.includes(learningArea)) setLearningArea(officialAreas[0])
  }, [learningArea, officialAreas, sourceKind])

  useEffect(() => {
    if (sourceKind === 'official') {
      setCurriculumVersionId('')
      return
    }
    const current = filteredChoices.find((choice) => choice.versionId === curriculumVersionId)
    const next = current ?? filteredChoices[0] ?? null
    setCurriculumVersionId(next?.versionId ?? '')
    if (next) {
      setGradeLevel(next.gradeLevel)
      setLearningArea(next.learningArea)
    }
  }, [curriculumVersionId, filteredChoices, sourceKind])

  async function add() {
    const pendingSection = sectionDraft.trim().replace(/\s+/g, ' ')
    const nextSections = pendingSection && !sections.includes(pendingSection) ? [...sections, pendingSection] : sections
    if (!user || nextSections.length === 0) {
      setMessage('Add at least one section.')
      return
    }
    if (sourceKind === 'official' && !selectedOfficialEntry) {
      setMessage('Choose a source-catalogued official learning area for this grade and school year.')
      return
    }
    if (sourceKind !== 'official' && !selectedChoice) {
      setMessage('Approve a matching school curriculum first, then select it here.')
      return
    }
    await createAssignment({
      userId: user.id,
      schoolYear,
      gradeLevel: selectedChoice?.gradeLevel ?? gradeLevel,
      learningArea: selectedChoice?.learningArea ?? learningArea,
      sections: nextSections,
      isActive: true,
      curriculumSourceKind: sourceKind,
      curriculumVersionId: sourceKind === 'official' ? null : selectedChoice?.versionId ?? null,
    })
    setSections([])
    setSectionDraft('')
    setOpen(false)
    setMessage(null)
  }

  function addSection(value = sectionDraft) {
    const next = value.trim().replace(/\s+/g, ' ')
    if (!next) return
    setSections((current) => current.includes(next) ? current : [...current, next])
    setSectionDraft('')
  }

  return (
    <>
      <PageHeader
        eyebrow="Teaching setup"
        title="Classes"
        description="Add the classes you teach. Official curriculum is resolved from your grade, learning area, and school year."
        actions={<button aria-label="Add assignment" className="button primary" onClick={() => setOpen(!open)}><Plus size={17} /> Add class</button>}
      />

      {open && (
        <div className="panel inline-form-panel">
          <div className="workflow-class-intro"><strong>Set up an official class</strong><p>Choose a grade, learning area, and one or more sections. GuroDesk will resolve the verified curriculum for {schoolYear}.</p></div>
          <div className="form-grid three">
            {customizeCurriculum && <label>Curriculum source<select value={sourceKind} onChange={(e) => setSourceKind(e.target.value as CurriculumSourceKind)}>
              <option value="official">Official DepEd</option>
              <option value="custom">My / school curriculum</option>
              <option value="hybrid">DepEd + school enrichment</option>
            </select></label>}

            {sourceKind === 'official' ? <>
              <label>Grade level<select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>{GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Learning area<select value={learningArea} onChange={(e) => setLearningArea(e.target.value)} disabled={!officialGroups.length}>{officialGroups.map(({ group, entries }) => <optgroup key={group} label={group}>{entries.map((entry) => <option key={entry.id} value={entry.learningArea}>{entry.displayName}</option>)}</optgroup>)}</select></label>
            </> : (
              <label className="span-two">Approved curriculum<select value={curriculumVersionId} onChange={(e) => setCurriculumVersionId(e.target.value)} disabled={!filteredChoices.length}>
                {!filteredChoices.length && <option value="">No approved {sourceKind === 'hybrid' ? 'hybrid' : 'school'} curriculum yet</option>}
                {filteredChoices.map((choice) => <option key={choice.versionId} value={choice.versionId}>{choice.gradeLevel} · {choice.learningArea} · {choice.name} · r{choice.revisionNumber}</option>)}
              </select></label>
            )}
            <label className="workflow-sections-field">Sections<span className="workflow-input-row"><input value={sectionDraft} onChange={(e) => setSectionDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSection() } }} placeholder="e.g. Rizal" /><button type="button" className="button secondary" onClick={() => addSection()}>Add</button></span><span className="workflow-chip-row workflow-section-chips">{sections.map((section) => <button type="button" key={section} className="workflow-chip selected" onClick={() => setSections((current) => current.filter((item) => item !== section))}>{section} <span aria-hidden="true">×</span></button>)}</span><small>Press Enter or Add for each section.</small></label>
          </div>
          <button type="button" className="text-button workflow-advanced-link" onClick={() => setCustomizeCurriculum((value) => { if (value) setSourceKind('official'); return !value })}>{customizeCurriculum ? 'Use official curriculum setup' : 'Change curriculum type'} </button>
          {sourceKind === 'official' && selectedOfficialEntry && (
            <div className="custom-curriculum-assignment-help"><BookMarked size={15} /><span>{selectedOfficialEntry.status === 'verified_competencies' ? 'Verified competency pack ready' : selectedOfficialEntry.status === 'transitional' ? 'Official transition catalog entry; exact competencies remain source-gated' : 'Official curriculum catalogued; exact competencies remain source-gated until imported'}</span></div>
          )}
          {sourceKind !== 'official' && !filteredChoices.length && (
            <div className="custom-curriculum-assignment-help"><BookMarked size={15} /><span>Create and approve the curriculum in <Link to="/curriculum">Curriculum Navigator</Link> first. It stays private to your account.</span></div>
          )}
          {selectedChoice && sourceKind !== 'official' && <div className="custom-curriculum-assignment-help"><School size={15} /><span>{selectedChoice.organizationName || 'Private curriculum'} · {selectedChoice.schoolYear} · {sourceLabel(sourceKind)}</span></div>}
          {message && <div className="form-message error">{message}</div>}
          <div className="inline-actions"><button className="button ghost" onClick={() => setOpen(false)}>Cancel</button><button aria-label="Save assignment" className="button secondary" onClick={() => void add()}>Save class</button></div>
        </div>
      )}

      <div className="panel table-panel">
        <div className="responsive-table">
          <table>
            <thead><tr><th>Grade</th><th>Learning area</th><th>Curriculum</th><th>Sections</th><th>School year</th><th></th></tr></thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id}>
                  <td><span className="table-grade"><School size={15} /> {item.gradeLevel}</span></td>
                  <td><strong>{item.learningArea}</strong></td>
                  <td><span className={`curriculum-source-badge ${item.curriculumSourceKind}`}>{sourceLabel(item.curriculumSourceKind)}</span></td>
                  <td>{item.sections.map((section) => <span className="tag" key={section}>{section}</span>)}</td>
                  <td>{item.schoolYear}</td>
                  <td><button className="icon-button danger" onClick={() => void removeAssignment(item.id)} aria-label="Delete assignment"><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {assignments.length === 0 && <div className="mini-empty">No teaching assignments yet.</div>}
      </div>
    </>
  )
}
