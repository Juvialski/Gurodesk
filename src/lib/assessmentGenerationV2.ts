import type {
  AssessmentCpdKey,
  AssessmentMasterPlan,
  AssessmentMasterPlanEntry,
  AssessmentQuestionTypeSuitability,
  AssessmentV2PointBucket,
  AssessmentVisualPolicy,
  QuestionType,
} from '../types/assessment'
import type { TosRecord } from '../types/tos'

export type AssessmentV2Setup = {
  totalPoints: number
  allowedTypes: QuestionType[]
  visualPolicy: AssessmentVisualPolicy
  title?: string
  generationInstructions?: string
}

export type AssessmentV2SetupIssue = {
  key: string
  message: string
  cpdKey?: AssessmentCpdKey
}

export type AssessmentV2SetupValidation = {
  ready: boolean
  errors: AssessmentV2SetupIssue[]
  warnings: AssessmentV2SetupIssue[]
  pointBuckets: AssessmentV2PointBucket[]
}

type PointRule = { min: number; max: number; preferred: number }

export const QUESTION_TYPE_POINT_RULES: Record<QuestionType, PointRule> = {
  multiple_choice: { min: 1, max: 1, preferred: 1 },
  true_false: { min: 1, max: 1, preferred: 1 },
  identification: { min: 1, max: 1, preferred: 1 },
  short_answer: { min: 1, max: 3, preferred: 1 },
  fill_in_the_blank: { min: 1, max: 4, preferred: 2 },
  numerical_answer: { min: 1, max: 4, preferred: 2 },
  matching: { min: 2, max: 8, preferred: 4 },
  multiple_select: { min: 1, max: 3, preferred: 2 },
  problem_solving: { min: 2, max: 8, preferred: 4 },
  constructed_response: { min: 2, max: 8, preferred: 4 },
  essay: { min: 4, max: 12, preferred: 5 },
}


/** Conventional paper section order. Master-plan entries remain bound to their
 * immutable competency/CPD buckets, but learner-facing numbering is assigned
 * only after this stable grouping step so one question type forms one
 * contiguous section (for example MC 1–10 instead of being interleaved). */
export const ASSESSMENT_PAPER_TYPE_ORDER: readonly QuestionType[] = [
  'multiple_choice',
  'true_false',
  'identification',
  'fill_in_the_blank',
  'matching',
  'multiple_select',
  'short_answer',
  'numerical_answer',
  'problem_solving',
  'constructed_response',
  'essay',
] as const

const ASSESSMENT_PAPER_TYPE_RANK = new Map<QuestionType, number>(ASSESSMENT_PAPER_TYPE_ORDER.map((type, index) => [type, index]))

function groupedPaperOrder<T extends { questionType: QuestionType }>(entries: readonly T[]) {
  return entries
    .map((entry, providerIndex) => ({ entry, providerIndex }))
    .sort((left, right) => (ASSESSMENT_PAPER_TYPE_RANK.get(left.entry.questionType) ?? 999) - (ASSESSMENT_PAPER_TYPE_RANK.get(right.entry.questionType) ?? 999) || left.providerIndex - right.providerIndex)
    .map(({ entry }) => entry)
}

