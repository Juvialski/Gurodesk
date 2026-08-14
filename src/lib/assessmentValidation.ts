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
  AssessmentScoringCriterion,
} from '../types/assessment'
import { calculateRubricTotalPoints, validatePerformanceTaskRubric } from './performanceTaskRubric'

function normalizeItemPoints(item: Partial<AssessmentItem>) {
  const raw: unknown = item.pointsPossible ?? item.points
  if (raw === null || raw === undefined || raw === '') return 1
  const value = Number(raw)
  return Number.isFinite(value) ? value : Number.NaN
}

function deriveAssessmentTotalPoints(items: readonly Partial<AssessmentItem>[]) {
  return Math.round(items.reduce((sum, item) => {
    const points = normalizeItemPoints(item)
    return sum + (Number.isFinite(points) && points > 0 ? points : 0)
  }, 0) * 100) / 100
}

// Keep this module usable by the project's lightweight data-URL validator
// harness, which intentionally erases type-only imports without resolving
// runtime modules.
const QUESTION_TYPES: QuestionType[] = [
  'multiple_choice', 'true_false', 'short_answer', 'constructed_response',
  'identification', 'fill_in_the_blank', 'numerical_answer',
  'problem_solving', 'matching', 'multiple_select', 'essay',
]
const AUTHORSHIP_STATES: AssessmentAuthorshipState[] = ['empty', 'ai_suggestion', 'teacher_accepted', 'teacher_edited', 'manual']
const QA_STATES = ['empty', 'generated', 'verified', 'needs_review', 'teacher_edited', 'answer_needs_recheck', 'locked', 'repair_needed'] as const

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
            kind: 'tos',
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

function isV2Assessment(assessment: AssessmentBlueprint) {
  return Number(assessment.settings?.schemaVersion ?? 1) >= 2
    && assessment.settings?.generationVersion === 'v2'
    && assessment.settings?.numberingMode === 'point_ranges'
}

function v2SourceMapping(source: AssessmentTosSnapshot, item: AssessmentItem) {
  const row = source.content.rows.find((candidate) => candidate.id === item.mapping?.rowId)
  if (!row || row.competency.id !== item.mapping?.competencyId) return null
  const allocation = row.cognitiveAllocations.find((candidate) => candidate.categoryId === item.mapping?.cognitiveCategoryId)
  if (!allocation || allocation.itemStart === null || allocation.itemEnd === null || allocation.itemCount < 1) return null
  const category = source.content.cognitiveCategories.find((candidate) => candidate.id === allocation.categoryId) ?? {
    id: allocation.categoryId,
    label: allocation.label,
    shortLabel: allocation.shortLabel,
  }
  return {
    mapping: {
      kind: 'tos',
      rowId: row.id,
      competencyId: row.competency.id,
      cognitiveCategoryId: category.id,
      allocationItemStart: allocation.itemStart,
      allocationItemEnd: allocation.itemEnd,
      allocationIndex: 0,
    },
    competency: {
      id: row.competency.id,
      code: row.competency.code,
      text: row.competency.text,
      sourcePage: row.competency.sourcePage,
      academicPeriodId: row.competency.academicPeriodId,
      curriculumPeriodId: row.competency.academicPeriodId,
      curriculumPeriodLabel: row.competency.curriculumPeriodLabel,
    },
    category: { id: category.id, label: category.label, shortLabel: category.shortLabel },
  }
}

