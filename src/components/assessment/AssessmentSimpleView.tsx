import { ArrowLeft, Check, CircleAlert, ClipboardCheck, Download, Eye, FileDown, FileText, Printer, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../PageHeader'
import { SimpleAdvancedToggle } from '../ui/SimpleAdvancedToggle'
import type { AssessmentItem } from '../../types/assessment'
import type { AssessmentRecordView } from '../../pages/assessmentUi'
import { assessmentAttentionCount, assessmentItemHasPreparationBlocker, assessmentReadyCount, assessmentTeacherErrorLabel, pointsForItem } from '../../pages/assessmentUi'
import type { AssessmentPreparationController } from '../../hooks/useAssessmentPreparation'
import { AssessmentPreparationProgress } from './AssessmentPreparationProgress'
import { AssessmentQuestionOutline } from './AssessmentQuestionOutline'
import { AssessmentSimpleQuestionEditor } from './AssessmentSimpleQuestionEditor'

export function AssessmentSimpleView({
  record,
  selectedIndex,
  current,
  readOnly,
  preparation,
  error = '',
  savedMessage = '',
  batchMessage = '',
  onModeChange,
  onSelect,
  onChangeItem,
  onSave,
  onPrevious,
  onNext,
  onFixRemaining,
  onReviewQuestions,
  onFinalize,
  finalizing = false,
}: {
  record: AssessmentRecordView
  selectedIndex: number
  current: AssessmentItem | null
  readOnly: boolean
  preparation: AssessmentPreparationController
  error?: string
  savedMessage?: string
  batchMessage?: string
  onModeChange: (mode: 'simple' | 'advanced') => void
  onSelect: (index: number) => void
  onChangeItem: (updater: (item: AssessmentItem) => AssessmentItem) => void
  onSave?: () => void
  onPrevious: () => void
  onNext: () => void
  onFixRemaining: () => void
  onReviewQuestions: () => void
  onFinalize: () => void
  finalizing?: boolean
}) {
  const ready = assessmentReadyCount(record)
  const attention = assessmentAttentionCount(record)
  const total = Math.max(record.totalItems, record.items.length)
  const preparationBlockers = record.items.filter(assessmentItemHasPreparationBlocker).length
  const unreviewed = record.items.filter((item) => item.authorshipState === 'ai_suggestion').length
  const readyForTeacherReview = !readOnly && preparationBlockers === 0 && record.items.length >= total
  const complete = readOnly && record.status !== 'draft'
  const firstAttention = record.items.findIndex(assessmentItemHasPreparationBlocker)

  return <div className="assessment-simple-page">
    <PageHeader eyebrow="Test preparation" title={record.title} description={[record.gradeLevel, record.learningArea].filter(Boolean).join(' · ') || 'Assessment'} actions={<div className="assessment-simple-header-actions"><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> All assessments</Link><SimpleAdvancedToggle mode="simple" onChange={onModeChange} /></div>} />
    {error && <><div className="form-message error assessment-editor-message" role="alert"><CircleAlert size={15} /> {assessmentTeacherErrorLabel(error)}</div><details className="assessment-technical-details assessment-simple-error-details"><summary>Technical details</summary><p>{error}</p></details></>}
    {savedMessage && <div className="assessment-saved-message" role="status"><Check size={15} /> {savedMessage}</div>}
    <section className="panel assessment-simple-context"><div><small>Based on</small><strong>{record.sourceTosTitle}</strong><span>{[record.gradeLevel, record.learningArea, record.schoolYear].filter(Boolean).join(' · ')}</span></div><div className="assessment-simple-context-metrics"><strong>{total}</strong><span>questions</span><strong>{record.totalPoints ?? record.items.reduce((sum, item) => sum + pointsForItem(item), 0)}</strong><span>points</span></div><div className={`assessment-simple-ready-badge ${complete ? 'complete' : attention ? 'attention' : 'working'}`}><span>{complete ? <Check size={15} /> : attention ? <CircleAlert size={15} /> : <Eye size={15} />}</span><strong>{complete ? 'Finalized' : readyForTeacherReview ? 'Ready for your review' : `${ready} of ${total} ready`}</strong></div></section>
    {!readOnly && preparationBlockers > 0 && <section className="panel assessment-simple-primary-action"><div><span className="assessment-simple-eyebrow">Next step</span><h2>Prepare a classroom-ready test</h2><p>GuroDesk creates missing questions, adds safe diagrams, and checks the paper. Generated work is saved as a draft for your review.</p></div><button data-testid="assessment-generate-prepare" type="button" className="button primary assessment-simple-generate" onClick={preparation.prepare} disabled={preparation.working}><WandSparkles size={19} /> {preparation.working ? preparation.phaseLabel : 'Generate & prepare test'}</button></section>}
    {readyForTeacherReview && <section className="panel assessment-simple-primary-action complete"><div><span className="assessment-simple-eyebrow">Teacher review required</span><h2>Review before finalizing</h2><p>{unreviewed ? `${unreviewed} AI-prepared question${unreviewed === 1 ? '' : 's'} still require your acceptance. ` : ''}Review the questions below. Finalization happens only after your explicit confirmation.</p></div><div className="assessment-simple-export-actions"><button type="button" className="button ghost" onClick={onReviewQuestions}><Eye size={17} /> Review questions</button><button type="button" className="button primary assessment-simple-generate" onClick={onFinalize} disabled={finalizing || preparation.working}><ClipboardCheck size={18} /> {finalizing ? 'Finalizing…' : 'I reviewed — finalize test'}</button></div></section>}
    {complete && <section className="panel assessment-simple-primary-action complete"><div><span className="assessment-simple-eyebrow">Finalized</span><h2>Test is ready</h2><p>Your teacher-reviewed test is locked. Preview the canonical paper before sharing it with learners.</p></div><Link className="button primary assessment-simple-generate" to={`/assessments/${record.id}/print`}><Eye size={19} /> Preview test</Link></section>}
    <AssessmentPreparationProgress preparation={preparation} />
    <p className="assessment-simple-autosave-banner"><Check size={15} /> Generation progress is saved automatically. Save teacher edits with Save draft.</p>
    {batchMessage && !preparation.working && <details className="assessment-technical-details assessment-simple-update"><summary>Technical details</summary><p>{batchMessage}</p></details>}
    {!readOnly && !preparation.working && preparationBlockers > 0 && <section className="panel assessment-simple-attention"><div><strong>{preparationBlockers} question{preparationBlockers === 1 ? '' : 's'} need attention</strong><span>Fix the remaining items or review the question list.</span></div><div><button type="button" className="button primary" onClick={onFixRemaining}>{firstAttention >= 0 ? 'Fix remaining' : 'Review questions'}</button><button type="button" className="button ghost" onClick={onReviewQuestions}>Review questions</button></div></section>}
    {complete && <section className="panel assessment-simple-export"><div><span className="assessment-simple-eyebrow">Share your test</span><h2>Preview and download</h2><p>The existing canonical preview keeps Student, Teacher, and Answer Key copies aligned across Word, PDF, and print.</p></div><div className="assessment-simple-export-actions"><Link className="button primary" to={`/assessments/${record.id}/print`}><Download size={16} /> Download Word</Link><Link className="button secondary" to={`/assessments/${record.id}/print`}><FileText size={16} /> PDF</Link><Link className="button ghost" to={`/assessments/${record.id}/print`}><Printer size={16} /> Print</Link></div><div className="assessment-simple-export-modes"><span><Eye size={13} /> Student</span><span><FileDown size={13} /> Teacher</span><span><Check size={13} /> Answer Key</span><small>Choose a copy in the preview.</small></div></section>}
    <section className="assessment-simple-review-section" id="assessment-simple-questions"><div className="assessment-simple-section-heading"><div><span className="assessment-simple-eyebrow">Question review</span><h2>Questions at a glance</h2><p>Choose one question to edit. TOS mapping stays protected.</p></div><span>{ready}/{total} ready</span></div><AssessmentQuestionOutline items={record.items} selectedIndex={selectedIndex} onSelect={onSelect} /></section>
    {current && <AssessmentSimpleQuestionEditor item={current} index={selectedIndex} total={record.items.length} readOnly={readOnly} onChange={onChangeItem} onBack={onReviewQuestions} onPrevious={onPrevious} onNext={onNext} onSave={onSave} />}
  </div>
}
