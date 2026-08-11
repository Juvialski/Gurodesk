import type {
  AssessmentAnswer,
  AssessmentAuthorshipState,
  AssessmentItem,
  AssessmentRecord,
  QuestionType,
} from '../types/assessment'
import type { AssessmentVisualRequirement, AssessmentVisualStatus } from '../types/assessmentVisual'
import { ASSESSMENT_QUESTION_TYPES } from '../types/assessment'

export type AssessmentItemType = QuestionType
export type AssessmentRecordView = AssessmentRecord & { sourceTosTitle: string }
export type AssessmentViewMode = 'simple' | 'advanced'
export type AssessmentPreparationStage = 'questions' | 'visuals' | 'qa'

/**
 * The preference is intentionally local to this browser. It is a presentation
 * preference, not assessment data, so it must never be persisted with the
 * assessment record or sent to the provider.
 */
export const ASSESSMENT_VIEW_MODE_STORAGE_KEY = 'gurodesk.assessment.view-mode'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {} }

export function normalizeAssessment(recordValue: AssessmentRecord): AssessmentRecordView {
  const value = recordValue as AssessmentRecord & UnknownRecord
  const items = Array.isArray(value.items) ? value.items : []
  const totalItems = Number(value.totalItems || items.length)
  const totalPoints = items.reduce((sum, item) => sum + pointsForItem(item as AssessmentItem), 0)
  return {
    ...recordValue,
    title: recordValue.title || 'Untitled assessment',
    instructions: recordValue.instructions || '',
    totalItems,
    totalPoints,
    items,
    sourceTosTitle: recordValue.sourceTos?.title || 'Finalized TOS',
  }
}

export function itemsForRecord(recordValue: AssessmentRecord): AssessmentItem[] { return recordValue.items }

export function recordWithItems(recordValue: AssessmentRecord, items: AssessmentItem[], status: AssessmentRecord['status'] = recordValue.status, title = recordValue.title, instructions = recordValue.instructions): AssessmentRecord {
  const totalPoints = items.reduce((sum, item) => sum + pointsForItem(item), 0)
  return { ...recordValue, status, title, instructions, items, totalPoints }
}

export function assessmentTitle(recordValue: AssessmentRecord) { return recordValue.title || 'Untitled assessment' }

export function pointsForItem(item: AssessmentItem) {
  const value = record(item).pointsPossible ?? record(item).points
  if (value === null || value === undefined || value === '') return 1
  const points = Number(value)
  return Number.isFinite(points) ? points : 0
}

export function assessmentTotalPoints(recordValue: AssessmentRecord) { return recordValue.items.reduce((sum, item) => sum + pointsForItem(item), 0) }

export function assessmentCompletion(recordValue: AssessmentRecord) {
  const total = Math.max(recordValue.totalItems, recordValue.items.length)
  const filled = recordValue.items.filter((item) => item.prompt.trim()).length
  const needsReview = recordValue.items.filter((item) => {
    const state = record(item).qaState
    return state === 'needs_review' || state === 'answer_needs_recheck' || state === 'repair_needed'
  }).length
  const objectivePoints = recordValue.items.filter((item) => !['constructed_response', 'problem_solving', 'essay'].includes(item.questionType)).reduce((sum, item) => sum + pointsForItem(item), 0)
  const teacherScoredPoints = recordValue.items.filter((item) => ['constructed_response', 'problem_solving', 'essay'].includes(item.questionType)).reduce((sum, item) => sum + pointsForItem(item), 0)
  return {
    filled,
    total,
    percent: total ? Math.round((filled / total) * 100) : 0,
    needsReview,
    totalPoints: assessmentTotalPoints(recordValue),
    objectivePoints,
    teacherScoredPoints,
  }
}

export function mappingLabel(item: AssessmentItem) { return [item.competencySnapshot.code, item.competencySnapshot.text].filter(Boolean).join(' · ') || 'TOS mapping preserved' }

export function mappingDetails(item: AssessmentItem) {
  return [item.cognitiveCategorySnapshot.label || item.cognitiveCategorySnapshot.shortLabel, item.competencySnapshot.sourcePage === null || item.competencySnapshot.sourcePage === undefined ? '' : `Source p. ${item.competencySnapshot.sourcePage}`].filter(Boolean).join(' · ') || 'Mapping details preserved in source TOS'
}

export function typeLabel(type: AssessmentItemType) {
  const labels: Record<QuestionType, string> = {
    multiple_choice: 'Multiple choice', true_false: 'True / False', short_answer: 'Short answer', constructed_response: 'Constructed response', identification: 'Identification', fill_in_the_blank: 'Fill in the blank', numerical_answer: 'Numerical answer', problem_solving: 'Problem solving', matching: 'Matching type', multiple_select: 'Multiple select', essay: 'Essay / extended response',
  }
  return labels[type] ?? type
}