const BASE_SUITABILITY: Record<AssessmentCpdKey, Partial<Record<QuestionType, AssessmentQuestionTypeSuitability>>> = {
  remembering: {
    multiple_choice: 'strong', true_false: 'strong', identification: 'strong', fill_in_the_blank: 'strong', matching: 'strong', short_answer: 'allowed', multiple_select: 'allowed', numerical_answer: 'unsupported', problem_solving: 'unsupported', constructed_response: 'allowed', essay: 'unsupported',
  },
  understanding: {
    multiple_choice: 'strong', true_false: 'strong', identification: 'allowed', fill_in_the_blank: 'allowed', matching: 'strong', short_answer: 'strong', multiple_select: 'strong', numerical_answer: 'allowed', problem_solving: 'allowed', constructed_response: 'strong', essay: 'allowed',
  },
  applying: {
    multiple_choice: 'strong', true_false: 'allowed', identification: 'unsupported', fill_in_the_blank: 'allowed', matching: 'allowed', short_answer: 'allowed', multiple_select: 'strong', numerical_answer: 'strong', problem_solving: 'strong', constructed_response: 'strong', essay: 'allowed',
  },
  analyzing: {
    multiple_choice: 'strong', true_false: 'allowed', identification: 'unsupported', fill_in_the_blank: 'unsupported', matching: 'allowed', short_answer: 'strong', multiple_select: 'strong', numerical_answer: 'strong', problem_solving: 'strong', constructed_response: 'strong', essay: 'strong',
  },
  evaluating: {
    multiple_choice: 'allowed', true_false: 'unsupported', identification: 'unsupported', fill_in_the_blank: 'unsupported', matching: 'unsupported', short_answer: 'allowed', multiple_select: 'allowed', numerical_answer: 'allowed', problem_solving: 'strong', constructed_response: 'strong', essay: 'strong',
  },
  creating: {
    multiple_choice: 'unsupported', true_false: 'unsupported', identification: 'unsupported', fill_in_the_blank: 'unsupported', matching: 'unsupported', short_answer: 'unsupported', multiple_select: 'unsupported', numerical_answer: 'unsupported', problem_solving: 'strong', constructed_response: 'strong', essay: 'strong',
  },
  other: {
    multiple_choice: 'allowed', true_false: 'allowed', identification: 'allowed', fill_in_the_blank: 'allowed', matching: 'allowed', short_answer: 'strong', multiple_select: 'allowed', numerical_answer: 'allowed', problem_solving: 'strong', constructed_response: 'strong', essay: 'strong',
  },
}

function clean(value: unknown) { return String(value ?? '').trim() }

export function normalizeCpdKey(id: unknown, label: unknown): AssessmentCpdKey {
  const value = `${clean(id)} ${clean(label)}`.toLowerCase()
  if (/\bremember(?:ing)?\b|\brecall\b|\bknowledge\b/.test(value)) return 'remembering'
  if (/\bunderstand(?:ing)?\b|\bcomprehens/.test(value)) return 'understanding'
  if (/\bapply(?:ing)?\b|\bapplication\b/.test(value)) return 'applying'
  if (/\banaly[sz](?:e|ing)\b|\banalysis\b/.test(value)) return 'analyzing'
  if (/\bevaluat(?:e|ing|ion)\b|\bjudge|critique/.test(value)) return 'evaluating'
  if (/\bcreat(?:e|ing|ion)\b|\bdesign\b|\bproduce\b/.test(value)) return 'creating'
  return 'other'
}

function isMathArea(learningArea: string) {
  return /\bmath(?:ematics)?\b|\bmathematika\b/i.test(learningArea)
}

function isVisualEligibleArea(learningArea: string) {
  return /\bmath(?:ematics)?\b|\bmathematika\b|\bcalculus\b|\bscience\b|\bphysics\b|\bchemistry\b|\bbiology\b|\bgeometry\b|\bstatistics\b|\bstem\b|\btle\b/i.test(learningArea)
}

function isLanguageArea(learningArea: string) {
  return /\benglish\b|\bfilipino\b|\blanguage\b|\breading\b|\bliterature\b|\bcommunication\b/i.test(learningArea)
}

export function questionTypeSuitability(type: QuestionType, cpd: AssessmentCpdKey, learningArea = ''): AssessmentQuestionTypeSuitability {
  const base = BASE_SUITABILITY[cpd][type] ?? 'unsupported'
  if (cpd === 'creating' && isMathArea(learningArea) && type === 'problem_solving') return 'strong'
  if ((cpd === 'evaluating' || cpd === 'creating') && isLanguageArea(learningArea) && type === 'essay') return 'strong'
  return base
}

