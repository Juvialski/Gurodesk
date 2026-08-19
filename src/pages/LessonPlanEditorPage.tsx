import { ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCircle2, ChevronDown, CircleAlert, FileCheck2, FileDown, Lightbulb, Save, Search, ShieldCheck, Sparkles, Star, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AiAssistTextarea } from '../components/AiAssistTextarea'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { SimpleAdvancedToggle } from '../components/ui/SimpleAdvancedToggle'
import { useApp } from '../contexts/AppContext'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { buildAiDeclaration, LESSON_PLANNING_POLICY } from '../data/lessonPlanningPolicy'
import { createBlankLessonPlan } from '../lib/lessonPlanFactory'
import { createLessonCompetencySnapshot, curriculumContentAreaSuggestions, groupLessonCompetencies, rankVerifiedLessonCompetencies } from '../lib/lessonCurriculum'
import { emptyLessonCompetencySnapshot } from '../lib/lessonPlanAlignment'
import { validateLessonPlan } from '../lib/lessonPlanValidation'
import {
  loadCurriculumNavigator,
  loadLessonPlan,
  loadSchoolYearCalendar,
  loadTeacherLessonPreferences,
  runLessonAiSupport,
  saveLessonPlan,
} from '../lib/repository'
import type { CurriculumNavigatorBundle, SchoolYearCalendar } from '../types/curriculum'
import { LESSON_PLAN_FORMAT_OPTIONS, type AiSupportType, type LessonAiSupportRequest, type LessonAiSupportResponse, type LessonPlanContent, type LessonPlanFormat, type LessonPlanRecord, type LessonQuickDraft } from '../types/lessonPlan'
import { createDefaultTeacherLessonPreferences, LESSON_LANGUAGE_OPTIONS, type TeacherLessonPreferences } from '../types/teachingSetup'
import type { TeacherAssignment } from '../types/app'
import '../workflows.css'

const QUICK_DRAFT_LABELS: Array<[keyof LessonQuickDraft, string]> = [
  ['lessonTitle', 'Lesson title'],
  ['learningObjectives', 'Learning objectives'],
  ['homeBasedAlternative', 'Home-based alternative'],
  ['preLessonActivity', 'Pre-lesson activity'],
  ['lessonFlow', 'Lesson flow'],
  ['integrationContextualization', 'Integration & contextualization'],
  ['inclusionAccommodations', 'Inclusion / accommodations'],
  ['formativeAssessments', 'Formative assessments'],
  ['evidenceOfLearning', 'Evidence of learning'],
  ['nextSteps', 'Next steps'],
  ['extendedLearning', 'Extended learning'],
]

const NO_ALIGNMENT_PURPOSES: Array<{
  value: Exclude<LessonPlanContent['alignmentPurpose'], 'regular'>
  label: string
}> = [
  { value: 'review', label: 'Review' },
  { value: 'remediation', label: 'Remediation' },
  { value: 'enrichment', label: 'Enrichment' },
  { value: 'locally_developed', label: 'Locally developed' },
  { value: 'interdisciplinary', label: 'Interdisciplinary' },
  { value: 'other', label: 'Other' },
]

function hasExplicitTopicOnlyPurpose(content: LessonPlanContent) {
  return content.alignmentMode === 'topic_only'
    && content.alignmentPurpose !== 'regular'
    && (content.alignmentPurpose !== 'other' || content.alignmentNote.trim().length >= 4)
}

type AlignmentPickerProps = {
  plan: LessonPlanRecord
  bundle: CurriculumNavigatorBundle | null
  competencies: CurriculumNavigatorBundle['competencies']
  open: boolean
  search: string
  onToggleOpen: () => void
  onClose: () => void
  onSearchChange: (value: string) => void
  onToggleCompetency: (id: string) => void
  onSetPrimary: (id: string) => void
  onRemove: (id: string) => void
}

function AlignmentPicker({
  plan,
  bundle,
  competencies,
  open,
  search,
  onToggleOpen,
  onClose,
  onSearchChange,
  onToggleCompetency,
  onSetPrimary,
  onRemove,
}: AlignmentPickerProps) {
  const selected = plan.content.curriculumAlignments
  const selectedIds = new Set(selected.map((item) => item.id))
  const groups = groupLessonCompetencies(bundle, competencies)

  return <>
    {selected.length > 0 && <div className="workflow-selected-alignments" data-testid="selected-lesson-alignments">
      <header><strong>{selected.length} verified {selected.length === 1 ? 'competency' : 'competencies'} aligned</strong><span className="workflow-topic-source"><ShieldCheck size={12} /> Curriculum-grounded</span></header>
      {selected.map((alignment) => {
        const primary = plan.content.primaryCompetencyId === alignment.id
        return <div className={`workflow-selected-alignment ${primary ? 'primary' : ''}`} key={alignment.id}>
          <div className="workflow-selected-alignment-copy">
            <small>{primary && <span className="workflow-primary-badge">Primary</span>}{alignment.contentArea || alignment.code || 'Verified competency'}{alignment.sourcePage ? ` · source p. ${alignment.sourcePage}` : ''}</small>
            <strong>{alignment.text}</strong>
          </div>
          <div className="workflow-alignment-actions">
            {!primary && <button type="button" onClick={() => onSetPrimary(alignment.id)}><Star size={13} /> Make primary</button>}
            <button type="button" className="danger" onClick={() => onRemove(alignment.id)} aria-label={`Remove ${alignment.code || alignment.text}`}><X size={13} /> Remove</button>
          </div>
        </div>
      })}
    </div>}

    <button type="button" className={`workflow-picker-trigger ${open ? 'open' : ''}`} aria-expanded={open} aria-controls="lesson-competency-options" onClick={onToggleOpen}>
      <span>{selected.length ? `Add or change curriculum alignment · ${selected.length} selected` : bundle === null ? 'Loading verified competencies…' : 'Find verified curriculum matches'}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="workflow-picker-panel">
      <label className="workflow-search"><Search size={16} /><span className="sr-only">Search verified competencies</span><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search competency, code, content area, or standard" autoFocus /></label>
      <div className="workflow-picker-summary"><span>{competencies.length} verified curriculum {competencies.length === 1 ? 'match' : 'matches'}</span><button type="button" onClick={onClose}>Done</button></div>
      <div className="workflow-competency-list" id="lesson-competency-options" role="listbox" aria-label="Verified curriculum alignments" aria-multiselectable="true">
        {groups.map((group) => <section className="workflow-curriculum-group" key={group.key}>
          <header className="workflow-curriculum-group-header"><small>{group.periodLabel}</small><strong>{group.contentArea}</strong></header>
          {(group.contentStandards.length > 0 || group.performanceStandards.length > 0) && <details className="workflow-curriculum-standards workflow-curriculum-details"><summary>View verified standards</summary>
            {group.contentStandards.length > 0 && <div><span>Content standard</span>{group.contentStandards.map((standard) => <p key={standard}>{standard}</p>)}</div>}
            {group.performanceStandards.length > 0 && <div><span>Performance standard</span>{group.performanceStandards.map((standard) => <p key={standard}>{standard}</p>)}</div>}
          </details>}
          <div className="workflow-curriculum-competencies">{group.competencies.map((competency) => {
            const isSelected = selectedIds.has(competency.id)
            return <button type="button" role="option" aria-selected={isSelected} key={competency.id} className={`workflow-competency-option ${isSelected ? 'selected' : ''}`} onClick={() => onToggleCompetency(competency.id)}>
              <span className="workflow-checkbox" aria-hidden="true">{isSelected ? <Check size={15} /> : null}</span>
              <span><small>{competency.competencyCode || 'Verified competency'}{competency.sourcePage ? ` · source p. ${competency.sourcePage}` : ''}</small><strong>{competency.competencyText}</strong></span>
            </button>
          })}</div>
        </section>)}
        {!competencies.length && <div className="workflow-empty">No verified curriculum row matches this topic and search. Try different wording, search the full competency text, or continue without curriculum alignment.</div>}
      </div>
    </div>}
  </>
}

function AlignmentModePanel({ plan, onUpdateContent }: { plan: LessonPlanRecord; onUpdateContent: (mutator: (content: LessonPlanContent) => void) => void }) {
  const topicOnly = plan.content.alignmentMode === 'topic_only'
  if (plan.content.curriculumAlignments.length > 0) return null
  return <div className="workflow-alignment-mode">
    {!topicOnly ? <button type="button" className="button ghost" onClick={() => onUpdateContent((content) => {
      content.alignmentMode = 'topic_only'
      content.alignmentPurpose = 'regular'
      content.alignmentNote = ''
    })}>Continue without curriculum alignment</button> : <div className="workflow-purpose-panel">
      <strong>What kind of topic-only lesson is this?</strong>
      <div className="workflow-purpose-grid">{NO_ALIGNMENT_PURPOSES.map((purpose) => <button type="button" key={purpose.value} aria-pressed={plan.content.alignmentPurpose === purpose.value} className={`workflow-chip ${plan.content.alignmentPurpose === purpose.value ? 'selected' : ''}`} onClick={() => onUpdateContent((content) => { content.alignmentPurpose = purpose.value })}>{purpose.label}</button>)}</div>
      <label className="workflow-topic-field"><span>{plan.content.alignmentPurpose === 'other' ? 'Brief reason (required)' : 'Planning note (optional)'}</span><textarea rows={2} value={plan.content.alignmentNote} onChange={(event) => onUpdateContent((content) => { content.alignmentNote = event.target.value })} placeholder="Add curriculum alignment later, or note why this lesson is intentionally topic-only." /></label>
      <div className="workflow-alignment-state"><CircleAlert size={15} /><span>This lesson will be labeled as teacher-provided and not curriculum-aligned. Gemini must not present the topic as an official competency.</span></div>
      <button type="button" className="button ghost" onClick={() => onUpdateContent((content) => { content.alignmentMode = 'curriculum_aligned'; content.alignmentPurpose = 'regular'; content.alignmentNote = '' })}>Choose curriculum alignment instead</button>
    </div>}
  </div>
}

