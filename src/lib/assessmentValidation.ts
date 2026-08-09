import type {
  AssessmentAnswer,
  AssessmentAuthorshipState,
  AssessmentBlueprint,
  AssessmentItem,
  AssessmentItemMapping,
  AssessmentTosSnapshot,
  AssessmentValidationIssue,
  AssessmentValidationResult,
  QuestionType,
} from '../types/assessment'

const QUESTION_TYPES: QuestionType[] = ['multiple_choice', 'true_false', 'short_answer', 'constructed_response']
const AUTHORSHIP_STATES: AssessmentAuthorshipState[] = ['empty', 'ai_suggestion', 'teacher_accepted', 'teacher_edited', 'manual']

/** Central registry keeps question-type validation extensible as new structured unions are added. */
export const SUPPORTED_ASSESSMENT_QUESTION_TYPES = [...QUESTION_TYPES] as const
export function isSupportedAssessmentQuestionType(value: unknown): value is QuestionType {
  return typeof value === 'string' && QUESTION_TYPES.includes(value as QuestionType)
}

function issue(
  key: string,
  message: string,
  item: AssessmentItem | undefined,
  severity: 'error' | 'warning',
): AssessmentValidationIssue {
  return { key, message, severity, itemId: item?.id, itemNumber: item?.itemNumber }
}

function same(valueA: unknown, valueB: unknown) {
  return JSON.stringify(valueA) === JSON.stringify(valueB)
}

function expectedMappings(source: AssessmentTosSnapshot) {
  const result = new Map<number, { mapping: AssessmentItemMapping; competency: AssessmentItem['competencySnapshot']; category: AssessmentItem['cognitiveCategorySnapshot'] }>()
  const content = source.content
  const rows = [...content.rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, 'en'))
  rows.forEach((row) => {
    const allocations = [...row.cognitiveAllocations].sort((a, b) => (a.itemStart ?? Number.MAX_SAFE_INTEGER) - (b.itemStart ?? Number.MAX_SAFE_INTEGER) || a.categoryId.localeCompare(b.categoryId, 'en'))
    allocations.forEach((allocation) => {
      if (!allocation.itemCount || allocation.itemStart === null || allocation.itemEnd === null) return
      const category = content.cognitiveCategories.find((candidate) => candidate.id === allocation.categoryId) ?? {
        id: allocation.categoryId,
        label: allocation.label,
        shortLabel: allocation.shortLabel,
      }
      const competency = {
        id: row.competency.id,
        code: row.competency.code,
        text: row.competency.text,
        sourcePage: row.competency.sourcePage,
        academicPeriodId: row.competency.academicPeriodId,
        curriculumPeriodId: row.competency.academicPeriodId,
        curriculumPeriodLabel: row.competency.curriculumPeriodLabel,
      }
      for (let itemNumber = allocation.itemStart; itemNumber <= allocation.itemEnd; itemNumber += 1) {
        result.set(itemNumber, {
          mapping: {
            rowId: row.id,
            competencyId: row.competency.id,
            cognitiveCategoryId: category.id,
            allocationItemStart: allocation.itemStart,
            allocationItemEnd: allocation.itemEnd,
            allocationIndex: itemNumber - allocation.itemStart,
          },
          competency,
          category: { id: category.id, label: category.label, shortLabel: category.shortLabel },
        })
      }
    })
  })
  return result
}

function sourcePlacementStatus(source: AssessmentTosSnapshot) {
  const numbers = new Set<number>()
  let duplicate = false
  source.content.rows.forEach((row) => row.cognitiveAllocations.forEach((allocation) => {
    if (!allocation.itemCount || allocation.itemStart === null || allocation.itemEnd === null) return
    for (let itemNumber = allocation.itemStart; itemNumber <= allocation.itemEnd; itemNumber += 1) {
      if (numbers.has(itemNumber)) duplicate = true
      numbers.add(itemNumber)
    }
  }))
  return { numbers, duplicate }
}

