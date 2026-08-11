import type { AssessmentAnswer, AssessmentItem, AssessmentItemVersion, AssessmentQaState, QuestionType } from '../types/assessment'
import { normalizeItemPoints } from './assessmentScoring'
import { assessmentVisualSourceHash, invalidateAssessmentVisualAfterContentEdit, withResolvedAssessmentVisualPlan } from './assessmentVisualPlanning'

const MAX_HISTORY = 5

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function versionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `item-version-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export type AssessmentItemEdit = Partial<Pick<AssessmentItem, 'prompt' | 'questionType' | 'answer' | 'rationale' | 'teacherNotes' | 'pointsPossible' | 'points' | 'visual' | 'visualRequirement' | 'visualIntent'>>

export function isAssessmentItemLocked(item: AssessmentItem) {
  return item.locked === true || item.qaState === 'locked'
}

export function canEditAssessmentItem(item: AssessmentItem) {
  return !isAssessmentItemLocked(item)
}

function snapshot(item: AssessmentItem, source: AssessmentItemVersion['source']): AssessmentItemVersion {
  return {
    id: versionId(),
    savedAt: new Date().toISOString(),
    source,
    prompt: item.prompt,
    questionType: item.questionType,
    answer: clone(item.answer),
    rationale: item.rationale,
    teacherNotes: item.teacherNotes,
    pointsPossible: normalizeItemPoints(item),
    points: item.points,
    qaState: item.qaState,
    visual: item.visual ? clone(item).visual : undefined,
    visualRequirement: item.visualRequirement,
    visualIntent: item.visualIntent,
    visualStatus: item.visualStatus,
    visualAttempts: item.visualAttempts,
    visualError: item.visualError,
    visualSourceHash: item.visualSourceHash,
    visualUpdatedAt: item.visualUpdatedAt,
  }
}

export function pushAssessmentItemHistory(item: AssessmentItem, source: AssessmentItemVersion['source'] = 'teacher_edit', maxHistory = MAX_HISTORY): AssessmentItem {
  const history = [...(item.history ?? []), snapshot(item, source)].slice(-Math.max(1, Math.min(MAX_HISTORY, maxHistory)))
  return { ...clone(item), history }
}

function answerChanged(before: AssessmentItem, after: AssessmentItem) {
  return before.questionType !== after.questionType
    || before.prompt !== after.prompt
    || JSON.stringify(before.answer) !== JSON.stringify(after.answer)
    || JSON.stringify(before.visual) !== JSON.stringify(after.visual)
    || normalizeItemPoints(before) !== normalizeItemPoints(after)
}

function visualSourceChanged(before: AssessmentItem, after: AssessmentItem) {
  return before.questionType !== after.questionType || before.prompt !== after.prompt || JSON.stringify(before.answer) !== JSON.stringify(after.answer)
}

/** Apply one-question edits without allowing a lock to be bypassed. */
export function editAssessmentItem(item: AssessmentItem, edit: AssessmentItemEdit, options: { explicitUnlock?: boolean; source?: AssessmentItemVersion['source'] } = {}) {
  if (isAssessmentItemLocked(item) && options.explicitUnlock !== true) throw new Error('Locked assessment items must be unlocked before editing.')
  let next = { ...clone(item), ...clone(edit) } as AssessmentItem
  const material = answerChanged(item, next)
  if (visualSourceChanged(item, next)) next = invalidateAssessmentVisualAfterContentEdit(item, next)
  else if (Object.prototype.hasOwnProperty.call(edit, 'visual')) {
    next = withResolvedAssessmentVisualPlan({ ...next, visualStatus: next.visual ? 'succeeded' : undefined, visualSourceHash: assessmentVisualSourceHash(next), visualError: undefined, visualUpdatedAt: new Date().toISOString() })
  }
  const withHistory = pushAssessmentItemHistory(item, options.source ?? 'teacher_edit')
  return {
    ...next,
    history: withHistory.history,
    pointsPossible: Number(next.pointsPossible ?? next.points ?? normalizeItemPoints(item)),
    points: next.points === undefined ? Number(next.pointsPossible ?? next.points ?? normalizeItemPoints(item)) : next.points,
    authorshipState: 'teacher_edited' as const,
    qaState: material ? 'answer_needs_recheck' as const : 'teacher_edited' as const,
    locked: false,
  }
}

export function markAssessmentItemGenerated(item: AssessmentItem) {
  if (isAssessmentItemLocked(item)) throw new Error('Locked assessment items cannot be replaced.')
  return { ...clone(item), authorshipState: 'ai_suggestion' as const, qaState: 'generated' as const }
}

export function markAssessmentItemVerified(item: AssessmentItem) {
  if (isAssessmentItemLocked(item)) return item
  return { ...clone(item), qaState: 'verified' as const }
}

export function markAssessmentItemNeedsReview(item: AssessmentItem, state: Exclude<AssessmentQaState, 'locked'> = 'needs_review') {
  if (isAssessmentItemLocked(item)) return item
  return { ...clone(item), qaState: state }
}


function visibleBlankMarkers(prompt: string) {
  return prompt.match(/_{3,}/gu) ?? []
}

/**
 * Recover the structured answer shell for legacy/saved fill-in-the-blank items
 * when the learner prompt contains exactly one visible blank marker but the
 * structured `answer.blanks` array was lost. Prefer the newest bounded history
 * version with one valid blank so old generated answers are not discarded.
 * Never guesses a missing accepted answer from rationale/prompt text.
 */
export function recoverSingleFillBlankStructure(item: AssessmentItem) {
  if (item.questionType !== 'fill_in_the_blank' || item.answer.type !== 'fill_in_the_blank') return clone(item)
  if (item.answer.blanks.length > 0 || visibleBlankMarkers(item.prompt).length !== 1) return clone(item)

  const prior = [...(item.history ?? [])].reverse().find((version) =>
    version.questionType === 'fill_in_the_blank'
    && version.answer.type === 'fill_in_the_blank'
    && version.answer.blanks.length === 1
    && version.answer.blanks[0].acceptedAnswers.some((answer) => answer.trim().length > 0),
  )
  const recoveredBlank = prior && prior.answer.type === 'fill_in_the_blank'
    ? clone(prior.answer.blanks[0])
    : { id: 'blank-1', acceptedAnswers: [] as string[] }

  return { ...clone(item), answer: { type: 'fill_in_the_blank' as const, blanks: [recoveredBlank] } }
}

export function lockAssessmentItem(item: AssessmentItem) {
  return { ...clone(item), locked: true, qaState: 'locked' as const }
}

export function unlockAssessmentItem(item: AssessmentItem) {
  return { ...clone(item), locked: false, qaState: item.qaState === 'locked' ? 'needs_review' as const : item.qaState }
}

export function restoreAssessmentItemVersion(item: AssessmentItem, historyId: string, options: { explicitUnlock?: boolean } = {}) {
  if (isAssessmentItemLocked(item) && options.explicitUnlock !== true) throw new Error('Locked assessment items must be unlocked before restoring a version.')
  const prior = (item.history ?? []).find((entry) => entry.id === historyId)
  if (!prior) throw new Error('The requested item version is not available in bounded history.')
  const current = pushAssessmentItemHistory(item, 'restore')
  return {
    ...current,
    prompt: prior.prompt,
    questionType: prior.questionType,
    answer: clone(prior.answer),
    rationale: prior.rationale,
    teacherNotes: prior.teacherNotes,
    pointsPossible: prior.pointsPossible,
    points: prior.points ?? prior.pointsPossible,
    visual: prior.visual ? clone(prior.visual) : undefined,
    visualRequirement: prior.visualRequirement,
    visualIntent: prior.visualIntent,
    visualStatus: prior.visualStatus,
    visualAttempts: prior.visualAttempts,
    visualError: prior.visualError,
    visualSourceHash: prior.visualSourceHash,
    visualUpdatedAt: prior.visualUpdatedAt,
    authorshipState: 'teacher_edited' as const,
    qaState: 'answer_needs_recheck' as const,
    locked: false,
  }
}

/** Replace exactly one item in an assessment; all other mappings/IDs remain untouched. */
export function replaceAssessmentItem<T extends { items: AssessmentItem[] }>(assessment: T, itemId: string, replacement: AssessmentItem, options: { explicitUnlock?: boolean } = {}): T {
  const index = assessment.items.findIndex((item) => item.id === itemId)
  if (index < 0) throw new Error('Assessment item not found.')
  if (isAssessmentItemLocked(assessment.items[index]) && options.explicitUnlock !== true) throw new Error('Locked assessment items must be unlocked before replacement.')
  if (replacement.id !== itemId || replacement.itemNumber !== assessment.items[index].itemNumber) throw new Error('A replacement must preserve the item identity and number.')
  const items = assessment.items.slice()
  items[index] = replacement
  return { ...assessment, items }
}

export const saveAssessmentItemVersion = pushAssessmentItemHistory
export const lockItem = lockAssessmentItem
export const unlockItem = unlockAssessmentItem
export const restoreItemVersion = restoreAssessmentItemVersion
