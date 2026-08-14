import { ArrowLeft, ChevronLeft, ChevronRight, FilePenLine, Lock, Save } from 'lucide-react'
import { AssessmentDiagram } from '../AssessmentDiagram'
import type { AssessmentItem, AssessmentNumberingMode } from '../../types/assessment'
import { assessmentItemNumberLabel } from '../../lib/assessmentGenerationV2'
import { assessmentItemSourcePresentation } from '../../lib/assessmentSourcePresentation'
import { assessmentItemStatus, assessmentVisualStatusLabel, isLocked, mappingDetails, mappingLabel, pointsForItem, typeLabel } from '../../pages/assessmentUi'

export function AssessmentSimpleQuestionEditor({
  item,
  index,
  total,
  readOnly,
  visualStatus,
  onChange,
  onBack,
  onPrevious,
  onNext,
  onSave,
  numberingMode = 'legacy_items',
}: {
  item: AssessmentItem
  index: number
  total: number
  readOnly: boolean
  visualStatus?: string
  onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void
  onBack: () => void
  onPrevious: () => void
  onNext: () => void
  onSave?: () => void
  numberingMode?: AssessmentNumberingMode
}) {
  const locked = isLocked(item)
  const disabled = readOnly || locked
  const visualRequirement = item.visualRequirement ?? 'none'
  const numberLabel = assessmentItemNumberLabel(item, numberingMode)
  const translatedVisualStatus = visualStatus ?? assessmentVisualStatusLabel(item.visualStatus, visualRequirement)
  const sourcePresentation = assessmentItemSourcePresentation(item)
  return <article id="assessment-simple-question-editor" className="panel assessment-simple-question-editor" aria-labelledby="assessment-simple-question-title">
    <div className="assessment-simple-question-heading">
      <button type="button" className="button ghost" onClick={onBack}><ArrowLeft size={16} /> All questions</button>
      <span>Question {numberLabel} · {index + 1} of {total}</span>
    </div>
    <div className="assessment-simple-question-title-row">
      <div><span className="assessment-simple-question-kicker">{typeLabel(item.questionType)}</span><h2 id="assessment-simple-question-title">Question {numberLabel}</h2></div>
      <span className={`assessment-simple-status status-${assessmentItemStatus(item).toLocaleLowerCase().replace(/\s+/gu, '-')}`}><FilePenLine size={14} /> {assessmentItemStatus(item)}</span>
    </div>
    <div className="assessment-simple-mapping"><div><small>{sourcePresentation.label}</small><strong>{mappingLabel(item)}</strong><span>{mappingDetails(item)}</span></div><Lock size={16} aria-label={sourcePresentation.lockLabel} /></div>
    <label className="assessment-simple-prompt">Question prompt<textarea rows={6} disabled={disabled} value={item.prompt} onChange={(event) => onChange((current) => ({ ...current, prompt: event.target.value }))} placeholder="Write the question learners should answer." /></label>
    <div className="assessment-simple-question-fields"><label>Points possible<input type="number" min="0" step="1" disabled={disabled || numberingMode === 'point_ranges'} value={pointsForItem(item)} onChange={(event) => onChange((current) => ({ ...current, pointsPossible: Math.max(0, Number(event.target.value) || 0), points: Math.max(0, Number(event.target.value) || 0) }))} /></label><label>Teacher note <small>Private; not shown to learners.</small><textarea rows={3} disabled={disabled} value={item.teacherNotes ?? ''} onChange={(event) => onChange((current) => ({ ...current, teacherNotes: event.target.value }))} placeholder="Optional note for your review" /></label></div>
    <div className="assessment-simple-question-status"><strong>{translatedVisualStatus}</strong>{item.visual && <AssessmentDiagram visual={item.visual} className="assessment-simple-question-visual" />}{item.visualError && visualRequirement === 'required' && <small>This required diagram still needs attention. Try again under Customize.</small>}</div>
    <p className="assessment-simple-advanced-hint">Need answer choices, rubrics, diagrams, or verification controls? Use <strong>Customize</strong> above to open the full editor.</p>
    <div className="assessment-simple-question-actions"><button type="button" className="button ghost" disabled={index <= 0} onClick={onPrevious}><ChevronLeft size={16} /> Previous</button>{onSave && <button type="button" className="button secondary" disabled={disabled} onClick={onSave}><Save size={16} /> Save draft</button>}<button type="button" className="button primary" disabled={index >= total - 1} onClick={onNext}>Next <ChevronRight size={16} /></button></div>
  </article>
}
