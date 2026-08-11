/** Deterministic assessment QA and transparent risk classification.
 *
 * This module intentionally has no Supabase/Gemini dependency.  It validates
 * the safe parts of an item before a verifier request is considered and keeps
 * review state understandable to a teacher while allowing the persisted core
 * model to grow with future question types.
 */

import { ASSESSMENT_QUESTION_TYPES } from '../types/assessment'

// Re-export the canonical registry for existing QA callers.  The type module
// is the single source of truth shared by the editor, persistence, and exports.
export { ASSESSMENT_QUESTION_TYPES } from '../types/assessment'

export type AssessmentQuestionTypeName = typeof ASSESSMENT_QUESTION_TYPES[number]

export type AssessmentQaStateName =
  | 'empty'
  | 'generated'
  | 'verified'
  | 'needs_review'
  | 'teacher_edited'
  | 'answer_needs_recheck'
  | 'locked'
  | 'repair_needed'

export type AssessmentQaIssueSeverity = 'error' | 'warning'

export type AssessmentQaIssue = {
  code: string
  message: string
  severity: AssessmentQaIssueSeverity
}

export type AssessmentDeterministicQaResult = {
  valid: boolean
  errors: AssessmentQaIssue[]
  warnings: AssessmentQaIssue[]
}

export type AssessmentRiskSignal = {
  signal: string
  weight: number
}

export type AssessmentRiskResult = {
  level: 'low' | 'medium' | 'high'
  score: number
  signals: AssessmentRiskSignal[]
  verifyRecommended: boolean
}

export type AssessmentVerifierResult = {
  status: 'pass' | 'needs_repair'
  answerValid: boolean
  competencyAligned: boolean
  cognitiveAlignment: 'good' | 'questionable'
  ambiguityDetected: boolean
  factualOrMathIssue: boolean
  issues: string[]
  repairGuidance: string[]
}

export type AssessmentReviewSummary = {
  state: AssessmentQaStateName
  deterministic: AssessmentDeterministicQaResult
  risk: AssessmentRiskResult
  verifier?: AssessmentVerifierResult
  repairAttempted?: boolean
  requestsUsed?: number
}

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function typeOf(item: unknown): string {
  return stringValue(record(item).questionType)
}

function promptOf(item: unknown) {
  return stringValue(record(item).prompt ?? record(item).question)
}

function promptRequiresAttachedVisual(value: string) {
  return /\b(?:shown|displayed|illustrated|depicted)\s+(?:in|on)\s+(?:the\s+)?(?:visual|diagram|figure|graph)\b|\b(?:visual|diagram|figure|graph)\s+(?:shown|below|above)\b/iu.test(value)
}

function pointsOf(item: unknown) {
  const value = record(item).pointsPossible ?? record(item).points ?? record(item).pointValue
  if (value === null || value === undefined || value === '') return 1
  return Number(value)
}

function answerOf(item: unknown) {
  return record(record(item).answer)
}

function arrayOf(value: unknown) {
  return Array.isArray(value) ? value : []
}

function issue(code: string, message: string, severity: AssessmentQaIssueSeverity = 'error'): AssessmentQaIssue {
  return { code, message, severity }
}

function nonblankArray(value: unknown) {
  return arrayOf(value).map(stringValue).filter(Boolean)
}

function uniqueText(values: string[]) {
  const normalized = values.map((value) => value.normalize('NFKC').toLocaleLowerCase('en').trim())
  return new Set(normalized).size === normalized.length
}

function uniqueIds(values: string[]) {
  return new Set(values).size === values.length && values.every(Boolean)
}

function answerChoices(answer: UnknownRecord) {
  return arrayOf(answer.choices ?? answer.options).map(record)
}

function answerChoiceIds(answer: UnknownRecord) {
  return answerChoices(answer).map((choice) => stringValue(choice.id ?? choice.key ?? choice.label))
}

function stringListFrom(value: unknown) {
  if (Array.isArray(value)) return value.map((entry) => stringValue(entry)).filter(Boolean)
  if (typeof value === 'string') return value.split(/[\n;,]/).map((entry) => entry.trim()).filter(Boolean)
  return []
}