function answerError(answer: AssessmentAnswer | undefined, questionType: QuestionType, item: AssessmentItem): string[] {
  if (!answer || typeof answer !== 'object') return ['Answer must be configured.']
  if (answer.type !== questionType) return [`Answer type "${answer.type}" does not match question type "${questionType}".`]
  const totalItemPoints = normalizeItemPoints(item)
  if (answer.type === 'multiple_choice') {
    if (!Array.isArray(answer.choices) || answer.choices.length < 2) return ['Multiple choice questions require at least 2 choices.']
    if (answer.choices.some((choice) => !choice || typeof choice.text !== 'string' || !choice.text.trim())) return ['Multiple choice choices cannot be empty.']
    const choiceIds = new Set(answer.choices.map((choice) => choice.id))
    if (choiceIds.size !== answer.choices.length) return ['Multiple choice choice IDs must be unique.']
    if (!answer.choiceId || !choiceIds.has(answer.choiceId)) return ['Multiple choice correct choice must select an existing choice.']
    const textSet = new Set<string>()
    for (const choice of answer.choices) {
      const normalized = choice.text.trim().toLowerCase()
      if (textSet.has(normalized)) return ['Multiple choice choices cannot be duplicate.']
      textSet.add(normalized)
    }
    return []
  }
  if (answer.type === 'true_false') {
    if (typeof answer.value !== 'boolean') return ['True/False questions require a boolean answer.']
    return []
  }
  if (answer.type === 'short_answer') {
    if (!Array.isArray(answer.acceptedAnswers) || !answer.acceptedAnswers.length) return ['Short answer questions require at least one accepted answer.']
    if (answer.acceptedAnswers.some((entry) => typeof entry !== 'string' || !entry.trim())) return ['Accepted short answers cannot be blank.']
    const textSet = new Set<string>()
    for (const text of answer.acceptedAnswers) {
      const normalized = answer.caseSensitive ? text.trim() : text.trim().toLowerCase()
      if (textSet.has(normalized)) return ['Accepted short answers cannot be duplicate.']
      textSet.add(normalized)
    }
    return []
  }
  if (answer.type === 'identification') {
    if (!Array.isArray(answer.acceptedAnswers) || !answer.acceptedAnswers.length) return ['Identification questions require at least one accepted answer.']
    if (answer.acceptedAnswers.some((entry) => typeof entry !== 'string' || !entry.trim())) return ['Accepted identification answers cannot be blank.']
    const textSet = new Set<string>()
    for (const text of answer.acceptedAnswers) {
      const normalized = answer.caseSensitive ? text.trim() : text.trim().toLowerCase()
      if (textSet.has(normalized)) return ['Accepted identification answers cannot be duplicate.']
      textSet.add(normalized)
    }
    return []
  }
  if (answer.type === 'fill_in_the_blank') {
    if (!Array.isArray(answer.blanks) || !answer.blanks.length) return ['Fill-in-the-blank questions require at least one blank.']
    const blankIds = new Set<string>()
    let hasExplicitPoints = false
    let explicitPointsSum = 0
    let missingExplicitPoints = 0
    for (const blank of answer.blanks) {
      if (!blank || typeof blank.id !== 'string' || !blank.id.trim()) return ['Every blank must have a unique ID.']
      if (blankIds.has(blank.id)) return ['Blank IDs must be unique within a question.']
      blankIds.add(blank.id)
      if (!Array.isArray(blank.acceptedAnswers) || !blank.acceptedAnswers.length) return ['Every blank requires at least one accepted answer.']
      if (blank.acceptedAnswers.some((entry) => typeof entry !== 'string' || !entry.trim())) return ['Blank accepted answers cannot be blank.']
      if (blank.pointsPossible !== undefined && blank.pointsPossible !== null) {
        hasExplicitPoints = true
        const pts = Number(blank.pointsPossible)
        if (!Number.isFinite(pts) || pts <= 0) return ['Explicit blank points must be positive.']
        explicitPointsSum += pts
      } else {
        missingExplicitPoints += 1
      }
    }
    if (hasExplicitPoints) {
      if (missingExplicitPoints > 0) return ['If any blank specifies points, every blank must specify points.']
      if (Math.abs(explicitPointsSum - totalItemPoints) > 0.001) {
        return [`Sum of blank points (${explicitPointsSum}) must equal the item points (${totalItemPoints}).`]
      }
    }
    return []
  }
  if (answer.type === 'numerical_answer') {
    if (typeof answer.value !== 'number' || !Number.isFinite(answer.value)) return ['Numerical answer requires a valid number.']
    if (answer.tolerance !== undefined && (typeof answer.tolerance !== 'number' || answer.tolerance < 0 || !Number.isFinite(answer.tolerance))) {
      return ['Numerical tolerance must be a nonnegative number.']
    }
    return []
  }
  if (answer.type === 'problem_solving') {
    if (answer.finalAnswer === undefined || answer.finalAnswer === null || String(answer.finalAnswer).trim() === '') {
      return ['Problem solving questions require a final answer.']
    }
    if (Array.isArray(answer.subparts) && answer.subparts.length > 0) {
      let subpartsSum = 0
      for (const subpart of answer.subparts) {
        if (!subpart || typeof subpart.prompt !== 'string' || !subpart.prompt.trim()) return ['Every subpart requires a prompt.']
        const pts = Number(subpart.pointsPossible)
        if (!Number.isFinite(pts) || pts <= 0) return ['Subpart points must be positive.']
        subpartsSum += pts
      }
      if (Math.abs(subpartsSum - totalItemPoints) > 0.001) {
        return [`Sum of subpart points (${subpartsSum}) must equal the item points (${totalItemPoints}).`]
      }
    }
    return []
  }
  if (answer.type === 'matching') {
    if (!Array.isArray(answer.prompts) || answer.prompts.length < 2) return ['Matching questions require at least 2 prompts.']
    if (!Array.isArray(answer.choices) || answer.choices.length < 2) return ['Matching questions require at least 2 choices.']
    if (!Array.isArray(answer.mappings) || answer.mappings.length < 2) return ['Matching questions require at least 2 mappings.']
    const promptIds = new Set(answer.prompts.map((p) => p.id))
    const choiceIds = new Set(answer.choices.map((c) => c.id))
    const mappedPromptIds = new Set<string>()
    const mappedChoiceIds = new Set<string>()
    let hasExplicitMatchPoints = false
    let matchPointsSum = 0
    let missingMatchPoints = 0
    for (const mapping of answer.mappings) {
      if (!promptIds.has(mapping.promptId)) return ['Matching prompt mapping references an unknown prompt ID.']
      if (!choiceIds.has(mapping.choiceId)) return ['Matching choice mapping references an unknown choice ID.']
      if (mappedPromptIds.has(mapping.promptId)) return ['Each matching prompt can only be mapped once.']
      mappedPromptIds.add(mapping.promptId)
      if (!answer.reusableChoices && mappedChoiceIds.has(mapping.choiceId)) {
        return ['Matching choice cannot be mapped more than once unless reusableChoices is true.']
      }
      mappedChoiceIds.add(mapping.choiceId)
      if (mapping.pointsPossible !== undefined && mapping.pointsPossible !== null) {
        hasExplicitMatchPoints = true
        const pts = Number(mapping.pointsPossible)
        if (!Number.isFinite(pts) || pts <= 0) return ['Explicit match points must be positive.']
        matchPointsSum += pts
      } else {
        missingMatchPoints += 1
      }
    }
    if (hasExplicitMatchPoints) {
      if (missingMatchPoints > 0) return ['If any match specifies points, every scored match must specify points.']
      if (Math.abs(matchPointsSum - totalItemPoints) > 0.001) {
        return [`Sum of match points (${matchPointsSum}) must equal the item points (${totalItemPoints}).`]
      }
    }
    return []
  }
  if (answer.type === 'multiple_select') {
    if (!Array.isArray(answer.choices) || answer.choices.length < 2) return ['Multiple select questions require at least 2 choices.']
    if (!Array.isArray(answer.choiceIds) || answer.choiceIds.length === 0) return ['Multiple select questions require at least one correct choice.']
    const choiceIds = new Set(answer.choices.map((c) => c.id))
    if (answer.choiceIds.some((id) => !choiceIds.has(id))) return ['Multiple select correct choice IDs must exist in choices.']
    return []
  }
  if (answer.type === 'constructed_response') {
    if (typeof answer.expectedResponse !== 'string' || !answer.expectedResponse.trim()) return ['Constructed response questions require an expected response.']
    return []
  }
  if (answer.type === 'essay') {
    if (!Array.isArray(answer.keyPoints) || !answer.keyPoints.length) return ['Essay questions require at least one key point.']
    if (Array.isArray(answer.rubric) && answer.rubric.length > 0) {
      let rubricSum = 0
      for (const crit of answer.rubric) {
        if (!crit || typeof crit.label !== 'string' || !crit.label.trim()) return ['Every essay rubric criterion requires a label.']
        const pts = Number(crit.pointsPossible)
        if (!Number.isFinite(pts) || pts <= 0) return ['Essay rubric criterion points must be positive.']
        rubricSum += pts
      }
      if (Math.abs(rubricSum - totalItemPoints) > 0.001) {
        return [`Sum of essay rubric points (${rubricSum}) must equal the item points (${totalItemPoints}).`]
      }
    }
    return []
  }
  return []
}

