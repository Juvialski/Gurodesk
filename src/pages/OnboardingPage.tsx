import { ArrowRight, BookOpen, Check, Plus, School, Trash2, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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

  const officialAreas = useMemo(() => learningAreasForGrade(draft.gradeLevel, form.schoolYear), [draft.gradeLevel, form.schoolYear])
  const officialGroups = useMemo(() => curriculumCatalogGroups(draft.gradeLevel, form.schoolYear), [draft.gradeLevel, form.schoolYear])
  const selectedOfficialEntry = findCurriculumCatalogEntry(draft.gradeLevel, draft.learningArea, form.schoolYear)
  const sections = useMemo(
    () => draft.sectionsText.split(',').map((value) => value.trim()).filter(Boolean),
    [draft.sectionsText],
  )

  useEffect(() => {
    if (!officialAreas.length) return
    if (!officialAreas.includes(draft.learningArea)) setDraft((current) => ({ ...current, learningArea: officialAreas[0] }))
  }, [draft.learningArea, officialAreas])

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
    if (!selectedOfficialEntry) {
      setLocalError('Choose a source-catalogued official learning area for this grade and school year.')
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
        curriculumSourceKind: 'official',
        curriculumVersionId: null,
      })
      setDraft((current) => ({ ...current, sectionsText: '' }))
      setLocalError(null)
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    setBusy(true)
    try {
      await updateProfile({ ...form, onboardingCompleted: true })
    } finally {
      setBusy(false)
    }
  }

  async function finishWithPrivateCurriculum() {
    setBusy(true)
    try {
      await updateProfile({ ...form, onboardingCompleted: true })
      navigate('/curriculum', { replace: true })
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
              <div className="section-title"><span className="title-icon"><School size={20} /></span><div><h2>Your teaching load</h2><p>Add official DepEd assignments now, or finish setup without one and import your private-school curriculum from Curriculum Navigator first.</p></div></div>
              <div className="assignment-builder">
                <div className="form-grid three">
                  <label>Grade level<select value={draft.gradeLevel} onChange={(e) => setDraft({ ...draft, gradeLevel: e.target.value })}>{GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label>Learning area<select value={draft.learningArea} onChange={(e) => setDraft({ ...draft, learningArea: e.target.value })} disabled={!officialGroups.length}>{officialGroups.map(({ group, entries }) => <optgroup key={group} label={group}>{entries.map((entry) => <option key={entry.id} value={entry.learningArea}>{entry.displayName}</option>)}</optgroup>)}</select></label>
                  <label>Sections<input value={draft.sectionsText} onChange={(e) => setDraft({ ...draft, sectionsText: e.target.value })} placeholder="Rizal, Mabini" /></label>
                </div>
                <button className="button secondary" onClick={() => void addAssignment()} disabled={busy || !selectedOfficialEntry}><Plus size={17} /> Add assignment</button>
              </div>
              {selectedOfficialEntry && <div className="custom-curriculum-assignment-help"><BookOpen size={15} /><span>{selectedOfficialEntry.status === 'verified_competencies' ? 'Verified competency pack ready.' : selectedOfficialEntry.status === 'transitional' ? 'Official transition offering catalogued; exact competencies remain source-gated.' : 'Official curriculum offering catalogued; exact competencies remain source-gated until imported.'}</span></div>}

              <div className="private-curriculum-onboarding">
                <div><strong>Private school or school-developed curriculum?</strong><span>Skip the official assignment for now. Upload, paste, or manually create your school curriculum, review it, then attach the approved version to your class.</span></div>
                <button className="button secondary" onClick={() => void finishWithPrivateCurriculum()} disabled={busy}>Set up school curriculum <ArrowRight size={16} /></button>
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
              <div className="form-footer"><button className="button ghost" onClick={() => setStep(1)}>Back</button><button className="button primary" onClick={() => void finish()} disabled={busy}>{assignments.length ? 'Open workspace' : 'Skip classes for now'} <ArrowRight size={17} /></button></div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