function subpartPoints(value: unknown) {
  return arrayOf(value).map((entry) => numberValue(record(entry).pointsPossible ?? record(entry).points, NaN))
}

function rubricPoints(value: unknown) {
  return arrayOf(value).map((entry) => numberValue(record(entry).pointsPossible ?? record(entry).points, NaN))
}

function matchingMappings(answer: UnknownRecord) {
  return record(answer).mappings ?? record(answer).mapping ?? record(answer).matches
}

function deterministicMathCheck(item: unknown): AssessmentQaIssue[] {
  const itemRecord = record(item)
  const answer = answerOf(item)
  const type = typeOf(item)
  if (type !== 'numerical_answer') return []
  const value = answer.value ?? answer.numericValue ?? answer.expectedValue
  const number = Number(value)
  if (!Number.isFinite(number)) return [issue('numerical-value', 'Numerical answer must contain a finite numeric value.')]
  const tolerance = answer.tolerance
  if (tolerance !== undefined && (!Number.isFinite(Number(tolerance)) || Number(tolerance) < 0)) return [issue('numerical-tolerance', 'Numerical tolerance must be zero or a positive finite number.')]
  const unit = answer.unit ?? answer.requiredUnit
  if (unit !== undefined && typeof unit !== 'string') return [issue('numerical-unit', 'Numerical answer unit must be text when supplied.')]
  // Never evaluate model-provided expressions.  A teacher can still request
  // independent verification for algebra, geometry, or multi-step work.
  if (typeof value === 'string' && /[+*/^=]|\b(?:solve|find|calculate)\b/i.test(value)) {
    return [issue('unsafe-math-expression', 'A generated mathematical expression requires teacher or independent Lite review; it was not executed.', 'warning')]
  }
  return []
}

