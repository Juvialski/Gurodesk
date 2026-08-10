import { ArrowRight, BookOpen, Check, Plus, School, Trash2, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { GRADE_LEVELS, POSITION_TITLES, SCHOOL_YEARS } from '../data/constants'
import { curriculumCatalogGroups, findCurriculumCatalogEntry, learningAreasForGrade } from '../data/curriculumCatalog'
import type { Profile } from '../types/app'
import { Brand } from '../components/Brand'

type DraftAssignment = {
  gradeLevel: string
  learningArea: string
  sectionsText: string
}

export function OnboardingPage() {
  const { user, profile, assignments, updateProfile, createAssignment, removeAssignment } = useApp()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [form, setForm] = useState<Profile>(() => profile ?? {
    id: user?.id ?? '',
    email: user?.email ?? null,
    fullName: '',
    schoolName: '',
    region: '',
    division: '',
    positionTitle: 'Teacher I',
    schoolYear: '2026-2027',
    onboardingCompleted: false,
  })
  const [draft, setDraft] = useState<DraftAssignment>({
    gradeLevel: 'Grade 7',
    learningArea: 'Mathematics',
    sectionsText: '',
  })

  const sections = useMemo(
    () => draft.sectionsText.split(',').map((value) => value.trim()).filter(Boolean),
    [draft.sectionsText],
  )

  const learningAreas = useMemo(
    () => learningAreasForGrade(draft.gradeLevel, form.schoolYear),
    [draft.gradeLevel, form.schoolYear],
  )
  const learningAreaGroups = useMemo(
    () => curriculumCatalogGroups(draft.gradeLevel, form.schoolYear),
    [draft.gradeLevel, form.schoolYear],
  )
  const selectedCatalogEntry = useMemo(
    () => findCurriculumCatalogEntry(draft.gradeLevel, draft.learningArea, form.schoolYear),
    [draft.gradeLevel, draft.learningArea, form.schoolYear],
  )

  useEffect(() => {
    if (!learningAreas.length) return
    if (!learningAreas.includes(draft.learningArea)) {
      setDraft((current) => ({ ...current, learningArea: learningAreas[0] }))
    }
  }, [draft.learningArea, learningAreas])

  async function saveIdentity() {
    if (!form.fullName.trim() || !form.schoolName.trim()) {
      setLocalError('Name and school are required to continue.')
      return
    }
    setBusy(true)
    try {
      await updateProfile({ ...form, onboardingCompleted: false })
      setStep(2)
      setLocalError(null)
    } finally {
      setBusy(false)
    }
  }

  async function addAssignment() {
    if (!selectedCatalogEntry) {
      setLocalError('Choose a source-catalogued learning area for this grade and school year.')
      return
    }
    if (!user || sections.length === 0) {
      setLocalError('Add at least one section. Separate multiple sections with commas.')
      return
    }
    setBusy(true)
    try {
      await createAssignment({
        userId: user.id,
        schoolYear: form.schoolYear,
        gradeLevel: draft.gradeLevel,
        learningArea: draft.learningArea,
        sections,
        isActive: true,
      })
      setDraft((current) => ({ ...current, sectionsText: '' }))
      setLocalError(null)
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    if (assignments.length === 0) {
      setLocalError('Add at least one teaching assignment first.')
      return
    }
    setBusy(true)
    try {
      await updateProfile({ ...form, onboardingCompleted: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding-page">
      <header className="onboarding-top"><Brand /><span>Setup {step} of 2</span></header>
      <div className="onboarding-layout">
        <aside className="onboarding-intro">
          <span className="hero-kicker"><BookOpen size={15} /> Teacher setup</span>
          <h1>Set it once. GuroDesk adapts to what you teach.</h1>
          <p>Your school year and teaching assignments will later drive the correct curriculum, lesson-plan formats, assessments, and paperwork.</p>
          <div className="setup-steps">
            <div className={step >= 1 ? 'active' : ''}><span>{step > 1 ? <Check size={16} /> : '1'}</span><div><strong>Teacher profile</strong><small>School and current school year</small></div></div>
            <div className={step >= 2 ? 'active' : ''}><span>2</span><div><strong>Teaching load</strong><small>Grades, subjects, and sections</small></div></div>
          </div>
        </aside>

        <section className="onboarding-card panel">
          {step === 1 ? (
            <>
              <div className="section-title"><span className="title-icon"><UserRound size={20} /></span><div><h2>About you</h2><p>Use the details you normally place on school documents.</p></div></div>
              <div className="form-grid two">
                <label>Full name<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Juan Dela Cruz" /></label>
                <label>Position<select value={form.positionTitle} onChange={(e) => setForm({ ...form, positionTitle: e.target.value })}>{POSITION_TITLES.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="span-two">School name<input value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} placeholder="Your school" /></label>
                <label>Region<input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. NCR" /></label>
                <label>Schools Division<input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} placeholder="Optional" /></label>
                <label>School year<select value={form.schoolYear} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}>{SCHOOL_YEARS.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
              {localError && <div className="form-message error">{localError}</div>}
              <div className="form-footer"><span /><button className="button primary" onClick={() => void saveIdentity()} disabled={busy}>Continue <ArrowRight size={17} /></button></div>
            </>
          ) : (
            <>
              <div className="section-title"><span className="title-icon"><School size={20} /></span><div><h2>Your teaching load</h2><p>Add each grade and learning area once; include all sections taught under it.</p></div></div>
              <div className="assignment-builder">
                <div className="form-grid three">
                  <label>Grade level<select value={draft.gradeLevel} onChange={(e) => setDraft({ ...draft, gradeLevel: e.target.value })}>{GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label>Learning area<select value={draft.learningArea} onChange={(e) => setDraft({ ...draft, learningArea: e.target.value })} disabled={!learningAreaGroups.length}>{learningAreaGroups.map(({ group, entries }) => <optgroup key={group} label={group}>{entries.map((entry) => <option key={entry.id} value={entry.learningArea}>{entry.displayName}</option>)}</optgroup>)}</select></label>
                  <label>Sections<input value={draft.sectionsText} onChange={(e) => setDraft({ ...draft, sectionsText: e.target.value })} placeholder="Rizal, Mabini" /></label>
                </div>
                {selectedCatalogEntry && (
                  <div className={`curriculum-assignment-note ${selectedCatalogEntry.status === 'verified_competencies' ? 'verified' : selectedCatalogEntry.status === 'transitional' ? 'transition' : 'catalogued'}`}>
                    <strong>{selectedCatalogEntry.status === 'verified_competencies' ? 'Verified competency pack ready.' : selectedCatalogEntry.status === 'transitional' ? 'Transitional curriculum selection.' : 'Official curriculum offering catalogued.'}</strong>
                    <span>{selectedCatalogEntry.notes}</span>
                  </div>
                )}
                <button className="button secondary" onClick={() => void addAssignment()} disabled={busy}><Plus size={17} /> Add assignment</button>
              </div>

              <div className="assignment-list compact-list">
                {assignments.length === 0 ? <div className="mini-empty">No assignments yet.</div> : assignments.map((item) => (
                  <div className="assignment-row" key={item.id}>
                    <div><strong>{item.gradeLevel} · {item.learningArea}</strong><span>{item.sections.join(' · ')}</span></div>
                    <button className="icon-button danger" aria-label="Remove assignment" onClick={() => void removeAssignment(item.id)}><Trash2 size={17} /></button>
                  </div>
                ))}
              </div>
              {localError && <div className="form-message error">{localError}</div>}
              <div className="form-footer"><button className="button ghost" onClick={() => setStep(1)}>Back</button><button className="button primary" onClick={() => void finish()} disabled={busy}>Open workspace <ArrowRight size={17} /></button></div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
