import type {
  AssessmentAnswer,
  AssessmentItem,
  AssessmentRecord,
  QuestionType,
} from '../types/assessment'
import type { AssessmentVisual, AssessmentVisualRequirement } from '../types/assessmentVisual'
import { ASSESSMENT_QUESTION_TYPES } from '../types/assessment'
import { validateAssessmentFinal } from './assessmentValidation'
import {
  classifyAssessmentRisk,
  parseAssessmentVerifierResult,
  stateForAssessmentItem,
  validateAssessmentItemDeterministic,
  verifierRequiresRepair,
  type AssessmentDeterministicQaResult,
  type AssessmentRiskResult,
  type AssessmentVerifierResult,
} from './assessmentQa'
import { assessmentRequestScheduler } from './assessmentRequestScheduler'
import { supabase } from './supabase'
import { assessmentVisualPlanForItem, assessmentVisualSourceHash, invalidateAssessmentVisualAfterContentEdit, withResolvedAssessmentVisualPlan } from './assessmentVisualPlanning'
import { validateAssessmentVisual } from './assessmentVisualValidation'

type UnknownRecord = Record<string, unknown>

export type AssessmentItemCandidate = {
  questionType: QuestionType
  prompt: string
  answer: AssessmentAnswer
  rationale: string
  referencedResources: string[]
  /** Visual intent is decided with the question, but the diagram itself is generated in a separate provider request. */
  visualRequirement?: AssessmentVisualRequirement
  visualIntent?: string
  /** Compatibility field populated only after the dedicated visual pass (or by legacy/manual callers). */
  visual?: AssessmentVisual | null
}

export type AssessmentItemSuggestion = {
  assessmentId: string
  itemId: string
  questionType: QuestionType
  candidate: AssessmentItemCandidate
  approvedResources?: string[]
  model: string
  fallbackUsed: boolean
  editable: true
  qaState?: string
  deterministicQa?: AssessmentDeterministicQaResult
  risk?: AssessmentRiskResult
  verifier?: AssessmentVerifierResult
  repairAttempted?: boolean
  requestsUsed?: number
  visualRequestsUsed?: number
  visualRequirement?: AssessmentVisualRequirement
  visualIntent?: string
  visualError?: string
  quotaPaused?: boolean
}

export type AssessmentGenerationBatchSummary = {
  attempted: number
  succeeded: number
  skipped: number
  failed: number
  cancelled: number
  results: AssessmentItem[]
  errors: Array<{ itemId: string; message: string }>
  /** A successful item may still have hit a provider boundary during its optional visual/review pass. */
  providerPaused?: boolean
}

export type AssessmentGenerationBatchOptions = {
  assessment: AssessmentRecord
  demo: boolean
  /** Called after the question JSON is validated but before any separate visual request.
   * It is intended for a lightweight resumable checkpoint, not a database save. */
  onQuestionReady?: (item: AssessmentItem, suggestion: AssessmentItemSuggestion) => void | Promise<void>
  onItem?: (item: AssessmentItem) => void | Promise<void>
  onSuggestion?: (item: AssessmentItem, suggestion: AssessmentItemSuggestion) => void | Promise<void>
  onProgress?: (progress: { completed: number; processed: number; total: number; succeeded: number; failed: number; cancelled: number; remaining: number; itemId: string; status: 'success' | 'failed' | 'skipped' | 'cancelled'; message?: string }) => void
  signal?: AbortSignal
  concurrency?: number
  itemIds?: string[]
  generate?: (args: { assessment: AssessmentRecord; item: AssessmentItem; demo: boolean; signal?: AbortSignal; onQuestionReady?: (suggestion: AssessmentItemSuggestion) => void | Promise<void> }) => Promise<AssessmentItemSuggestion>
}

type CandidateInput = UnknownRecord

const questionTypes = new Set<string>([...ASSESSMENT_QUESTION_TYPES])
// Compatibility contract: the scheduler's maxRetries=2 is equivalent to a
// bounded `attempt <= 3` policy (initial request plus two retries).
const emptyAnswer = (type: QuestionType): AssessmentAnswer => {
  if (type === 'true_false') return { type, value: false }
  if (type === 'short_answer') return { type, acceptedAnswers: [], caseSensitive: false }
  if (type === 'identification') return { type, acceptedAnswers: [], caseSensitive: false }
  if (type === 'fill_in_the_blank') return { type, blanks: [] }
  if (type === 'numerical_answer') return { type, value: 0, tolerance: 0, unit: '', requireUnit: false }
  if (type === 'problem_solving') return { type, finalAnswer: '', solutionOutline: '' }
  if (type === 'matching') return { type, prompts: [], choices: [], mappings: [], reusableChoices: false }
  if (type === 'multiple_select') return { type, choices: [], choiceIds: [], scoringPolicy: 'all_or_nothing' }
  if (type === 'essay') return { type, keyPoints: [], rubric: [] }
  if (type === 'constructed_response') return { type, expectedResponse: '', sampleResponse: '' }
  return { type: 'multiple_choice', choices: [], choiceId: '' }
}

function clean(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function asObject(value: unknown): CandidateInput {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as CandidateInput : {}
}

function onlyKeys(value: CandidateInput, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function unique(values: string[], caseSensitive = false) {
  const seen = new Set<string>()
  for (const value of values) {
    const key = caseSensitive ? value : value.toLocaleLowerCase('en')
    if (seen.has(key)) return false
    seen.add(key)
  }
  return true
}

function list(value: unknown, max = 30, itemMax = 800) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((entry) => clean(entry, itemMax)).filter(Boolean).slice(0, max)
}

function acceptedAnswerKey(value: string, caseSensitive = false) {
  const normalized = value.normalize('NFKC').trim().replace(/[.,;:!?]+$/u, '').trim()
  return caseSensitive ? normalized : normalized.toLocaleLowerCase('en')
}

function dedupeAcceptedAnswers(values: string[], caseSensitive = false) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = acceptedAnswerKey(value, caseSensitive)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function stripCodeFence(value: string) {
  return value.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseJsonObject(value: string): CandidateInput {
  let parsed: unknown
  try { parsed = JSON.parse(stripCodeFence(value)) } catch { throw new Error('The AI response was not valid JSON. Your assessment draft remains unchanged.') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The AI response did not match the required object shape. Your assessment draft remains unchanged.')
  return parsed as CandidateInput
}

function normalizeClaimText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function resourceClaimLooksUnverified(value: string, teacherResources: string[]) {
  const normalized = normalizeClaimText(value)
  const allowed = teacherResources.map((resource) => ({ raw: resource.toLocaleLowerCase('en'), normalized: normalizeClaimText(resource) })).filter((resource) => resource.normalized)
  const urlClaims = value.match(/(?:https?:\/\/|www\.)[^\s)\],]+/gi) ?? []
  if (urlClaims.some((claim) => !allowed.some((resource) => resource.raw.includes(claim.toLocaleLowerCase('en'))))) return true
  const pageClaims = value.match(/(?:\bpage\b|\bp\.|\bpahina\b)\s*\d+/gi) ?? []
  if (pageClaims.some((claim) => !allowed.some((resource) => resource.normalized.includes(normalizeClaimText(claim))))) return true
  const namedResourceOrLocalFact = /\b(?:textbook|module|worksheet|website|handout|reference|activity\s+sheet|learning\s+material|mobile\s+app|app|software|device|tablet|computer|laptop|projector|aklat|modyul|sanggunian|kagamitang\s+pampagkatuto|aplikasyon|kompyuter|barangay|municipality|province)\b/iu
  return namedResourceOrLocalFact.test(value) && !allowed.some((resource) => normalized.includes(resource.normalized))
}

function answerStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(answerStrings)
  if (value && typeof value === 'object') return Object.values(value as UnknownRecord).flatMap(answerStrings)
  return []
}

/**
 * Empty draft items carry a typed placeholder answer (for example
 * `{ type: 'multiple_choice', choices: [], choiceId: '' }`).  Treating the
 * discriminator itself as content would make those drafts impossible to
 * generate.  Keep this check intentionally conservative and inspect only
 * answer fields that represent teacher/model-authored content.
 */
