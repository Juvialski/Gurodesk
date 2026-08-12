import type { AssessmentRecord, AssessmentItem, QuestionType } from '../types/assessment'
import { ASSESSMENT_QUESTION_TYPES } from '../types/assessment'
import { classifyAssessmentRisk, objectiveQuestionType, teacherScoredQuestionType, validateAssessmentItemDeterministic, type AssessmentQaIssue } from './assessmentQa'
import { assessmentDuplicateLevel, assessmentSimilarityConcentration, assessmentVisualSemanticFindings } from './assessmentFinalQa'
import { hasUnsupportedAssessmentMathMarkup } from './assessmentMathText'
import { assessmentQuestionTypesAreContiguous } from './assessmentExportPresentation'

type UnknownRecord = Record<string, unknown>
function record(value: unknown): UnknownRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {} }
function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function pointsForItem(item: AssessmentItem) {
  const value = record(item).pointsPossible ?? record(item).points
  if (value === null || value === undefined || value === '') return 1
  const points = Number(value)
  return points
}
function safePoints(item: AssessmentItem) { const points = pointsForItem(item); return Number.isFinite(points) && points > 0 ? points : 0 }
function sourceMappings(assessment: AssessmentRecord) {
  const source = assessment.sourceTos?.content
  const result = new Map<number, { competencyId: string; cognitiveCategoryId: string }>()
  source?.rows?.forEach((row) => row.cognitiveAllocations?.forEach((allocation) => {
    if (!allocation.itemStart || !allocation.itemEnd) return
    for (let item = allocation.itemStart; item <= allocation.itemEnd; item += 1) result.set(item, { competencyId: row.competency.id, cognitiveCategoryId: allocation.categoryId })
  }))
  return result
}


function v2SourceMappingValid(assessment: AssessmentRecord, item: AssessmentItem) {
  const row = assessment.sourceTos?.content?.rows?.find((candidate) => candidate.id === item.mapping.rowId)
  if (!row || row.competency.id !== item.mapping.competencyId || item.mapping.competencyId !== item.competencySnapshot.id) return false
  const allocation = row.cognitiveAllocations?.find((candidate) => candidate.categoryId === item.mapping.cognitiveCategoryId)
  return Boolean(allocation
    && allocation.itemStart !== null
    && allocation.itemEnd !== null
    && allocation.itemStart === item.mapping.allocationItemStart
    && allocation.itemEnd === item.mapping.allocationItemEnd
    && allocation.categoryId === item.cognitiveCategorySnapshot.id)
}

export type AssessmentFinalReviewIssue = AssessmentQaIssue & { itemId?: string; itemNumber?: number; overridable: boolean }
export type AssessmentFinalReview = {
  ready: boolean
  canFinalize: boolean
  acknowledgedWarningCodes: string[]
  hardErrors: AssessmentFinalReviewIssue[]
  warnings: AssessmentFinalReviewIssue[]
  suspiciousItemIds: string[]
  metrics: {
    itemCount: number
    expectedItemCount: number
    totalPoints: number
    objectivePoints: number
    teacherScoredPoints: number
    completedItems: number
    needsReviewItems: number
    typeCounts: Partial<Record<QuestionType, number>>
    typePoints: Partial<Record<QuestionType, number>>
    competencyItemCounts: Record<string, number>
    competencyPoints: Record<string, number>
    cognitiveItemCounts: Record<string, number>
    cognitivePoints: Record<string, number>
  }
}

function add(target: AssessmentFinalReviewIssue[], code: string, message: string, item?: AssessmentItem, overridable = false) {
  target.push({ code, message, severity: overridable ? 'warning' : 'error', itemId: item?.id, itemNumber: item?.itemNumber, overridable })
}

function malformedNotation(prompt: string) {
  const pairs: Array<[string, string]> = [['(', ')'], ['[', ']'], ['{', '}']]
  return pairs.some(([open, close]) => prompt.split(open).length !== prompt.split(close).length)
}

/**
 * Final-test review is deterministic first. AI callers can use
 * `suspiciousItemIds` to request a small high-risk review subset; an unavailable
 * optional AI check is represented as a warning and never blocks by itself.
 */
