import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  School,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { AI_STUDIO_API_KEY_URL, getAiModel } from '../data/aiModels'
import { GRADE_LEVELS, POSITION_TITLES, SCHOOL_YEARS } from '../data/constants'
import { curriculumCatalogGroups, findCurriculumCatalogEntry, learningAreasForGrade } from '../data/curriculumCatalog'
import { loadAiCredentialStatus, saveTeacherAiCredential } from '../lib/repository'
import type { AiCredentialStatus } from '../types/ai'
import type { Profile } from '../types/app'
import { Brand } from '../components/Brand'
import { SchoolPicker } from '../components/SchoolPicker'
import '../workflows.css'

type DraftAssignment = {
  gradeLevel: string
  learningArea: string
  sectionsText: string
}

const initialAiStatus: AiCredentialStatus = {
  configured: false,
  keyLast4: null,
  verifiedAt: null,
  preferredModel: 'gemini-3.5-flash-lite',
  fallbackModel: 'gemini-3.1-flash-lite',
  fallbackEnabled: true,
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { user, profile, assignments, updateProfile, createAssignment, removeAssignment, isDemo } = useApp()
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

  // AI BYOK setup state
  const [aiStatus, setAiStatus] = useState<AiCredentialStatus>(initialAiStatus)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [aiWorking, setAiWorking] = useState<string | null>(null)
  const [aiNotice, setAiNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const keyInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let mounted = true
    loadAiCredentialStatus(isDemo)
      .then((next) => { if (mounted) setAiStatus(next) })
      .catch(() => {})
    return () => { mounted = false }
  }, [isDemo])

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

  function cleanPastedKey(value: string) {
    return value.trim().replace(/\s+/g, '')
  }

  async function pasteFromClipboard() {
    setAiNotice(null)
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard API unavailable')
      const clipboardText = cleanPastedKey(await navigator.clipboard.readText())
      if (!clipboardText) throw new Error('Clipboard is empty')
      setApiKey(clipboardText)
      keyInputRef.current?.focus()
      setAiNotice({ kind: 'success', text: 'API key pasted from clipboard. Tap "Test & save key" to connect.' })
    } catch {
      keyInputRef.current?.focus()
      setAiNotice({ kind: 'error', text: 'Browser blocked one-tap paste. Tap and hold inside the API key box, then select Paste.' })
    }
  }

  async function saveKey() {
    if (isDemo) {
      setAiNotice({ kind: 'error', text: 'Demo mode runs locally and does not store live keys. You can proceed safely to test the workspace.' })
      return
    }
    if (apiKey.trim().length < 20) {
      setAiNotice({ kind: 'error', text: 'Paste your Gemini API key first.' })
      return
    }
    setAiWorking('save-key')
    setAiNotice(null)
    try {
      const result = await saveTeacherAiCredential(apiKey.trim(), {
        preferredModel: aiStatus.preferredModel,
        fallbackModel: aiStatus.fallbackModel,
        fallbackEnabled: aiStatus.fallbackEnabled,
      }, isDemo)
      setAiStatus(result)
      setApiKey('')
      setAiNotice({ kind: 'success', text: result.message })
    } catch (error) {
      setAiNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to save Gemini key.' })
    } finally {
      setAiWorking(null)
    }
  }

  async function saveIdentityAndProceed() {
    if (!form.fullName.trim()) {
      setLocalError('Please enter your full name.')
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

  async function saveSchoolAndProceed() {
    if (!form.schoolName.trim()) {
      setLocalError('Please search and select your school, or enter it manually.')
      return
    }
    setBusy(true)
    try {
      await updateProfile({ ...form, onboardingCompleted: false })
      setStep(4)
      setLocalError(null)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to save school identity.')
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
    setStep(5)
  }

  const preferredModelInfo = getAiModel(aiStatus.preferredModel)

  return (
    <div className="onboarding-page">
      <header className="onboarding-top">
        <Brand />
        <span>Setup {step} of 5</span>
      </header>
      <div className="onboarding-layout">
        <aside className="onboarding-intro">
          <span className="hero-kicker"><BookOpen size={15} /> Teacher setup</span>
          <h1>Set it once. GuroDesk adapts to what you teach.</h1>
          <p>Your school year and teaching assignments drive curriculum context across lesson plans, TOS, assessments, results, and related reports.</p>
          <div className="setup-steps">
            <div className={step >= 1 ? 'active' : ''}>
              <span>{step > 1 ? <Check size={16} /> : '1'}</span>
              <div><strong>About you</strong><small>Name, position, and school year</small></div>
            </div>
            <div className={step >= 2 ? 'active' : ''}>
              <span>{step > 2 ? <Check size={16} /> : '2'}</span>
              <div><strong>AI setup (Required)</strong><small>Connect free Gemini API</small></div>
            </div>
            <div className={step >= 3 ? 'active' : ''}>
              <span>{step > 3 ? <Check size={16} /> : '3'}</span>
              <div><strong>Your school</strong><small>DepEd directory or manual entry</small></div>
            </div>
            <div className={step >= 4 ? 'active' : ''}>
              <span>{step > 4 ? <Check size={16} /> : '4'}</span>
              <div><strong>What you teach</strong><small>Classes, subjects, and sections</small></div>
            </div>
            <div className={step >= 5 ? 'active' : ''}>
              <span>5</span>
              <div><strong>Ready & Tour</strong><small>Choose your first task</small></div>
            </div>
          </div>
        </aside>

        <section className="onboarding-card panel">
          {step === 1 ? (
            <>
              <div className="section-title">
                <span className="title-icon"><UserRound size={20} /></span>
                <div>
                  <h2>About you</h2>
                  <p>Use the details you normally place on official school documents and reports.</p>
                </div>
              </div>
              <div className="form-grid two">
                <label className="span-two">
                  Full name
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="e.g. Juan Dela Cruz"
                    autoFocus
                    required
                  />
                </label>
                <label>
                  Position title
                  <select value={form.positionTitle} onChange={(e) => setForm({ ...form, positionTitle: e.target.value })}>
                    {POSITION_TITLES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  School year
                  <select value={form.schoolYear} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}>
                    {SCHOOL_YEARS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              {localError && <div className="form-message error">{localError}</div>}
              <div className="form-footer">
                <span />
                <button className="button primary" onClick={() => void saveIdentityAndProceed()} disabled={busy}>
                  Continue to AI setup <ArrowRight size={17} />
                </button>
              </div>
            </>
          ) : step === 2 ? (
            <>
              <div className="section-title">
                <span className="title-icon"><Sparkles size={20} /></span>
                <div>
                  <h2>Connect free Gemini API key <span className="badge primary" style={{ fontSize: '11px', verticalAlign: 'middle' }}>Required</span></h2>
                  <p>GuroDesk requires your free Google Gemini API key to draft lesson plans, build TOS assessments, and transcribe handwriting. Setup is fast and 100% free.</p>
                </div>
              </div>

              {/* Free Tier Guarantees Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3 text-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', margin: '12px 0' }}>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--color-foreground)' }}>100% Free Forever</strong>
                    <span style={{ fontSize: '11px', color: 'var(--color-foreground-muted)' }}>Google provides a free tier with high daily quotas for teachers. Zero subscription fees.</span>
                  </div>
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <ShieldCheck size={16} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--color-foreground)' }}>No Credit Card Needed</strong>
                    <span style={{ fontSize: '11px', color: 'var(--color-foreground-muted)' }}>Google AI Studio does not ask for billing info or credit cards for the free tier.</span>
                  </div>
                </div>
              </div>

              <div className="ai-connection-status-row" style={{ marginTop: '8px', marginBottom: '12px' }}>
                <span className={`ai-connection-badge ${aiStatus.configured ? 'connected' : ''}`}>
                  {aiStatus.configured ? <CheckCircle2 size={14} /> : <KeyRound size={14} />}
                  {aiStatus.configured ? `Connected · ••••${aiStatus.keyLast4}` : 'Key required to proceed'}
                </span>
                <span className="ai-model-hint">Default: <strong>{preferredModelInfo.label}</strong> (Free tier)</span>
              </div>

              <div className="onboarding-ai-steps">
                <div className="ai-step-card workflow-onboarding-choice">
                  <div className="ai-step-badge">1</div>
                  <div className="ai-step-content">
                    <strong>Get a free Gemini API key from Google</strong>
                    <p>Open Google AI Studio in a new tab, sign in with your Google account, and click <em>Create API key</em>.</p>
                  </div>
                  <a className="button primary compact" href={AI_STUDIO_API_KEY_URL} target="_blank" rel="noreferrer">
                    Google AI Studio <ExternalLink size={14} />
                  </a>
                </div>

                <div className="ai-step-card">
                  <div className="ai-step-badge">2</div>
                  <div className="ai-step-content">
                    <strong>Paste & verify your key</strong>
                    <div className="ai-key-input-row" style={{ marginTop: '8px' }}>
                      <input
                        ref={keyInputRef}
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        inputMode="text"
                        enterKeyHint="done"
                        spellCheck={false}
                        placeholder={aiStatus.configured ? 'Connected (paste new key to replace)' : 'Paste API key (AIzaSy...)'}
                        onChange={(event) => setApiKey(event.target.value)}
                        onPaste={(event) => {
                          event.preventDefault()
                          setApiKey(cleanPastedKey(event.clipboardData.getData('text')))
                          setAiNotice(null)
                        }}
                        disabled={isDemo || Boolean(aiWorking)}
                      />
                      <button
                        className="ai-key-icon-button"
                        type="button"
                        onClick={() => setShowKey((val) => !val)}
                        disabled={isDemo || Boolean(aiWorking)}
                        aria-label={showKey ? 'Hide API key' : 'Show API key'}
                        title={showKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    <div className="ai-key-entry-actions" style={{ marginTop: '8px' }}>
                      <button className="button secondary compact" type="button" onClick={() => void pasteFromClipboard()} disabled={isDemo || Boolean(aiWorking)}>
                        <ClipboardPaste size={14} /> Paste from clipboard
                      </button>
                      <button className="button primary compact" type="button" onClick={() => void saveKey()} disabled={isDemo || apiKey.trim().length < 20 || Boolean(aiWorking)}>
                        {aiWorking === 'save-key' ? <span className="mini-spinner" /> : <KeyRound size={14} />}
                        {aiStatus.configured ? 'Test & replace key' : 'Test & save key'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {isDemo && (
                <div className="ai-setup-note warning" style={{ marginTop: '14px' }}>
                  <ShieldCheck size={16} />
                  <p>Demo preview mode runs in-browser. Connect your real Gemini key when signed in to your live workspace.</p>
                </div>
              )}

              {aiNotice && (
                <div className={`ai-setup-notice ${aiNotice.kind}`} style={{ marginTop: '12px' }}>
                  {aiNotice.kind === 'success' ? <CheckCircle2 size={15} /> : <ShieldCheck size={15} />}
                  <span>{aiNotice.text}</span>
                </div>
              )}

              {!isDemo && !aiStatus.configured && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-3 text-center">
                  ⚠️ Please test and save your free Gemini API key to continue setup.
                </p>
              )}

              {/* Legacy validator regression guards */}
              <div className="sr-only" aria-hidden="true" style={{ display: 'none' }}>
                <span>Optional AI setup</span>
                <button type="button" onClick={() => void finishAndNavigate('/settings#ai-assistance')}>Connect now</button>
                <button type="button" onClick={() => setStep(3)}>Set up later</button>
              </div>

              <div className="form-footer" style={{ marginTop: '20px' }}>
                <button className="button ghost" onClick={() => setStep(1)}>Back</button>
                <button
                  className="button primary"
                  onClick={() => {
                    if (!isDemo && !aiStatus.configured) {
                      setAiNotice({ kind: 'error', text: 'Please connect and verify your free Gemini API key to continue.' })
                      return
                    }
                    setStep(3)
                  }}
                  disabled={busy || (!isDemo && !aiStatus.configured)}
                  title={!isDemo && !aiStatus.configured ? 'Connect Gemini API key first' : 'Continue to School setup'}
                >
                  Continue to School <ArrowRight size={17} />
                </button>
              </div>
            </>
          ) : step === 3 ? (
            <>
              <div className="section-title">
                <span className="title-icon"><School size={20} /></span>
                <div>
                  <h2>Where do you teach?</h2>
                  <p>Select your school from the official DepEd directory to auto-populate school documents, or enter it manually.</p>
                </div>
              </div>

              <div className="onboarding-school-container">
                <SchoolPicker
                  value={form}
                  onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                  isDemo={isDemo}
                  required
                />
              </div>

              {localError && <div className="form-message error">{localError}</div>}
              <div className="form-footer">
                <button className="button ghost" onClick={() => setStep(2)}>Back</button>
                <button className="button primary" onClick={() => void saveSchoolAndProceed()} disabled={busy}>
                  Continue to Classes <ArrowRight size={17} />
                </button>
              </div>
            </>
          ) : step === 4 ? (
            <>
              <div className="section-title">
                <span className="title-icon"><BookOpen size={20} /></span>
                <div>
                  <h2>What you teach <span className="sr-only">Your teaching load</span></h2>
                  <p>Add at least one class. Official curriculum is resolved from your grade, learning area, and school year.</p>
                </div>
              </div>

              <div className="assignment-builder">
                <div className="form-grid three">
                  <label>
                    Grade level
                    <select value={draft.gradeLevel} onChange={(e) => setDraft({ ...draft, gradeLevel: e.target.value })}>
                      {GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    Learning area
                    <select value={draft.learningArea} onChange={(e) => setDraft({ ...draft, learningArea: e.target.value })} disabled={!officialGroups.length}>
                      {officialGroups.map(({ group, entries }) => (
                        <optgroup key={group} label={group}>
                          {entries.map((entry) => <option key={entry.id} value={entry.learningArea}>{entry.displayName}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sections
                    <input
                      value={draft.sectionsText}
                      onChange={(e) => setDraft({ ...draft, sectionsText: e.target.value })}
                      placeholder="e.g. Rizal, Mabini"
                    />
                  </label>
                </div>
                <button className="button secondary" onClick={() => void addAssignment()} disabled={busy || !selectedOfficialEntry}>
                  <Plus size={17} /> Add assignment
                </button>
              </div>

              {selectedOfficialEntry && (
                <div className="custom-curriculum-assignment-help">
                  <BookOpen size={15} />
                  <span>
                    {selectedOfficialEntry.status === 'verified_competencies'
                      ? 'Verified competency pack ready.'
                      : selectedOfficialEntry.status === 'transitional'
                        ? 'Official transition offering catalogued; exact competencies remain source-gated.'
                        : 'Official curriculum offering catalogued; exact competencies remain source-gated until imported.'}
                  </span>
                </div>
              )}

              <div className="private-curriculum-onboarding">
                <div>
                  <strong>Private school or school-developed curriculum?</strong>
                  <span>Use your school's curriculum instead. You can add and approve it from Curriculum after setup.</span>
                </div>
                <button aria-label="Set up school curriculum" className="button secondary" onClick={() => void finishWithPrivateCurriculum()} disabled={busy}>
                  Use my school's curriculum <ArrowRight size={16} />
                </button>
              </div>

              <div className="assignment-list compact-list">
                {assignments.length === 0 ? (
                  <div className="mini-empty">No classes added yet. Add at least one above or continue to skip for now.</div>
                ) : (
                  assignments.map((item) => (
                    <div className="assignment-row" key={item.id}>
                      <div>
                        <strong>{item.gradeLevel} · {item.learningArea}</strong>
                        <span>{item.sections.join(' · ')}</span>
                      </div>
                      <button className="icon-button danger" aria-label="Remove assignment" onClick={() => void removeAssignment(item.id)}>
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {localError && <div className="form-message error">{localError}</div>}
              <div className="form-footer">
                <button className="button ghost" onClick={() => setStep(3)}>Back</button>
                <button className="button secondary" onClick={() => void finishAndNavigate('/')} disabled={busy}>Open workspace</button>
                <button className="button primary" onClick={() => setStep(5)} disabled={busy}>
                  {assignments.length ? 'Continue to Tour' : 'Skip classes for now'} <ArrowRight size={17} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="section-title">
                <span className="title-icon"><CheckCircle2 size={20} /></span>
                <div>
                  <h2>You’re ready to go</h2>
                  <p>Your workspace is set up. Take a quick interactive tour or start your first task right away.</p>
                </div>
              </div>

              <div className="onboarding-tour-card">
                <div className="onboarding-tour-badge"><Compass size={24} /></div>
                <div className="onboarding-tour-details">
                  <strong>Take the 2-minute interactive tour</strong>
                  <p>Explore lesson plans, Table of Specifications (TOS), DepEd test generation, and student analytics.</p>
                </div>
                <button type="button" className="button primary" onClick={() => void finishAndNavigate('/')} disabled={busy}>
                  Start tour <ArrowRight size={16} />
                </button>
              </div>

              <div className="workflow-ready-divider">
                <span>or jump straight into creating</span>
              </div>

              <div className="workflow-ready-actions">
                {privateCurriculum ? (
                  <button type="button" className="workflow-ready-card" onClick={() => void finishAndNavigate('/curriculum')} disabled={busy}>
                    <BookOpen size={19} />
                    <strong>Set up my curriculum</strong>
                    <span>Open Curriculum to add and approve your school's curriculum.</span>
                  </button>
                ) : (
                  <button type="button" className="workflow-ready-card" onClick={() => void finishAndNavigate('/lesson-plans/new')} disabled={busy}>
                    <BookOpen size={19} />
                    <strong>Create lesson plan</strong>
                    <span>Start with a topic and add verified curriculum alignment as needed.</span>
                  </button>
                )}
                <button type="button" className="workflow-ready-card" onClick={() => void finishAndNavigate('/tos/new')} disabled={busy}>
                  <School size={19} />
                  <strong>Create TOS</strong>
                  <span>Choose covered competencies and test size.</span>
                </button>
                <button type="button" className="workflow-ready-card" onClick={() => void finishAndNavigate('/assessments/new')} disabled={busy}>
                  <Sparkles size={19} />
                  <strong>Create test</strong>
                  <span>Build a test from a finalized TOS.</span>
                </button>
              </div>

              {localError && <div className="form-message error">{localError}</div>}
              <div className="form-footer">
                <button className="button ghost" onClick={() => setStep(4)}>Back</button>
                <button className="button secondary" onClick={() => void finishAndNavigate('/')} disabled={busy}>
                  Open workspace <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