/** Validate all deterministic shape and scoring constraints available locally. */
export function validateAssessmentItemDeterministic(item: unknown, options: {
  allowedTypes?: readonly string[]
  expectedItemNumber?: number
  expectedCompetencyId?: string
  expectedCognitiveCategoryId?: string
} = {}): AssessmentDeterministicQaResult {
  const value = record(item)
  const answer = answerOf(item)
  const type = typeOf(item)
  const errors: AssessmentQaIssue[] = []
  const warnings: AssessmentQaIssue[] = []
  const add = (target: AssessmentQaIssue[], code: string, message: string, severity: AssessmentQaIssueSeverity = 'error') => target.push(issue(code, message, severity))

  if (!type || !ASSESSMENT_QUESTION_TYPES.includes(type as AssessmentQuestionTypeName)) add(errors, 'question-type', 'Question type is missing or unsupported.')
  if (options.allowedTypes && type && !options.allowedTypes.includes(type)) add(errors, 'disabled-question-type', 'The question type is disabled for this assessment.')
  const prompt = promptOf(item)
  if (!prompt) add(errors, 'prompt', 'Question prompt is required.')
  if (prompt && promptRequiresAttachedVisual(prompt) && !record(value.visual).kind) add(errors, 'missing-visual', 'The question refers to a visual, but no valid visual is attached. Regenerate the item or add a diagram before accepting it.')
  const points = pointsOf(item)
  if (!Number.isFinite(points) || points <= 0) add(errors, 'points', 'Points possible must be a positive finite number.')
  if (options.expectedItemNumber !== undefined && numberValue(value.itemNumber, -1) !== options.expectedItemNumber) add(errors, 'item-number', 'Item number does not match the immutable TOS slot.')
  const competencyId = stringValue(record(value.competencySnapshot).id ?? value.competencyId)
  const cognitiveId = stringValue(record(value.cognitiveCategorySnapshot).id ?? value.cognitiveCategoryId)
  if (options.expectedCompetencyId && competencyId !== options.expectedCompetencyId) add(errors, 'competency-drift', 'Competency mapping changed from the finalized TOS.')
  if (options.expectedCognitiveCategoryId && cognitiveId !== options.expectedCognitiveCategoryId) add(errors, 'cognitive-drift', 'Cognitive-category mapping changed from the finalized TOS.')

  if (type === 'multiple_choice') {
    const choices = answerChoices(answer)
    const ids = answerChoiceIds(answer)
    const texts = choices.map((choice) => stringValue(choice.text ?? choice.value))
    if (choices.length < 2 || choices.length > 6) add(errors, 'mcq-choice-count', 'Multiple-choice questions require 2–6 choices.')
    if (!uniqueIds(ids)) add(errors, 'mcq-choice-ids', 'Multiple-choice choice IDs must be unique and nonblank.')
    if (texts.some((entry) => !entry) || !uniqueText(texts)) add(errors, 'mcq-choice-text', 'Multiple-choice choices must be nonblank and unique.')
    const correct = stringValue(answer.choiceId ?? answer.correctChoiceId ?? answer.correctAnswer)
    if (!correct || !ids.includes(correct)) add(errors, 'mcq-answer', 'The correct multiple-choice choice must reference an existing option.')
  } else if (type === 'true_false') {
    if (typeof (answer.value ?? answer.correct) !== 'boolean') add(errors, 'true-false-answer', 'True/False answer must be true or false.')
  } else if (type === 'short_answer' || type === 'identification') {
    const accepted = stringListFrom(answer.acceptedAnswers ?? answer.accepted ?? answer.terms)
    if (!accepted.length || !uniqueText(accepted)) add(errors, 'accepted-answers', 'Provide one or more unique accepted answers.')
  } else if (type === 'fill_in_the_blank') {
    const blanks = arrayOf(answer.blanks ?? value.blanks)
    if (!blanks.length) add(errors, 'blank-count', 'Fill-in-the-blank questions require at least one structured blank.')
    const ids = blanks.map((entry) => stringValue(record(entry).id ?? record(entry).blankId))
    if (!uniqueIds(ids)) add(errors, 'blank-ids', 'Fill-in-the-blank IDs must be unique and nonblank.')
    const hasPerBlankScoring = answer.perBlankScoring === true || blanks.some((entry) => record(entry).pointsPossible !== undefined || record(entry).points !== undefined)
    const blankPoints = blanks.map((entry) => numberValue(record(entry).pointsPossible ?? record(entry).points, NaN))
    if (hasPerBlankScoring) {
      if (blankPoints.some((entry) => !Number.isFinite(entry) || entry <= 0)) add(errors, 'blank-points', 'Each scored blank must have positive points.')
      if (blankPoints.length && Math.abs(blankPoints.reduce((sum, entry) => sum + entry, 0) - points) > 1e-9) add(errors, 'blank-points-total', 'Fill-in-the-blank points must equal the sum of blank points.')
    }
    blanks.forEach((entry) => {
      const accepted = stringListFrom(record(entry).acceptedAnswers ?? record(entry).accepted)
      if (!accepted.length || !uniqueText(accepted)) add(errors, 'blank-answer', 'Each blank needs one or more unique accepted answers.')
    })
  } else if (type === 'numerical_answer') {
    deterministicMathCheck(item).forEach((entry) => entry.severity === 'warning' ? warnings.push(entry) : errors.push(entry))
  } else if (type === 'problem_solving') {
    const finalAnswer = answer.finalAnswer ?? answer.expectedFinalAnswer ?? answer.expectedResponse
    const finalAnswerValid = typeof finalAnswer === 'number' ? Number.isFinite(finalAnswer) : Boolean(stringValue(finalAnswer))
    if (!finalAnswerValid) add(errors, 'problem-final-answer', 'Problem-solving items need a structured final answer.')
    if (!stringValue(answer.solutionOutline ?? answer.expectedMethod ?? answer.method)) add(warnings, 'problem-solution-outline', 'Add a solution outline so partial-credit scoring is reviewable.', 'warning')
    const parts = arrayOf(answer.subparts ?? value.subparts)
    if (parts.length) {
      const values = subpartPoints(parts)
      if (values.some((entry) => !Number.isFinite(entry) || entry <= 0)) add(errors, 'subpart-points', 'Problem subparts must have positive points.')
      if (Math.abs(values.reduce((sum, entry) => sum + entry, 0) - points) > 1e-9) add(errors, 'subpart-points-total', 'Problem subpart points must equal item points.')
    }
  } else if (type === 'matching') {
    const columnA = arrayOf(answer.prompts ?? answer.columnA ?? value.columnA)
    const columnB = arrayOf(answer.choices ?? answer.columnB ?? value.columnB)
    if (!columnA.length || !columnB.length) add(errors, 'matching-columns', 'Matching type requires both Column A prompts and Column B choices.')
    const aIds = columnA.map((entry) => stringValue(record(entry).id ?? record(entry).key))
    const bIds = columnB.map((entry) => stringValue(record(entry).id ?? record(entry).key))
    const aTexts = columnA.map((entry) => stringValue(record(entry).text ?? record(entry).value))
    const bTexts = columnB.map((entry) => stringValue(record(entry).text ?? record(entry).value))
    if (!uniqueIds(aIds) || !uniqueIds(bIds)) add(errors, 'matching-ids', 'Matching column IDs must be unique and nonblank.')
    if (aTexts.some((entry) => !entry) || bTexts.some((entry) => !entry) || !uniqueText(aTexts) || !uniqueText(bTexts)) add(errors, 'matching-text', 'Matching prompts and choices must be unique and nonblank.')
    if (columnB.length < columnA.length) add(errors, 'matching-choice-count', 'Column B must contain at least as many choices as scored Column A prompts.')
    const mapping = matchingMappings(answer)
    const pairs: UnknownRecord[] = Array.isArray(mapping) ? mapping.map(record) : Object.entries(record(mapping)).map(([from, to]) => ({ from, to }))
    if (!pairs.length) add(errors, 'matching-map', 'Matching type requires a structured answer mapping.')
    const used = new Set<string>()
    pairs.forEach((pair) => {
      const from = stringValue(pair.from ?? pair.columnAId ?? pair.promptId ?? pair.leftId)
      const to = stringValue(pair.to ?? pair.columnBId ?? pair.choiceId ?? pair.rightId)
      if (!aIds.includes(from) || !bIds.includes(to)) add(errors, 'matching-reference', 'Every matching answer must reference an existing Column A and Column B entry.')
      if (used.has(to) && record(answer).reusableChoices !== true && record(answer).allowReuse !== true) add(errors, 'matching-reuse', 'Matching choices cannot be reused unless reusable choices are enabled.')
      used.add(to)
    })
    const mappedPromptIds = new Set(pairs.map((pair) => stringValue(pair.from ?? pair.columnAId ?? pair.promptId ?? pair.leftId)))
    if (pairs.length !== aIds.length || mappedPromptIds.size !== pairs.length || aIds.some((id) => !mappedPromptIds.has(id))) add(errors, 'matching-unmapped-prompt', 'Every Column A prompt must have exactly one structured match.')
    const pairPoints = pairs.map((pair) => numberValue(pair.pointsPossible ?? pair.points ?? record(answer).pointsPerMatch, NaN))
    const pointsPerMatch = numberValue(record(answer).pointsPerMatch, NaN)
    const groupPoints = numberValue(record(answer).groupPointsPossible, NaN)
    const hasAnyPairPoints = pairs.some((pair) => pair.pointsPossible !== undefined || pair.points !== undefined)
    if (hasAnyPairPoints && pairPoints.some((entry) => !Number.isFinite(entry) || entry <= 0)) add(errors, 'matching-points', 'Provide positive points for every scored match or omit all per-match point fields.')
    const expectedTotal = hasAnyPairPoints && pairPoints.every(Number.isFinite) ? pairPoints.reduce((sum, entry) => sum + entry, 0) : Number.isFinite(pointsPerMatch) ? pairs.length * pointsPerMatch : Number.isFinite(groupPoints) ? groupPoints : points
    if (Number.isFinite(expectedTotal) && Math.abs(expectedTotal - points) > 1e-9) add(errors, 'matching-points-total', 'Matching scored responses must sum to the group points.')
  } else if (type === 'multiple_select') {
    const choices = answerChoices(answer)
    const ids = answerChoiceIds(answer)
    const texts = choices.map((choice) => stringValue(choice.text ?? choice.value))
    if (choices.length < 2) add(errors, 'multi-select-choice-count', 'Multiple-select questions require at least two choices.')
    if (!uniqueIds(ids) || texts.some((entry) => !entry) || !uniqueText(texts)) add(errors, 'multi-select-choices', 'Multiple-select choices must be unique and nonblank.')
    const correct = stringListFrom(answer.choiceIds ?? answer.correctChoiceIds ?? answer.correctIds ?? answer.correctAnswers)
    if (!correct.length || !correct.every((id) => ids.includes(id)) || !uniqueIds(correct)) add(errors, 'multi-select-answer', 'Multiple-select answers must contain one or more existing choice IDs.')
    if (answer.scoringPolicy !== undefined && answer.scoringPolicy !== 'all_or_nothing') add(errors, 'multi-select-policy', 'Multiple-select scoring must use the supported all-or-nothing policy.')
  } else if (type === 'constructed_response') {
    if (!stringValue(answer.expectedResponse ?? answer.expected)) add(errors, 'constructed-expected', 'Constructed response needs an expected response.')
    if (answer.rubric !== undefined || answer.criteria !== undefined) {
      const values = rubricPoints(answer.rubric ?? answer.criteria)
      if (values.some((entry) => !Number.isFinite(entry) || entry <= 0)) add(errors, 'rubric-points', 'Rubric criterion points must be positive.')
      if (values.length && Math.abs(values.reduce((sum, entry) => sum + entry, 0) - points) > 1e-9) add(errors, 'rubric-points-total', 'Rubric criterion points must equal item points.')
    }
  } else if (type === 'essay') {
    const keyPoints = stringListFrom(answer.keyPoints ?? answer.expectedElements ?? answer.expectedResponse)
    if (!keyPoints.length) add(warnings, 'essay-key-points', 'Add key points to guide teacher scoring.', 'warning')
    const values = rubricPoints(answer.rubric ?? answer.criteria)
    if (values.some((entry) => !Number.isFinite(entry) || entry <= 0)) add(errors, 'essay-rubric-points', 'Essay rubric criterion points must be positive.')
    if (values.length && Math.abs(values.reduce((sum, entry) => sum + entry, 0) - points) > 1e-9) add(errors, 'essay-rubric-points-total', 'Essay rubric criterion points must equal item points.')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/** Transparent, conservative heuristic. It is not a model confidence score. */
export function classifyAssessmentRisk(item: unknown): AssessmentRiskResult {
  const value = record(item)
  const answer = answerOf(item)
  const type = typeOf(item)
  const prompt = `${promptOf(item)} ${JSON.stringify(answer)}`.toLocaleLowerCase('en')
  const signals: AssessmentRiskSignal[] = []
  const add = (signal: string, weight: number) => signals.push({ signal, weight })
  if (['numerical_answer', 'problem_solving'].includes(type)) add('mathematical or multi-step response', 3)
  if (['constructed_response', 'essay'].includes(type)) add('teacher-scored extended response', 2)
  if (['matching', 'multiple_select'].includes(type)) add('multiple interacting answer conditions', 2)
  if (/\b(analy[sz]e|evaluate|create|justify|compare|synthesize|derive|prove)\b/i.test(prompt)) add('higher cognitive or reasoning language', 2)
  if (/\b(fraction|percent|percentage|algebra|equation|geometry|area|volume|ratio|probability|calculate|solve|cm²|m²)\b/i.test(prompt)) add('math or exact computation signal', 2)
  const cognitive = stringValue(record(value.cognitiveCategorySnapshot).label ?? value.cognitiveCategoryLabel).toLocaleLowerCase('en')
  if (/analy|evaluat|creat/.test(cognitive)) add('higher cognitive TOS category', 2)
  if (stringValue(value.qaState) === 'answer_needs_recheck' || stringValue(value.authorshipState) === 'teacher_edited') add('material teacher edit awaiting review', 2)
  if (prompt.length > 500) add('unusually long item content', 1)
  if (/\b(?:only|always|never|best|most appropriate|except)\b/i.test(prompt)) add('possible ambiguity or absolute wording', 1)
  if (numberValue(value.pointsPossible ?? value.points, 1) >= 5) add('high point value', 1)
  const score = signals.reduce((sum, signal) => sum + signal.weight, 0)
  const level = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low'
  // Independent Gemini verification is intentionally reserved for high-risk
  // items. Medium-risk questions still receive deterministic QA but do not
  // automatically double provider traffic during bulk generation.
  return { level, score, signals, verifyRecommended: level === 'high' }
}

function verifierObject(value: unknown): UnknownRecord {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim())
      return record(parsed)
    } catch {
      return {}
    }
  }
  return record(value)
}