function answerHasMeaningfulContent(answer: UnknownRecord) {
  const type = clean(answer.type, 80) as QuestionType
  if (type === 'multiple_choice' || type === 'multiple_select') {
    return (Array.isArray(answer.choices) && answer.choices.length > 0)
      || (typeof answer.choiceId === 'string' && answer.choiceId.trim().length > 0)
      || (Array.isArray(answer.choiceIds) && answer.choiceIds.length > 0)
  }
  if (type === 'true_false') return answer.value === true
  if (type === 'short_answer' || type === 'identification') {
    return Array.isArray(answer.acceptedAnswers) && answer.acceptedAnswers.some((entry) => clean(entry))
  }
  if (type === 'fill_in_the_blank') return Array.isArray(answer.blanks) && answer.blanks.length > 0
  if (type === 'numerical_answer') {
    return (typeof answer.value === 'number' && Number.isFinite(answer.value) && answer.value !== 0)
      || clean(answer.unit).length > 0
      || (typeof answer.tolerance === 'number' && answer.tolerance !== 0)
  }
  if (type === 'problem_solving') {
    return clean(answer.finalAnswer).length > 0 || clean(answer.solutionOutline).length > 0
      || (Array.isArray(answer.subparts) && answer.subparts.length > 0)
  }
  if (type === 'matching') {
    return (Array.isArray(answer.prompts) && answer.prompts.length > 0)
      || (Array.isArray(answer.choices) && answer.choices.length > 0)
      || (Array.isArray(answer.mappings) && answer.mappings.length > 0)
  }
  if (type === 'constructed_response') {
    return clean(answer.expectedResponse).length > 0 || clean(answer.sampleResponse).length > 0
      || clean(answer.rubricGuidance).length > 0 || (Array.isArray(answer.expectedElements) && answer.expectedElements.length > 0)
  }
  if (type === 'essay') {
    return (Array.isArray(answer.keyPoints) && answer.keyPoints.length > 0)
      || (Array.isArray(answer.rubric) && answer.rubric.length > 0)
      || clean(answer.expectedResponse).length > 0 || clean(answer.scoringNotes).length > 0
  }
  return false
}

function choiceList(value: unknown) {
  return Array.isArray(value) ? value.map(asObject) : []
}

function normalizeChoices(answer: CandidateInput, field = 'choices') {
  const choices = choiceList(answer[field] ?? answer.options)
  const ids = choices.map((choice, index) => clean(choice.id ?? choice.key ?? choice.label, 80) || String.fromCharCode(65 + index))
  const texts = choices.map((choice) => clean(choice.text ?? choice.value ?? choice.label, 500))
  if (choices.some((choice) => !onlyKeys(choice, ['id', 'text', 'key', 'label', 'value']))) throw new Error('Choice shape is invalid.')
  if (choices.length < 2 || choices.length > 6 || ids.some((id) => !id) || texts.some((value) => !value) || !unique(ids) || !unique(texts)) throw new Error('Choices must contain 2–6 unique, nonblank options.')
  return { ids, choices: ids.map((id, index) => ({ id, text: texts[index] })) }
}

function criterionList(value: unknown) {
  return list(value, 20, 1000).map((entry) => ({ id: `criterion-${Math.random().toString(36).slice(2, 8)}`, label: entry, pointsPossible: 0 }))
}

