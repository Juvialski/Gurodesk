import { ArrowRight, BookOpen, Check, CheckCircle2, Plus, School, Sparkles, Trash2, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { GRADE_LEVELS, POSITION_TITLES, SCHOOL_YEARS } from '../data/constants'
import { curriculumCatalogGroups, findCurriculumCatalogEntry, learningAreasForGrade } from '../data/curriculumCatalog'
import type { Profile } from '../types/app'
import { Brand } from '../components/Brand'
import '../workflows.css'

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
  const [privateCurriculum, setPrivateCurriculum] = useState(false)

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
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to save your profile.')
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
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to add this class.')
    } finally {
      setBusy(false)
    }
  }

  async function finishAndNavigate(path: string) {
    setBusy(true)
    setLocalError(null)
    try {
      await updateProfile({ ...form, onboardingCompleted: true })
      if (path === '/curriculum') navigateToCurriculum()
      else navigate(path, { replace: true })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to finish setup.')
    } finally {
      setBusy(false)
    }
  }

  function navigateToCurriculum() {
    navigate('/curriculum', { replace: true })
  }

  async function finishWithPrivateCurriculum() {
    setPrivateCurriculum(true)
    setLocalError(null)
    setStep(3)
  }

  return (
    <div className="onboarding-page">
      <header className="onboarding-top"><Brand /><span>Setup {step} of 4</span></header>
      <div className="onboarding-layout">
        <aside className="onboarding-intro">
          <span className="hero-kicker"><BookOpen size={15} /> Teacher setup</span>
          <h1>Set it once. GuroDesk adapts to what you teach.</h1>
          <p>Your school year and teaching assignments drive curriculum context across lesson plans, TOS, assessments, results, and related reports.</p>
          <div className="setup-steps">
            <div className={step >= 1 ? 'active' : ''}><span>{step > 1 ? <Check size={16} /> : '1'}</span><div><strong>About you</strong><small>Name, school, and school year</small></div></div>
            <div className={step >= 2 ? 'active' : ''}><span>{step > 2 ? <Check size={16} /> : '2'}</span><div><strong>What you teach</strong><small>One class and its sections</small></div></div>
            <div className={step >= 3 ? 'active' : ''}><span>{step > 3 ? <Check size={16} /> : '3'}</span><div><strong>AI setup</strong><small>Optional Gemini assistance</small></div></div>
            <div className={step >= 4 ? 'active' : ''}><span>4</span><div><strong>Ready</strong><small>Choose your first task</small></div></div>
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
          ) : step === 2 ? (
            <>
              <div className="section-title"><span className="title-icon"><School size={20} /></span><div><h2>What do you teach? <span className="sr-only">Your teaching load</span></h2><p>Add at least one class. Official curriculum is resolved from your grade, learning area, and school year.</p></div></div>
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
                <div><strong>Private school or school-developed curriculum?</strong><span>Use your school's curriculum instead. You can add and approve it from Curriculum after setup.</span></div>
                <button aria-label="Set up school curriculum" className="button secondary" onClick={() => void finishWithPrivateCurriculum()} disabled={busy}>Use my school's curriculum <ArrowRight size={16} /></button>
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
              <div className="form-footer"><button className="button ghost" onClick={() => setStep(1)}>Back</button><button className="button secondary" onClick={() => void finishAndNavigate('/')} disabled={busy}>Open workspace</button><button className="button primary" onClick={() => setStep(3)} disabled={busy}>{assignments.length ? 'Continue' : 'Skip classes for now'} <ArrowRight size={17} /></button></div>
            </>
          ) : step === 3 ? (
            <>
              <div className="section-title"><span className="title-icon"><Sparkles size={20} /></span><div><h2>Optional AI setup</h2><p>Connect Gemini if you want help creating draft lesson plans and assessments. You can finish setup without AI.</p></div></div>
              <div className="workflow-onboarding-choice-grid"><button type="button" className="workflow-onboarding-choice" onClick={() => void finishAndNavigate('/settings#ai-assistance')} disabled={busy}><Sparkles size={20} /><strong>Connect now</strong><span>Open AI assistance settings after onboarding.</span><small>No key details are shown here.</small></button><button type="button" className="workflow-onboarding-choice" onClick={() => setStep(4)} disabled={busy}><CheckCircle2 size={20} /><strong>Set up later</strong><span>Start teaching first and connect AI whenever you are ready.</span></button></div>
              {privateCurriculum && <div className="workflow-info-note"><BookOpen size={15} /> You can attach your approved school curriculum from Curriculum after setup.</div>}
              {localError && <div className="form-message error">{localError}</div>}
              <div className="form-footer"><button className="button ghost" onClick={() => setStep(2)}>Back</button><button className="button primary" onClick={() => setStep(4)} disabled={busy}>Set up later <ArrowRight size={17} /></button></div>
            </>
          ) : (
            <>
              <div className="section-title"><span className="title-icon"><CheckCircle2 size={20} /></span><div><h2>You’re ready to go</h2><p>Your workspace is set up. Choose a first task, or open the workspace and explore.</p></div></div>
              <div className="workflow-ready-actions">{privateCurriculum ? <button type="button" className="workflow-ready-card" onClick={() => void finishAndNavigate('/curriculum')} disabled={busy}><BookOpen size={19} /><strong>Set up my curriculum</strong><span>Open Curriculum to add and approve your school's curriculum.</span></button> : <button type="button" className="workflow-ready-card" onClick={() => void finishAndNavigate('/lesson-plans/new')} disabled={busy}><BookOpen size={19} /><strong>Create lesson plan</strong><span>Start with a topic and add verified curriculum alignment as needed.</span></button>}<button type="button" className="workflow-ready-card" onClick={() => void finishAndNavigate('/tos/new')} disabled={busy}><School size={19} /><strong>Create TOS</strong><span>Choose covered competencies and a test size.</span></button><button type="button" className="workflow-ready-card" onClick={() => void finishAndNavigate('/assessments/new')} disabled={busy}><Sparkles size={19} /><strong>Create test</strong><span>Build a test from a finalized TOS.</span></button></div>
              {localError && <div className="form-message error">{localError}</div>}
              <div className="form-footer"><button className="button ghost" onClick={() => setStep(3)}>Back</button><button className="button secondary" onClick={() => void finishAndNavigate('/')} disabled={busy}>Open workspace <ArrowRight size={17} /></button></div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