export function reviewAssessmentForFinalization(assessment: AssessmentRecord, options: { acknowledgedWarningCodes?: string[] } = {}): AssessmentFinalReview {
  const hardErrors: AssessmentFinalReviewIssue[] = []
  const warnings: AssessmentFinalReviewIssue[] = []
  const assessmentSettings = record(record(assessment).settings)
  const isV2 = Number(assessmentSettings.schemaVersion ?? 1) >= 2 && assessmentSettings.generationVersion === 'v2' && assessmentSettings.numberingMode === 'point_ranges'
  const masterPlan = isV2 ? record(assessmentSettings.masterPlan) : {}
  const expected = isV2 ? Number(masterPlan.logicalItemCount) : Number(assessment.totalItems)
  const source = sourceMappings(assessment)
  const numbers = new Set<number>()
  let pointCursor = 1
  const typeCounts: Partial<Record<QuestionType, number>> = {}
  const typePoints: Partial<Record<QuestionType, number>> = {}
  const competencyItemCounts: Record<string, number> = {}
  const competencyPoints: Record<string, number> = {}
  const cognitiveItemCounts: Record<string, number> = {}
  const cognitivePoints: Record<string, number> = {}
  const suspiciousItemIds: string[] = []
  const answerPatterns: Record<string, number> = {}
  let patternEligibleItems = 0
  const allowed = Array.isArray(assessmentSettings.allowedTypes) ? assessmentSettings.allowedTypes.map((value: unknown) => String(value)) : []
  let completedItems = 0
  let needsReviewItems = 0
  assessment.items.forEach((item) => {
    const itemRecord = record(item)
    const points = pointsForItem(item)
    const type = item.questionType
    typeCounts[type] = (typeCounts[type] ?? 0) + 1
    const metricPoints = safePoints(item)
    typePoints[type] = (typePoints[type] ?? 0) + metricPoints
    const competencyId = item.competencySnapshot.id
    const cognitiveId = item.cognitiveCategorySnapshot.id
    competencyItemCounts[competencyId] = (competencyItemCounts[competencyId] ?? 0) + 1
    competencyPoints[competencyId] = (competencyPoints[competencyId] ?? 0) + metricPoints
    cognitiveItemCounts[cognitiveId] = (cognitiveItemCounts[cognitiveId] ?? 0) + 1
    cognitivePoints[cognitiveId] = (cognitivePoints[cognitiveId] ?? 0) + metricPoints
    if (!Number.isSafeInteger(item.itemNumber) || item.itemNumber < 1 || item.itemNumber > expected) add(hardErrors, 'item-number', isV2 ? 'Logical question number is missing, duplicated, or outside the frozen master plan.' : 'Item number is missing, duplicated, or outside the source TOS slots.', item)
    if (numbers.has(item.itemNumber)) add(hardErrors, 'duplicate-item-number', 'Item numbers must not be duplicated.', item)
    numbers.add(item.itemNumber)
    if (isV2) {
      const planEntries = Array.isArray(masterPlan.entries) ? masterPlan.entries.map(record) : []
      const entry = planEntries.find((candidate) => Number(candidate.itemNumber) === item.itemNumber)
      const pointStart = Number(record(item).pointStart); const pointEnd = Number(record(item).pointEnd)
      if (!entry || clean(entry.id) !== clean(record(item).planEntryId) || Number(entry.pointStart) !== pointStart || Number(entry.pointEnd) !== pointEnd || Number(entry.pointsPossible) !== points || clean(entry.questionType) !== type || clean(entry.rowId) !== item.mapping.rowId || clean(entry.competencyId) !== item.mapping.competencyId || clean(entry.cognitiveCategoryId) !== item.mapping.cognitiveCategoryId) add(hardErrors, 'master-plan-item', 'Question type, points, range, or curriculum mapping changed from the frozen master plan.', item)
      if (!Number.isSafeInteger(pointStart) || !Number.isSafeInteger(pointEnd) || pointStart !== pointCursor || pointEnd !== pointStart + points - 1) add(hardErrors, 'point-range', 'Point ranges must be contiguous and exactly match pointsPossible.', item)
      if (Number.isSafeInteger(pointEnd)) pointCursor = pointEnd + 1
      if (!v2SourceMappingValid(assessment, item)) add(hardErrors, 'tos-mapping', 'Finalized TOS competency or cognitive mapping changed.', item)
    } else {
      const mapped = source.get(item.itemNumber)
      if (!mapped || mapped.competencyId !== item.mapping.competencyId || mapped.cognitiveCategoryId !== item.mapping.cognitiveCategoryId || item.mapping.competencyId !== item.competencySnapshot.id) add(hardErrors, 'tos-mapping', 'Finalized TOS item, competency, or cognitive mapping changed.', item)
    }
    if (!ASSESSMENT_QUESTION_TYPES.includes(type) || (allowed.length > 0 && !allowed.includes(type))) add(hardErrors, 'question-type', 'Question type is unsupported or disabled for this assessment.', item)
    const deterministic = validateAssessmentItemDeterministic(item, { allowedTypes: allowed.length ? allowed : undefined, expectedItemNumber: item.itemNumber, expectedCompetencyId: item.competencySnapshot.id, expectedCognitiveCategoryId: item.cognitiveCategorySnapshot.id })
    deterministic.errors.forEach((entry) => add(hardErrors, entry.code, entry.message, item))
    deterministic.warnings.forEach((entry) => add(warnings, entry.code, entry.message, item, true))
    if (!item.prompt.trim()) add(hardErrors, 'missing-item', 'Every TOS slot needs a question prompt.', item)
    else completedItems += 1
    if (!Number.isFinite(points) || points <= 0) add(hardErrors, 'points', 'Points possible must be positive and finite.', item)
    const qaState = String(itemRecord.qaState ?? '')
    if (['needs_review', 'answer_needs_recheck', 'repair_needed'].includes(qaState)) {
      needsReviewItems += 1
      // Keep a structurally valid edit or optional-AI concern visible without
      // making finalization depend on provider availability. Deterministic
      // answer, scoring, and TOS errors above remain blocking.
      add(warnings, 'unresolved-review-state', 'This item still needs a teacher accuracy review before finalization.', item, true)
    }
    if (itemRecord.locked === true && !item.prompt.trim()) add(hardErrors, 'locked-empty', 'A locked item cannot be empty.', item)
    if (item.authorshipState === 'empty' || item.authorshipState === 'ai_suggestion') add(hardErrors, 'teacher-review', 'Teacher must accept or edit each generated item before finalization.', item)
    if (malformedNotation(item.prompt)) add(warnings, 'malformed-notation', 'Prompt punctuation may contain an unmatched bracket or parenthesis.', item, true)
    if (hasUnsupportedAssessmentMathMarkup(item.prompt)) add(warnings, 'unsupported-math-markup', 'Prompt contains math markup that may not render cleanly in PDF/Word export; simplify or review the notation.', item, true)
    if (item.visualRequirement === 'required' && ['pending', 'running', 'failed', 'stale'].includes(String(item.visualStatus ?? 'pending'))) {
      add(hardErrors, 'required-visual-not-ready', 'This question depends on its diagram, so the diagram must finish successfully before finalization.', item)
    }
    assessmentVisualSemanticFindings(item).forEach((finding) => add(finding.severity === 'error' ? hardErrors : warnings, finding.code, finding.message, item, finding.severity === 'warning'))
    const risk = classifyAssessmentRisk(item)
    if (risk.verifyRecommended || itemRecord.qaState === 'answer_needs_recheck') suspiciousItemIds.push(item.id)
    const answer = record(item.answer)
    if (type === 'multiple_choice') {
      const choices = Array.isArray(answer.choices) ? answer.choices.map(record) : []
      const correctIndex = choices.findIndex((choice) => clean(choice.id) === clean(answer.choiceId))
      if (correctIndex >= 0) { const key = `mcq-${correctIndex}`; answerPatterns[key] = (answerPatterns[key] ?? 0) + 1; patternEligibleItems += 1 }
    } else if (type === 'true_false' && typeof answer.value === 'boolean') {
      const key = `tf-${String(answer.value)}`; answerPatterns[key] = (answerPatterns[key] ?? 0) + 1; patternEligibleItems += 1
    }
  })
  const distributionMode = String(assessmentSettings.mode ?? 'auto_balanced')
  if (distributionMode !== 'manual_per_item' && !assessmentQuestionTypesAreContiguous(assessment.items)) {
    add(hardErrors, 'question-type-sections', 'Automatic question-type modes require contiguous grouped test sections. Reapply the distribution to empty slots or switch to Manual per item before finalization.')
  }

  for (let leftIndex = 0; leftIndex < assessment.items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < assessment.items.length; rightIndex += 1) {
      const left = assessment.items[leftIndex]; const right = assessment.items[rightIndex]
      const level = assessmentDuplicateLevel(left, right)
      if (level === 'exact') add(hardErrors, 'duplicate-prompt', `This prompt duplicates Item ${left.itemNumber}; replace one item before finalization.`, right)
      else if (level === 'strong') add(hardErrors, 'strong-duplicate-prompt', `This item is effectively the same evidence as Item ${left.itemNumber}; replace or materially differentiate one item.`, right)
      else if (level === 'similar') add(warnings, 'near-duplicate-prompt', `This prompt is similar to Item ${left.itemNumber}; confirm that it assesses distinct evidence.`, right, true)
    }
  }
  const concentration = assessmentSimilarityConcentration(assessment.items)
  if (concentration) add(warnings, 'evidence-concentration', `${concentration.points} point(s) (${Math.round(concentration.share * 100)}%) are concentrated in a closely related question cluster: Items ${concentration.itemNumbers.join(', ')}. Confirm that this weighting matches the intended evidence.`, undefined, true)
  for (let itemNumber = 1; itemNumber <= expected; itemNumber += 1) if (!numbers.has(itemNumber)) add(hardErrors, 'missing-slot', isV2 ? `Logical question ${itemNumber} from the frozen master plan is missing.` : `Item ${itemNumber} from the finalized TOS is missing.`)
  if (assessment.items.length !== expected) add(hardErrors, 'item-count', `Assessment must contain exactly ${expected} logical question(s).`)
  if (isV2 && pointCursor !== Number(masterPlan.totalPoints) + 1) add(hardErrors, 'point-range-total', 'Point-range numbering must cover exactly 1 through the frozen assessment total points.')
  const dominantPattern = Math.max(0, ...Object.values(answerPatterns))
  if (patternEligibleItems >= 5 && dominantPattern / patternEligibleItems >= 0.8) add(warnings, 'answer-pattern', 'A large share of objective answers uses the same position/value; review for an unintended answer pattern.', undefined, true)
  const totalPoints = assessment.items.reduce((sum, item) => sum + safePoints(item), 0)
  const mirror = record(assessment).totalPoints
  if (mirror !== undefined && (!Number.isFinite(Number(mirror)) || Math.abs(Number(mirror) - totalPoints) > 0.000001)) add(hardErrors, 'total-points-mismatch', 'Persisted total points must equal the derived item-point sum.')
  const settings = record(record(assessment).settings)
  const target = settings.targetTotalPoints === null || settings.targetTotalPoints === undefined ? undefined : Number(settings.targetTotalPoints)
  if (target !== undefined && Number.isFinite(target) && target > 0 && totalPoints !== target) add(warnings, 'target-points-difference', `${Math.abs(target - totalPoints)} point(s) remain between the optional target and the current item sum; scoring was not altered automatically.`, undefined, true)
  const objectivePoints = assessment.items.filter((item) => objectiveQuestionType(item.questionType)).reduce((sum, item) => sum + safePoints(item), 0)
  const teacherScoredPoints = assessment.items.filter((item) => teacherScoredQuestionType(item.questionType)).reduce((sum, item) => sum + safePoints(item), 0)
  const acknowledgedWarningCodes = [...new Set(options.acknowledgedWarningCodes ?? [])]
  const unacknowledgedWarnings = warnings.filter((entry) => !acknowledgedWarningCodes.includes(entry.code))
  return { ready: hardErrors.length === 0 && unacknowledgedWarnings.length === 0, canFinalize: hardErrors.length === 0, acknowledgedWarningCodes, hardErrors, warnings, suspiciousItemIds: [...new Set(suspiciousItemIds)], metrics: { itemCount: assessment.items.length, expectedItemCount: expected, totalPoints, objectivePoints, teacherScoredPoints, completedItems, needsReviewItems, typeCounts, typePoints, competencyItemCounts, competencyPoints, cognitiveItemCounts, cognitivePoints } }
}