function normalizeAnswer(answer: CandidateInput, type: QuestionType): AssessmentAnswer {
  if (answer.type !== type) throw new Error('The AI candidate answer type does not match the verified item type.')
  if (type === 'multiple_choice') {
    if (!onlyKeys(answer, ['type', 'choices', 'choiceId'])) throw new Error('Multiple-choice answer shape is invalid.')
    const normalized = normalizeChoices(answer)
    const choiceId = clean(answer.choiceId, 80)
    if (!normalized.ids.includes(choiceId)) throw new Error('Multiple-choice answer must select one returned choice.')
    return { type, choices: normalized.choices, choiceId }
  }
  if (type === 'true_false') {
    if (!onlyKeys(answer, ['type', 'value'])) throw new Error('True/False answer shape is invalid.')
    if (typeof answer.value !== 'boolean') throw new Error('True/False answer must be boolean.')
    return { type, value: answer.value }
  }
  if (type === 'short_answer' || type === 'identification') {
    if (!onlyKeys(answer, ['type', 'acceptedAnswers', 'caseSensitive'])) throw new Error('Accepted-answer shape is invalid.')
    const caseSensitive = answer.caseSensitive === true
    if (answer.caseSensitive !== undefined && typeof answer.caseSensitive !== 'boolean') throw new Error('Case sensitivity must be boolean.')
    const acceptedAnswers = dedupeAcceptedAnswers(list(answer.acceptedAnswers, 20, 500), caseSensitive)
    if (!acceptedAnswers.length) throw new Error('Accepted answers must be nonblank.')
    return { type, acceptedAnswers, caseSensitive }
  }
  if (type === 'fill_in_the_blank') {
    if (!onlyKeys(answer, ['type', 'blanks'])) throw new Error('Fill-in-the-blank answer shape is invalid.')
    const blanks = Array.isArray(answer.blanks) ? answer.blanks.map(asObject) : []
    const ids = blanks.map((blank, index) => clean(blank.id ?? blank.blankId, 80) || `blank-${index + 1}`)
    if (!blanks.length || !unique(ids)) throw new Error('Fill-in-the-blank requires unique blanks.')
    const normalized = blanks.map((blank, index) => {
      const acceptedAnswers = dedupeAcceptedAnswers(list(blank.acceptedAnswers ?? blank.accepted, 20, 500), blank.caseSensitive === true)
      const pointsPossible = blank.pointsPossible === undefined ? undefined : Number(blank.pointsPossible)
      if (!acceptedAnswers.length) throw new Error('Each blank requires at least one nonblank accepted answer.')
      if (pointsPossible !== undefined && (!Number.isFinite(pointsPossible) || pointsPossible <= 0)) throw new Error('Blank points must be positive.')
      return { id: ids[index], acceptedAnswers, ...(blank.caseSensitive !== undefined ? { caseSensitive: blank.caseSensitive === true } : {}), ...(pointsPossible === undefined ? {} : { pointsPossible }) }
    })
    return { type, blanks: normalized }
  }
  if (type === 'numerical_answer') {
    if (!onlyKeys(answer, ['type', 'value', 'tolerance', 'unit', 'requireUnit'])) throw new Error('Numerical answer shape is invalid.')
    const value = Number(answer.value)
    const tolerance = answer.tolerance === undefined ? undefined : Number(answer.tolerance)
    if (!Number.isFinite(value) || (tolerance !== undefined && (!Number.isFinite(tolerance) || tolerance < 0))) throw new Error('Numerical value/tolerance must be finite; no expressions are evaluated.')
    const unit = answer.unit === undefined ? undefined : clean(answer.unit, 80)
    if (answer.unit !== undefined && !unit) throw new Error('Numerical unit cannot be blank when supplied.')
    if (answer.requireUnit !== undefined && typeof answer.requireUnit !== 'boolean') throw new Error('Numerical requireUnit must be boolean.')
    return { type, value, ...(tolerance === undefined ? {} : { tolerance }), ...(unit ? { unit } : {}), ...(answer.requireUnit === true ? { requireUnit: true } : {}) }
  }
  if (type === 'problem_solving') {
    if (!onlyKeys(answer, ['type', 'finalAnswer', 'solutionOutline', 'subparts', 'scoringCriteria'])) throw new Error('Problem-solving answer shape is invalid.')
    const finalAnswer = typeof answer.finalAnswer === 'number' ? answer.finalAnswer : clean(answer.finalAnswer, 800)
    const solutionOutline = clean(answer.solutionOutline ?? answer.method, 1600)
    if ((typeof finalAnswer === 'number' && !Number.isFinite(finalAnswer)) || (typeof finalAnswer === 'string' && !finalAnswer) || !solutionOutline) throw new Error('Problem-solving answers require a finite final answer and solution outline.')
    const subparts = Array.isArray(answer.subparts) ? answer.subparts.map(asObject).map((part, index) => ({ id: clean(part.id, 80) || `part-${index + 1}`, prompt: clean(part.prompt, 800), ...(part.expectedAnswer === undefined ? {} : { expectedAnswer: typeof part.expectedAnswer === 'number' ? part.expectedAnswer : clean(part.expectedAnswer, 500) }), pointsPossible: Number(part.pointsPossible), ...(Array.isArray(part.scoringCriteria) ? { scoringCriteria: part.scoringCriteria } : {}) })) : undefined
    if (subparts?.some((part) => !part.prompt || !Number.isFinite(part.pointsPossible) || part.pointsPossible <= 0)) throw new Error('Problem subparts need prompts and positive points.')
    return { type, finalAnswer, solutionOutline, ...(subparts?.length ? { subparts } : {}), ...(Array.isArray(answer.scoringCriteria) ? { scoringCriteria: answer.scoringCriteria } : {}) }
  }
  if (type === 'matching') {
    if (!onlyKeys(answer, ['type', 'prompts', 'choices', 'mappings', 'reusableChoices', 'pointsPerMatch', 'groupPointsPossible'])) throw new Error('Matching answer shape is invalid.')
    const prompts = Array.isArray(answer.prompts) ? answer.prompts.map(asObject) : []
    const choices = Array.isArray(answer.choices) ? answer.choices.map(asObject) : []
    const promptIds = prompts.map((entry, index) => clean(entry.id, 80) || `prompt-${index + 1}`)
    const choiceIds = choices.map((entry, index) => clean(entry.id, 80) || String.fromCharCode(65 + index))
    if (!prompts.length || !choices.length || !unique(promptIds) || !unique(choiceIds)) throw new Error('Matching columns require unique IDs and at least one entry.')
    const normalizedPrompts = prompts.map((entry, index) => ({ id: promptIds[index], text: clean(entry.text, 800) }))
    const normalizedChoices = choices.map((entry, index) => ({ id: choiceIds[index], text: clean(entry.text ?? entry.value, 500), ...(entry.label ? { label: clean(entry.label, 40) } : {}) }))
    if (normalizedPrompts.some((entry) => !entry.text) || normalizedChoices.some((entry) => !entry.text)) throw new Error('Matching prompts and choices must be nonblank.')
    const mappings = Array.isArray(answer.mappings) ? answer.mappings.map(asObject).map((entry) => ({ promptId: clean(entry.promptId ?? entry.from, 80), choiceId: clean(entry.choiceId ?? entry.to, 80), ...(entry.pointsPossible === undefined ? {} : { pointsPossible: Number(entry.pointsPossible) }) })) : []
    if (!mappings.length || mappings.some((entry) => !promptIds.includes(entry.promptId) || !choiceIds.includes(entry.choiceId))) throw new Error('Matching mappings must reference existing prompt and choice IDs.')
    if (answer.reusableChoices !== true && !unique(mappings.map((entry) => entry.choiceId))) throw new Error('Matching choices cannot be reused unless reusableChoices is enabled.')
    return { type, prompts: normalizedPrompts, choices: normalizedChoices, mappings, ...(answer.reusableChoices === true ? { reusableChoices: true } : {}), ...(answer.pointsPerMatch === undefined ? {} : { pointsPerMatch: Number(answer.pointsPerMatch) }), ...(answer.groupPointsPossible === undefined ? {} : { groupPointsPossible: Number(answer.groupPointsPossible) }) }
  }
  if (type === 'multiple_select') {
    if (!onlyKeys(answer, ['type', 'choices', 'choiceIds', 'scoringPolicy'])) throw new Error('Multiple-select answer shape is invalid.')
    const normalized = normalizeChoices(answer)
    const choiceIds = list(answer.choiceIds, normalized.ids.length, 80)
    if (!choiceIds.length || !unique(choiceIds) || choiceIds.some((id) => !normalized.ids.includes(id))) throw new Error('Multiple-select answers must reference existing unique choices.')
    if (answer.scoringPolicy !== undefined && answer.scoringPolicy !== 'all_or_nothing') throw new Error('Only all-or-nothing multiple-select scoring is supported.')
    return { type, choices: normalized.choices, choiceIds, scoringPolicy: 'all_or_nothing' }
  }
  if (type === 'constructed_response') {
    if (!onlyKeys(answer, ['type', 'expectedResponse', 'sampleResponse', 'rubricGuidance', 'expectedElements', 'rubric'])) throw new Error('Constructed-response answer shape is invalid.')
    const expectedResponse = clean(answer.expectedResponse, 1600)
    const sampleResponse = clean(answer.sampleResponse, 1600)
    if (!expectedResponse || !sampleResponse) throw new Error('Constructed response requires expected and sample responses.')
    return { type, expectedResponse, sampleResponse, ...(answer.rubricGuidance ? { rubricGuidance: clean(answer.rubricGuidance, 1600) } : {}), ...(Array.isArray(answer.expectedElements) ? { expectedElements: list(answer.expectedElements, 30, 400) } : {}), ...(Array.isArray(answer.rubric) ? { rubric: answer.rubric } : {}) }
  }
  if (type === 'essay') {
    if (!onlyKeys(answer, ['type', 'keyPoints', 'rubric', 'expectedResponse', 'scoringNotes'])) throw new Error('Essay answer shape is invalid.')
    const keyPoints = list(answer.keyPoints, 30, 500)
    if (!keyPoints.length) throw new Error('Essay requires one or more key points for teacher scoring.')
    return { type, keyPoints, ...(Array.isArray(answer.rubric) ? { rubric: answer.rubric } : {}), ...(answer.expectedResponse ? { expectedResponse: clean(answer.expectedResponse, 1600) } : {}), ...(answer.scoringNotes ? { scoringNotes: clean(answer.scoringNotes, 1600) } : {}) }
  }
  throw new Error('Unsupported question type.')
}

export function validateAssessmentCandidate(value: unknown, questionType?: QuestionType, teacherResources: string[] = []): AssessmentItemCandidate {
  const object = typeof value === 'string' ? parseJsonObject(value) : asObject(value)
  const allowedKeys = new Set(['questionType', 'prompt', 'answer', 'rationale', 'referencedResources', 'visualRequirement', 'visualIntent', 'visual'])
  if (Object.keys(object).some((key) => !allowedKeys.has(key))) throw new Error('The AI candidate included unsupported fields; item mapping was not changed.')
  const candidateType = clean(object.questionType) as QuestionType
  if (!questionTypes.has(candidateType) || (questionType && candidateType !== questionType)) throw new Error('The AI candidate question type does not match the verified item mapping.')
  const prompt = clean(object.prompt)
  const rationale = clean(object.rationale, 1600)
  if (prompt.length < 4 || rationale.length < 4) throw new Error('The AI candidate needs a non-empty prompt and rationale.')
  if (!Array.isArray(object.referencedResources) || object.referencedResources.length > 10) throw new Error('The AI candidate resource list is invalid.')
  const referencedResources = object.referencedResources.map((entry) => clean(entry, 180))
  if (referencedResources.some((entry) => !entry) || !referencedResources.every((entry) => teacherResources.includes(entry))) throw new Error('The AI candidate referenced an unlisted teacher resource.')
  const normalizedAnswer = normalizeAnswer(asObject(object.answer), candidateType)
  const legacyVisualPresent = object.visual !== undefined && object.visual !== null
  const hasExplicitVisualRequirement = object.visualRequirement !== undefined
  const visualRequirement = hasExplicitVisualRequirement
    ? clean(object.visualRequirement, 20) as AssessmentVisualRequirement
    : (legacyVisualPresent ? 'helpful' : 'none')
  if (!['none', 'helpful', 'required'].includes(visualRequirement)) throw new Error('The AI candidate visual requirement is invalid.')
  // Backward compatibility: the pre-split Edge Function returned geometry in
  // the question response without visualRequirement/visualIntent. Preserve a
  // valid legacy visual, but do not classify it as "required" and trigger an
  // unsupported second provider call solely because old metadata is absent.
  const visualIntent = object.visualIntent === undefined
    ? (legacyVisualPresent ? 'Use the attached validated diagram for this question.' : '')
    : clean(object.visualIntent, 500)
  if (hasExplicitVisualRequirement && visualRequirement !== 'none' && !visualIntent) throw new Error('A helpful or required visual needs a concise visual intent.')
  let visual: AssessmentVisual | null | undefined
  if (object.visual !== undefined && object.visual !== null) {
    const visualResult = validateAssessmentVisual(object.visual)
    // A malformed optional/legacy diagram must not discard an otherwise valid
    // generated question. Final deterministic QA still blocks any stem that
    // actually depends on a now-missing figure.
    visual = visualResult.valid ? object.visual as AssessmentVisual : null
  } else if (object.visual === null) visual = null
  if ([prompt, rationale, ...answerStrings(normalizedAnswer)].some((entry) => resourceClaimLooksUnverified(entry, teacherResources))) throw new Error('The AI candidate included an unverified resource, device, local fact, URL, or page claim.')
  return { questionType: candidateType, prompt, answer: normalizedAnswer, rationale, referencedResources, visualRequirement, visualIntent, ...(visual === undefined ? {} : { visual }) }
}