function assessmentVisualErrors(visual: unknown): string[] {
  if (!visual || typeof visual !== 'object') return []
  const v = visual as Record<string, unknown>
  if (typeof v.tikzSource !== 'string' || !v.tikzSource.trim()) return ['Diagram visual must have valid TikZ source.']
  return []
}

function validateCommon(
  assessment: AssessmentBlueprint,
  mode: 'draft' | 'final',
): AssessmentValidationResult {
  const errors: AssessmentValidationIssue[] = []
  const warnings: AssessmentValidationIssue[] = []

  const add = (key: string, message: string, item?: AssessmentItem, isWarning = false) => {
    const target = isWarning ? warnings : errors
    target.push(issue(key, message, item, isWarning ? 'warning' : 'error'))
  }

  if (!assessment) {
    add('blueprint', 'Assessment blueprint is required.')
    return { ready: false, errors, warnings }
  }

  const isPerfTask = assessment.mode === 'performance_task' || Boolean(assessment.performanceTask)
  const isLessonQuiz = assessment.mode === 'lesson_quiz'
  const isUnitQuiz = assessment.mode === 'unit_quiz'
  const isTosBased = !isPerfTask && !isLessonQuiz && !isUnitQuiz

  if (!assessment.title || !assessment.title.trim()) add('title', 'Assessment title is required.')
  if (!assessment.schoolYear || !assessment.schoolYear.trim()) add('schoolYear', 'School year is required.')

  // ---------------------------------------------------------
  // Performance Task Specific Validation
  // ---------------------------------------------------------
  if (isPerfTask) {
    const pt = assessment.performanceTask
    if (!pt) {
      add('performance-task', 'Performance Task content is missing.')
    } else {
      if (!pt.title || !pt.title.trim()) add('performance-task-title', 'Performance Task title is required.')
      if (!pt.scenario || !pt.scenario.trim()) add('performance-task-scenario', 'Performance Task scenario is required.', undefined, mode === 'draft')
      if (!pt.studentInstructions || !pt.studentInstructions.trim()) add('performance-task-instructions', 'Student instructions are required.', undefined, mode === 'draft')
      if (!pt.expectedOutput || !pt.expectedOutput.trim()) add('performance-task-output', 'Expected output/product is required.', undefined, mode === 'draft')

      const rubricResult = validatePerformanceTaskRubric(pt.rubric)
      rubricResult.errors.forEach((e) => add(`rubric-${e.field}`, e.message))
      rubricResult.warnings.forEach((w) => add(`rubric-${w.field}`, w.message, undefined, true))

      const totalRubricPts = pt.rubric?.totalPoints ?? calculateRubricTotalPoints(pt.rubric)
      if (totalRubricPts <= 0) add('rubric-points', 'Performance Task rubric must have positive total points.')
    }
    return { ready: errors.length === 0 && warnings.length === 0, errors, warnings }
  }

  // ---------------------------------------------------------
  // Lesson Quiz & Unit Quiz Specific Validation
  // ---------------------------------------------------------
  if (isLessonQuiz) {
    if (!assessment.sourceLesson) {
      add('source-lesson', 'Lesson Quiz requires a source lesson plan snapshot.')
    }
  }

  if (isUnitQuiz) {
    if (!assessment.sourceLessons || assessment.sourceLessons.length < 2) {
      add('source-lessons', 'Unit Quiz requires at least 2 source lesson plan snapshots.')
    } else {
      const primaryGrade = assessment.sourceLessons[0].gradeLevel
      const primarySubject = assessment.sourceLessons[0].learningArea
      for (let i = 1; i < assessment.sourceLessons.length; i += 1) {
        const candidate = assessment.sourceLessons[i]
        if (candidate.gradeLevel && primaryGrade && candidate.gradeLevel.toLowerCase() !== primaryGrade.toLowerCase()) {
          add('unit-grade-mismatch', `All lessons in a Unit Quiz must have the same grade level (found "${primaryGrade}" and "${candidate.gradeLevel}").`)
        }
        if (candidate.learningArea && primarySubject && candidate.learningArea.toLowerCase() !== primarySubject.toLowerCase()) {
          add('unit-subject-mismatch', `All lessons in a Unit Quiz must have the same learning area (found "${primarySubject}" and "${candidate.learningArea}").`)
        }
      }
    }
  }

  // ---------------------------------------------------------
  // Item-Based Assessments Validation (TOS, Lesson, Unit)
  // ---------------------------------------------------------
  const expectedItemCount = isTosBased ? Number(assessment.sourceTos?.content.totalItems ?? assessment.totalItems) : assessment.items.length
  if (!Number.isSafeInteger(expectedItemCount) || expectedItemCount < 1) {
    add('total-items', 'Assessment must contain at least one item.')
  }

  if (assessment.items.length !== expectedItemCount) {
    add('item-count', `Assessment item count (${assessment.items.length}) does not match expected total (${expectedItemCount}).`)
  }

  const settings = assessment.settings
  const allowedTypes = new Set<QuestionType>(settings?.allowedTypes ?? QUESTION_TYPES)

  if (settings) {
    for (const [type, count] of Object.entries(settings.counts ?? {})) {
      if (!QUESTION_TYPES.includes(type as QuestionType) || !allowedTypes.has(type as QuestionType)) add('distribution-disabled-type', `Disabled question type ${type} cannot receive a count.`)
      if (!Number.isSafeInteger(Number(count)) || Number(count) < 0) add('distribution-count', `Question type count for ${type} must be a nonnegative whole number.`)
    }
    for (const [type, percentage] of Object.entries(settings.percentages ?? {})) {
      if (!QUESTION_TYPES.includes(type as QuestionType) || !allowedTypes.has(type as QuestionType)) add('distribution-disabled-type', `Disabled question type ${type} cannot receive a percentage.`)
      if (!Number.isFinite(Number(percentage)) || Number(percentage) < 0) add('distribution-percentage', `Question type percentage for ${type} must be nonnegative.`)
    }
  }

  const numbers = new Set<number>()
  const pointRanges = new Set<string>()
  let pointCursor = 1
  const v2 = isTosBased && isV2Assessment(assessment)
  const masterPlan = v2 ? assessment.settings?.masterPlan : undefined

  for (const item of assessment.items) {
    if (!Number.isSafeInteger(item.itemNumber) || item.itemNumber < 1 || item.itemNumber > expectedItemCount) add('item-number', 'Logical question number must be a whole number within 1..N.', item)
    if (numbers.has(item.itemNumber)) add('duplicate-item-number', 'Logical question numbers must not be duplicated.', item)
    numbers.add(item.itemNumber)
    if (v2) {
      const points = normalizeItemPoints(item)
      if (!Number.isSafeInteger(item.pointStart) || !Number.isSafeInteger(item.pointEnd) || item.pointStart !== pointCursor || item.pointEnd !== item.pointStart + points - 1) add('point-range', 'V2 point ranges must be whole-number, contiguous, and exactly match pointsPossible.', item)
      const rangeKey = `${item.pointStart}-${item.pointEnd}`
      if (pointRanges.has(rangeKey)) add('duplicate-point-range', 'V2 point ranges must not be duplicated.', item)
      pointRanges.add(rangeKey)
      if (Number.isSafeInteger(item.pointEnd)) pointCursor = Number(item.pointEnd) + 1
    }
  }
  for (let itemNumber = 1; itemNumber <= expectedItemCount; itemNumber += 1) {
    if (!numbers.has(itemNumber)) add('item-number-gap', `Logical question ${itemNumber} is missing.`)
  }
  if (v2 && pointCursor !== Number(masterPlan?.totalPoints) + 1) add('point-range-total', 'V2 point ranges must cover exactly 1 through the frozen total-points value.')

  const expected = isTosBased ? (v2 ? new Map() : expectedMappings(assessment.sourceTos!)) : new Map()
  if (isTosBased && assessment.sourceTos) {
    const sourcePlacement = sourcePlacementStatus(assessment.sourceTos)
    const sourceNumbers = [...sourcePlacement.numbers].sort((a, b) => a - b)
    const sourceTotal = Number(assessment.sourceTos.content.totalItems)
    if (sourcePlacement.duplicate || (!v2 && (expected.size !== sourceTotal || sourceNumbers.length !== sourceTotal || sourceNumbers.some((number, index) => number !== index + 1)))) add('source-blueprint', 'The source TOS ranges are invalid or overlapping.')
  }

  const seenMappings = new Set<string>()
  const planEntries = new Map((masterPlan?.entries ?? []).map((entry) => [entry.itemNumber, entry]))
  for (const item of assessment.items) {
    if (isTosBased && assessment.sourceTos) {
      const expectedItem = v2 ? v2SourceMapping(assessment.sourceTos, item) : expected.get(item.itemNumber)
      if (!expectedItem) {
        add('unmapped-item', 'Every question must map to an allocated source TOS row and cognitive category.', item)
        continue
      }
      const mappingKey = `${item.mapping?.rowId ?? ''}|${item.mapping?.cognitiveCategoryId ?? ''}|${item.itemNumber}`
      if (seenMappings.has(mappingKey)) add('duplicate-mapping', 'Question mappings must not be duplicated.', item)
      seenMappings.add(mappingKey)
      if (v2) {
        const planEntry = planEntries.get(item.itemNumber)
        if (!planEntry || item.planEntryId !== planEntry.id || item.pointStart !== planEntry.pointStart || item.pointEnd !== planEntry.pointEnd || normalizeItemPoints(item) !== planEntry.pointsPossible || item.questionType !== planEntry.questionType || item.mapping.rowId !== planEntry.rowId || item.mapping.competencyId !== planEntry.competencyId || item.mapping.cognitiveCategoryId !== planEntry.cognitiveCategoryId) add('master-plan-item', 'This V2 question no longer matches its frozen master-plan entry.', item)
        if (item.mapping.allocationItemStart !== expectedItem.mapping.allocationItemStart || item.mapping.allocationItemEnd !== expectedItem.mapping.allocationItemEnd || item.mapping.rowId !== expectedItem.mapping.rowId || item.mapping.competencyId !== expectedItem.mapping.competencyId || item.mapping.cognitiveCategoryId !== expectedItem.mapping.cognitiveCategoryId) add('mapping-mismatch', 'Question mapping must remain inside its immutable source TOS competency/CPD allocation.', item)
      } else if (!same(item.mapping, expectedItem.mapping)) add('mapping-mismatch', 'Item mapping must exactly match the immutable source TOS blueprint.', item)
      if (!same(item.competencySnapshot, expectedItem.competency)) add('competency-snapshot', 'The competency snapshot no longer matches the source TOS row.', item)
      if (!same(item.cognitiveCategorySnapshot, expectedItem.category)) add('cognitive-snapshot', 'The cognitive-category snapshot no longer matches the source TOS allocation.', item)
    } else if (isLessonQuiz || isUnitQuiz) {
      if (!item.competencySnapshot || !item.competencySnapshot.text) add('competency-snapshot', 'Question must include a valid competency alignment snapshot.', item)
      if (!item.cognitiveCategorySnapshot || !item.cognitiveCategorySnapshot.id) add('cognitive-snapshot', 'Question must include a cognitive category alignment snapshot.', item)
    }

    if (!QUESTION_TYPES.includes(item.questionType)) add('question-type', 'Question type is not supported.', item)
    if (!allowedTypes.has(item.questionType)) add('disabled-question-type', 'This item uses a question type disabled for the assessment.', item)
    if (!AUTHORSHIP_STATES.includes(item.authorshipState)) add('authorship-state', 'Authorship state must be empty, ai_suggestion, teacher_accepted, teacher_edited, or manual.', item)
    if (item.qaState !== undefined && !QA_STATES.includes(item.qaState)) add('qa-state', 'Question QA state is invalid.', item)
    if (item.locked === true && item.qaState !== undefined && item.qaState !== 'locked') add('lock-state', 'Locked items must use the locked QA state.', item)
    if (mode === 'final' && (item.authorshipState === 'empty' || item.authorshipState === 'ai_suggestion')) add('teacher-review', 'Final assessments require teacher_accepted, teacher_edited, or manual authorship state.', item)
    if (!item.prompt.trim()) add('prompt', 'Question prompt is required.', item, true)
    const points = Number(item.pointsPossible ?? item.points)
    if (mode === 'final' && (!Number.isFinite(points) || points <= 0)) add('points', 'Final questions require positive points.', item)
    if (mode === 'draft' && (!Number.isFinite(points) || points <= 0)) add('points', 'Questions should have positive points before finalization.', item, true)
    answerError(item.answer, item.questionType, item).forEach((message) => add('structured-answer', message, item, mode === 'draft'))
    if (item.visual !== undefined) assessmentVisualErrors(item.visual).forEach((message) => add('visual', message, item, mode === 'draft'))
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