function groupedReviewMessages(entries: AssessmentFinalReviewIssue[]) {
  const groups = new Map<string, number[]>()
  entries.forEach((entry) => {
    const numbers = groups.get(entry.message) ?? []
    if (entry.itemNumber !== undefined) numbers.push(entry.itemNumber)
    groups.set(entry.message, numbers)
  })
  return [...groups.entries()].map(([message, itemNumbers]) => {
    const uniqueNumbers = [...new Set(itemNumbers)].sort((left, right) => left - right)
    if (!uniqueNumbers.length) return message
    const shown = uniqueNumbers.slice(0, 12).join(', ')
    const remainder = uniqueNumbers.length > 12 ? ` +${uniqueNumbers.length - 12} more` : ''
    return `${message} (Item${uniqueNumbers.length === 1 ? '' : 's'} ${shown}${remainder})`
  })
}

export function finalReviewMessages(review: AssessmentFinalReview) {
  return { errors: groupedReviewMessages(review.hardErrors), warnings: groupedReviewMessages(review.warnings) }
}

export function appendOptionalAiReviewWarning(review: AssessmentFinalReview, message = 'Optional AI quality review was unavailable. Teacher review remains authoritative; this does not block finalization.') {
  review.warnings.push({ code: 'ai-review-unavailable', message, severity: 'warning', overridable: true })
  return { ...review, canFinalize: review.hardErrors.length === 0, ready: review.hardErrors.length === 0 && review.warnings.every((entry) => review.acknowledgedWarningCodes.includes(entry.code)) }
}