function answerError(answer: AssessmentAnswer | undefined, questionType: QuestionType, item: AssessmentItem) {
  const errors: string[] = []
  if (!answer || answer.type !== questionType) return [`The structured answer must match ${questionType}.`]
  if (answer.type === 'multiple_choice') {
    const choices = answer.choices
    // 2–6 choices is a product safety range/good practice for this exporter,
    // not a claim about a nationwide DepEd requirement.
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 6) errors.push('Multiple-choice questions require 2–6 choices.')
    const choiceIds = new Set<string>()
    const choiceTexts = new Set<string>()
    for (const choice of choices ?? []) {
      const id = typeof choice?.id === 'string' ? choice.id.trim() : ''
      const text = typeof choice?.text === 'string' ? choice.text.trim() : ''
      if (!id || !text) errors.push('Every multiple-choice option needs a nonblank ID and text.')
      if (choiceIds.has(id)) errors.push('Multiple-choice option IDs must be unique.')
      if (choiceTexts.has(text.toLocaleLowerCase('en'))) errors.push('Multiple-choice option text must be unique without case differences.')
      choiceIds.add(id); choiceTexts.add(text.toLocaleLowerCase('en'))
    }
    const correct = typeof answer.choiceId === 'string' ? answer.choiceId.trim() : ''
    if (!correct || !choiceIds.has(correct)) errors.push('The correct multiple-choice option must reference an existing choice ID.')
  } else if (answer.type === 'true_false') {
    if (typeof answer.value !== 'boolean') errors.push('A true/false answer must be a boolean.')
  } else if (answer.type === 'short_answer') {
    if (!Array.isArray(answer.acceptedAnswers) || answer.acceptedAnswers.length === 0) errors.push('Short-answer questions require at least one accepted answer.')
    const values = (answer.acceptedAnswers ?? []).map((value) => typeof value === 'string' ? value.trim() : '')
    if (values.some((value) => !value)) errors.push('Accepted short answers must be nonblank.')
    const unique = new Set(values.map((value) => answer.caseSensitive ? value : value.toLocaleLowerCase('en')))
    if (unique.size !== values.length) errors.push('Accepted short answers must be unique without case differences.')
    if (answer.caseSensitive !== undefined && typeof answer.caseSensitive !== 'boolean') errors.push('Short-answer case sensitivity must be boolean when provided.')
  } else {
    if (typeof answer.expectedResponse !== 'string' || !answer.expectedResponse.trim()) errors.push('Constructed-response questions require a nonblank expected response.')
    if (typeof answer.sampleResponse !== 'string' || !answer.sampleResponse.trim()) errors.push('Constructed-response questions require a nonblank sample response.')
    if (answer.rubricGuidance !== undefined && typeof answer.rubricGuidance !== 'string') errors.push('Constructed-response rubric guidance must be text when provided.')
  }
  return errors
}