/** Formats that may actually satisfy one CPD bucket in the frozen master plan. */
export function plannerEligibleTypesForCpd(types: readonly QuestionType[], cpd: AssessmentCpdKey, learningArea = '') {
  return [...new Set(types)].filter((type) => {
    const suitability = questionTypeSuitability(type, cpd, learningArea)
    // Higher-order CPDs must be represented by a naturally strong response
    // format. Merely selecting MCQ or another flexible format cannot satisfy
    // Evaluating/Creating coverage.
    if (cpd === 'evaluating' || cpd === 'creating') return suitability === 'strong'
    return suitability !== 'unsupported'
  })
}

function hamilton(total: number, weights: number[]) {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Point allocation total must be a nonnegative whole number.')
  if (!weights.length) return []
  const safe = weights.map((value) => Number.isFinite(value) && value > 0 ? value : 0)
  const sum = safe.reduce((a, b) => a + b, 0)
  if (sum <= 0) return safe.map(() => 0)
  const raw = safe.map((weight) => total * weight / sum)
  const result = raw.map(Math.floor)
  let remaining = total - result.reduce((a, b) => a + b, 0)
  const order = raw.map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (let i = 0; i < order.length && remaining > 0; i += 1, remaining -= 1) result[order[i].index] += 1
  return result
}

export function minimumAssessmentV2Points(tos: TosRecord, allowedTypes: readonly QuestionType[]): number {
  if (tos.status !== 'final') throw new Error('Assessment V2 requires a finalized TOS.')
  const selected = [...new Set(allowedTypes)]
  if (!selected.length) throw new Error('Select at least one question type.')
  let total = 0
  const rows = [...tos.content.rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, 'en'))
  for (const row of rows) {
    for (const allocation of row.cognitiveAllocations) {
      if (!allocation.itemCount || allocation.itemStart === null || allocation.itemEnd === null) continue
      const cpd = normalizeCpdKey(allocation.categoryId, allocation.label)
      const candidates = plannerEligibleTypesForCpd(selected, cpd, tos.content.learningArea)
      if (!candidates.length) throw new Error(`${allocation.label} is required by the TOS, but the selected question types cannot validly cover it.`)
      total += Math.min(...candidates.map((type) => QUESTION_TYPE_POINT_RULES[type].min))
    }
  }
  if (total < 1) throw new Error('The finalized TOS has no positive cognitive allocations.')
  return total
}

export function buildV2PointBuckets(tos: TosRecord, totalPoints: number, allowedTypes?: readonly QuestionType[]): AssessmentV2PointBucket[] {
  if (tos.status !== 'final') throw new Error('Assessment V2 requires a finalized TOS.')
  if (!Number.isSafeInteger(totalPoints) || totalPoints < 1 || totalPoints > 1000) throw new Error('Total points must be a whole number from 1 to 1000.')
  const cells: Omit<AssessmentV2PointBucket, 'pointsAllocated'>[] = []
  const rows = [...tos.content.rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, 'en'))
  for (const row of rows) {
    const allocations = [...row.cognitiveAllocations].sort((a, b) => (a.itemStart ?? 1e9) - (b.itemStart ?? 1e9) || a.categoryId.localeCompare(b.categoryId, 'en'))
    for (const allocation of allocations) {
      if (!allocation.itemCount || allocation.itemStart === null || allocation.itemEnd === null) continue
      cells.push({
        id: `${row.id}:${allocation.categoryId}`,
        rowId: row.id,
        competencyId: row.competency.id,
        competencyCode: row.competency.code,
        competencyText: row.competency.text,
        cognitiveCategoryId: allocation.categoryId,
        cognitiveLabel: allocation.label,
        cognitiveShortLabel: allocation.shortLabel,
        cpdKey: normalizeCpdKey(allocation.categoryId, allocation.label),
        sourceItemCount: allocation.itemCount,
        sourceAllocationItemStart: allocation.itemStart,
        sourceAllocationItemEnd: allocation.itemEnd,
      })
    }
  }
  if (!cells.length) throw new Error('The finalized TOS has no positive cognitive allocations.')
  const minimums = cells.map((cell) => {
    if (!allowedTypes?.length) return 1
    const candidates = plannerEligibleTypesForCpd(allowedTypes, cell.cpdKey, tos.content.learningArea)
    if (!candidates.length) throw new Error(`${cell.cognitiveLabel} is required by the TOS, but the selected question types cannot validly cover it.`)
    return Math.min(...candidates.map((type) => QUESTION_TYPE_POINT_RULES[type].min))
  })
  const minimumTotal = minimums.reduce((sum, value) => sum + value, 0)
  if (totalPoints < minimumTotal) throw new Error(`At least ${minimumTotal} total points are required to preserve every positive TOS competency/CPD allocation with the selected question types.`)
  const extras = hamilton(totalPoints - minimumTotal, cells.map((cell) => cell.sourceItemCount))
  return cells.map((cell, index) => ({ ...cell, pointsAllocated: minimums[index] + extras[index] }))
}