/** Strict verifier JSON contract; malformed or extended objects cannot pass. */
export function parseAssessmentVerifierResult(value: unknown): AssessmentVerifierResult {
  const object = verifierObject(value)
  const required = ['status', 'answerValid', 'competencyAligned', 'cognitiveAlignment', 'ambiguityDetected', 'factualOrMathIssue', 'issues', 'repairGuidance']
  if (Object.keys(object).length !== required.length || Object.keys(object).some((key) => !required.includes(key))) throw new Error('Verifier response did not match the strict structured contract.')
  const status = object.status === 'pass' || object.status === 'needs_repair' ? object.status : null
  if (!status || typeof object.answerValid !== 'boolean' || typeof object.competencyAligned !== 'boolean' || !['good', 'questionable'].includes(String(object.cognitiveAlignment)) || typeof object.ambiguityDetected !== 'boolean' || typeof object.factualOrMathIssue !== 'boolean' || !Array.isArray(object.issues) || !Array.isArray(object.repairGuidance)) throw new Error('Verifier response did not match the strict structured contract.')
  const issues = stringListFrom(object.issues)
  const repairGuidance = stringListFrom(object.repairGuidance ?? object.repair_guidance)
  const answerValid = object.answerValid === true
  const competencyAligned = object.competencyAligned === true
  const cognitiveAlignment = object.cognitiveAlignment === 'good' || object.cognitiveAlignment === 'questionable' ? object.cognitiveAlignment : 'questionable'
  const ambiguityDetected = object.ambiguityDetected === true
  const factualOrMathIssue = object.factualOrMathIssue === true
  return {
    status,
    answerValid,
    competencyAligned,
    cognitiveAlignment,
    ambiguityDetected,
    factualOrMathIssue,
    issues,
    repairGuidance,
  }
}