export function stateLabel(state: AssessmentAuthorshipState | string | undefined) {
  if (state === 'ai_suggestion') return 'AI suggestion'
  if (state === 'teacher_accepted') return 'Accepted'
  if (state === 'teacher_edited') return 'Edited'
  if (state === 'manual') return 'Manual'
  if (state === 'verified') return 'Verified'
  if (state === 'needs_review' || state === 'repair_needed' || state === 'answer_needs_recheck') return 'Needs review'
  if (state === 'locked') return 'Locked'
  return 'Empty'
}

/**
 * Translate persisted QA/authorship values into teacher-facing language.
 *
 * Keep this mapping in the UI boundary: raw lifecycle values remain useful to
 * repositories, validation, and resume logic, but they should not leak into a
 * teacher's default assessment workflow.
 */
export function assessmentItemStatusLabel(state: AssessmentAuthorshipState | string | undefined): string {
  if (state === 'generated' || state === 'verified' || state === 'locked' || state === 'teacher_accepted' || state === 'manual') return 'Ready'
  if (state === 'teacher_edited') return 'Edited'
  if (state === 'answer_needs_recheck') return 'Check needed'
  if (state === 'needs_review' || state === 'repair_needed') return 'Needs review'
  return 'Missing'
}

/** Alias with an explicit translation name for UI callers and focused tests. */
export const translateAssessmentItemStatus = assessmentItemStatusLabel

export function assessmentItemStatusTone(state: AssessmentAuthorshipState | string | undefined): 'missing' | 'ready' | 'edited' | 'attention' {
  const label = assessmentItemStatusLabel(state)
  if (label === 'Ready') return 'ready'
  if (label === 'Edited') return 'edited'
  if (label === 'Needs review' || label === 'Check needed') return 'attention'
  return 'missing'
}

/**
 * Translate visual lifecycle values while respecting helpful/required
 * semantics. A failed helpful visual does not make a question incomplete;
 * a failed required visual does.
 */
export function assessmentVisualStatusLabel(
  status: AssessmentVisualStatus | string | undefined,
  requirement: AssessmentVisualRequirement | string | undefined = 'none',
): string {
  if (status === 'pending' || status === 'running') return 'Adding diagram'
  if (status === 'succeeded') return 'Diagram ready'
  if (status === 'failed') return requirement === 'required' ? 'Needs diagram' : 'Ready · diagram skipped'
  if (status === 'stale') return requirement === 'required' ? 'Needs diagram' : 'Diagram needs refresh'
  if (requirement === 'required') return 'Needs diagram'
  if (requirement === 'helpful') return 'Diagram optional'
  return 'No diagram needed'
}

/** Alias with an explicit translation name for UI callers and focused tests. */
export const translateAssessmentVisualStatus = assessmentVisualStatusLabel

export function assessmentPreparationStageLabel(stage: AssessmentPreparationStage): string {
  if (stage === 'visuals') return 'Adding diagrams'
  if (stage === 'qa') return 'Checking paper'
  return 'Creating questions'
}

export function assessmentPreparationPhaseLabel(stage: AssessmentPreparationStage): string {
  return assessmentPreparationStageLabel(stage)
}

export function assessmentItemStatus(item: AssessmentItem): string {
  if (item.authorshipState === 'ai_suggestion') return 'Needs review'
  const qaState = record(item).qaState
  return assessmentItemStatusLabel(typeof qaState === 'string' ? qaState : item.authorshipState)
}

export function assessmentItemHasPreparationBlocker(item: AssessmentItem): boolean {
  const qaState = String(record(item).qaState ?? '')
  if (!item.prompt.trim()) return true
  if (assessmentItemStatusLabel(qaState || item.authorshipState) === 'Missing') return true
  if (['needs_review', 'repair_needed', 'answer_needs_recheck'].includes(qaState)) return true
  const requirement = item.visualRequirement ?? 'none'
  if (requirement === 'required' && (!item.visual || ['pending', 'running', 'failed', 'stale'].includes(String(item.visualStatus ?? '')))) return true
  return false
}

export function assessmentItemNeedsAttention(item: AssessmentItem): boolean {
  return item.authorshipState === 'ai_suggestion' || assessmentItemHasPreparationBlocker(item)
}

export function assessmentReadyCount(recordValue: AssessmentRecord): number {
  return recordValue.items.filter((item) => !assessmentItemNeedsAttention(item)).length
}

export function assessmentAttentionCount(recordValue: AssessmentRecord): number {
  return recordValue.items.filter(assessmentItemNeedsAttention).length
}