type LessonSimpleFlowProps = {
  plan: LessonPlanRecord
  assignments: TeacherAssignment[]
  assignmentId: string
  assignment: TeacherAssignment | null
  bundle: CurriculumNavigatorBundle | null
  calendar: SchoolYearCalendar | null
  preferences: TeacherLessonPreferences
  filteredCompetencies: CurriculumNavigatorBundle['competencies']
  topicSuggestions: Array<{ id: string; label: string }>
  competencyPickerOpen: boolean
  competencySearch: string
  simpleLanguage: string
  quickDraftLoading: boolean
  quickDraftMessage: string | null
  quickDraftPreview: LessonAiSupportResponse | null
  validation: ReturnType<typeof validateLessonPlan> | null
  saving: boolean
  isNew: boolean
  isDemo: boolean
  aiContext: LessonAiSupportRequest['lessonContext']
  pendingSections: string[]
  onUpdateContent: (mutator: (content: LessonPlanContent) => void) => void
  onAssignmentChange: (id: string) => void
  onSelectPeriod: (label: string) => void
  onLessonPlanFormatChange: (value: LessonPlanFormat) => void
  onTopicChange: (value: string) => void
  onTopicSuggestion: (id: string, label: string) => void
  onToggleCompetency: (id: string) => void
  onSetPrimary: (id: string) => void
  onRemoveCompetency: (id: string) => void
  onToggleCompetencyPicker: () => void
  onCloseCompetencyPicker: () => void
  onCompetencySearchChange: (value: string) => void
  onLanguageChange: (value: string) => void
  onPrepare: () => void
  onDiscardDraft: () => void
  onApplyDraft: () => void
  onSave: (status: 'draft' | 'final') => void
  onConfirmAllAiReview: () => void
  onSetResources: (value: string) => void
  onAppendSavedResource: (resource: string) => void
  onMarkAiUsed: (supportType: AiSupportType) => void
}