export const parseAssessmentCandidate = validateAssessmentCandidate
export const parseAndValidateAssessmentCandidate = validateAssessmentCandidate

export function validateAssessmentForFinal(assessment: AssessmentRecord) {
  const result = validateAssessmentFinal({ ...assessment, status: 'final' })
  if (!result.ready) {
    const first = result.errors[0]
    const itemLabel = first?.itemNumber ? ` (item ${first.itemNumber})` : ''
    throw new Error(`${first?.message ?? 'Assessment final validation failed.'}${itemLabel}`)
  }
  return assessment
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function itemRecord(item: AssessmentItem): UnknownRecord { return item as unknown as UnknownRecord }

function pointsOf(item: AssessmentItem) {
  const value = itemRecord(item).pointsPossible ?? itemRecord(item).points
  const number = Number(value)
  return Number.isFinite(number) ? number : 1
}

export function hasExistingAssessmentContent(item: AssessmentItem) {
  const value = itemRecord(item)
  if (value.locked === true || value.qaState === 'locked') return true
  if (value.authorshipState !== 'empty' || item.prompt.trim().length > 0) return true
  if (String(value.rationale ?? '').trim() || String(value.teacherNotes ?? '').trim()) return true
  const answer = item.answer as unknown as UnknownRecord
  return answerHasMeaningfulContent(answer)
}

function historyWithPrevious(item: AssessmentItem, source: 'alternative' | 'repair' | 'generated' = 'generated') {
  const value = itemRecord(item)
  const priorHistory = Array.isArray(value.history) ? value.history : []
  if (!item.prompt.trim() && !hasExistingAssessmentContent(item)) return priorHistory.slice(-5)
  return [...priorHistory, {
    id: `item-version-${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
    source,
    prompt: item.prompt,
    questionType: item.questionType,
    answer: clone(item.answer),
    rationale: item.rationale,
    teacherNotes: item.teacherNotes,
    pointsPossible: pointsOf(item),
    points: item.points,
    qaState: value.qaState,
    visual: item.visual,
    visualRequirement: item.visualRequirement,
    visualIntent: item.visualIntent,
    visualStatus: item.visualStatus,
    visualAttempts: item.visualAttempts,
    visualError: item.visualError,
    visualSourceHash: item.visualSourceHash,
    visualUpdatedAt: item.visualUpdatedAt,
  }].slice(-5)
}

export function applyAssessmentItemCandidate(item: AssessmentItem, candidate: AssessmentItemCandidate, options: { alternative?: boolean; teacherResources?: string[]; source?: 'alternative' | 'repair' | 'generated' } = {}): AssessmentItem {
  const value = itemRecord(item)
  if (value.locked === true || value.qaState === 'locked') throw new Error('Locked questions are protected. Unlock the item before replacing it.')
  if (hasExistingAssessmentContent(item) && options.alternative !== true) throw new Error('Existing item content is protected; request an explicit alternative before replacing it.')
  if (candidate.referencedResources.length > 0 && options.teacherResources === undefined) throw new Error('Referenced resources require a server-approved teacher resource list; item mapping was not changed.')
  const validated = validateAssessmentCandidate(candidate, item.questionType, options.teacherResources ?? [])
  let next: AssessmentItem = {
    ...clone(item),
    prompt: validated.prompt,
    answer: clone(validated.answer),
    rationale: validated.rationale,
    authorshipState: 'ai_suggestion' as const,
    pointsPossible: pointsOf(item),
    points: item.points,
    qaState: 'generated' as const,
    // A provider omission is the legacy/manual-compatible "leave it alone"
    // signal.  An explicit null is an accepted replacement with no diagram.
    visual: validated.visual === undefined ? item.visual : validated.visual === null ? undefined : clone(validated.visual),
    visualRequirement: validated.visualRequirement,
    visualIntent: validated.visualIntent,
    visualAttempts: 0,
    visualError: undefined,
    visualUpdatedAt: new Date().toISOString(),
    history: historyWithPrevious(item, options.source ?? (options.alternative ? 'alternative' : 'generated')),
  }
  if (validated.visual) {
    next.visualStatus = 'succeeded'
    next.visualSourceHash = assessmentVisualSourceHash(next)
  } else {
    next = invalidateAssessmentVisualAfterContentEdit(item, next)
  }
  return withResolvedAssessmentVisualPlan(next)
}

/** Apply a suggestion while preserving the QA result produced by the
 * adaptive review.  The candidate still cannot change points or TOS mapping. */
export function applyAssessmentItemSuggestion(item: AssessmentItem, suggestion: AssessmentItemSuggestion, options: { alternative?: boolean; source?: 'alternative' | 'repair' | 'generated' } = {}) {
  const applied = applyAssessmentItemCandidate(item, suggestion.candidate, { alternative: options.alternative, teacherResources: suggestion.approvedResources ?? [], source: options.source })
  const qaState = suggestion.qaState
  if (!qaState) return applied
  return { ...applied, qaState: qaState as AssessmentItem['qaState'] }
}

/** Teacher approval is one action: accepting an AI suggestion also locks the
 * accepted item. Unlock remains explicit when a teacher wants to edit it later. */
export function acceptAssessmentItemSuggestion(item: AssessmentItem, suggestion: AssessmentItemSuggestion) {
  const applied = applyAssessmentItemSuggestion(item, suggestion, { alternative: true, source: suggestion.repairAttempted ? 'repair' : 'generated' })
  return { ...applied, authorshipState: 'teacher_accepted' as const, locked: true, qaState: 'locked' as const }
}

/** One explicit teacher verification action can also approve a persisted
 * generated item after a refresh, when its transient suggestion object is no
 * longer available. This does not bypass structural QA; callers must run the
 * deterministic validator before persisting/finalizing the result. */
export function teacherVerifyAndLockAssessmentItem(item: AssessmentItem, suggestion?: AssessmentItemSuggestion) {
  const applied = suggestion
    ? applyAssessmentItemSuggestion(item, suggestion, { alternative: true, source: suggestion.repairAttempted ? 'repair' : 'generated' })
    : item
  const authorshipState = applied.authorshipState === 'empty' || applied.authorshipState === 'ai_suggestion'
    ? 'teacher_accepted' as const
    : applied.authorshipState
  return { ...applied, authorshipState, locked: true, qaState: 'locked' as const }
}

/** Bulk approval is intentionally limited to candidates that passed local
 * deterministic QA and were not flagged for teacher review/repair. The teacher
 * still makes one explicit approval action for the ready subset. */
export function suggestionReadyForBulkAcceptance(suggestion: AssessmentItemSuggestion) {
  if (suggestion.deterministicQa?.valid === false) return false
  return !['needs_review', 'repair_needed', 'answer_needs_recheck'].includes(String(suggestion.qaState ?? 'generated'))
}

function demoCandidate(item: AssessmentItem): AssessmentItemCandidate {
  const competency = item.competencySnapshot.text || 'the verified competency'
  const cognitive = item.cognitiveCategorySnapshot.label || 'the verified cognitive category'
  const prefix = `Teacher-review draft for ${competency} (${cognitive}).`
  const type = item.questionType
  if (type === 'true_false') return { questionType: type, prompt: `${prefix} Decide whether this statement is accurate after checking the lesson content.`, answer: { type, value: true }, rationale: 'Demo-local preview only; the teacher must verify the statement and answer.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
  if (type === 'short_answer' || type === 'identification') return { questionType: type, prompt: `${prefix} State one accurate response in your own words.`, answer: { type, acceptedAnswers: ['Teacher-verified response'], caseSensitive: false }, rationale: 'Demo-local preview only; replace the placeholder with a teacher-verified answer.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
  if (type === 'fill_in_the_blank') return { questionType: type, prompt: `${prefix} Complete the blank with the teacher-verified term.`, answer: { type, blanks: [{ id: 'blank-1', acceptedAnswers: ['Teacher-verified term'], pointsPossible: pointsOf(item) }] }, rationale: 'Demo-local preview only; the teacher must verify the blank answer.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
  if (type === 'numerical_answer') return { questionType: type, prompt: `${prefix} Calculate the requested value.`, answer: { type, value: 0, tolerance: 0 }, rationale: 'Demo-local preview only; the teacher must enter and verify the numeric answer.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
  if (type === 'problem_solving') return { questionType: type, prompt: `${prefix} Solve the problem and show your solution.`, answer: { type, finalAnswer: 'Teacher-verified final answer', solutionOutline: 'Teacher-verified method and key steps.' }, rationale: 'Demo-local preview only; the teacher must verify the solution and scoring.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
  if (type === 'matching') return { questionType: type, prompt: `${prefix} Match each prompt with its best answer.`, answer: { type, prompts: [{ id: 'prompt-1', text: 'Teacher-verified prompt' }], choices: [{ id: 'A', text: 'Teacher-verified choice' }], mappings: [{ promptId: 'prompt-1', choiceId: 'A' }] }, rationale: 'Demo-local preview only; the teacher must verify every mapping.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
  if (type === 'multiple_select') return { questionType: type, prompt: `${prefix} Select all correct answers.`, answer: { type, choices: [{ id: 'A', text: 'Teacher-verified choice A' }, { id: 'B', text: 'Teacher-verified choice B' }], choiceIds: ['A'], scoringPolicy: 'all_or_nothing' }, rationale: 'Demo-local preview only; the teacher must verify the complete correct set.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
  if (type === 'constructed_response') return { questionType: type, prompt: `${prefix} Explain your reasoning and show the key evidence.`, answer: { type, expectedResponse: 'Teacher-verified expected response.', sampleResponse: 'Teacher-verified sample response.', rubricGuidance: 'Teacher-verified criteria for alignment, reasoning, and evidence.' }, rationale: 'Demo-local preview only; the teacher must replace placeholders and validate response criteria.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
  if (type === 'essay') return { questionType: type, prompt: `${prefix} Write an extended response using evidence and reasoning.`, answer: { type, keyPoints: ['Teacher-verified key point'], rubric: [] }, rationale: 'Demo-local preview only; the teacher must replace placeholders and score with professional judgment.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
  return { questionType: 'multiple_choice', prompt: `${prefix} Which option best demonstrates the verified competency?`, answer: { type: 'multiple_choice', choices: [{ id: 'A', text: 'Teacher-verified option A' }, { id: 'B', text: 'Teacher-verified option B' }], choiceId: 'A' }, rationale: 'Demo-local preview only; the teacher must replace the placeholder and verify the answer.', referencedResources: [], visualRequirement: 'none', visualIntent: '' }
}

function candidatePayload(suggestion: AssessmentItemCandidate) {
  // No points, item number, competency, or cognitive mapping is accepted from
  // the browser/model. Those values remain server/item-owned.
  return {
    questionType: suggestion.questionType,
    prompt: suggestion.prompt,
    answer: suggestion.answer,
    rationale: suggestion.rationale,
    referencedResources: suggestion.referencedResources,
    visualRequirement: suggestion.visualRequirement ?? (suggestion.visual ? 'required' : 'none'),
    visualIntent: suggestion.visualIntent ?? '',
    ...(suggestion.visual === undefined ? {} : { visual: suggestion.visual }),
  }
}

const DEFAULT_GENERATOR_QUEUE_MODEL = 'gemini-3.5-flash-lite'
const FALLBACK_QUEUE_MODEL = 'gemini-3.1-flash-lite'

const NON_RETRYABLE_AI_CATEGORIES = new Set([
  'provider_configuration',
  'provider_authentication',
  'provider_quota',
  'provider_blocked',
  'output_truncated',
  'empty_response',
  'invalid_json',
  'invalid_question_structure',
  'answer_validation',
  'resource_validation',
  'immutable_mapping',
  'verification_failure',
])

function providerRequestCount(value: unknown) {
  const count = Number(value)
  return Number.isSafeInteger(count) && count >= 1 && count <= 4 ? count : 1
}

function providerFailureRetryable(category: string, status: number | undefined) {
  if (category === 'provider_rate_limit' || category === 'edge_transport') return true
  if (NON_RETRYABLE_AI_CATEGORIES.has(category)) return false
  // Treat an unclassified 429 as a quota boundary. This avoids silently
  // spending two more requests when the provider has already refused one.
  if (status === 429) return false
  return [408, 425, 500, 502, 503, 504].includes(Number(status ?? 0))
}

function edgeTransportFailure(error: { name?: string; message?: string }, status: number | undefined) {
  if (Number(status ?? 0) > 0) return false
  const value = `${error.name ?? ''} ${error.message ?? ''}`
  return /FunctionsFetchError|Failed to send a request to the Edge Function|failed to fetch|fetch failed|network(?:error| error)?/i.test(value)
}

function oppositeLiteQueueModel(generatorModel?: string) {
  if (generatorModel === DEFAULT_GENERATOR_QUEUE_MODEL) return FALLBACK_QUEUE_MODEL
  if (generatorModel === FALLBACK_QUEUE_MODEL) return DEFAULT_GENERATOR_QUEUE_MODEL
  return FALLBACK_QUEUE_MODEL
}

async function invokeAssessmentAi(body: UnknownRecord, signal?: AbortSignal, model = DEFAULT_GENERATOR_QUEUE_MODEL) {
  const client = supabase
  if (!client) throw new Error('Assessment AI service is unavailable in this workspace.')
  let totalProviderRequests = 0
  return assessmentRequestScheduler.enqueue(model, async () => {
    const response = await client.functions.invoke('assessment-question-generator', { body, signal })
    if (response.error) {
      // FunctionsHttpError.context is the Edge Function Response. Read its
      // structured error body when available so teachers see the real failure
      // instead of the opaque "non-2xx status" wrapper.
      const errorValue = response.error as unknown as {
        name?: string
        status?: number
        message?: string
        context?: {
          status?: number
          headers?: { get?: (name: string) => string | null }
          json?: () => Promise<unknown>
          text?: () => Promise<string>
          clone?: () => unknown
        }
      }
      const context = errorValue.context
      const status = errorValue.status ?? context?.status
      const retryAfter = context?.headers?.get?.('Retry-After')
      const retryAfterMs = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : undefined
      let serverMessage = ''
      let failureCategory = ''
      let observedProviderRequests = 1
      try {
        if (typeof context?.json === 'function') {
          const payload = await context.json()
          if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            const value = payload as UnknownRecord
            serverMessage = typeof value.error === 'string' ? value.error : typeof value.message === 'string' ? value.message : ''
            failureCategory = typeof value.category === 'string' ? value.category : ''
            observedProviderRequests = providerRequestCount(value.providerRequestCount)
          }
        }
      } catch {
        // A missing/consumed response body is harmless; fall back below.
      }
      totalProviderRequests += observedProviderRequests
      if (observedProviderRequests > 1) assessmentRequestScheduler.recordObservedProviderRequests(model, observedProviderRequests - 1)
      const transportFailure = edgeTransportFailure(errorValue, status)
      if (!failureCategory && transportFailure) failureCategory = 'edge_transport'
      const message = serverMessage || (transportFailure
        ? 'The assessment service could not be reached. GuroDesk retries temporary connection failures automatically; saved work is preserved.'
        : `${errorValue.message || 'Assessment AI request failed.'}${status ? ` (provider status ${status})` : ''}`)
      throw Object.assign(new Error(message), {
        status,
        retryAfterMs,
        response: context,
        failureCategory,
        retryable: providerFailureRetryable(failureCategory, status),
        providerRequestCount: totalProviderRequests,
      })
    }
    if (response.data?.error) throw new Error(String(response.data.error))
    const data = asObject(response.data)
    const observedProviderRequests = providerRequestCount(data.providerRequestCount)
    totalProviderRequests += observedProviderRequests
    if (observedProviderRequests > 1) {
      const observedModel = typeof data.model === 'string' ? data.model : model
      assessmentRequestScheduler.recordObservedProviderRequests(observedModel, observedProviderRequests - 1)
    }
    data.providerRequestCount = totalProviderRequests
    return data
  }, { signal })
}

function candidateFromResponse(data: UnknownRecord, item: AssessmentItem, approvedResources: string[]) {
  const raw = data.candidate ?? data
  return validateAssessmentCandidate(raw, item.questionType, approvedResources)
}

function itemWithCandidate(item: AssessmentItem, candidate: AssessmentItemCandidate) {
  return withResolvedAssessmentVisualPlan({
    ...item,
    prompt: candidate.prompt,
    answer: candidate.answer,
    visual: candidate.visual === undefined ? item.visual : candidate.visual === null ? undefined : candidate.visual,
    visualRequirement: candidate.visualRequirement,
    visualIntent: candidate.visualIntent,
  })
}

export type AssessmentVisualGenerationResult = {
  visual?: AssessmentVisual
  model: string
  fallbackUsed: boolean
  requestsUsed: number
}

/** Dedicated provider pass for diagrams. Question generation never supplies executable
 * markup or geometry; this request receives an already-validated question candidate
 * and may return only the bounded AssessmentVisual data DSL. */
export async function generateAssessmentVisualSuggestion(args: {
  assessment: AssessmentRecord
  item: AssessmentItem
  candidate: AssessmentItemCandidate
  visualIntent?: string
  issues?: string[]
  demo?: boolean
  signal?: AbortSignal
}): Promise<AssessmentVisualGenerationResult> {
  const requirement = args.candidate.visualRequirement ?? (args.candidate.visual ? 'required' : 'none')
  if (requirement === 'none') return { model: 'none', fallbackUsed: false, requestsUsed: 0 }
  if (args.demo || !supabase) {
    return { ...(args.candidate.visual ? { visual: clone(args.candidate.visual) } : {}), model: 'demo-local-preview', fallbackUsed: false, requestsUsed: 0 }
  }
  const visualIntent = clean(args.visualIntent ?? args.candidate.visualIntent, 500)
  if (!visualIntent) throw new Error('A helpful or required visual needs a concise visual intent before generation.')
  const candidateWithoutVisual: AssessmentItemCandidate = { ...args.candidate, visual: undefined, visualRequirement: requirement, visualIntent }
  const data = await invokeAssessmentAi({
    operation: 'visual',
    assessmentId: args.assessment.id,
    itemId: args.item.id,
    questionType: args.item.questionType,
    candidate: candidatePayload(candidateWithoutVisual),
    visualIntent,
    issues: (args.issues ?? []).slice(0, 8),
  }, args.signal)
  const raw = data.visual
  if (raw === null || raw === undefined) return { model: String(data.model || 'unknown'), fallbackUsed: data.fallbackUsed === true, requestsUsed: providerRequestCount(data.providerRequestCount) }
  const result = validateAssessmentVisual(raw)
  if (!result.valid) throw new Error(`The dedicated AI visual is invalid: ${result.errors.slice(0, 3).join(' ')}`)
  return { visual: clone(raw as AssessmentVisual), model: String(data.model || 'unknown'), fallbackUsed: data.fallbackUsed === true, requestsUsed: providerRequestCount(data.providerRequestCount) }
}

export type AssessmentVisualEnrichmentSummary = {
  eligible: number
  attempted: number
  succeeded: number
  failed: number
  skipped: number
  cancelled: number
  requiredFailed: number
  helpfulFailed: number
  providerPaused: boolean
  results: AssessmentItem[]
  errors: Array<{ itemId: string; itemNumber: number; requirement: 'helpful' | 'required'; message: string }>
}

export type AssessmentVisualEnrichmentOptions = {
  assessment: AssessmentRecord
  demo: boolean
  itemIds?: string[]
  force?: boolean
  maxAttempts?: number
  signal?: AbortSignal
  generate?: typeof generateAssessmentVisualSuggestion
  onItem?: (item: AssessmentItem, outcome: { status: 'success' | 'failed'; requirement: 'helpful' | 'required'; message?: string }) => void | Promise<void>
  onProgress?: (progress: { processed: number; total: number; succeeded: number; failed: number; remaining: number; itemId: string; itemNumber: number; status: 'success' | 'failed' | 'cancelled'; message?: string }) => void
}

function visualCandidateForItem(item: AssessmentItem, requirement: 'helpful' | 'required', visualIntent: string): AssessmentItemCandidate {
  return {
    questionType: item.questionType,
    prompt: item.prompt,
    answer: clone(item.answer),
    rationale: item.rationale ?? '',
    referencedResources: [],
    visualRequirement: requirement,
    visualIntent,
  }
}

/** Pass 2: generate only diagrams, strictly one item at a time. A failed
 * optional diagram never replaces or discards its already-saved question. */
export async function enrichAssessmentVisualsSequentially(options: AssessmentVisualEnrichmentOptions): Promise<AssessmentVisualEnrichmentSummary> {
  const selected = options.itemIds?.length ? new Set(options.itemIds) : null
  const maxAttempts = Math.max(1, Math.min(5, Math.floor(options.maxAttempts ?? 2)))
  const generate = options.generate ?? generateAssessmentVisualSuggestion
  const candidates = options.assessment.items
    .filter((item) => (!selected || selected.has(item.id)) && item.prompt.trim() && item.authorshipState !== 'empty' && item.locked !== true && item.qaState !== 'locked')
    .map((item) => withResolvedAssessmentVisualPlan(item))
    .filter((item) => {
      const plan = assessmentVisualPlanForItem(item)
      if (plan.requirement === 'none') return false
      if (!options.force && plan.current) return false
      return options.force || plan.attempts < maxAttempts
    })
    .sort((left, right) => left.itemNumber - right.itemNumber || left.id.localeCompare(right.id, 'en'))
  const summary: AssessmentVisualEnrichmentSummary = {
    eligible: candidates.length,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: options.assessment.items.length - candidates.length,
    cancelled: 0,
    requiredFailed: 0,
    helpfulFailed: 0,
    providerPaused: false,
    results: [],
    errors: [],
  }
  let working = options.assessment
  let processed = 0
  const progress = (item: AssessmentItem, status: 'success' | 'failed' | 'cancelled', message?: string) => {
    processed += 1
    options.onProgress?.({ processed, total: candidates.length, succeeded: summary.succeeded, failed: summary.failed, remaining: Math.max(0, candidates.length - processed), itemId: item.id, itemNumber: item.itemNumber, status, ...(message ? { message } : {}) })
  }
  for (let index = 0; index < candidates.length; index += 1) {
    const source = working.items.find((item) => item.id === candidates[index].id) ?? candidates[index]
    if (options.signal?.aborted) {
      for (const pending of candidates.slice(index)) { summary.cancelled += 1; progress(pending, 'cancelled') }
      break
    }
    const plan = assessmentVisualPlanForItem(source)
    if (plan.requirement === 'none') continue
    const requirement = plan.requirement
    summary.attempted += 1
    const attempt = plan.attempts + 1
    const startedAt = new Date().toISOString()
    const running: AssessmentItem = { ...source, visualRequirement: requirement, visualIntent: plan.intent, visualStatus: 'running', visualAttempts: attempt, visualError: undefined, visualSourceHash: plan.sourceHash, visualUpdatedAt: startedAt }
    working = { ...working, items: working.items.map((item) => item.id === running.id ? running : item) }
    try {
      const candidate = visualCandidateForItem(running, requirement, plan.intent)
      const result = await generate({ assessment: working, item: running, candidate, visualIntent: plan.intent, demo: options.demo, signal: options.signal })
      if (!result.visual) throw Object.assign(new Error('Dedicated visual generation returned no usable diagram.'), { failureCategory: 'empty_visual' })
      if (assessmentVisualSourceHash(running) !== plan.sourceHash) throw Object.assign(new Error('The question changed while its visual was being generated; the stale diagram was not attached.'), { failureCategory: 'stale_visual' })
      const completed: AssessmentItem = {
        ...running,
        visual: clone(result.visual),
        visualStatus: 'succeeded',
        visualError: undefined,
        visualSourceHash: plan.sourceHash,
        visualUpdatedAt: new Date().toISOString(),
      }
      working = { ...working, items: working.items.map((item) => item.id === completed.id ? completed : item) }
      summary.results.push(completed)
      summary.succeeded += 1
      await options.onItem?.(completed, { status: 'success', requirement })
      progress(completed, 'success')
    } catch (error) {
      if (options.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        summary.cancelled += 1
        progress(running, 'cancelled')
        for (const pending of candidates.slice(index + 1)) { summary.cancelled += 1; progress(pending, 'cancelled') }
        break
      }
      const message = clean(String((error as { message?: unknown })?.message ?? error), 600) || 'Visual generation failed.'
      const failed: AssessmentItem = { ...running, visualStatus: 'failed', visualError: message, visualUpdatedAt: new Date().toISOString() }
      working = { ...working, items: working.items.map((item) => item.id === failed.id ? failed : item) }
      summary.results.push(failed)
      summary.failed += 1
      if (requirement === 'required') summary.requiredFailed += 1
      else summary.helpfulFailed += 1
      summary.errors.push({ itemId: failed.id, itemNumber: failed.itemNumber, requirement, message })
      await options.onItem?.(failed, { status: 'failed', requirement, message })
      progress(failed, 'failed', message)
      if (batchGenerationShouldPause(error)) {
        summary.providerPaused = true
        for (const pending of candidates.slice(index + 1)) { summary.cancelled += 1; progress(pending, 'cancelled') }
        break
      }
    }
  }
  return summary
}

export async function requestAssessmentVerification(args: { assessment: AssessmentRecord; item: AssessmentItem; candidate: AssessmentItemCandidate; generatorModel?: string; demo?: boolean; signal?: AbortSignal }) {
  const deterministic = validateAssessmentItemDeterministic(itemWithCandidate(args.item, args.candidate), { allowedTypes: allowedTypesFor(args.assessment) })
  if (!deterministic.valid) return { deterministic, verifier: undefined, requestsUsed: 0 }
  if (args.demo || !supabase) return { deterministic, verifier: undefined, requestsUsed: 0 }
  const data = await invokeAssessmentAi({ operation: 'verify', assessmentId: args.assessment.id, itemId: args.item.id, questionType: args.item.questionType, ...(args.generatorModel ? { generatorModel: args.generatorModel } : {}), candidate: candidatePayload(args.candidate) }, args.signal, oppositeLiteQueueModel(args.generatorModel))
  const verifier = parseAssessmentVerifierResult(data.verifier ?? data.result ?? data)
  return { deterministic, verifier, requestsUsed: providerRequestCount(data.providerRequestCount) }
}

export async function repairAssessmentItemSuggestion(args: { assessment: AssessmentRecord; item: AssessmentItem; candidate: AssessmentItemCandidate; issues: string[]; repairGuidance?: string[]; demo?: boolean; signal?: AbortSignal }) {
  if (args.demo || !supabase) return { candidate: args.candidate, requestsUsed: 0 }
  const data = await invokeAssessmentAi({ operation: 'repair', assessmentId: args.assessment.id, itemId: args.item.id, questionType: args.item.questionType, candidate: candidatePayload(args.candidate), issues: args.issues.slice(0, 8), repairGuidance: (args.repairGuidance ?? []).slice(0, 8) }, args.signal)
  const approved = Array.isArray(data.approvedResources) ? data.approvedResources.map((entry) => clean(entry, 180)) : []
  let candidate = candidateFromResponse(data, args.item, approved)
  // Repair responses intentionally do not carry geometry. Reuse the already
  // validated visual only when the repaired question kept the same visual plan;
  // otherwise leave it absent so the dedicated visual pass regenerates it.
  if (args.candidate.visual
    && candidate.visualRequirement === args.candidate.visualRequirement
    && candidate.visualIntent === args.candidate.visualIntent) {
    candidate = { ...candidate, visual: clone(args.candidate.visual) }
  }
  return { candidate, requestsUsed: providerRequestCount(data.providerRequestCount), approvedResources: approved }
}

async function adaptiveReview(assessment: AssessmentRecord, item: AssessmentItem, candidate: AssessmentItemCandidate, demo: boolean, signal?: AbortSignal, baseModel = 'assessment-lite-queue') {
  const deterministic = validateAssessmentItemDeterministic(itemWithCandidate(item, candidate), { allowedTypes: allowedTypesFor(assessment) })
  if (!deterministic.valid) return { candidate, deterministic, risk: classifyAssessmentRisk(itemWithCandidate(item, candidate)), requestsUsed: 0, state: 'needs_review', repairAttempted: false } as const
  const risk = classifyAssessmentRisk(itemWithCandidate(item, candidate))
  if (!risk.verifyRecommended || demo || !supabase) return { candidate, deterministic, risk, requestsUsed: 0, state: stateForAssessmentItem(itemWithCandidate(item, candidate), deterministic), repairAttempted: false } as const
  let verifier: AssessmentVerifierResult | undefined
  let requestsUsed = 0
  try {
    const verified = await requestAssessmentVerification({ assessment, item, candidate, generatorModel: baseModel, demo, signal })
    verifier = verified.verifier
    requestsUsed += verified.requestsUsed
    if (!verifier || !verifierRequiresRepair(verifier)) return { candidate, deterministic, risk, verifier, requestsUsed, state: 'verified' as const, repairAttempted: false }
    const repaired = await repairAssessmentItemSuggestion({ assessment, item, candidate, issues: verifier.issues, repairGuidance: verifier.repairGuidance, demo, signal })
    requestsUsed += repaired.requestsUsed
    const repairedDeterministic = validateAssessmentItemDeterministic(itemWithCandidate(item, repaired.candidate), { allowedTypes: allowedTypesFor(assessment) })
    if (!repairedDeterministic.valid) return { candidate: repaired.candidate, deterministic: repairedDeterministic, risk, verifier, requestsUsed, state: 'needs_review' as const, repairAttempted: true }
    return { candidate: repaired.candidate, deterministic: repairedDeterministic, risk: classifyAssessmentRisk(itemWithCandidate(item, repaired.candidate)), verifier, requestsUsed, state: 'needs_review' as const, repairAttempted: true }
  } catch (error) {
    // Review unavailability is a warning, not a reason to lose a valid draft.
    // Infrastructure/provider boundaries still pause the remainder of a bulk run
    // after this already-valid question has been preserved.
    const quotaPaused = batchGenerationShouldPause(error)
    return { candidate, deterministic, risk, verifier, requestsUsed, state: 'needs_review' as const, repairAttempted: false, quotaPaused }
  }
}

function allowedTypesFor(assessment: AssessmentRecord) {
  const settings = (assessment as unknown as UnknownRecord).settings as UnknownRecord | undefined
  const allowed = Array.isArray(settings?.allowedTypes) ? settings!.allowedTypes.map(String) : undefined
  return allowed?.length ? allowed : undefined
}

export async function generateAssessmentItemSuggestion(args: { assessment: AssessmentRecord; item: AssessmentItem; demo: boolean; alternative?: boolean; teacherContext?: string; signal?: AbortSignal; onQuestionReady?: (suggestion: AssessmentItemSuggestion) => void | Promise<void> }): Promise<AssessmentItemSuggestion> {
  const { assessment, item, demo, alternative = false, teacherContext = '', signal } = args
  const itemValue = itemRecord(item)
  if (signal?.aborted) throw new DOMException('Generation cancelled.', 'AbortError')
  if (itemValue.locked === true || itemValue.qaState === 'locked') throw new Error('Locked questions are protected; unlock before requesting replacement.')
  if (hasExistingAssessmentContent(item) && !alternative) throw new Error('Existing item content is protected; request an explicit alternative before replacing it.')
  let candidate: AssessmentItemCandidate
  let approvedResources: string[] = []
  let model = 'demo-local-preview'
  let fallbackUsed = false
  let quotaPaused = false
  let baseRequests = 0
  if (demo || !supabase) {
    candidate = validateAssessmentCandidate(demoCandidate(item), item.questionType)
  } else {
    const boundedContext = clean(teacherContext, 1200)
    const data = await invokeAssessmentAi({ assessmentId: assessment.id, itemId: item.id, questionType: item.questionType, alternative, ...(boundedContext ? { teacherContext: boundedContext } : {}) }, signal)
    baseRequests += providerRequestCount(data.providerRequestCount)
    approvedResources = Array.isArray(data.approvedResources) ? data.approvedResources.map((entry) => clean(entry, 180)).filter(Boolean) : []
    candidate = candidateFromResponse(data, item, approvedResources)
    model = String(data.model || 'unknown')
    fallbackUsed = data.fallbackUsed === true
  }

  // Pass 1 owns question content only. Persist its visual plan with the question;
  // a separate sequential pass generates diagrams after the batch is stable.
  await args.onQuestionReady?.({
    assessmentId: assessment.id,
    itemId: item.id,
    questionType: item.questionType,
    candidate,
    approvedResources,
    model,
    fallbackUsed,
    editable: true,
    qaState: 'generated',
    requestsUsed: baseRequests,
    visualRequirement: candidate.visualRequirement,
    visualIntent: candidate.visualIntent,
    quotaPaused: false,
  })

  if (candidate.visual) {
    // Legacy/backward-safe path: older deployed generators may already return a
    // validated diagram with the question. Keep it without issuing another call.
    candidate = { ...candidate, visual: clone(candidate.visual) }
  } else {
    // Explicitly record that pass 1 produced no diagram. The persisted visual
    // plan remains pending for the separate sequential enrichment phase.
    candidate = { ...candidate, visual: null }
  }

  const review = await adaptiveReview(assessment, item, candidate, demo, signal, model)
  const mergedCandidate = review.candidate
  const state = review.state
  quotaPaused = quotaPaused || Boolean((review as { quotaPaused?: boolean }).quotaPaused)
  return {
    assessmentId: assessment.id,
    itemId: item.id,
    questionType: item.questionType,
    candidate: mergedCandidate,
    approvedResources,
    model,
    fallbackUsed,
    editable: true,
    qaState: state,
    deterministicQa: review.deterministic,
    risk: review.risk,
    verifier: review.verifier,
    repairAttempted: review.repairAttempted,
    requestsUsed: baseRequests + review.requestsUsed,
    visualRequestsUsed: 0,
    visualRequirement: mergedCandidate.visualRequirement,
    visualIntent: mergedCandidate.visualIntent,
    quotaPaused,
  }
}

function batchGenerationShouldPause(error: unknown) {
  const failureCategory = String((error as { failureCategory?: unknown })?.failureCategory ?? '')
  if (['provider_configuration', 'provider_authentication', 'provider_quota', 'provider_rate_limit', 'unknown_provider_failure', 'edge_transport'].includes(failureCategory)) return true
  const message = String((error as { message?: unknown })?.message ?? error)
  return /429|quota|rate.?limit|provider limit|api key|credential|authentication required|not configured|rejected the (?:structured )?request configuration|assessment service could not be reached|failed to send a request to the edge function/i.test(message)
}

export async function generateMissingAssessmentItems(options: AssessmentGenerationBatchOptions): Promise<AssessmentGenerationBatchSummary> {
  const { assessment, demo, onItem, onSuggestion, onProgress, signal } = options
  const generate = options.generate ?? generateAssessmentItemSuggestion
  const concurrency = Math.max(1, Math.min(3, Math.floor(options.concurrency ?? 2)))
  const selected = options.itemIds?.length ? new Set(options.itemIds) : null
  const eligible = assessment.items.filter((item) => {
    const value = itemRecord(item)
    if (selected && !selected.has(item.id)) return false
    if (value.locked === true || value.qaState === 'locked') return false
    if (item.authorshipState === 'teacher_edited' || item.authorshipState === 'teacher_accepted') return false
    return !hasExistingAssessmentContent(item)
  })
  const summary: AssessmentGenerationBatchSummary = { attempted: 0, succeeded: 0, skipped: assessment.items.length - eligible.length, failed: 0, cancelled: 0, results: [], errors: [], providerPaused: false }
  let cursor = 0
  let processed = 0
  let paused = false
  // Progress describes eligible work only. `processed` is intentionally
  // separate from `succeeded`: a failed provider/validation attempt must never
  // be displayed as a generated question.
  const progress = (itemId: string, status: 'success' | 'failed' | 'skipped' | 'cancelled', message?: string) => {
    processed += 1
    onProgress?.({
      completed: processed,
      processed,
      total: eligible.length,
      succeeded: summary.succeeded,
      failed: summary.failed,
      cancelled: summary.cancelled,
      remaining: Math.max(0, eligible.length - processed),
      itemId,
      status,
      ...(message ? { message } : {}),
    })
  }
  const worker = async () => {
    while (true) {
      if (signal?.aborted || paused) return
      const index = cursor++
      if (index >= eligible.length) return
      const item = eligible[index]
      summary.attempted += 1
      try {
        const suggestion = await generate({
          assessment, item, demo, signal,
          onQuestionReady: options.onQuestionReady
            ? async (questionSuggestion) => {
              const questionItem = applyAssessmentItemSuggestion(item, questionSuggestion, { source: 'generated' })
              await options.onQuestionReady?.(questionItem, questionSuggestion)
            }
            : undefined,
        })
        const applied = applyAssessmentItemSuggestion(item, suggestion, { source: 'generated' })
        summary.results.push(applied)
        summary.succeeded += 1
        await onItem?.(applied)
        await onSuggestion?.(applied, suggestion)
        progress(item.id, 'success')
        // Preserve the successfully generated question, then stop scheduling
        // more work when a later visual/verifier request hit a provider boundary.
        if (suggestion.quotaPaused) {
          summary.providerPaused = true
          paused = true
        }
      } catch (error) {
        if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          summary.cancelled += 1
          progress(item.id, 'cancelled')
        } else {
          summary.failed += 1
          const message = String((error as { message?: unknown })?.message ?? error)
          summary.errors.push({ itemId: item.id, message })
          progress(item.id, 'failed', message)
          // If a provider/credential boundary is exhausted, do not burn a
          // request on every remaining item. The teacher can resume later.
          if (batchGenerationShouldPause(error)) {
            summary.providerPaused = true
            paused = true
          }
        }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  if (signal?.aborted || paused) {
    eligible.slice(Math.min(cursor, eligible.length)).forEach((item) => { summary.cancelled += 1; progress(item.id, 'cancelled') })
  }
  return summary
}