/** Keep provider/runtime wording inside Technical details in Simple mode. */
export function assessmentTeacherErrorLabel(error: string | undefined): string {
  if (!error) return ''
  if (/quota|rate.?limit|provider.?paused|provider limit|429/iu.test(error)) return 'AI creation paused. Everything completed so far is saved.'
  if (/visual|diagram/iu.test(error)) return 'A diagram could not be added. The question is still saved; try again or edit it under Customize.'
  if (/save|persist|supabase/iu.test(error)) return 'Your latest change could not be saved. Try Save draft again.'
  return 'This step could not be completed. Your saved work is preserved; try again or open Customize for more options.'
}

export function answerForType(type: QuestionType): AssessmentAnswer {
  switch (type) {
    case 'true_false': return { type, value: false }
    case 'short_answer': return { type, acceptedAnswers: [], caseSensitive: false }
    case 'identification': return { type, acceptedAnswers: [], caseSensitive: false }
    case 'fill_in_the_blank': return { type, blanks: [] }
    case 'numerical_answer': return { type, value: 0, tolerance: 0, unit: '', requireUnit: false }
    case 'problem_solving': return { type, finalAnswer: '', solutionOutline: '' }
    case 'matching': return { type, prompts: [], choices: [], mappings: [], reusableChoices: false }
    case 'multiple_select': return { type, choices: [], choiceIds: [], scoringPolicy: 'all_or_nothing' }
    case 'constructed_response': return { type, expectedResponse: '', sampleResponse: '', rubricGuidance: '', rubric: [] }
    case 'essay': return { type, keyPoints: [], rubric: [] }
    default: return { type: 'multiple_choice', choices: [], choiceId: '' }
  }
}

export function cloneItem(item: AssessmentItem): AssessmentItem {
  const cloned = typeof structuredClone === 'function' ? structuredClone(item) : JSON.parse(JSON.stringify(item)) as AssessmentItem
  return cloned
}

export function isLocked(item: AssessmentItem) { return record(item).locked === true || record(item).qaState === 'locked' }

export function allowedQuestionTypes(recordValue: AssessmentRecord): QuestionType[] {
  const settings = record(recordValue).settings
  const settingsRecord = record(settings)
  const rawAllowed = Array.isArray(settingsRecord.allowedTypes) ? settingsRecord.allowedTypes : []
  const allowed = rawAllowed.filter((value: unknown): value is QuestionType => ASSESSMENT_QUESTION_TYPES.includes(String(value) as QuestionType))
  return allowed.length ? [...new Set(allowed)] : [...ASSESSMENT_QUESTION_TYPES]
}

export function defaultPointsForType(recordValue: AssessmentRecord, type: QuestionType) {
  const defaults = record(record(recordValue).settings).defaultPoints
  const value = Number(record(defaults)[type])
  if (Number.isFinite(value) && value > 0) return value
  return ['constructed_response'].includes(type) ? 5 : type === 'problem_solving' ? 3 : type === 'essay' ? 10 : 1
}

export function appendItemHistory(item: AssessmentItem, source: 'generated' | 'alternative' | 'teacher_edit' | 'repair' | 'restore') {
  if (!item.prompt.trim()) return Array.isArray(record(item).history) ? record(item).history as never[] : []
  const history = Array.isArray(record(item).history) ? record(item).history as never[] : []
  const value = record(item)
  const version = {
    id: `item-version-${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
    source,
    prompt: item.prompt,
    questionType: item.questionType,
    answer: cloneItem(item).answer,
    rationale: item.rationale,
    teacherNotes: item.teacherNotes,
    pointsPossible: pointsForItem(item),
    points: item.points,
    qaState: value.qaState,
    visual: item.visual ? cloneItem(item).visual : undefined,
    visualRequirement: item.visualRequirement,
    visualIntent: item.visualIntent,
    visualStatus: item.visualStatus,
    visualAttempts: item.visualAttempts,
    visualError: item.visualError,
    visualSourceHash: item.visualSourceHash,
    visualUpdatedAt: item.visualUpdatedAt,
  }
  return [...history, version].slice(-5)
}

export function itemSummary(item: AssessmentItem) {
  const points = pointsForItem(item)
  const state = String(record(item).qaState ?? item.authorshipState)
  return { itemNumber: item.itemNumber, type: typeLabel(item.questionType), points, completed: Boolean(item.prompt.trim()), locked: isLocked(item), state: stateLabel(state) }
}

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (typeof obj.message === 'string' && obj.message) return obj.message
    if (typeof obj.error_description === 'string' && obj.error_description) return obj.error_description
    if (typeof obj.details === 'string' && obj.details) return obj.details
  }
  return fallback
}