function LessonSimpleFlow({
  plan,
  assignments,
  assignmentId,
  assignment,
  bundle,
  calendar,
  preferences,
  filteredCompetencies,
  topicSuggestions,
  competencyPickerOpen,
  competencySearch,
  simpleLanguage,
  quickDraftLoading,
  quickDraftMessage,
  quickDraftPreview,
  validation,
  saving,
  isNew,
  isDemo,
  aiContext,
  pendingSections,
  onUpdateContent,
  onAssignmentChange,
  onSelectPeriod,
  onLessonPlanFormatChange,
  onTopicChange,
  onTopicSuggestion,
  onToggleCompetency,
  onSetPrimary,
  onRemoveCompetency,
  onToggleCompetencyPicker,
  onCloseCompetencyPicker,
  onCompetencySearchChange,
  onLanguageChange,
  onPrepare,
  onDiscardDraft,
  onApplyDraft,
  onSave,
  onConfirmAllAiReview,
  onSetResources,
  onAppendSavedResource,
  onMarkAiUsed,
}: LessonSimpleFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const isFinal = plan.status === 'final'
  const pending = (sectionKey: string) => pendingSections.includes(sectionKey)

  return (
    <section className="workflow-simple-shell lesson-simple-flow">
      {isFinal && (
        <div className="workflow-finalized-card">
          <div className="workflow-finalized-badge"><Sparkles size={28} /></div>
          <div className="workflow-finalized-details">
            <span className="eyebrow">Lesson Plan Finalized</span>
            <h3>Ready for teaching and assessment</h3>
            <p>Your lesson plan is approved and locked. Create an aligned assessment or export your printable document.</p>
          </div>
          <div className="workflow-finalized-actions">
            <Link to={`/assessments/new?lesson=${plan.id}&mode=lesson_quiz`} className="button primary">
              <Sparkles size={16} /> Create assessment from lesson
            </Link>
            <Link to={`/tos/new?lessonPlan=${plan.id}`} className="button secondary">
              <FileCheck2 size={16} /> Create TOS
            </Link>
            <Link to={`/lesson-plans/${plan.id}/print`} className="button ghost">
              <FileDown size={16} /> Preview / download
            </Link>
          </div>
        </div>
      )}

      <nav className="workflow-wizard-stepper" aria-label="Lesson plan creation steps">
        <button
          type="button"
          className={`workflow-stepper-btn ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}
          onClick={() => setStep(1)}
        >
          <span className="workflow-stepper-num">{step > 1 ? <Check size={12} /> : '1'}</span>
          <span>Class Setup</span>
        </button>
        <button
          type="button"
          className={`workflow-stepper-btn ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}
          onClick={() => setStep(2)}
        >
          <span className="workflow-stepper-num">{step > 2 ? <Check size={12} /> : '2'}</span>
          <span>Topic & Focus</span>
        </button>
        <button
          type="button"
          className={`workflow-stepper-btn ${step === 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}
          onClick={() => setStep(3)}
        >
          <span className="workflow-stepper-num">{step > 3 ? <Check size={12} /> : '3'}</span>
          <span>Alignment & AI</span>
        </button>
        <button
          type="button"
          className={`workflow-stepper-btn ${step === 4 ? 'active' : ''} ${step === 4 && isFinal ? 'completed' : ''}`}
          onClick={() => setStep(4)}
        >
          <span className="workflow-stepper-num">{isFinal ? <Check size={12} /> : '4'}</span>
          <span>Lesson Content (ILAW)</span>
        </button>
      </nav>

      {step === 1 && (
        <div className="workflow-step-card">
          <div className="workflow-step-heading">
            <span>1</span>
            <div>
              <strong>Class and lesson setup</strong>
              <small>Curriculum-guide period and school grading term are shown separately.</small>
            </div>
          </div>
          <div className="workflow-form-grid one">
            <label>
              Class
              <select value={assignmentId} disabled={Boolean(plan.id)} onChange={(event) => onAssignmentChange(event.target.value)}>
                {assignments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.gradeLevel} · {item.learningArea}{item.sections?.length ? ` · ${item.sections.join(' · ')}` : ''} · {item.schoolYear}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="workflow-options-grid two-col">
            <div className="workflow-chip-group">
              <span className="workflow-field-label">Curriculum-guide period</span>
              <div className="workflow-chip-row">
                {bundle?.periods.map((period) => (
                  <button
                    type="button"
                    key={period.id}
                    aria-pressed={plan.content.curriculumPeriodLabel === period.label}
                    className={`workflow-chip ${plan.content.curriculumPeriodLabel === period.label ? 'selected' : ''}`}
                    onClick={() => onSelectPeriod(period.label)}
                  >
                    {period.label}
                  </button>
                )) ?? <span className="workflow-muted">Loading verified periods…</span>}
              </div>
            </div>

            <div className="workflow-chip-group">
              <span className="workflow-field-label">School grading term</span>
              <div className="workflow-chip-row">
                {calendar?.periods.map((period) => (
                  <button
                    type="button"
                    key={period.id}
                    aria-pressed={plan.content.gradingTermLabel === period.label}
                    className={`workflow-chip ${plan.content.gradingTermLabel === period.label ? 'selected' : ''}`}
                    onClick={() => onUpdateContent((content) => { content.gradingTermLabel = period.label })}
                  >
                    {period.label}
                  </button>
                )) ?? <span className="workflow-muted">Loading grading terms…</span>}
              </div>
            </div>

            <div className="workflow-chip-group">
              <span className="workflow-field-label">Lesson length</span>
              <div className="workflow-chip-row">
                {[45, 60, 90].map((minutes) => (
                  <button
                    type="button"
                    key={minutes}
                    aria-pressed={plan.content.durationMinutes === minutes}
                    className={`workflow-chip ${plan.content.durationMinutes === minutes ? 'selected' : ''}`}
                    onClick={() => onUpdateContent((content) => { content.durationMinutes = minutes })}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>

            <div className="workflow-chip-group">
              <span className="workflow-field-label">Lesson plan type</span>
              <div className="workflow-chip-row workflow-format-chips">
                {LESSON_PLAN_FORMAT_OPTIONS.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    aria-pressed={(plan.content.lessonPlanFormat ?? 'ilaw') === item.value}
                    className={`workflow-chip ${((plan.content.lessonPlanFormat ?? 'ilaw') === item.value) ? 'selected' : ''}`}
                    title={item.description}
                    onClick={() => onLessonPlanFormatChange(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="workflow-chip-group full-width">
              <span className="workflow-field-label">Lesson language</span>
              <div className="workflow-chip-row workflow-language-chips">
                {LESSON_LANGUAGE_OPTIONS.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    aria-pressed={simpleLanguage === item.value}
                    className={`workflow-chip ${simpleLanguage === item.value ? 'selected' : ''}`}
                    onClick={() => onLanguageChange(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="workflow-step-footer">
            <span className="workflow-muted">Step 1 of 4</span>
            <div className="workflow-step-footer-actions">
              <button type="button" className="button primary" onClick={() => setStep(2)}>
                Next: Lesson Topic <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="workflow-step-card">
          <div className="workflow-step-heading"><span>2</span><div><strong>What are you teaching?</strong><small>Enter the topic or lesson focus in the words you use for your class.</small></div></div>
          <label className="workflow-topic-field"><span>Topic / lesson focus <small>(required)</small></span><input data-testid="lesson-focus-input" value={plan.content.lessonFocus} onChange={(event) => onTopicChange(event.target.value)} placeholder={`e.g. ${assignment?.learningArea === 'Mathematics' ? 'Percentage increase and decrease' : 'A focused lesson topic'}`} /><small>This is the main pedagogical focus. It may cover all, part, or several competencies.</small></label>
          <div className="workflow-topic-suggestions"><span>Curriculum-derived content areas</span><small className="workflow-muted">These are verified content-area labels, not invented official lesson titles.</small><div className="workflow-chip-row">{topicSuggestions.map((suggestion) => <button type="button" key={suggestion.id} className={`workflow-chip ${plan.content.lessonFocusSource === 'curriculum_derived' && plan.content.lessonFocusSourceId === suggestion.id ? 'selected' : ''}`} onClick={() => onTopicSuggestion(suggestion.id, suggestion.label)}>{suggestion.label}</button>)}</div></div>
          <span className="workflow-topic-source">{plan.content.lessonFocusSource === 'curriculum_derived' ? <><ShieldCheck size={12} /> Curriculum-derived suggestion</> : <><Sparkles size={12} /> Teacher-entered topic</>}</span>
          <div className="workflow-step-footer">
            <button type="button" className="button ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={15} /> Back
            </button>
            <div className="workflow-step-footer-actions">
              <button
                type="button"
                className="button primary"
                disabled={!plan.content.lessonFocus.trim()}
                onClick={() => setStep(3)}
              >
                Next: Curriculum Alignment <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="workflow-step-card">
          <div className="workflow-step-heading"><span>3</span><div><strong>Curriculum alignment</strong><small>Select zero, one, or several verified competencies. Choose one primary competency when several apply.</small></div><span className="workflow-count-badge">{plan.content.curriculumAlignments.length} selected</span></div>
          <AlignmentPicker plan={plan} bundle={bundle} competencies={filteredCompetencies} open={competencyPickerOpen} search={competencySearch} onToggleOpen={onToggleCompetencyPicker} onClose={onCloseCompetencyPicker} onSearchChange={onCompetencySearchChange} onToggleCompetency={onToggleCompetency} onSetPrimary={onSetPrimary} onRemove={onRemoveCompetency} />
          <AlignmentModePanel plan={plan} onUpdateContent={onUpdateContent} />

          {quickDraftMessage && <div className="workflow-warning">{quickDraftMessage}</div>}
          {quickDraftPreview?.draft && (
            <div className="workflow-review-card">
              <div className="workflow-review-heading">
                <div>
                  <strong>Review your lesson plan draft</strong>
                  <small>Only empty planning fields are suggested. Check that each idea fits your real class.</small>
                </div>
                <span>{quickDraftPreview.model === 'demo-local-preview' ? 'Preview' : 'AI draft'}</span>
              </div>
              <div className="workflow-review-list">
                {QUICK_DRAFT_LABELS.map(([key, label]) => quickDraftPreview.draft?.[key] ? (
                  <div key={key}>
                    <strong>{label}</strong>
                    <p>{quickDraftPreview.draft[key]}</p>
                  </div>
                ) : null)}
              </div>
              <div className="workflow-actions">
                <button type="button" className="button ghost" onClick={onDiscardDraft}>Discard</button>
                <button type="button" className="button primary" onClick={() => {
                  onApplyDraft()
                  setStep(4)
                }}>
                  <CheckCircle2 size={15} /> Apply to empty fields & continue
                </button>
              </div>
            </div>
          )}

          <div className="workflow-step-footer">
            <button type="button" className="button ghost" onClick={() => setStep(2)}>
              <ArrowLeft size={15} /> Back
            </button>
            <div className="workflow-step-footer-actions">
              <button
                type="button"
                className="button secondary"
                disabled={quickDraftLoading || plan.content.lessonFocus.trim().length < 3 || (plan.content.curriculumAlignments.length === 0 && !hasExplicitTopicOnlyPurpose(plan.content))}
                onClick={onPrepare}
              >
                {quickDraftLoading ? <span className="mini-spinner" /> : <Lightbulb size={15} />}
                {quickDraftLoading ? 'Preparing…' : 'Prepare Quick Draft'}
              </button>
              <button type="button" className="button primary" onClick={() => setStep(4)}>
                Next: Lesson Content (ILAW) <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="lesson-simple-sections">
          <div className="lesson-simple-sections-header">
            <h2>Lesson plan content (ILAW)</h2>
            <p>Review and refine all four ILAW sections. GuroDesk never auto-fills specific books or physical equipment without your verification.</p>
          </div>

          {/* I - Intentions */}
          <div id="lesson-intentions-field" className="lesson-simple-ilaw-card">
            <div className="editor-section-head">
              <div>
                <span className="ilaw-letter intentions">I</span>
                <div>
                  <span className="eyebrow">ILAW Phase 1</span>
                  <h2>Intentions</h2>
                </div>
              </div>
            </div>
            <div className="form-grid one">
              <label className={pending('lessonTitle') ? 'pending-control' : ''}>
                <span>Lesson title</span>
                <input
                  value={plan.content.lessonTitle}
                  onChange={(event) => onUpdateContent((c) => { c.lessonTitle = event.target.value })}
                  placeholder="Teacher-chosen lesson title"
                />
                {pending('lessonTitle') && <small className="pending-review-label">Quick Draft · review</small>}
              </label>
            </div>

            {preferences.typicalClassProfile && !plan.content.learnerContext.trim() && (
              <div className="saved-setup-callout">
                <span>Saved class profile available</span>
                <button className="button ghost" onClick={() => onUpdateContent((c) => { c.learnerContext = preferences.typicalClassProfile })}>
                  Use saved profile
                </button>
              </div>
            )}
            <AiAssistTextarea
              label="Learner context / readiness"
              sectionKey="learnerContext"
              value={plan.content.learnerContext}
              onChange={(value) => onUpdateContent((c) => { c.learnerContext = value })}
              isDemo={isDemo}
              context={aiContext}
              onAiUsed={onMarkAiUsed}
              documentId={plan.id || undefined}
              placeholder="What do you know about this class that should shape the lesson? Avoid learner names or sensitive personal data."
              help="Teacher-provided class-level context only. AI does not invent learner needs."
            />
            <AiAssistTextarea
              label="Learning objectives"
              sectionKey="intentions.learningObjectives"
              value={plan.content.intentions.learningObjectives}
              onChange={(value) => onUpdateContent((c) => { c.intentions.learningObjectives = value })}
              isDemo={isDemo}
              context={aiContext}
              onAiUsed={onMarkAiUsed}
              documentId={plan.id || undefined}
              placeholder="Choose, edit, or write the focused objectives you want learners to demonstrate."
              help="GuroDesk can propose alternatives centered on the topic and grounded in selected verified competencies; you choose and adapt the final objectives."
              suggestionType="suggest_learning_objectives"
              suggestionLabel="Suggest objectives"
              pendingQuickDraft={pending('intentions.learningObjectives')}
            />
          </div>

          {/* L — Learning Experience */}
          <div id="lesson-experience-field" className="lesson-simple-ilaw-card ilaw-section learning-section">
            <div className="editor-section-head">
              <div>
                <span className="ilaw-letter">L</span>
                <div>
                  <span className="eyebrow">Learning Experience</span>
                  <h2>How learners will engage and learn</h2>
                </div>
              </div>
              <span className="teacher-decision-chip">Teacher approves</span>
            </div>

            <div id="lesson-resources-field" className="teacher-resource-field">
              <div className="field-label-row">
                <span>Learning resources</span>
                <small>Teacher-verified only</small>
              </div>
              <textarea
                rows={4}
                value={plan.content.learningExperience.resources}
                onChange={(event) => onSetResources(event.target.value)}
                placeholder="Enter only materials, books, modules, devices, or other resources you will actually use."
              />
              {preferences.actualResources.length > 0 && (
                <div className="saved-resource-chips">
                  <span>From My teaching setup:</span>
                  {preferences.actualResources.map((resource) => (
                    <button type="button" key={resource} onClick={() => onAppendSavedResource(resource)}>
                      + {resource}
                    </button>
                  ))}
                </div>
              )}
              <div className="resource-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => onUpdateContent((c) => { c.learningExperience.resources = 'No additional learning resources required.'; c.resourcesVerifiedByTeacher = true })}
                >
                  No additional resources
                </button>
                <label className="review-check">
                  <input
                    type="checkbox"
                    checked={plan.content.resourcesVerifiedByTeacher}
                    onChange={(event) => onUpdateContent((c) => { c.resourcesVerifiedByTeacher = event.target.checked })}
                  />
                  I verified these are resources I actually use for this lesson.
                </label>
              </div>
              <small className="field-help">AI suggestions are constrained by the resources and technology you entered in Settings, but this field itself is never AI-filled.</small>
            </div>

            <AiAssistTextarea
              label="Pre-lesson activity"
              sectionKey="learningExperience.preLessonActivity"
              value={plan.content.learningExperience.preLessonActivity}
              onChange={(value) => onUpdateContent((c) => { c.learningExperience.preLessonActivity = value })}
              isDemo={isDemo}
              context={aiContext}
              onAiUsed={onMarkAiUsed}
              documentId={plan.id || undefined}
              rows={4}
              placeholder="Brief readiness check, routine, or prior-knowledge activation"
              suggestionType="suggest_pre_lesson"
              suggestionLabel="Suggest openings"
              pendingQuickDraft={pending('learningExperience.preLessonActivity')}
            />
            <AiAssistTextarea
              label="Lesson flow"
              sectionKey="learningExperience.lessonFlow"
              value={plan.content.learningExperience.lessonFlow}
              onChange={(value) => onUpdateContent((c) => { c.learningExperience.lessonFlow = value })}
              isDemo={isDemo}
              context={aiContext}
              onAiUsed={onMarkAiUsed}
              documentId={plan.id || undefined}
              rows={8}
              placeholder="Explicit teaching, guided practice, independent work, and closure"
              suggestionType="suggest_lesson_flow"
              suggestionLabel="Suggest sequence"
              pendingQuickDraft={pending('learningExperience.lessonFlow')}
            />
            <AiAssistTextarea
              label="Contextualization & local integration"
              sectionKey="learningExperience.integrationContextualization"
              value={plan.content.learningExperience.integrationContextualization}
              onChange={(value) => onUpdateContent((c) => { c.learningExperience.integrationContextualization = value })}
              isDemo={isDemo}
              context={aiContext}
              onAiUsed={onMarkAiUsed}
              documentId={plan.id || undefined}
              rows={3}
              placeholder="Community context, local examples, or values integration"
              suggestionType="suggest_contextualization"
              suggestionLabel="Suggest local connections"
              pendingQuickDraft={pending('learningExperience.integrationContextualization')}
            />
            <AiAssistTextarea
              label="Inclusion & differentiated support"
              sectionKey="learningExperience.inclusionAccommodations"
              value={plan.content.learningExperience.inclusionAccommodations}
              onChange={(value) => onUpdateContent((c) => { c.learningExperience.inclusionAccommodations = value })}
              isDemo={isDemo}
              context={aiContext}
              onAiUsed={onMarkAiUsed}
              documentId={plan.id || undefined}
              rows={3}
              placeholder="Support for struggling learners, extensions for advanced learners, language scaffolding"
              suggestionType="suggest_inclusion"
              suggestionLabel="Suggest accommodations"
              pendingQuickDraft={pending('learningExperience.inclusionAccommodations')}
            />
            <AiAssistTextarea
              label="Home-based alternative (optional)"
              sectionKey="learningExperience.homeBasedAlternative"
              value={plan.content.learningExperience.homeBasedAlternative}
              onChange={(value) => onUpdateContent((c) => { c.learningExperience.homeBasedAlternative = value })}
              isDemo={isDemo}
              context={aiContext}
              onAiUsed={onMarkAiUsed}
              documentId={plan.id || undefined}
              rows={3}
              placeholder="Alternative activity if face-to-face instruction is interrupted"
              suggestionType="suggest_home_alternative"
              suggestionLabel="Suggest alternatives"
              pendingQuickDraft={pending('learningExperience.homeBasedAlternative')}
            />
          </div>

          {/* A — Assessing Learning */}
          <div id="lesson-assessing-field" className="lesson-simple-ilaw-card ilaw-section assessment-section">
            <div className="editor-section-head">
              <div>
                <span className="ilaw-letter">A</span>
                <div>
                  <span className="eyebrow">Assessing Learning</span>
                  <h2>Evidence gathered during learning</h2>
                </div>
              </div>
              <span className="teacher-decision-chip">Teacher approves</span>
            </div>

            <div className="form-grid two">
              <AiAssistTextarea
                label="Formative assessments"
                sectionKey="assessingLearning.formativeAssessments"
                value={plan.content.assessingLearning.formativeAssessments}
                onChange={(value) => onUpdateContent((c) => { c.assessingLearning.formativeAssessments = value })}
                isDemo={isDemo}
                context={aiContext}
                onAiUsed={onMarkAiUsed}
                documentId={plan.id || undefined}
                rows={4}
                placeholder="Checks you will use throughout the session"
                suggestionType="suggest_formative_assessment"
                suggestionLabel="Suggest checks"
                pendingQuickDraft={pending('assessingLearning.formativeAssessments')}
              />
              <AiAssistTextarea
                label="What evidence will show learning?"
                sectionKey="assessingLearning.evidenceOfLearning"
                value={plan.content.assessingLearning.evidenceOfLearning}
                onChange={(value) => onUpdateContent((c) => { c.assessingLearning.evidenceOfLearning = value })}
                isDemo={isDemo}
                context={aiContext}
                onAiUsed={onMarkAiUsed}
                documentId={plan.id || undefined}
                rows={4}
                placeholder="Describe the evidence you will look for before moving forward."
                suggestionType="suggest_evidence_of_learning"
                suggestionLabel="Suggest evidence"
                pendingQuickDraft={pending('assessingLearning.evidenceOfLearning')}
              />
            </div>
          </div>

          {/* W — Ways Forward */}
          <div id="lesson-ways-forward-field" className="lesson-simple-ilaw-card ilaw-section ways-section">
            <div className="editor-section-head">
              <div>
                <span className="ilaw-letter">W</span>
                <div>
                  <span className="eyebrow">Ways Forward</span>
                  <h2>Reflection and next instructional steps</h2>
                </div>
              </div>
              <span className="teacher-decision-chip">Teacher judgment</span>
            </div>

            <div className="form-grid two">
              <AiAssistTextarea
                label="Next steps / intervention"
                sectionKey="waysForward.nextSteps"
                value={plan.content.waysForward.nextSteps}
                onChange={(value) => onUpdateContent((c) => { c.waysForward.nextSteps = value })}
                isDemo={isDemo}
                context={aiContext}
                onAiUsed={onMarkAiUsed}
                documentId={plan.id || undefined}
                rows={4}
                placeholder="Reteaching, remediation, enrichment, adjustment, or next lesson decision"
                suggestionType="suggest_next_steps"
                suggestionLabel="Suggest contingencies"
                pendingQuickDraft={pending('waysForward.nextSteps')}
              />
              <AiAssistTextarea
                label="Extended learning opportunities"
                sectionKey="waysForward.extendedLearning"
                value={plan.content.waysForward.extendedLearning}
                onChange={(value) => onUpdateContent((c) => { c.waysForward.extendedLearning = value })}
                isDemo={isDemo}
                context={aiContext}
                onAiUsed={onMarkAiUsed}
                documentId={plan.id || undefined}
                rows={4}
                placeholder="Optional reinforcement, enrichment, or remediation beyond the session"
                suggestionType="suggest_extended_learning"
                suggestionLabel="Suggest extensions"
                pendingQuickDraft={pending('waysForward.extendedLearning')}
              />
            </div>
            <AiAssistTextarea
              label="Reflection"
              sectionKey="waysForward.reflection"
              value={plan.content.waysForward.reflection}
              onChange={(value) => onUpdateContent((c) => { c.waysForward.reflection = value })}
              isDemo={isDemo}
              context={aiContext}
              onAiUsed={onMarkAiUsed}
              documentId={plan.id || undefined}
              rows={5}
              placeholder="After teaching, record what the evidence showed and what you noticed."
              help="Reflection stays teacher-authored because it describes what actually happened. AI may polish your wording afterward."
            />
          </div>

          {/* ILAW Self-Check & Quality Summary */}
          <div className="lesson-simple-quality-card">
            <span className="eyebrow">ILAW self-check</span>
            <div className="validation-score">
              <strong>{validation?.score ?? 0}%</strong>
              <span>{validation?.ready ? 'Ready to finalize' : 'Draft needs attention (click any item to jump)'}</span>
            </div>
            <div className="validation-list">
              {validation?.items.map((item) => {
                const targetId = item.key === 'resources' ? 'lesson-resources-field'
                  : item.key === 'objectives' ? 'lesson-intentions-field'
                  : item.key === 'experience' ? 'lesson-experience-field'
                  : item.key === 'assessment' ? 'lesson-assessing-field'
                  : item.key === 'ways-forward' ? 'lesson-ways-forward-field'
                  : item.key === 'suggestion-review' || item.key === 'ai-review' ? 'quick-draft-pending-card'
                  : ''

                const handleClick = () => {
                  if (item.key === 'resources' && !item.passed) {
                    if (plan.content.learningExperience.resources.trim().length >= 3) {
                      onUpdateContent((c) => { c.resourcesVerifiedByTeacher = true })
                      return
                    }
                  }
                  if (targetId) {
                    const el = document.getElementById(targetId)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
                      input?.focus()
                    }
                  }
                }

                return (
                  <div
                    className={`validation-item ${item.passed ? 'passed' : 'clickable'}`}
                    key={item.key}
                    onClick={!item.passed ? handleClick : undefined}
                    title={!item.passed ? 'Click to jump to this section' : undefined}
                  >
                    {item.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </div>
                    {!item.passed && item.key === 'resources' && plan.content.learningExperience.resources.trim().length >= 3 && (
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={(e) => {
                          e.stopPropagation()
                          onUpdateContent((c) => { c.resourcesVerifiedByTeacher = true })
                        }}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Simple Mode Status & Post-Final Action Panel */}
          <div className="lesson-simple-actions-card">
            <div className="current-status">
              <FileCheck2 size={16} />
              <strong>Document status: {plan.status === 'final' ? 'Finalized' : 'Draft'}</strong>
            </div>

            <div className="lesson-simple-actions-row">
              {plan.id ? (
                <Link to={`/lesson-plans/${plan.id}/print`} className="button ghost">
                  <FileDown size={16} /> Preview / download
                </Link>
              ) : (
                <button type="button" className="button ghost" disabled>
                  <FileDown size={16} /> Save before export
                </button>
              )}

              {plan.status === 'final' && (
                <>
                  <Link to={`/assessments/new?lesson=${plan.id}&mode=lesson_quiz`} className="button accent">
                    <Sparkles size={16} /> Create assessment from lesson
                  </Link>
                  <Link to={`/tos/new?lessonPlan=${plan.id}`} className="button secondary">
                    <FileCheck2 size={16} /> Create TOS
                  </Link>
                </>
              )}
            </div>

            {pendingSections.length > 0 && (
              <div id="quick-draft-pending-card" className="quick-draft-pending">
                <CircleAlert size={16} />
                <div>
                  <strong>{pendingSections.length} Quick Draft section{pendingSections.length === 1 ? '' : 's'} need your review</strong>
                  <p>Edit anything you want, then confirm when the suggested text matches your actual class and intended instruction.</p>
                </div>
                <button type="button" className="button secondary" onClick={onConfirmAllAiReview}>
                  <CheckCircle2 size={15} /> I reviewed all
                </button>
              </div>
            )}
          </div>

          <div className="workflow-step-footer">
            <button type="button" className="button ghost" onClick={() => setStep(3)}>
              <ArrowLeft size={15} /> Back: Alignment & AI
            </button>
            <div className="workflow-step-footer-actions">
              <button
                type="button"
                className="button secondary"
                disabled={saving}
                onClick={() => onSave('draft')}
              >
                <Save size={16} /> Save draft
              </button>
              <button
                type="button"
                className="button primary"
                disabled={saving || !validation?.ready}
                onClick={() => onSave('final')}
              >
                <CheckCircle2 size={16} /> Mark final
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function ArrowRightIcon() {
  return <span aria-hidden="true" className="workflow-arrow">→</span>
}

export function LessonPlanEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, assignments, isDemo } = useApp()
  const { selection, updateSelection } = useWorkspaceSelection(user?.id)
  const requestedAssignmentId = searchParams.get('assignment') ?? ''
  const requestedCompetencyId = searchParams.get('competency') ?? ''
  const [assignmentId, setAssignmentId] = useState(requestedAssignmentId || selection.assignmentId || assignments[0]?.id || '')
  const [plan, setPlan] = useState<LessonPlanRecord | null>(null)
  const [bundle, setBundle] = useState<CurriculumNavigatorBundle | null>(null)
  const [calendar, setCalendar] = useState<SchoolYearCalendar | null>(null)
  const [preferences, setPreferences] = useState<TeacherLessonPreferences>(() => createDefaultTeacherLessonPreferences(user?.id ?? ''))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [quickDraftLoading, setQuickDraftLoading] = useState(false)
  const [quickDraftPreview, setQuickDraftPreview] = useState<LessonAiSupportResponse | null>(null)
  const [quickDraftMessage, setQuickDraftMessage] = useState<string | null>(null)
  const [competencyPickerOpen, setCompetencyPickerOpen] = useState(false)
  const [competencySearch, setCompetencySearch] = useState('')
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>(() => {
    try {
      return localStorage.getItem('gurodesk.lesson-plan.view-mode') === 'advanced' ? 'advanced' : 'simple'
    } catch {
      return 'simple'
    }
  })

  const assignment = assignments.find((item) => item.id === assignmentId) ?? null

  useEffect(() => {
    try {
      localStorage.setItem('gurodesk.lesson-plan.view-mode', viewMode)
    } catch {
      // Local preference is optional; the editor remains fully usable.
    }
  }, [viewMode])

  useEffect(() => {
    if (!assignmentId) return
    updateSelection({
      assignmentId,
      curriculumPeriodId: plan?.content.curriculumPeriodLabel
        ? (bundle?.periods.find((item) => item.label === plan.content.curriculumPeriodLabel)?.id ?? null)
        : null,
    })
  }, [assignmentId, plan?.content.curriculumPeriodLabel, bundle?.periods, updateSelection])

  function freshPlan(userId: string, targetAssignment: (typeof assignments)[number]) {
    const next = createBlankLessonPlan(userId, targetAssignment)
    next.content.durationMinutes = preferences.defaultDurationMinutes || 60
    next.content.lessonLanguage = preferences.languagePreference || 'Auto'
    next.content.teachingApproaches = [...preferences.preferredApproaches]
    return next
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadTeacherLessonPreferences(user.id, isDemo).then((next) => {
      if (cancelled) return
      setPreferences(next)
      setPlan((current) => {
        if (!current || !isNew || current.id) return current
        const copy = structuredClone(current)
        if (copy.content.durationMinutes === 60) copy.content.durationMinutes = next.defaultDurationMinutes || 60
        if (!copy.content.lessonLanguage || copy.content.lessonLanguage === 'Auto') copy.content.lessonLanguage = next.languagePreference || 'Auto'
        if (!copy.content.teachingApproaches.length) copy.content.teachingApproaches = [...next.preferredApproaches]
        return copy
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user?.id, isDemo])

  useEffect(() => {
    if (!user || !assignments.length) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const initialize = async () => {
      if (!isNew && id) {
        const existing = await loadLessonPlan(id, user.id, isDemo)
        if (!existing) throw new Error('This lesson plan was not found or you do not have access to it.')
        if (cancelled) return
        setPlan(existing)
        setAssignmentId(existing.assignmentId ?? assignments[0].id)
        return
      }
      const initialAssignment = assignments.find((item) => item.id === (requestedAssignmentId || assignmentId)) ?? assignments[0]
      if (cancelled) return
      setAssignmentId(initialAssignment.id)
      setPlan(freshPlan(user.id, initialAssignment))
    }

    void initialize().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to open lesson plan.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, isNew, user?.id, isDemo])

  useEffect(() => {
    if (!assignment) return
    let cancelled = false
    Promise.all([
      loadCurriculumNavigator(assignment.schoolYear, assignment.gradeLevel, assignment.learningArea, isDemo, assignment.curriculumVersionId),
      loadSchoolYearCalendar(assignment.schoolYear, isDemo),
    ]).then(([nextBundle, nextCalendar]) => {
      if (cancelled) return
      setBundle(nextBundle)
      setCalendar(nextCalendar)
      setPlan((current) => {
        if (!current) return current
        const next = structuredClone(current)
        if (isNew && current.assignmentId !== assignment.id) return freshPlan(current.userId, assignment)
        if (!next.content.gradingTermLabel) next.content.gradingTermLabel = nextCalendar?.periods[0]?.label ?? ''
        if (!next.content.curriculumPeriodLabel) next.content.curriculumPeriodLabel = nextBundle.periods[0]?.label ?? ''
        const targetCompetency = nextBundle.competencies.find((item) => item.id === requestedCompetencyId)
        if (targetCompetency && !next.content.curriculumAlignments.some((item) => item.id === targetCompetency.id)) {
          const snapshot = createLessonCompetencySnapshot(nextBundle, targetCompetency)
          next.content.curriculumAlignments.push(snapshot)
          next.content.primaryCompetencyId ||= snapshot.id
          next.content.competency = structuredClone(next.content.curriculumAlignments.find((item) => item.id === next.content.primaryCompetencyId) ?? snapshot)
          next.content.alignmentMode = 'curriculum_aligned'
          next.content.alignmentPurpose = 'regular'
          if (!next.content.lessonFocus.trim()) {
            next.content.lessonFocus = snapshot.contentArea || snapshot.text
            next.content.lessonFocusSource = 'curriculum_derived'
            next.content.lessonFocusSourceId = snapshot.domainId || snapshot.id
          }
          const period = nextBundle.periods.find((item) => item.id === targetCompetency.academicPeriodId)
          if (period) next.content.curriculumPeriodLabel = period.label
          next.content.performanceStandard = snapshot.performanceStandards.join('\n')
        }
        return next
      })
    }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to resolve curriculum context.') })
    return () => { cancelled = true }
  }, [assignmentId, assignment?.schoolYear, assignment?.gradeLevel, assignment?.learningArea, isDemo])

  const validation = useMemo(() => plan ? validateLessonPlan(plan.content) : null, [plan])
  const period = bundle?.periods.find((item) => item.label === plan?.content.curriculumPeriodLabel) ?? bundle?.periods[0] ?? null
  const periodCompetencies = bundle?.competencies.filter((item) => !period || item.academicPeriodId === period.id) ?? []
  // Never leave a verified competency select silently empty when verified rows exist.
  // If a legacy/imported period ID does not match, show all verified competencies and
  // make the mismatch visible instead of presenting a dead mobile dropdown.
  const periodMappingFallback = Boolean(bundle?.competencies.length && period && periodCompetencies.length === 0)
  const visibleCompetencies = periodMappingFallback ? (bundle?.competencies ?? []) : periodCompetencies
  const filteredCompetencies = rankVerifiedLessonCompetencies(
    bundle,
    visibleCompetencies,
    plan?.content.lessonFocus ?? '',
    competencySearch,
  )
  const topicSuggestions = curriculumContentAreaSuggestions(bundle, period?.id ?? null)
  const simpleLanguage = plan?.content.lessonLanguage || preferences.languagePreference || 'Auto'

  function updateContent(mutator: (content: LessonPlanContent) => void) {
    setSavedMessage('')
    setPlan((current) => {
      if (!current) return current
      const next = structuredClone(current)
      mutator(next.content)
      next.title = next.content.lessonTitle || next.content.lessonFocus || `${next.content.gradeLevel} ${next.content.learningArea} lesson`
      next.schoolYear = next.content.schoolYear
      next.academicPeriodLabel = next.content.curriculumPeriodLabel || null
      return next
    })
  }

  function changeAssignment(nextId: string) {
    if (!isNew) return
    setCompetencyPickerOpen(false)
    setCompetencySearch('')
    setAssignmentId(nextId)
    const nextAssignment = assignments.find((item) => item.id === nextId)
    if (nextAssignment && user) setPlan(freshPlan(user.id, nextAssignment))
  }

  function selectCurriculumPeriod(label: string) {
    setCompetencyPickerOpen(false)
    setCompetencySearch('')
    updateContent((content) => {
      if (content.curriculumPeriodLabel === label) return
      const hadCurriculumAlignments = content.curriculumAlignments.length > 0
      content.curriculumPeriodLabel = label
      // Alignments are period-scoped curriculum snapshots. Keep the teacher's
      // topic, but require a fresh verified selection for the newly chosen period.
      content.curriculumAlignments = []
      content.primaryCompetencyId = null
      content.competency = emptyLessonCompetencySnapshot()
      content.performanceStandard = ''
      if (hadCurriculumAlignments) {
        content.alignmentMode = 'curriculum_aligned'
        content.alignmentPurpose = 'regular'
        content.alignmentNote = ''
      }
    })
  }

  function syncPrimaryProjection(content: LessonPlanContent) {
    if (content.curriculumAlignments.length === 0) {
      content.primaryCompetencyId = null
      content.competency = emptyLessonCompetencySnapshot()
      content.performanceStandard = ''
      return
    }
    if (!content.curriculumAlignments.some((item) => item.id === content.primaryCompetencyId)) {
      content.primaryCompetencyId = content.curriculumAlignments[0].id
    }
    const primary = content.curriculumAlignments.find((item) => item.id === content.primaryCompetencyId)!
    content.competency = structuredClone(primary)
    content.performanceStandard = primary.performanceStandards.join('\n')
    content.alignmentMode = 'curriculum_aligned'
    content.alignmentPurpose = 'regular'
    content.alignmentNote = ''
  }

  function changeLessonFocus(value: string) {
    updateContent((content) => {
      content.lessonFocus = value
      content.lessonFocusSource = 'teacher'
      content.lessonFocusSourceId = null
    })
  }

  function useTopicSuggestion(id: string, label: string) {
    updateContent((content) => {
      content.lessonFocus = label
      content.lessonFocusSource = 'curriculum_derived'
      content.lessonFocusSourceId = id
    })
  }

  function toggleCompetency(competencyId: string) {
    const competency = bundle?.competencies.find((item) => item.id === competencyId)
    if (!competency) return
    updateContent((content) => {
      const existing = content.curriculumAlignments.some((item) => item.id === competencyId)
      if (existing) {
        content.curriculumAlignments = content.curriculumAlignments.filter((item) => item.id !== competencyId)
      } else if (bundle) {
        const snapshot = createLessonCompetencySnapshot(bundle, competency)
        content.curriculumAlignments.push(snapshot)
        if (!content.lessonFocus.trim()) {
          content.lessonFocus = snapshot.contentArea || snapshot.text
          content.lessonFocusSource = 'curriculum_derived'
          content.lessonFocusSourceId = snapshot.domainId || snapshot.id
        }
      }
      syncPrimaryProjection(content)
    })
  }

  function removeCompetency(competencyId: string) {
    updateContent((content) => {
      content.curriculumAlignments = content.curriculumAlignments.filter((item) => item.id !== competencyId)
      syncPrimaryProjection(content)
    })
  }

  function setPrimaryCompetency(competencyId: string) {
    updateContent((content) => {
      if (!content.curriculumAlignments.some((item) => item.id === competencyId)) return
      content.primaryCompetencyId = competencyId
      syncPrimaryProjection(content)
    })
  }

  function markAiUsed(supportType: AiSupportType) {
    updateContent((content) => {
      const operations = [...content.aiDeclaration.operations, supportType]
      const pending = content.aiSuggestionReview?.pendingSections ?? []
      content.aiDeclaration = buildAiDeclaration(operations, pending.length === 0)
    })
  }

  function setResources(value: string) {
    updateContent((content) => {
      content.learningExperience.resources = value
      content.resourcesVerifiedByTeacher = value.trim().length >= 3
    })
  }

  function appendSavedResource(resource: string) {
    updateContent((content) => {
      const current = content.learningExperience.resources.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
      if (!current.includes(resource)) current.push(resource)
      content.learningExperience.resources = current.join('\n')
      content.resourcesVerifiedByTeacher = true
    })
  }

  async function prepareQuickDraft() {
    const activePlan = plan
    if (!activePlan || activePlan.content.lessonFocus.trim().length < 3) {
      setQuickDraftMessage('Enter the topic or lesson focus first.')
      return
    }
    if (activePlan.content.curriculumAlignments.length === 0 && !hasExplicitTopicOnlyPurpose(activePlan.content)) {
      setQuickDraftMessage('Choose curriculum alignment or explicitly choose a topic-only lesson purpose.')
      return
    }
    setQuickDraftLoading(true)
    setQuickDraftMessage(null)
    try {
      const result = await runLessonAiSupport({
        supportType: 'quick_draft',
        sectionKey: 'lesson.quick_draft',
        text: '',
        documentId: activePlan.id || undefined,
        lessonContext: aiContext,
      }, isDemo)
      if (!result.draft) throw new Error('Gemini returned no Quick Draft.')
      setQuickDraftPreview(result)
      setQuickDraftMessage(result.curriculumContextWarning ?? null)
    } catch (err) {
      setQuickDraftMessage(err instanceof Error ? err.message : 'Quick Draft could not be prepared.')
    } finally {
      setQuickDraftLoading(false)
    }
  }

  function applyQuickDraft() {
    const draft = quickDraftPreview?.draft
    if (!draft) return
    const applied: string[] = []
    updateContent((content) => {
      const use = (sectionKey: string, current: string, suggestion: string | undefined, setter: (value: string) => void) => {
        if (!current.trim() && suggestion?.trim()) {
          setter(suggestion.trim())
          applied.push(sectionKey)
        }
      }
      use('lessonTitle', content.lessonTitle, draft.lessonTitle, (value) => { content.lessonTitle = value })
      use('intentions.learningObjectives', content.intentions.learningObjectives, draft.learningObjectives, (value) => { content.intentions.learningObjectives = value })
      use('learningExperience.homeBasedAlternative', content.learningExperience.homeBasedAlternative, draft.homeBasedAlternative, (value) => { content.learningExperience.homeBasedAlternative = value })
      use('learningExperience.preLessonActivity', content.learningExperience.preLessonActivity, draft.preLessonActivity, (value) => { content.learningExperience.preLessonActivity = value })
      use('learningExperience.lessonFlow', content.learningExperience.lessonFlow, draft.lessonFlow, (value) => { content.learningExperience.lessonFlow = value })
      use('learningExperience.integrationContextualization', content.learningExperience.integrationContextualization, draft.integrationContextualization, (value) => { content.learningExperience.integrationContextualization = value })
      use('learningExperience.inclusionAccommodations', content.learningExperience.inclusionAccommodations, draft.inclusionAccommodations, (value) => { content.learningExperience.inclusionAccommodations = value })
      use('assessingLearning.formativeAssessments', content.assessingLearning.formativeAssessments, draft.formativeAssessments, (value) => { content.assessingLearning.formativeAssessments = value })
      use('assessingLearning.evidenceOfLearning', content.assessingLearning.evidenceOfLearning, draft.evidenceOfLearning, (value) => { content.assessingLearning.evidenceOfLearning = value })
      use('waysForward.nextSteps', content.waysForward.nextSteps, draft.nextSteps, (value) => { content.waysForward.nextSteps = value })
      use('waysForward.extendedLearning', content.waysForward.extendedLearning, draft.extendedLearning, (value) => { content.waysForward.extendedLearning = value })

      const pending = [...new Set([...(content.aiSuggestionReview?.pendingSections ?? []), ...applied])]
      content.aiSuggestionReview = { pendingSections: pending, lastQuickDraftAt: new Date().toISOString() }
      content.aiDeclaration = buildAiDeclaration([...content.aiDeclaration.operations, 'quick_draft'], pending.length === 0)
    })
    setQuickDraftPreview(null)
    setQuickDraftMessage('Quick Draft was applied to empty fields only. Existing teacher text was preserved. Review the highlighted sections before finalizing.')
  }

  function confirmAllAiReview() {
    updateContent((content) => {
      content.aiSuggestionReview = { ...(content.aiSuggestionReview ?? { lastQuickDraftAt: null }), pendingSections: [] }
      content.aiDeclaration = buildAiDeclaration(content.aiDeclaration.operations, true)
      if (content.learningExperience.resources.trim().length >= 3) {
        content.resourcesVerifiedByTeacher = true
      }
    })
  }

  async function save(status: 'draft' | 'final') {
    if (!plan) return
    let activeValidation = validation
    if (status === 'final') {
      if (plan.content.learningExperience.resources.trim().length >= 3 && !plan.content.resourcesVerifiedByTeacher) {
        updateContent((content) => { content.resourcesVerifiedByTeacher = true })
        plan.content.resourcesVerifiedByTeacher = true
      }
      activeValidation = validateLessonPlan(plan.content)
      if (!activeValidation.ready) {
        const firstFailed = activeValidation.items.find((i) => !i.passed)
        if (firstFailed) {
          const targetId = firstFailed.key === 'resources' ? 'lesson-resources-field'
            : firstFailed.key === 'objectives' ? 'lesson-intentions-field'
            : firstFailed.key === 'experience' ? 'lesson-experience-field'
            : firstFailed.key === 'assessment' ? 'lesson-assessing-field'
            : firstFailed.key === 'ways-forward' ? 'lesson-ways-forward-field'
            : firstFailed.key === 'suggestion-review' || firstFailed.key === 'ai-review' ? 'quick-draft-pending-card'
            : ''
          if (targetId) {
            const el = document.getElementById(targetId)
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')?.focus()
          }
        }
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const next: LessonPlanRecord = { ...plan, status }
      const saved = await saveLessonPlan(next, isDemo)
      setPlan(saved)
      setSavedMessage(status === 'final' ? 'Lesson plan marked final.' : 'Draft saved.')
      if (isNew) navigate(`/lesson-plans/${saved.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save lesson plan.')
    } finally {
      setSaving(false)
    }
  }

  if (!assignments.length) {
    return <EmptyState icon={BookOpenCheck} title="Add a teaching assignment first" description="Lesson planning starts from your teaching load so curriculum and policy context can be resolved correctly." />
  }
  if (loading || !plan) return <div className="panel lesson-loading"><span className="loader" /><strong>Opening lesson workspace…</strong></div>
  if (error && !plan) return <EmptyState icon={CircleAlert} title="Lesson plan could not be opened" description={error} />

  const primaryAlignment = plan.content.curriculumAlignments.find((item) => item.id === plan.content.primaryCompetencyId) ?? null
  const toAiCompetency = (item: LessonPlanContent['curriculumAlignments'][number]) => ({
    id: item.id,
    code: item.code,
    text: item.text,
    sourcePage: item.sourcePage,
    sourceTitle: item.sourceTitle,
  })
  const aiContext = {
    assignmentId: plan.assignmentId,
    gradeLevel: plan.content.gradeLevel,
    learningArea: plan.content.learningArea,
    lessonFocus: plan.content.lessonFocus,
    primaryCompetency: primaryAlignment ? toAiCompetency(primaryAlignment) : null,
    additionalCompetencies: plan.content.curriculumAlignments
      .filter((item) => item.id !== primaryAlignment?.id)
      .map(toAiCompetency),
    competencyText: primaryAlignment?.text || plan.content.competency.text,
    performanceStandard: plan.content.performanceStandard,
    teacherIntent: plan.content.intentions.learningObjectives,
    curriculumPeriodLabel: plan.content.curriculumPeriodLabel,
    gradingTermLabel: plan.content.gradingTermLabel,
    durationMinutes: plan.content.durationMinutes,
    numberOfSessions: plan.content.numberOfSessions,
    lessonPlanFormat: plan.content.lessonPlanFormat ?? 'ilaw',
    learnerContext: plan.content.learnerContext || preferences.typicalClassProfile,
    currentFormativeAssessment: plan.content.assessingLearning.formativeAssessments,
    teachingSetup: {
      languagePreference: simpleLanguage,
      localLanguageName: preferences.localLanguageName,
      typicalClassProfile: preferences.typicalClassProfile,
      availableTechnology: preferences.availableTechnology,
      preferredApproaches: plan.content.teachingApproaches.length ? plan.content.teachingApproaches : preferences.preferredApproaches,
      actualResources: plan.content.resourcesVerifiedByTeacher
        ? plan.content.learningExperience.resources.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
        : [],
      resourceNotes: preferences.resourceNotes,
    },
  }
  const pendingSections = plan.content.aiSuggestionReview?.pendingSections ?? []
  const pending = (sectionKey: string) => pendingSections.includes(sectionKey)

  return (
    <>
      <PageHeader
        eyebrow="ILAW lesson planning · Phase 3.6.3"
        title={isNew ? 'New lesson plan' : plan.title || 'Lesson plan'}
        description="Start with a lesson topic, add optional verified curriculum alignment, and review every planning decision before teaching."
        actions={
          <div className="editor-header-actions">
            <SimpleAdvancedToggle mode={viewMode} onChange={setViewMode} />
            <Link to="/lesson-plans" className="button ghost"><ArrowLeft size={15} /> Back</Link>
            <button className="button secondary" disabled={saving} onClick={() => void save('draft')}><Save size={15} /> Save draft</button>
            {plan.id && (
              <Link to={`/lesson-plans/${plan.id}/print`} className="button secondary">
                <FileDown size={15} /> Preview / download
              </Link>
            )}
            {plan.status === 'final' && (
              <Link to={`/assessments/new?lesson=${plan.id}&mode=lesson_quiz`} className="button accent">
                <Sparkles size={15} /> Create assessment
              </Link>
            )}
          </div>
        }
      />

      {error && <div className="editor-alert error"><CircleAlert size={15} /> {error}</div>}
      {savedMessage && <div className="editor-alert success"><CheckCircle2 size={15} /> {savedMessage}</div>}

      {viewMode === 'simple' ? (
        <LessonSimpleFlow
          plan={plan}
          assignments={assignments}
          assignmentId={assignmentId}
          assignment={assignment}
          bundle={bundle}
          calendar={calendar}
          preferences={preferences}
          filteredCompetencies={filteredCompetencies}
          topicSuggestions={topicSuggestions}
          competencyPickerOpen={competencyPickerOpen}
          competencySearch={competencySearch}
          simpleLanguage={simpleLanguage}
          quickDraftLoading={quickDraftLoading}
          quickDraftMessage={quickDraftMessage}
          quickDraftPreview={quickDraftPreview}
          validation={validation}
          saving={saving}
          isNew={isNew}
          isDemo={isDemo}
          aiContext={aiContext}
          pendingSections={pendingSections}
          onUpdateContent={updateContent}
          onAssignmentChange={changeAssignment}
          onSelectPeriod={selectCurriculumPeriod}
          onLessonPlanFormatChange={(value) => updateContent((content) => {
            content.lessonPlanFormat = value
            if (value === 'daily_lesson_log') content.numberOfSessions = 4
          })}
          onTopicChange={changeLessonFocus}
          onTopicSuggestion={useTopicSuggestion}
          onToggleCompetency={toggleCompetency}
          onSetPrimary={setPrimaryCompetency}
          onRemoveCompetency={removeCompetency}
          onToggleCompetencyPicker={() => setCompetencyPickerOpen((open) => !open)}
          onCloseCompetencyPicker={() => { setCompetencyPickerOpen(false); setCompetencySearch('') }}
          onCompetencySearchChange={setCompetencySearch}
          onLanguageChange={(value) => {
            updateContent((content) => { content.lessonLanguage = value })
          }}
          onPrepare={() => void prepareQuickDraft()}
          onDiscardDraft={() => setQuickDraftPreview(null)}
          onApplyDraft={applyQuickDraft}
          onSave={(status) => void save(status)}
          onConfirmAllAiReview={confirmAllAiReview}
          onSetResources={setResources}
          onAppendSavedResource={appendSavedResource}
          onMarkAiUsed={markAiUsed}
        />
      ) : <>
      <section className="policy-banner panel warning">
        <span className="policy-banner-icon"><ShieldCheck size={20} /></span>
        <div><strong>AI suggestions are starting points</strong><p>{LESSON_PLANNING_POLICY.aiRule} GuroDesk never auto-fills specific books, page numbers, materials, or devices.</p></div>
        <span className="policy-code">{LESSON_PLANNING_POLICY.code}</span>
      </section>

      <section className="panel quick-draft-panel">
        <div className="quick-draft-heading"><span className="quick-draft-icon"><Sparkles size={19} /></span><div><span className="eyebrow">Fast planning</span><h2>Quick Draft suggestions</h2><p>One Gemini call prepares a coherent set of suggestions for empty planning fields. Your existing text is never overwritten, and resources, references, and post-lesson reflection are never generated.</p></div><button className="button secondary" disabled={quickDraftLoading || plan.content.lessonFocus.trim().length < 3 || (plan.content.curriculumAlignments.length === 0 && !hasExplicitTopicOnlyPurpose(plan.content))} onClick={() => void prepareQuickDraft()}>{quickDraftLoading ? <span className="mini-spinner" /> : <Lightbulb size={15} />} Prepare suggestions</button></div>
        {quickDraftMessage && <div className="quick-draft-message">{quickDraftMessage}</div>}
        {quickDraftPreview?.draft && <div className="quick-draft-preview"><div className="quick-draft-preview-head"><div><strong>Review before applying</strong><small>{quickDraftPreview.model === 'demo-local-preview' ? 'Local demo preview' : `${quickDraftPreview.model}${quickDraftPreview.thinkingLevel === 'high' ? ' · high thinking' : ''}${quickDraftPreview.fallbackUsed ? ' · Lite fallback used' : ''}`}</small></div><p>Only currently empty fields will be filled.</p></div><div className="quick-draft-preview-list">{QUICK_DRAFT_LABELS.map(([key, label]) => quickDraftPreview.draft?.[key] ? <div key={key}><span>{label}</span><p>{quickDraftPreview.draft[key]}</p></div> : null)}</div><div className="quick-draft-preview-actions"><button className="button ghost" onClick={() => setQuickDraftPreview(null)}>Discard</button><button className="button primary" onClick={applyQuickDraft}><CheckCircle2 size={15} /> Apply to empty fields</button></div></div>}
        {pendingSections.length > 0 && <div className="quick-draft-pending"><CircleAlert size={16} /><div><strong>{pendingSections.length} Quick Draft section{pendingSections.length === 1 ? '' : 's'} need your review</strong><p>Edit anything you want, then confirm when the suggested text matches your actual class and intended instruction.</p></div><button className="button secondary" onClick={confirmAllAiReview}><CheckCircle2 size={15} /> I reviewed all</button></div>}
      </section>

      <div className="lesson-editor-grid">
        <div className="lesson-editor-main">
          <section className="panel editor-section">
            <div className="editor-section-head"><div><span className="ilaw-letter neutral">01</span><div><span className="eyebrow">Lesson details</span><h2>Class and curriculum context</h2></div></div></div>
            <div className="form-grid two">
              <label>Teaching assignment<select value={assignmentId} disabled={!isNew} onChange={(event) => changeAssignment(event.target.value)}>{assignments.map((item) => <option key={item.id} value={item.id}>{item.gradeLevel} · {item.learningArea}</option>)}</select></label>
              <label className="workflow-topic-field">Topic / lesson focus<input value={plan.content.lessonFocus} onChange={(event) => changeLessonFocus(event.target.value)} placeholder="What are you teaching?" /><small>The topic is the main pedagogical focus. Curriculum alignments ground it when selected.</small></label>
              <label className={pending('lessonTitle') ? 'pending-control' : ''}>Lesson title<input value={plan.content.lessonTitle} onChange={(event) => updateContent((c) => { c.lessonTitle = event.target.value })} placeholder="Teacher-chosen lesson title" />{pending('lessonTitle') && <small className="pending-review-label">Quick Draft · review</small>}</label>
              <label>Curriculum-guide period<select value={plan.content.curriculumPeriodLabel} onChange={(event) => selectCurriculumPeriod(event.target.value)} disabled={!bundle?.available}>{bundle?.periods.map((item) => <option key={item.id}>{item.label}</option>)}</select></label>
              <label>School grading term<select value={plan.content.gradingTermLabel} onChange={(event) => updateContent((c) => { c.gradingTermLabel = event.target.value })}>{calendar?.periods.map((item) => <option key={item.id}>{item.label}</option>)}</select></label>
              <label>Lesson date<input type="date" value={plan.content.lessonDate} onChange={(event) => updateContent((c) => { c.lessonDate = event.target.value })} /></label>
              <label>Week / schedule<input value={plan.content.weekLabel} onChange={(event) => updateContent((c) => { c.weekLabel = event.target.value })} placeholder="e.g. Week 3" /></label>
              <label>Lesson plan type<select value={plan.content.lessonPlanFormat ?? 'ilaw'} onChange={(event) => updateContent((c) => { const value = event.target.value as LessonPlanFormat; c.lessonPlanFormat = value; if (value === 'daily_lesson_log') c.numberOfSessions = 4 })}>{LESSON_PLAN_FORMAT_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
              <label>No. of sessions<input type="number" min="1" max="20" disabled={plan.content.lessonPlanFormat === 'daily_lesson_log'} value={plan.content.numberOfSessions} onChange={(event) => updateContent((c) => { c.numberOfSessions = Math.max(1, Number(event.target.value) || 1) })} />{plan.content.lessonPlanFormat === 'daily_lesson_log' && <small className="field-help">Daily Lesson Log uses four sessions.</small>}</label>
              <label>Minutes per session<input type="number" min="10" max="300" value={plan.content.durationMinutes} onChange={(event) => updateContent((c) => { c.durationMinutes = Math.max(10, Number(event.target.value) || 60) })} /></label>
              <label>Lesson language<select value={plan.content.lessonLanguage} onChange={(event) => updateContent((c) => { c.lessonLanguage = event.target.value })}>{LESSON_LANGUAGE_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            </div>
            <div className="section-picker"><strong>Sections</strong><div>{assignment?.sections.map((section) => <label className="check-chip" key={section}><input type="checkbox" checked={plan.content.sections.includes(section)} onChange={(event) => updateContent((c) => { c.sections = event.target.checked ? [...new Set([...c.sections, section])] : c.sections.filter((item) => item !== section) })} /> {section}</label>)}</div></div>
            <label className="full-field teacher-verified-field">Teaching approaches<textarea rows={3} value={plan.content.teachingApproaches.join('\n')} onChange={(event) => updateContent((c) => { c.teachingApproaches = [...new Set(event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))] })} placeholder="One approach per line, such as explicit instruction or collaborative learning" /><small>Lesson-specific choices. Saved teaching-setup preferences are used as the initial suggestions and can be changed here.</small></label>
            <div className="full-field competency-picker-field">
              <span className="competency-picker-label">Verified curriculum alignment</span>
              <small className="field-help">Select zero, one, or multiple competencies. One selected competency is kept as the primary alignment for reporting and legacy compatibility.</small>
              <AlignmentPicker plan={plan} bundle={bundle} competencies={filteredCompetencies} open={competencyPickerOpen} search={competencySearch} onToggleOpen={() => setCompetencyPickerOpen((open) => !open)} onClose={() => { setCompetencyPickerOpen(false); setCompetencySearch('') }} onSearchChange={setCompetencySearch} onToggleCompetency={toggleCompetency} onSetPrimary={setPrimaryCompetency} onRemove={removeCompetency} />
              <AlignmentModePanel plan={plan} onUpdateContent={updateContent} />
            </div>
            {bundle && !bundle.available && <div className="curriculum-inline-status warning"><CircleAlert size={15} /><div><strong>Verified curriculum unavailable for this assignment</strong><p>{bundle.coverageNote || 'No verified curriculum bundle was returned.'}</p></div></div>}
            {bundle?.available && visibleCompetencies.length === 0 && <div className="curriculum-inline-status warning"><CircleAlert size={15} /><div><strong>No competency rows were returned</strong><p>{bundle.coverageNote || 'Try reopening the lesson. GuroDesk will not invent competencies.'}</p></div></div>}
            {periodMappingFallback && <div className="curriculum-inline-status warning"><CircleAlert size={15} /><div><strong>Period mapping needs review</strong><p>The selected period did not match the imported competency period IDs, so all verified competencies are shown rather than leaving this selector empty.</p></div></div>}
            {bundle?.coverageNote?.includes('Verified local manifest fallback') && <div className="curriculum-inline-status info"><ShieldCheck size={15} /><div><strong>Verified manifest fallback active</strong><p>{bundle.coverageNote}</p></div></div>}
            {plan.content.performanceStandard && <div className="standard-grounding"><small>Performance standard</small><p>{plan.content.performanceStandard}</p></div>}
            <label className="full-field teacher-verified-field">References<textarea rows={3} value={plan.content.references} onChange={(event) => updateContent((c) => { c.references = event.target.value })} placeholder="Only books, modules, websites, page numbers, or teacher-made materials you actually used." /><small>Teacher-entered only. GuroDesk will not generate citations or page numbers.</small></label>
          </section>

          <section className="panel editor-section ilaw-section intentions-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">I</span><div><span className="eyebrow">Intentions</span><h2>What learners need to learn</h2></div></div><span className="teacher-decision-chip">Teacher approves</span></div>
            {preferences.typicalClassProfile && !plan.content.learnerContext.trim() && <div className="saved-setup-callout"><span>Saved class profile available</span><button className="button ghost" onClick={() => updateContent((c) => { c.learnerContext = preferences.typicalClassProfile })}>Use saved profile</button></div>}
            <AiAssistTextarea label="Learner context / readiness" sectionKey="learnerContext" value={plan.content.learnerContext} onChange={(value) => updateContent((c) => { c.learnerContext = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} placeholder="What do you know about this class that should shape the lesson? Avoid learner names or sensitive personal data." help="Teacher-provided class-level context only. AI does not invent learner needs." />
            <AiAssistTextarea label="Learning objectives" sectionKey="intentions.learningObjectives" value={plan.content.intentions.learningObjectives} onChange={(value) => updateContent((c) => { c.intentions.learningObjectives = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} placeholder="Choose, edit, or write the focused objectives you want learners to demonstrate." help="GuroDesk can propose alternatives centered on the topic and grounded in selected verified competencies; you choose and adapt the final objectives." suggestionType="suggest_learning_objectives" suggestionLabel="Suggest objectives" pendingQuickDraft={pending('intentions.learningObjectives')} />
          </section>

          <section className="panel editor-section ilaw-section learning-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">L</span><div><span className="eyebrow">Learning Experience</span><h2>How learners will engage and learn</h2></div></div><span className="teacher-decision-chip">Teacher approves</span></div>

            <div className="teacher-resource-field">
              <div className="field-label-row"><span>Learning resources</span><small>Teacher-verified only</small></div>
              <textarea rows={4} value={plan.content.learningExperience.resources} onChange={(event) => setResources(event.target.value)} placeholder="Enter only materials, books, modules, devices, or other resources you will actually use." />
              {preferences.actualResources.length > 0 && <div className="saved-resource-chips"><span>From My teaching setup:</span>{preferences.actualResources.map((resource) => <button type="button" key={resource} onClick={() => appendSavedResource(resource)}>+ {resource}</button>)}</div>}
              <div className="resource-actions"><button type="button" className="button ghost" onClick={() => updateContent((c) => { c.learningExperience.resources = 'No additional learning resources required.'; c.resourcesVerifiedByTeacher = true })}>No additional resources</button><label className="review-check"><input type="checkbox" checked={plan.content.resourcesVerifiedByTeacher} onChange={(event) => updateContent((c) => { c.resourcesVerifiedByTeacher = event.target.checked })} /> I verified these are resources I actually use for this lesson.</label></div>
              <small className="field-help">AI suggestions are constrained by the resources and technology you entered in Settings, but this field itself is never AI-filled.</small>
            </div>

            <AiAssistTextarea label="Home-based / Hinay alternative" sectionKey="learningExperience.homeBasedAlternative" value={plan.content.learningExperience.homeBasedAlternative} onChange={(value) => updateContent((c) => { c.learningExperience.homeBasedAlternative = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={3} placeholder="Alternative activity if face-to-face instruction is interrupted" suggestionType="suggest_home_alternative" suggestionLabel="Suggest alternatives" pendingQuickDraft={pending('learningExperience.homeBasedAlternative')} />
            <AiAssistTextarea label="Pre-lesson activity" sectionKey="learningExperience.preLessonActivity" value={plan.content.learningExperience.preLessonActivity} onChange={(value) => updateContent((c) => { c.learningExperience.preLessonActivity = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Brief readiness check, routine, or prior-knowledge activation" suggestionType="suggest_pre_lesson" suggestionLabel="Suggest openings" pendingQuickDraft={pending('learningExperience.preLessonActivity')} />
            <AiAssistTextarea label="Lesson flow" sectionKey="learningExperience.lessonFlow" value={plan.content.learningExperience.lessonFlow} onChange={(value) => updateContent((c) => { c.learningExperience.lessonFlow = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={8} placeholder="Choose or write the sequence, interactions, prompts, practice, and adjustments you intend to use." help="Suggestions use the lesson topic, selected verified alignments, available time, and saved teaching preferences. They cannot invent curriculum facts, materials, or technology." suggestionType="suggest_lesson_flow" suggestionLabel="Suggest lesson flows" pendingQuickDraft={pending('learningExperience.lessonFlow')} />
            <AiAssistTextarea label="Integration & contextualization" sectionKey="learningExperience.integrationContextualization" value={plan.content.learningExperience.integrationContextualization} onChange={(value) => updateContent((c) => { c.learningExperience.integrationContextualization = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Real-life, local, cultural, community, technology, or cross-learning-area connections" suggestionType="suggest_contextualization" suggestionLabel="Suggest contexts" pendingQuickDraft={pending('learningExperience.integrationContextualization')} />
            <AiAssistTextarea label="Inclusion / accommodations" sectionKey="learningExperience.inclusionAccommodations" value={plan.content.learningExperience.inclusionAccommodations} onChange={(value) => updateContent((c) => { c.learningExperience.inclusionAccommodations = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Classroom-level supports, accommodations, or modifications where applicable" help="Suggestions are universal supports only; Gemini is instructed not to infer diagnoses or sensitive learner needs." suggestionType="suggest_inclusion" suggestionLabel="Suggest supports" pendingQuickDraft={pending('learningExperience.inclusionAccommodations')} />
          </section>

          <section className="panel editor-section ilaw-section assessment-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">A</span><div><span className="eyebrow">Assessing Learning</span><h2>Evidence gathered during learning</h2></div></div><span className="teacher-decision-chip">Teacher approves</span></div>
            <AiAssistTextarea label="Formative assessments" sectionKey="assessingLearning.formativeAssessments" value={plan.content.assessingLearning.formativeAssessments} onChange={(value) => updateContent((c) => { c.assessingLearning.formativeAssessments = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={6} placeholder="Checks you will use throughout the session" suggestionType="suggest_formative_assessment" suggestionLabel="Suggest checks" pendingQuickDraft={pending('assessingLearning.formativeAssessments')} />
            <AiAssistTextarea label="What evidence will show learning?" sectionKey="assessingLearning.evidenceOfLearning" value={plan.content.assessingLearning.evidenceOfLearning} onChange={(value) => updateContent((c) => { c.assessingLearning.evidenceOfLearning = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Describe the evidence you will look for before moving forward." suggestionType="suggest_evidence_of_learning" suggestionLabel="Suggest evidence" pendingQuickDraft={pending('assessingLearning.evidenceOfLearning')} />
          </section>

          <section className="panel editor-section ilaw-section ways-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">W</span><div><span className="eyebrow">Ways Forward</span><h2>Reflection and next instructional steps</h2></div></div><span className="teacher-decision-chip">Teacher judgment</span></div>
            <AiAssistTextarea label="Reflection" sectionKey="waysForward.reflection" value={plan.content.waysForward.reflection} onChange={(value) => updateContent((c) => { c.waysForward.reflection = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={5} placeholder="After teaching, record what the evidence showed and what you noticed." help="Reflection stays teacher-authored because it describes what actually happened. AI may polish your wording afterward." />
            <AiAssistTextarea label="Next steps / intervention" sectionKey="waysForward.nextSteps" value={plan.content.waysForward.nextSteps} onChange={(value) => updateContent((c) => { c.waysForward.nextSteps = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={5} placeholder="Reteaching, remediation, enrichment, adjustment, or next lesson decision" suggestionType="suggest_next_steps" suggestionLabel="Suggest contingencies" pendingQuickDraft={pending('waysForward.nextSteps')} />
            <AiAssistTextarea label="Extended learning opportunities" sectionKey="waysForward.extendedLearning" value={plan.content.waysForward.extendedLearning} onChange={(value) => updateContent((c) => { c.waysForward.extendedLearning = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Optional reinforcement, enrichment, or remediation beyond the session" suggestionType="suggest_extended_learning" suggestionLabel="Suggest extensions" pendingQuickDraft={pending('waysForward.extendedLearning')} />
          </section>
        </div>

        <aside className="lesson-editor-side">
          <section className="panel validation-panel">
            <span className="eyebrow">ILAW self-check</span>
            <div className="validation-score"><strong>{validation?.score ?? 0}%</strong><span>{validation?.ready ? 'Ready to finalize' : 'Draft needs attention'}</span></div>
            <div className="validation-list">{validation?.items.map((item) => <div className={`validation-item ${item.passed ? 'passed' : ''}`} key={item.key}>{item.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}<div><strong>{item.label}</strong><small>{item.detail}</small></div></div>)}</div>
          </section>

          <section className="panel ai-declaration-panel">
            <span className="eyebrow">AI use declaration</span>
            <div className="ai-declaration-title"><Sparkles size={17} /><strong>{plan.content.aiDeclaration.used ? 'AI assistance recorded' : 'No AI used'}</strong></div>
            <p>{plan.content.aiDeclaration.statement}</p>
            {pendingSections.length > 0 && <button className="button secondary full" onClick={confirmAllAiReview}><CheckCircle2 size={15} /> Confirm Quick Draft review</button>}
            {plan.content.aiDeclaration.used && pendingSections.length === 0 && !plan.content.aiDeclaration.reviewedByTeacher && <label className="review-check"><input type="checkbox" checked={plan.content.aiDeclaration.reviewedByTeacher} onChange={(event) => updateContent((c) => { c.aiDeclaration = buildAiDeclaration(c.aiDeclaration.operations, event.target.checked) })} /> I reviewed, validated, and adapted all AI-assisted content.</label>}
            {plan.content.aiDeclaration.used && plan.content.aiDeclaration.reviewedByTeacher && pendingSections.length === 0 && <div className="review-complete"><CheckCircle2 size={14} /> Teacher review recorded</div>}
          </section>

          <section className="panel final-actions-panel">
            <span className="eyebrow">Document status</span>
            <div className="current-status"><FileCheck2 size={16} /><strong>{plan.status}</strong></div>
            <button className="button primary full" disabled={saving} onClick={() => void save('draft')}><Save size={15} /> Save draft</button>
            <button className="button secondary full" disabled={saving || !validation?.ready} onClick={() => void save('final')}><CheckCircle2 size={15} /> Mark final</button>
            {plan.id ? <Link className="button ghost full" to={`/lesson-plans/${plan.id}/print`}><FileDown size={15} /> Preview / download</Link> : <button className="button ghost full" disabled><FileDown size={15} /> Save before export</button>}
            {!validation?.ready && <small>Complete the ILAW self-check before marking this plan final. Saved drafts can still be previewed/exported with a draft label.</small>}
          </section>
        </aside>
      </div>
      </>}
    </>
  )
}