function canComposePoints(points: number, types: QuestionType[]) {
  if (!Number.isSafeInteger(points) || points < 1 || !types.length) return false
  const reachable = new Array(points + 1).fill(false)
  reachable[0] = true
  for (let sum = 0; sum <= points; sum += 1) {
    if (!reachable[sum]) continue
    for (const type of types) {
      const rule = QUESTION_TYPE_POINT_RULES[type]
      for (let value = rule.min; value <= rule.max && sum + value <= points; value += 1) reachable[sum + value] = true
    }
  }
  return reachable[points]
}

export function validateAssessmentV2Setup(tos: TosRecord | null, setup: AssessmentV2Setup): AssessmentV2SetupValidation {
  const errors: AssessmentV2SetupIssue[] = []
  const warnings: AssessmentV2SetupIssue[] = []
  if (!tos) return { ready: false, errors: [{ key: 'source', message: 'Choose a finalized TOS.' }], warnings, pointBuckets: [] }
  const allowedTypes = [...new Set(setup.allowedTypes)]
  if (!allowedTypes.length) errors.push({ key: 'types', message: 'Select at least one question type.' })
  let pointBuckets: AssessmentV2PointBucket[] = []
  if (allowedTypes.length) {
    try { pointBuckets = buildV2PointBuckets(tos, setup.totalPoints, allowedTypes) } catch (error) {
      errors.push({ key: 'points', message: error instanceof Error ? error.message : 'The point blueprint is invalid.' })
    }
  }
  const requiredCpds = [...new Set(pointBuckets.map((bucket) => bucket.cpdKey))]
  for (const cpd of requiredCpds) {
    const supported = plannerEligibleTypesForCpd(allowedTypes, cpd, tos.content.learningArea)
    const strong = supported.filter((type) => questionTypeSuitability(type, cpd, tos.content.learningArea) === 'strong')
    if (!supported.length) errors.push({ key: `cpd-${cpd}`, cpdKey: cpd, message: `Selected question types cannot validly assess ${cpd}. Add a suitable format before generating.` })
    if ((cpd === 'evaluating' || cpd === 'creating') && !strong.length) errors.push({ key: `cpd-strong-${cpd}`, cpdKey: cpd, message: `${cpd[0].toUpperCase()}${cpd.slice(1)} requires at least one strong higher-order format, not only flexible objective formats.` })
  }
  for (const bucket of pointBuckets) {
    const candidates = plannerEligibleTypesForCpd(allowedTypes, bucket.cpdKey, tos.content.learningArea)
    if (candidates.length && !canComposePoints(bucket.pointsAllocated, candidates)) errors.push({
      key: `bucket-${bucket.id}`,
      cpdKey: bucket.cpdKey,
      message: `${bucket.pointsAllocated} point${bucket.pointsAllocated === 1 ? '' : 's'} allocated to ${bucket.cognitiveLabel} for ${bucket.competencyCode || bucket.competencyText} cannot be composed from the selected question types. Add a compatible lower-point format or increase total points.`,
    })
  }
  if (setup.visualPolicy === 'more_visuals' && !isVisualEligibleArea(tos.content.learningArea)) warnings.push({ key: 'visual-policy', message: 'More visuals is enabled, but automatic required diagrams remain conservative outside visual-eligible learning areas.' })
  return { ready: errors.length === 0, errors, warnings, pointBuckets }
}