function validateCommon(assessment: AssessmentBlueprint, mode: 'draft' | 'final'): AssessmentValidationResult {
  const errors: AssessmentValidationIssue[] = []
  const warnings: AssessmentValidationIssue[] = []
  const add = (key: string, message: string, item?: AssessmentItem, incomplete = false) => {
    const severity = mode === 'draft' && incomplete ? 'warning' : 'error'
    const target = issue(key, message, item, severity)
    if (severity === 'warning') warnings.push(target)
    else errors.push(target)
  }

  if (!assessment.sourceTos || assessment.sourceTos.status !== 'final') add('source-tos', 'The assessment must retain a finalized source TOS snapshot.')
  const sourceTotal = Number(assessment.sourceTos?.content?.totalItems)
  if (!Number.isSafeInteger(sourceTotal) || sourceTotal < 1) add('source-total', 'The source TOS total must be a positive whole number.')
  if (assessment.totalItems !== sourceTotal) add('total-items', 'Assessment totalItems must exactly match the source TOS total.')
  if (assessment.items.length !== sourceTotal) add('item-count', `Assessment must contain exactly ${sourceTotal} item(s).`)
  if (!assessment.title.trim()) add('title', 'Assessment title is required.', undefined, true)
  if (!assessment.learningArea.trim()) add('learning-area', 'Learning area is required.', undefined, true)

  const numbers = new Set<number>()
  for (const item of assessment.items) {
    if (!Number.isSafeInteger(item.itemNumber) || item.itemNumber < 1 || item.itemNumber > sourceTotal) add('item-number', 'Item number must be a whole number within 1..N.', item)
    if (numbers.has(item.itemNumber)) add('duplicate-item-number', 'Item numbers must not be duplicated.', item)
    numbers.add(item.itemNumber)
  }
  for (let itemNumber = 1; itemNumber <= sourceTotal; itemNumber += 1) {
    if (!numbers.has(itemNumber)) add('item-number-gap', `Item number ${itemNumber} is missing.`)
  }

  const expected = expectedMappings(assessment.sourceTos)
  const sourcePlacement = sourcePlacementStatus(assessment.sourceTos)
  const sourceNumbers = [...sourcePlacement.numbers].sort((a, b) => a - b)
  if (sourcePlacement.duplicate || expected.size !== sourceTotal || sourceNumbers.length !== sourceTotal || sourceNumbers.some((number, index) => number !== index + 1)) add('source-blueprint', 'The source TOS ranges do not map exactly to 1..N.')
  const seenMappings = new Set<string>()
  for (const item of assessment.items) {
    const expectedItem = expected.get(item.itemNumber)
    if (!expectedItem) {
      add('unmapped-item', 'Every item must map to an allocated source TOS row and cognitive category.', item)
      continue
    }
    const mappingKey = `${item.mapping?.rowId ?? ''}|${item.mapping?.cognitiveCategoryId ?? ''}|${item.itemNumber}`
    if (seenMappings.has(mappingKey)) add('duplicate-mapping', 'Item mappings must not be duplicated.', item)
    seenMappings.add(mappingKey)
    if (!same(item.mapping, expectedItem.mapping)) add('mapping-mismatch', 'Item mapping must exactly match the immutable source TOS blueprint.', item)
    if (!same(item.competencySnapshot, expectedItem.competency)) add('competency-snapshot', 'The competency snapshot no longer matches the source TOS row.', item)
    if (!same(item.cognitiveCategorySnapshot, expectedItem.category)) add('cognitive-snapshot', 'The cognitive-category snapshot no longer matches the source TOS allocation.', item)

    if (!QUESTION_TYPES.includes(item.questionType)) add('question-type', 'Question type is not supported.', item)
    if (!AUTHORSHIP_STATES.includes(item.authorshipState)) add('authorship-state', 'Authorship state must be empty, ai_suggestion, teacher_accepted, teacher_edited, or manual.', item)
    if (mode === 'final' && (item.authorshipState === 'empty' || item.authorshipState === 'ai_suggestion')) add('teacher-review', 'Final assessments require teacher_accepted, teacher_edited, or manual authorship state.', item)
    if (!item.prompt.trim()) add('prompt', 'Question prompt is required.', item, true)
    if (mode === 'final' && (!Number.isFinite(item.points) || (item.points ?? 0) <= 0)) add('points', 'Final questions require positive points.', item)
    if (mode === 'draft' && (!Number.isFinite(item.points) || (item.points ?? 0) <= 0)) add('points', 'Questions should have positive points before finalization.', item, true)
    answerError(item.answer, item.questionType, item).forEach((message) => add('structured-answer', message, item, mode === 'draft'))
  }

  return { ready: errors.length === 0 && warnings.length === 0, errors, warnings }
}

export function validateAssessmentDraft(assessment: AssessmentBlueprint): AssessmentValidationResult {
  return validateCommon(assessment, 'draft')
}

export function validateAssessmentFinal(assessment: AssessmentBlueprint): AssessmentValidationResult {
  const result = validateCommon(assessment, 'final')
  if (assessment.status !== 'final') result.errors.push(issue('status', 'Only an assessment marked final can pass final validation.', undefined, 'error'))
  return { ...result, ready: result.errors.length === 0 && result.warnings.length === 0 }
}

export function validateAssessment(assessment: AssessmentBlueprint, mode: 'draft' | 'final' = assessment.status === 'final' ? 'final' : 'draft') {
  return mode === 'final' ? validateAssessmentFinal(assessment) : validateAssessmentDraft(assessment)
}

export function isAssessmentReadyForFinalization(assessment: AssessmentBlueprint) {
  const result = validateCommon({ ...assessment, status: 'final' }, 'final')
  return result.errors.length === 0 && result.warnings.length === 0
}