export function verifierRequiresRepair(result: AssessmentVerifierResult) {
  return result.status === 'needs_repair' || !result.answerValid || !result.competencyAligned || result.cognitiveAlignment === 'questionable' || result.ambiguityDetected || result.factualOrMathIssue
}

export function stateForAssessmentItem(item: unknown, qa: AssessmentDeterministicQaResult, verifier?: AssessmentVerifierResult): AssessmentQaStateName {
  const value = record(item)
  if (value.locked === true || stringValue(value.qaState) === 'locked') return 'locked'
  if (!promptOf(item)) return 'empty'
  if (!qa.valid) return 'needs_review'
  if (verifier && verifierRequiresRepair(verifier)) return 'repair_needed'
  if (verifier?.status === 'pass') return 'verified'
  if (stringValue(value.authorshipState) === 'teacher_edited') return 'teacher_edited'
  if (stringValue(value.qaState) === 'answer_needs_recheck') return 'answer_needs_recheck'
  return 'generated'
}

export function studentSafeQuestionType(type: string) {
  return ASSESSMENT_QUESTION_TYPES.includes(type as AssessmentQuestionTypeName) ? type : 'short_answer'
}

export function objectiveQuestionType(type: string) {
  return ['multiple_choice', 'true_false', 'short_answer', 'identification', 'fill_in_the_blank', 'numerical_answer', 'matching', 'multiple_select'].includes(type)
}

export function teacherScoredQuestionType(type: string) {
  return ['constructed_response', 'problem_solving', 'essay'].includes(type)
}