function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function array(value: unknown) { return Array.isArray(value) ? value : [] }
function safeIntent(value: unknown, max = 1200) { return clean(value).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max).trim() }
function asQuestionType(value: unknown): QuestionType | null {
  const allowed: QuestionType[] = ['multiple_choice','true_false','short_answer','constructed_response','identification','fill_in_the_blank','numerical_answer','problem_solving','matching','multiple_select','essay']
  return allowed.includes(value as QuestionType) ? value as QuestionType : null
}

export type FinalizeMasterPlanOptions = {
  pointBuckets: AssessmentV2PointBucket[]
  allowedTypes: QuestionType[]
  learningArea: string
  totalPoints: number
  plannerModel: string
  plannerFallbackUsed?: boolean
  visualPolicy?: AssessmentVisualPolicy
  now?: string
  idFactory?: () => string
}

/**
 * Accept only the AI's bounded design choices. Mapping, point ranges, ordering,
 * and total-point arithmetic are reconstructed locally from the immutable
 * deterministic point buckets.
 */
export function validateAndFinalizeMasterPlan(raw: unknown, options: FinalizeMasterPlanOptions): AssessmentMasterPlan {
  const root = object(raw)
  const rawEntries = array(root.entries)
  if (!rawEntries.length || rawEntries.length > options.totalPoints) throw new Error('The master planner returned an invalid logical question count.')
  const bucketMap = new Map(options.pointBuckets.map((bucket) => [bucket.id, bucket]))
  const remaining = new Map(options.pointBuckets.map((bucket) => [bucket.id, bucket.pointsAllocated]))
  const allowed = new Set(options.allowedTypes)
  const normalized: Array<Omit<AssessmentMasterPlanEntry, 'id'|'itemNumber'|'pointStart'|'pointEnd'|'rowId'|'competencyId'|'cognitiveCategoryId'>> = []
  for (const rawEntry of rawEntries) {
    const value = object(rawEntry)
    const bucketId = clean(value.bucketId)
    const bucket = bucketMap.get(bucketId)
    if (!bucket) throw new Error('The master planner referenced an unknown TOS point bucket.')
    const questionType = asQuestionType(value.questionType)
    if (!questionType || !allowed.has(questionType)) throw new Error('The master planner used a question type that the teacher did not enable.')
    if (!plannerEligibleTypesForCpd([questionType], bucket.cpdKey, options.learningArea).length) throw new Error(`The master planner assigned ${questionType} to an incompatible ${bucket.cpdKey} bucket.`)
    const pointsPossible = Number(value.pointsPossible)
    const rule = QUESTION_TYPE_POINT_RULES[questionType]
    if (!Number.isSafeInteger(pointsPossible) || pointsPossible < rule.min || pointsPossible > rule.max) throw new Error(`The master planner assigned an invalid point value to ${questionType}.`)
    const available = remaining.get(bucketId) ?? 0
    if (pointsPossible > available) throw new Error('The master planner exceeded a deterministic TOS point bucket.')
    remaining.set(bucketId, available - pointsPossible)
    const taskIntent = safeIntent(value.taskIntent)
    if (taskIntent.length < 8) throw new Error('Every planned question needs a concise task intent.')
    const requestedRequirement = value.visualRequirement === 'required' ? 'required' : 'none'
    if (requestedRequirement === 'required' && options.visualPolicy === 'off') throw new Error('The master plan added a visual while the teacher visual policy is Off.')
    if (requestedRequirement === 'required' && !isVisualEligibleArea(options.learningArea)) throw new Error('Automatic required visuals are limited to Mathematics and visual-eligible learning areas (Science, STEM) in Assessment Generation V2.')
    const requirement = requestedRequirement
    const visualIntent = requirement !== 'none' ? safeIntent(value.visualIntent, 700) : ''
    if (requirement !== 'none' && !visualIntent) throw new Error('Every planned visual needs a bounded visual intent.')
    if (requirement === 'none' && safeIntent(value.visualIntent, 700)) throw new Error('Text-only master-plan entries cannot include a visual intent.')
    normalized.push({ bucketId, questionType, pointsPossible, taskIntent, visualRequirement: requirement, visualIntent })
  }
  if ((options.visualPolicy ?? 'off') === 'balanced') {
    const requiredVisuals = normalized.filter((entry) => entry.visualRequirement === 'required').length
    const balancedLimit = normalized.length < 4 ? 0 : Math.floor(normalized.length / 4)
    if (requiredVisuals > balancedLimit) throw new Error(`Balanced visual policy allows at most ${balancedLimit} required visual${balancedLimit === 1 ? '' : 's'} for ${normalized.length} logical questions.`)
  }
  const incomplete = [...remaining.entries()].filter(([, points]) => points !== 0)
  if (incomplete.length) throw new Error('The master planner did not consume every deterministic TOS point bucket exactly.')
  if ((remaining.size && options.pointBuckets.reduce((sum, bucket) => sum + bucket.pointsAllocated, 0)) !== options.totalPoints) throw new Error('The deterministic point blueprint does not match the requested total points.')
  // Group the validated plan into conventional paper sections before learner-
  // facing point ranges are assigned. Bucket identity remains unchanged, so
  // this presentation ordering cannot move points across TOS/CPD allocations.
  const paperOrdered = groupedPaperOrder(normalized)
  let pointCursor = 1
  let fallbackCounter = 0
  const idFactory = options.idFactory ?? (() => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `plan-${++fallbackCounter}`)
  const entries: AssessmentMasterPlanEntry[] = paperOrdered.map((entry, index) => {
    const bucket = bucketMap.get(entry.bucketId)!
    const pointStart = pointCursor
    const pointEnd = pointStart + entry.pointsPossible - 1
    pointCursor = pointEnd + 1
    return {
      id: idFactory(),
      itemNumber: index + 1,
      pointStart,
      pointEnd,
      pointsPossible: entry.pointsPossible,
      bucketId: entry.bucketId,
      rowId: bucket.rowId,
      competencyId: bucket.competencyId,
      cognitiveCategoryId: bucket.cognitiveCategoryId,
      questionType: entry.questionType,
      taskIntent: entry.taskIntent,
      visualRequirement: entry.visualRequirement,
      visualIntent: entry.visualIntent,
    }
  })
  if (pointCursor !== options.totalPoints + 1) throw new Error('The planned point ranges are not exactly contiguous from 1 to total points.')
  return {
    schemaVersion: 1,
    generationVersion: 'v2',
    numberingMode: 'point_ranges',
    totalPoints: options.totalPoints,
    logicalItemCount: entries.length,
    plannerModel: clean(options.plannerModel) || 'unknown',
    plannerFallbackUsed: options.plannerFallbackUsed === true,
    createdAt: options.now ?? new Date().toISOString(),
    pointBuckets: options.pointBuckets.map((bucket) => ({ ...bucket })),
    entries,
  }
}

export function assessmentItemNumberLabel(item: { itemNumber: number; pointStart?: number; pointEnd?: number }, numberingMode: 'legacy_items' | 'point_ranges' = 'legacy_items') {
  if (numberingMode !== 'point_ranges') return String(item.itemNumber)
  const start = Number(item.pointStart)
  const end = Number(item.pointEnd)
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) return String(item.itemNumber)
  return start === end ? String(start) : `${start}–${end}`
}
