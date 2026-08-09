import type { AssessmentItem, AssessmentSettings, QuestionType } from '../types/assessment'

const ASSESSMENT_QUESTION_TYPES: readonly QuestionType[] = [
  'multiple_choice', 'true_false', 'short_answer', 'constructed_response',
  'identification', 'fill_in_the_blank', 'numerical_answer',
  'problem_solving', 'matching', 'multiple_select', 'essay',
]

export type AssessmentTypeAllocation = {
  types: QuestionType[]
  counts: Partial<Record<QuestionType, number>>
  totalSlots: number
  mode: AssessmentSettings['mode']
  warnings: string[]
  requestedCounts?: Partial<Record<QuestionType, number>>
  reconciled: boolean
}

function cleanAllowed(settings: Pick<AssessmentSettings, 'allowedTypes'>) {
  const allowed = [...new Set((settings.allowedTypes ?? []).filter((type): type is QuestionType => ASSESSMENT_QUESTION_TYPES.includes(type)))]
  return allowed.length ? allowed : ['multiple_choice' as QuestionType]
}

function countObject(types: readonly QuestionType[], counts: readonly number[]) {
  return types.reduce<Partial<Record<QuestionType, number>>>((result, type, index) => {
    result[type] = counts[index] ?? 0
    return result
  }, {})
}

/** Stable Hamilton/largest-remainder allocation with declaration-order ties. */
function largestRemainder(totalSlots: number, weights: readonly number[]) {
  const sum = weights.reduce((total, value) => total + Math.max(0, value), 0)
  if (!sum) {
    const base = Math.floor(totalSlots / Math.max(weights.length, 1))
    const remainder = totalSlots - base * weights.length
    return weights.map((_, index) => base + (index < remainder ? 1 : 0))
  }
  const quotas = weights.map((weight) => totalSlots * Math.max(0, weight) / sum)
  const result = quotas.map(Math.floor)
  let remaining = totalSlots - result.reduce((sumValue, value) => sumValue + value, 0)
  const order = quotas.map((quota, index) => ({ index, fraction: quota - result[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const entry of order) {
    if (remaining <= 0) break
    result[entry.index] += 1
    remaining -= 1
  }
  return result
}

function normalizedCount(value: unknown) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : 0
}

export function validateAssessmentTypeDistribution(settings: AssessmentSettings, totalSlots: number) {
  const errors: string[] = []
  if (!Number.isSafeInteger(totalSlots) || totalSlots < 1) errors.push('Total item slots must be a positive whole number.')
  const allowed = cleanAllowed(settings)
  if (settings.allowedTypes.some((type) => !ASSESSMENT_QUESTION_TYPES.includes(type))) errors.push('Allowed question types contain an unsupported type.')
  if (settings.mode === 'fixed_counts') {
    for (const [type, value] of Object.entries(settings.counts ?? {})) {
      if (!allowed.includes(type as QuestionType)) errors.push(`Disabled question type ${type} cannot receive a fixed count.`)
      if (!Number.isSafeInteger(Number(value)) || Number(value) < 0) errors.push(`Question type count for ${type} must be a nonnegative whole number.`)
    }
  }
  if (settings.mode === 'percentages') {
    const values = Object.entries(settings.percentages ?? {})
    for (const [type, value] of values) {
      if (!allowed.includes(type as QuestionType)) errors.push(`Disabled question type ${type} cannot receive a percentage.`)
      if (!Number.isFinite(Number(value)) || Number(value) < 0) errors.push(`Question type percentage for ${type} must be nonnegative.`)
    }
    if (values.length && values.reduce((sum, [, value]) => sum + Number(value), 0) <= 0) errors.push('Question type percentages must contain a positive total.')
  }
  for (const [type, value] of Object.entries(settings.defaultPoints ?? {})) {
    if (!ASSESSMENT_QUESTION_TYPES.includes(type as QuestionType)) errors.push(`Default points contain an unsupported type ${type}.`)
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) errors.push(`Default points for ${type} must be positive.`)
  }
  if (settings.targetTotalPoints !== null && settings.targetTotalPoints !== undefined && (!Number.isFinite(Number(settings.targetTotalPoints)) || Number(settings.targetTotalPoints) < 0)) {
    errors.push('Target total points must be a nonnegative number.')
  }
  return errors
}

/**
 * Allocate exactly `totalSlots` types.  This function only chooses a format;
 * it never changes item-to-TOS mapping and never calculates points with AI.
 */
export function allocateQuestionTypes(totalSlots: number, settings: AssessmentSettings): AssessmentTypeAllocation {
  if (!Number.isSafeInteger(totalSlots) || totalSlots < 1) throw new Error('Total item slots must be a positive whole number.')
  const errors = validateAssessmentTypeDistribution(settings, totalSlots)
  if (errors.length) throw new Error(errors[0])
  const allowed = cleanAllowed(settings)
  const mode = settings.mode ?? 'auto_balanced'
  let counts: number[]
  let reconciled = false
  const warnings: string[] = []
  const requestedCounts = mode === 'fixed_counts'
    ? allowed.reduce<Partial<Record<QuestionType, number>>>((result, type) => { result[type] = normalizedCount(settings.counts?.[type]); return result }, {})
    : undefined
  if (mode === 'fixed_counts') {
    counts = allowed.map((type) => normalizedCount(settings.counts?.[type]))
    const current = counts.reduce((sum, value) => sum + value, 0)
    if (current < totalSlots) {
      // Unallocated slots are spread predictably across enabled types.
      for (let index = current; index < totalSlots; index += 1) counts[index % allowed.length] += 1
      reconciled = true
      warnings.push(`Fixed counts left ${totalSlots - current} slot(s) unallocated; they were distributed deterministically.`)
    } else if (current > totalSlots) {
      // Keep the earliest declared counts first and trim overflow from the end.
      let overflow = current - totalSlots
      for (let index = counts.length - 1; index >= 0 && overflow > 0; index -= 1) {
        const take = Math.min(counts[index], overflow)
        counts[index] -= take
        overflow -= take
      }
      reconciled = true
      warnings.push(`Fixed counts exceeded the available slots; ${current - totalSlots} slot(s) were trimmed deterministically.`)
    }
  } else if (mode === 'percentages') {
    counts = largestRemainder(totalSlots, allowed.map((type) => Number(settings.percentages?.[type] ?? 0)))
  } else {
    // auto_balanced and manual_per_item both use a stable equal distribution
    // until the teacher explicitly chooses a type for an individual item.
    counts = largestRemainder(totalSlots, allowed.map(() => 1))
  }
  const types: QuestionType[] = []
  allowed.forEach((type, index) => {
    for (let offset = 0; offset < counts[index]; offset += 1) types.push(type)
  })
  return {
    types,
    counts: countObject(allowed, counts),
    totalSlots,
    mode,
    warnings: [...warnings, ...(types.length === totalSlots ? [] : ['Distribution was reconciled to the exact item-slot total.'])],
    requestedCounts,
    reconciled,
  }
}

export const allocateQuestionTypeDistribution = allocateQuestionTypes
export const allocateQuestionTypeCounts = (totalSlots: number, settings: AssessmentSettings) => allocateQuestionTypes(totalSlots, settings).counts

function emptyAnswer(type: QuestionType) {
  if (type === 'true_false') return { type: 'true_false' as const, value: false }
  if (type === 'short_answer') return { type: 'short_answer' as const, acceptedAnswers: [], caseSensitive: false }
  if (type === 'identification') return { type: 'identification' as const, acceptedAnswers: [], caseSensitive: false }
  if (type === 'fill_in_the_blank') return { type: 'fill_in_the_blank' as const, blanks: [] }
  if (type === 'numerical_answer') return { type: 'numerical_answer' as const, value: 0, tolerance: 0 }
  if (type === 'problem_solving') return { type: 'problem_solving' as const, finalAnswer: '', solutionOutline: '' }
  if (type === 'matching') return { type: 'matching' as const, prompts: [], choices: [], mappings: [], reusableChoices: false }
  if (type === 'multiple_select') return { type: 'multiple_select' as const, choices: [], choiceIds: [], scoringPolicy: 'all_or_nothing' as const }
  if (type === 'essay') return { type: 'essay' as const, keyPoints: [] }
  if (type === 'constructed_response') return { type: 'constructed_response' as const, expectedResponse: '', sampleResponse: '' }
  return { type: 'multiple_choice' as const, choices: [], choiceId: '' }
}

/** Apply only the optional format choice; every immutable TOS field survives. */
export function applyQuestionTypeDistribution(items: readonly AssessmentItem[], settings: AssessmentSettings) {
  const allocation = allocateQuestionTypes(items.length, settings)
  if (settings.mode === 'manual_per_item') return items.map((item) => ({ ...item }))
  return items.map((item, index) => ({ ...item, questionType: allocation.types[index], answer: item.questionType === allocation.types[index] ? item.answer : emptyAnswer(allocation.types[index]) }))
}
