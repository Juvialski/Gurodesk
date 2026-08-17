import type {
  Assessment,
  AssessmentAnswer,
  AssessmentAuthorshipState,
  AssessmentBlueprint,
  AssessmentCognitiveCategorySnapshot,
  AssessmentCompetencySnapshot,
  AssessmentCoveragePlan,
  AssessmentFactoryOptions,
  AssessmentItem,
  AssessmentItemMapping,
  AssessmentLessonSourceSnapshot,
  AssessmentMasterPlan,
  AssessmentMode,
  AssessmentSettings,
  AssessmentSourceType,
  AssessmentTosSnapshot,
  LessonCoverageItemMapping,
  PerformanceTaskContent,
  QuestionType,
  TosAssessmentItemMapping,
} from '../types/assessment'
import type { LessonPlanContent, LessonPlanRecord } from '../types/lessonPlan'
import type { TosContent, TosRecord } from '../types/tos'
import { allocateLessonCoverage } from './assessmentCoveragePlan'
import { createLessonSourceSnapshot } from './assessmentLessonSnapshot'
import { calculateRubricTotalPoints, createPerformanceTaskContent } from './performanceTaskRubric'
import { withResolvedAssessmentVisualPlan } from './assessmentVisualPlanning'

function normalizeItemPoints(item: Partial<AssessmentItem>) {
  const raw: unknown = item.pointsPossible ?? item.points
  if (raw === null || raw === undefined || raw === '') return 1
  const value = Number(raw)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : Number.NaN
}

function deriveAssessmentTotalPoints(items: readonly Partial<AssessmentItem>[]) {
  return Math.round(items.reduce((sum, item) => {
    const points = normalizeItemPoints(item)
    return sum + (Number.isFinite(points) && points > 0 ? points : 0)
  }, 0) * 100) / 100
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

let fallbackIdCounter = 0

function stableId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  fallbackIdCounter += 1
  return `${prefix}-${fallbackIdCounter.toString(36)}`
}

function timestamp(options?: AssessmentFactoryOptions) {
  return options?.now || new Date().toISOString()
}

function sourceSnapshot(tos: TosRecord): AssessmentTosSnapshot {
  if (tos.status !== 'final') throw new Error('Assessments can only be created from a finalized TOS.')
  return {
    id: tos.id,
    versionNumber: tos.versionNumber,
    title: tos.title || tos.content.title,
    status: 'final',
    assignmentId: tos.assignmentId,
    schoolYear: tos.schoolYear || tos.content.schoolYear,
    academicPeriodLabel: tos.academicPeriodLabel,
    content: clone(tos.content),
  }
}

function categoryForAllocation(content: TosContent, allocation: TosContent['rows'][number]['cognitiveAllocations'][number]) {
  return content.cognitiveCategories.find((category) => category.id === allocation.categoryId) ?? {
    id: allocation.categoryId,
    label: allocation.label,
    shortLabel: allocation.shortLabel,
  }
}

function competencySnapshot(row: TosContent['rows'][number]): AssessmentCompetencySnapshot {
  return {
    id: row.competency.id,
    code: row.competency.code,
    text: row.competency.text,
    sourcePage: row.competency.sourcePage,
    academicPeriodId: row.competency.academicPeriodId,
    curriculumPeriodId: row.competency.academicPeriodId,
    curriculumPeriodLabel: row.competency.curriculumPeriodLabel,
  }
}

function emptyAnswer(questionType: QuestionType = 'multiple_choice'): AssessmentAnswer {
  if (questionType === 'true_false') return { type: 'true_false', value: false }
  if (questionType === 'short_answer') return { type: 'short_answer', acceptedAnswers: [], caseSensitive: false }
  if (questionType === 'identification') return { type: 'identification', acceptedAnswers: [], caseSensitive: false }
  if (questionType === 'fill_in_the_blank') return { type: 'fill_in_the_blank', blanks: [] }
  if (questionType === 'numerical_answer') return { type: 'numerical_answer', value: 0, tolerance: 0, unit: '', requireUnit: false }
  if (questionType === 'problem_solving') return { type: 'problem_solving', finalAnswer: '', solutionOutline: '' }
  if (questionType === 'matching') return { type: 'matching', prompts: [], choices: [], mappings: [], reusableChoices: false }
  if (questionType === 'multiple_select') return { type: 'multiple_select', choices: [], choiceIds: [], scoringPolicy: 'all_or_nothing' }
  if (questionType === 'essay') return { type: 'essay', keyPoints: [], rubric: [] }
  if (questionType === 'constructed_response') return { type: 'constructed_response', expectedResponse: '', sampleResponse: '' }
  return { type: 'multiple_choice', choices: [], choiceId: '' }
}

export const DEFAULT_ASSESSMENT_SETTINGS: AssessmentSettings = {
  schemaVersion: 1,
  mode: 'auto_balanced',
  visualPolicy: 'balanced',
  allowedTypes: [
    'multiple_choice', 'true_false', 'short_answer', 'constructed_response',
    'identification', 'fill_in_the_blank', 'numerical_answer',
    'problem_solving', 'matching', 'multiple_select', 'essay',
  ],
  defaultPoints: {
    multiple_choice: 1,
    true_false: 1,
    short_answer: 1,
    constructed_response: 5,
    identification: 1,
    fill_in_the_blank: 1,
    numerical_answer: 1,
    problem_solving: 3,
    matching: 1,
    multiple_select: 1,
    essay: 10,
  },
  targetTotalPoints: null,
}

function validateAllocationRanges(tos: TosRecord) {
  const total = tos.content.totalItems
  if (!Number.isSafeInteger(total) || total < 1) throw new Error('The finalized TOS must contain at least one item.')
  const expected = new Set<number>()
  const rows = [...tos.content.rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, 'en'))
  rows.forEach((row) => {
    row.cognitiveAllocations.forEach((allocation) => {
      if (!Number.isSafeInteger(allocation.itemCount) || allocation.itemCount < 0) throw new Error(`The finalized TOS has an invalid allocation for ${row.id}.`)
      if (allocation.itemCount === 0) return
      if (!Number.isSafeInteger(allocation.itemStart) || !Number.isSafeInteger(allocation.itemEnd) || allocation.itemStart === null || allocation.itemEnd === null || allocation.itemEnd - allocation.itemStart + 1 !== allocation.itemCount) {
        throw new Error(`The finalized TOS has an invalid item range for ${row.id}.`)
      }
      for (let itemNumber = allocation.itemStart; itemNumber <= allocation.itemEnd; itemNumber += 1) {
        if (expected.has(itemNumber)) throw new Error('The finalized TOS has duplicate item placement ranges.')
        expected.add(itemNumber)
      }
    })
  })
  for (let itemNumber = 1; itemNumber <= total; itemNumber += 1) {
    if (!expected.has(itemNumber)) throw new Error('The finalized TOS has gaps in its item allocation ranges.')
  }
}

export function createAssessmentBlueprint(
  tos: TosRecord,
  options: AssessmentFactoryOptions = {},
): AssessmentBlueprint {
  assertSourceIsFinal(tos)
  validateAllocationRanges(tos)
  const sourceTos = sourceSnapshot(tos)
  const content = sourceTos.content
  const items: AssessmentItem[] = []
  const rows = [...content.rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, 'en'))
  rows.forEach((row) => {
    const allocations = [...row.cognitiveAllocations].sort((a, b) => (a.itemStart ?? Number.MAX_SAFE_INTEGER) - (b.itemStart ?? Number.MAX_SAFE_INTEGER) || a.categoryId.localeCompare(b.categoryId, 'en'))
    allocations.forEach((allocation) => {
      if (!allocation.itemCount || allocation.itemStart === null || allocation.itemEnd === null) return
      const category = categoryForAllocation(content, allocation)
      const compSnapshot = competencySnapshot(row)
      for (let itemNumber = allocation.itemStart; itemNumber <= allocation.itemEnd; itemNumber += 1) {
        const mapping: TosAssessmentItemMapping = {
          kind: 'tos',
          rowId: row.id,
          competencyId: row.competency.id,
          cognitiveCategoryId: category.id,
          allocationItemStart: allocation.itemStart,
          allocationItemEnd: allocation.itemEnd,
          allocationIndex: itemNumber - allocation.itemStart,
        }
        items.push({
          id: stableId('assessment-item'),
          itemNumber,
          competencySnapshot: compSnapshot,
          cognitiveCategorySnapshot: { id: category.id, label: category.label, shortLabel: category.shortLabel },
          mapping,
          prompt: '',
          questionType: 'multiple_choice',
          answer: emptyAnswer(),
          authorshipState: 'empty',
          rationale: '',
          teacherNotes: '',
          pointsPossible: 1,
          points: 1,
          qaState: 'empty',
          locked: false,
          history: [],
        })
      }
    })
  })
  items.sort((a, b) => a.itemNumber - b.itemNumber)
  if (items.length !== content.totalItems || items.some((item, index) => item.itemNumber !== index + 1)) throw new Error('The finalized TOS could not expand into a contiguous item blueprint.')
  const now = timestamp(options)
  return {
    id: options.id || stableId('assessment'),
    userId: options.userId ?? tos.userId,
    assignmentId: options.assignmentId === undefined ? tos.assignmentId : options.assignmentId,
    title: options.title ?? (content.assessmentTitle || tos.title || 'Assessment'),
    instructions: options.instructions ?? '',
    gradeLevel: content.gradeLevel,
    learningArea: content.learningArea,
    schoolYear: content.schoolYear || tos.schoolYear,
    gradingTermId: content.gradingTermId,
    gradingTermLabel: content.gradingTermLabel || tos.academicPeriodLabel || '',
    curriculumPeriodIds: [...content.curriculumPeriodIds],
    curriculumPeriodLabels: [...content.curriculumPeriodLabels],
    totalItems: content.totalItems,
    totalPoints: items.reduce((sum, item) => sum + item.pointsPossible, 0),
    settings: clone(DEFAULT_ASSESSMENT_SETTINGS),
    versionNumber: options.versionNumber ?? 1,
    status: 'draft',
    mode: 'standard',
    sourceType: 'tos',
    sourceTos: clone(sourceTos),
    items,
    createdAt: now,
    updatedAt: now,
  }
}

export function createAssessmentBlueprintV2(
  tos: TosRecord,
  masterPlan: AssessmentMasterPlan,
  options: AssessmentFactoryOptions = {},
): AssessmentBlueprint {
  assertSourceIsFinal(tos)
  if (!masterPlan || masterPlan.generationVersion !== 'v2' || !Array.isArray(masterPlan.entries) || masterPlan.entries.length === 0) {
    throw new Error('A validated Assessment Generation V2 master plan is required.')
  }
  const sourceTos = sourceSnapshot(tos)
  const content = sourceTos.content
  const rows = new Map(content.rows.map((row) => [row.id, row]))
  const items: AssessmentItem[] = masterPlan.entries.map((entry) => {
    const row = rows.get(entry.rowId)
    if (!row) throw new Error(`The master plan references missing TOS row ${entry.rowId}.`)
    const allocation = row.cognitiveAllocations.find((candidate) => candidate.categoryId === entry.cognitiveCategoryId)
    if (!allocation || allocation.itemStart === null || allocation.itemEnd === null) {
      throw new Error(`The master plan references missing cognitive category ${entry.cognitiveCategoryId} for ${row.id}.`)
    }
    const category = categoryForAllocation(content, allocation)
    const mapping: TosAssessmentItemMapping = {
      kind: 'tos',
      rowId: row.id,
      competencyId: row.competency.id,
      cognitiveCategoryId: category.id,
      allocationItemStart: allocation.itemStart,
      allocationItemEnd: allocation.itemEnd,
      allocationIndex: 0,
    }
    const item: AssessmentItem = {
      id: stableId('assessment-item'),
      itemNumber: entry.itemNumber,
      pointStart: entry.pointStart,
      pointEnd: entry.pointEnd,
      planEntryId: entry.id,
      competencySnapshot: competencySnapshot(row),
      cognitiveCategorySnapshot: { id: category.id, label: category.label, shortLabel: category.shortLabel },
      mapping,
      prompt: '',
      questionType: entry.questionType,
      answer: emptyAnswer(entry.questionType),
      authorshipState: 'empty',
      rationale: '',
      teacherNotes: '',
      pointsPossible: entry.pointsPossible,
      points: entry.pointsPossible,
      qaState: 'empty',
      locked: false,
      history: [],
      visualRequirement: entry.visualRequirement,
      visualIntent: entry.visualIntent,
      visualStatus: entry.visualRequirement === 'none' ? 'not_required' : 'pending',
      visualAttempts: 0,
    }
    const policy = masterPlan.visualPolicy || options?.visualPolicy || 'balanced'
    return withResolvedAssessmentVisualPlan(item, { visualPolicy: policy, learningArea: content.learningArea })
  })
  items.sort((a, b) => a.itemNumber - b.itemNumber)
  const now = timestamp(options)
  return {
    id: options.id || stableId('assessment'),
    userId: options.userId ?? tos.userId,
    assignmentId: options.assignmentId === undefined ? tos.assignmentId : options.assignmentId,
    title: options.title ?? (content.assessmentTitle || tos.title || 'Assessment'),
    instructions: options.instructions ?? '',
    gradeLevel: content.gradeLevel,
    learningArea: content.learningArea,
    schoolYear: content.schoolYear || tos.schoolYear,
    gradingTermId: content.gradingTermId,
    gradingTermLabel: content.gradingTermLabel || tos.academicPeriodLabel || '',
    curriculumPeriodIds: [...content.curriculumPeriodIds],
    curriculumPeriodLabels: [...content.curriculumPeriodLabels],
    totalItems: items.length,
    totalPoints: masterPlan.totalPoints,
    settings: {
      ...clone(DEFAULT_ASSESSMENT_SETTINGS),
      visualPolicy: masterPlan.visualPolicy || options?.visualPolicy || 'balanced',
      schemaVersion: 2,
      generationVersion: 'v2',
      numberingMode: 'point_ranges',
      targetTotalPoints: masterPlan.totalPoints,
      masterPlan: clone(masterPlan),
    },
    versionNumber: options.versionNumber ?? 1,
    status: 'draft',
    mode: 'standard',
    sourceType: 'tos',
    sourceTos: clone(sourceTos),
    items,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Creates an Assessment Blueprint for a single lesson plan quiz.
 * Deterministically distributes test items across the lesson's competencies and cognitive categories.
 */
export function createLessonQuizBlueprint(
  lessonInput: LessonPlanRecord | AssessmentLessonSourceSnapshot | { id: string; title?: string; content: LessonPlanContent; updatedAt?: string; versionNumber?: number },
  options: AssessmentFactoryOptions & {
    totalItems?: number
    settings?: Partial<AssessmentSettings>
  } = {}
): AssessmentBlueprint {
  const lessonSnapshot = 'learningObjectives' in lessonInput && Array.isArray(lessonInput.competencies)
    ? (lessonInput as AssessmentLessonSourceSnapshot)
    : createLessonSourceSnapshot(lessonInput as LessonPlanRecord)

  const totalItems = Number.isSafeInteger(options.totalItems) && Number(options.totalItems) > 0
    ? Number(options.totalItems)
    : 10

  const coveragePlan = allocateLessonCoverage({
    lessons: [lessonSnapshot],
    totalItems,
  })

  const items: AssessmentItem[] = coveragePlan.entries.flatMap((entry) => {
    return entry.allocatedItemNumbers.map((itemNumber): AssessmentItem => {
      const compSnapshot: AssessmentCompetencySnapshot = lessonSnapshot.competencies.find((c) => c.id === entry.competencyId) ?? {
        id: entry.competencyId,
        code: entry.competencyCode ?? null,
        text: entry.competencyStatement,
        sourcePage: null,
        academicPeriodId: null,
        curriculumPeriodId: null,
        curriculumPeriodLabel: lessonSnapshot.gradingTermLabel || '',
      }

      const cognitiveCategorySnapshot: AssessmentCognitiveCategorySnapshot = {
        id: entry.cognitiveCategoryId,
        label: entry.cognitiveCategoryLabel || entry.cognitiveCategoryId,
        shortLabel: entry.cognitiveCategoryId.slice(0, 3).toUpperCase(),
      }

      const mapping: LessonCoverageItemMapping = {
        kind: 'lesson_coverage',
        coverageEntryId: entry.id,
        sourceLessonId: lessonSnapshot.id,
        competencyId: entry.competencyId,
        cognitiveCategoryId: entry.cognitiveCategoryId,
        allocationIndex: 0,
        allocationItemStart: itemNumber,
        allocationItemEnd: itemNumber,
        rowId: entry.id,
      }

      return {
        id: stableId('assessment-item'),
        itemNumber,
        competencySnapshot: clone(compSnapshot),
        cognitiveCategorySnapshot,
        mapping,
        prompt: '',
        questionType: 'multiple_choice',
        answer: emptyAnswer(),
        authorshipState: 'empty',
        rationale: '',
        teacherNotes: '',
        pointsPossible: 1,
        points: 1,
        qaState: 'empty',
        locked: false,
        history: [],
      }
    })
  })

  items.sort((a, b) => a.itemNumber - b.itemNumber)

  const now = timestamp(options)
  return {
    id: options.id || stableId('assessment'),
    userId: options.userId ?? '',
    assignmentId: options.assignmentId === undefined ? null : options.assignmentId,
    title: options.title ?? `${lessonSnapshot.lessonTitle || lessonSnapshot.title || 'Lesson'} Quiz`,
    instructions: options.instructions ?? 'Answer each question to the best of your ability.',
    gradeLevel: lessonSnapshot.gradeLevel,
    learningArea: lessonSnapshot.learningArea,
    schoolYear: lessonSnapshot.schoolYear,
    gradingTermId: lessonSnapshot.gradingTermId || '',
    gradingTermLabel: lessonSnapshot.gradingTermLabel || '',
    curriculumPeriodIds: lessonSnapshot.curriculumPeriodIds ? [...lessonSnapshot.curriculumPeriodIds] : [],
    curriculumPeriodLabels: lessonSnapshot.curriculumPeriodLabels ? [...lessonSnapshot.curriculumPeriodLabels] : [],
    totalItems: items.length,
    totalPoints: items.reduce((sum, item) => sum + item.pointsPossible, 0),
    settings: {
      ...clone(DEFAULT_ASSESSMENT_SETTINGS),
      ...(options.settings || {}),
    },
    versionNumber: options.versionNumber ?? 1,
    status: 'draft',
    mode: 'lesson_quiz',
    sourceType: 'lesson_plan',
    sourceLesson: clone(lessonSnapshot),
    coveragePlan: clone(coveragePlan),
    items,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Creates an Assessment Blueprint for a multi-lesson unit quiz.
 * Deterministically balances test item counts across multiple lesson plans.
 */
export function createUnitQuizBlueprint(
  lessonInputs: (LessonPlanRecord | AssessmentLessonSourceSnapshot | { id: string; title?: string; content: LessonPlanContent; updatedAt?: string; versionNumber?: number })[],
  options: AssessmentFactoryOptions & {
    totalItems?: number
    lessonWeights?: Record<string, number>
    settings?: Partial<AssessmentSettings>
  } = {}
): AssessmentBlueprint {
  if (!lessonInputs || lessonInputs.length < 2) {
    throw new Error('Unit Quiz requires at least 2 lesson plans.')
  }

  const lessonSnapshots: AssessmentLessonSourceSnapshot[] = lessonInputs.map((input) =>
    'learningObjectives' in input && Array.isArray(input.competencies)
      ? (input as AssessmentLessonSourceSnapshot)
      : createLessonSourceSnapshot(input as LessonPlanRecord)
  )

  const primaryLesson = lessonSnapshots[0]
  for (let i = 1; i < lessonSnapshots.length; i += 1) {
    const candidate = lessonSnapshots[i]
    if (candidate.gradeLevel && primaryLesson.gradeLevel && candidate.gradeLevel.toLowerCase() !== primaryLesson.gradeLevel.toLowerCase()) {
      throw new Error(`All lessons in a Unit Quiz must have the same grade level (found "${primaryLesson.gradeLevel}" and "${candidate.gradeLevel}").`)
    }
    if (candidate.learningArea && primaryLesson.learningArea && candidate.learningArea.toLowerCase() !== primaryLesson.learningArea.toLowerCase()) {
      throw new Error(`All lessons in a Unit Quiz must have the same learning area (found "${primaryLesson.learningArea}" and "${candidate.learningArea}").`)
    }
  }

  const totalItems = Number.isSafeInteger(options.totalItems) && Number(options.totalItems) > 0
    ? Number(options.totalItems)
    : Math.max(10, lessonSnapshots.length * 5)

  const coveragePlan = allocateLessonCoverage({
    lessons: lessonSnapshots,
    totalItems,
    lessonWeights: options.lessonWeights,
  })

  const items: AssessmentItem[] = coveragePlan.entries.flatMap((entry) => {
    const parentLesson = lessonSnapshots.find((l) => l.id === entry.sourceLessonId) ?? primaryLesson
    const compSnapshot: AssessmentCompetencySnapshot = parentLesson.competencies.find((c) => c.id === entry.competencyId) ?? {
      id: entry.competencyId,
      code: entry.competencyCode ?? null,
      text: entry.competencyStatement,
      sourcePage: null,
      academicPeriodId: null,
      curriculumPeriodId: null,
      curriculumPeriodLabel: parentLesson.gradingTermLabel || '',
    }

    const cognitiveCategorySnapshot: AssessmentCognitiveCategorySnapshot = {
      id: entry.cognitiveCategoryId,
      label: entry.cognitiveCategoryLabel || entry.cognitiveCategoryId,
      shortLabel: entry.cognitiveCategoryId.slice(0, 3).toUpperCase(),
    }

    return entry.allocatedItemNumbers.map((itemNumber): AssessmentItem => {
      const mapping: LessonCoverageItemMapping = {
        kind: 'lesson_coverage',
        coverageEntryId: entry.id,
        sourceLessonId: parentLesson.id,
        competencyId: entry.competencyId,
        cognitiveCategoryId: entry.cognitiveCategoryId,
        allocationIndex: 0,
        allocationItemStart: itemNumber,
        allocationItemEnd: itemNumber,
        rowId: entry.id,
      }

      return {
        id: stableId('assessment-item'),
        itemNumber,
        competencySnapshot: clone(compSnapshot),
        cognitiveCategorySnapshot,
        mapping,
        prompt: '',
        questionType: 'multiple_choice',
        answer: emptyAnswer(),
        authorshipState: 'empty',
        rationale: '',
        teacherNotes: '',
        pointsPossible: 1,
        points: 1,
        qaState: 'empty',
        locked: false,
        history: [],
      }
    })
  })

  items.sort((a, b) => a.itemNumber - b.itemNumber)

  const allCurriculumPeriodLabels = Array.from(
    new Set(lessonSnapshots.flatMap((l) => l.curriculumPeriodLabels ?? []))
  )

  const now = timestamp(options)
  return {
    id: options.id || stableId('assessment'),
    userId: options.userId ?? '',
    assignmentId: options.assignmentId === undefined ? null : options.assignmentId,
    title: options.title ?? `Unit Quiz (${lessonSnapshots.length} Lessons)`,
    instructions: options.instructions ?? 'Read and answer each question carefully.',
    gradeLevel: primaryLesson.gradeLevel,
    learningArea: primaryLesson.learningArea,
    schoolYear: primaryLesson.schoolYear,
    gradingTermId: primaryLesson.gradingTermId || '',
    gradingTermLabel: primaryLesson.gradingTermLabel || '',
    curriculumPeriodIds: primaryLesson.curriculumPeriodIds ? [...primaryLesson.curriculumPeriodIds] : [],
    curriculumPeriodLabels: allCurriculumPeriodLabels,
    totalItems: items.length,
    totalPoints: items.reduce((sum, item) => sum + item.pointsPossible, 0),
    settings: {
      ...clone(DEFAULT_ASSESSMENT_SETTINGS),
      ...(options.settings || {}),
    },
    versionNumber: options.versionNumber ?? 1,
    status: 'draft',
    mode: 'unit_quiz',
    sourceType: 'multi_lesson_plan',
    sourceLessons: clone(lessonSnapshots),
    coveragePlan: clone(coveragePlan),
    items,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Creates an Authentic Performance Task Blueprint with analytic scoring rubrics.
 * Dedicated payload structure: does NOT create fake constructed_response items.
 */
export function createPerformanceTaskBlueprint(
  source: {
    lesson?: LessonPlanRecord | AssessmentLessonSourceSnapshot | { id: string; title?: string; content: LessonPlanContent; updatedAt?: string; versionNumber?: number }
    lessons?: (LessonPlanRecord | AssessmentLessonSourceSnapshot | { id: string; title?: string; content: LessonPlanContent; updatedAt?: string; versionNumber?: number })[]
    tos?: TosRecord
  },
  options: AssessmentFactoryOptions & {
    performanceTask?: Partial<PerformanceTaskContent>
  } = {}
): AssessmentBlueprint {
  let gradeLevel = ''
  let learningArea = ''
  let schoolYear = ''
  let gradingTermLabel = ''
  let curriculumPeriodLabels: string[] = []
  let sourceLesson: AssessmentLessonSourceSnapshot | undefined
  let sourceLessons: AssessmentLessonSourceSnapshot[] | undefined
  let sourceTos: AssessmentTosSnapshot | undefined
  let sourceType: AssessmentSourceType = 'lesson_plan'
  let compAlignments: AssessmentCompetencySnapshot[] = []
  let learningObjectives: string[] = []

  if (source.lesson) {
    sourceLesson = 'learningObjectives' in source.lesson && Array.isArray(source.lesson.competencies)
      ? (source.lesson as AssessmentLessonSourceSnapshot)
      : createLessonSourceSnapshot(source.lesson as LessonPlanRecord)
    gradeLevel = sourceLesson.gradeLevel
    learningArea = sourceLesson.learningArea
    schoolYear = sourceLesson.schoolYear
    gradingTermLabel = sourceLesson.gradingTermLabel || ''
    curriculumPeriodLabels = sourceLesson.curriculumPeriodLabels ?? []
    sourceType = 'lesson_plan'
    compAlignments = sourceLesson.competencies
    learningObjectives = sourceLesson.learningObjectives
  } else if (source.lessons && source.lessons.length > 0) {
    sourceLessons = source.lessons.map((input) =>
      'learningObjectives' in input && Array.isArray(input.competencies)
        ? (input as AssessmentLessonSourceSnapshot)
        : createLessonSourceSnapshot(input as LessonPlanRecord)
    )
    const first = sourceLessons[0]
    gradeLevel = first.gradeLevel
    learningArea = first.learningArea
    schoolYear = first.schoolYear
    gradingTermLabel = first.gradingTermLabel || ''
    curriculumPeriodLabels = Array.from(new Set(sourceLessons.flatMap((l) => l.curriculumPeriodLabels ?? [])))
    sourceType = 'multi_lesson_plan'
    compAlignments = sourceLessons.flatMap((l) => l.competencies)
    learningObjectives = sourceLessons.flatMap((l) => l.learningObjectives)
  } else if (source.tos) {
    sourceTos = sourceSnapshot(source.tos)
    gradeLevel = sourceTos.content.gradeLevel
    learningArea = sourceTos.content.learningArea
    schoolYear = sourceTos.schoolYear
    gradingTermLabel = sourceTos.content.gradingTermLabel || ''
    curriculumPeriodLabels = [...sourceTos.content.curriculumPeriodLabels]
    sourceType = 'tos'
    compAlignments = sourceTos.content.rows.map((r) => competencySnapshot(r))
  }

  const performanceTask = createPerformanceTaskContent({
    title: options.title || `${learningArea || 'Curriculum'} Performance Task`,
    learningObjectives: learningObjectives.slice(0, 5),
    competencyAlignment: compAlignments,
    ...options.performanceTask,
  })

  const totalPoints = performanceTask.rubric?.totalPoints || calculateRubricTotalPoints(performanceTask.rubric)

  const now = timestamp(options)
  return {
    id: options.id || stableId('assessment'),
    userId: options.userId ?? '',
    assignmentId: options.assignmentId === undefined ? null : options.assignmentId,
    title: options.title ?? performanceTask.title,
    instructions: options.instructions ?? performanceTask.studentInstructions,
    gradeLevel,
    learningArea,
    schoolYear,
    gradingTermId: '',
    gradingTermLabel,
    curriculumPeriodIds: [],
    curriculumPeriodLabels,
    totalItems: 0,
    totalPoints,
    settings: {
      ...clone(DEFAULT_ASSESSMENT_SETTINGS),
      mode: 'manual_per_item',
    },
    versionNumber: options.versionNumber ?? 1,
    status: 'draft',
    mode: 'performance_task',
    sourceType,
    sourceTos,
    sourceLesson,
    sourceLessons,
    performanceTask,
    items: [],
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeItemMapping(rawMapping: any, itemNumber: number): AssessmentItemMapping {
  if (!rawMapping || typeof rawMapping !== 'object') {
    return {
      kind: 'tos',
      rowId: `row-${itemNumber}`,
      competencyId: `comp-${itemNumber}`,
      cognitiveCategoryId: 'remembering',
      allocationItemStart: itemNumber,
      allocationItemEnd: itemNumber,
      allocationIndex: 0,
    }
  }
  if (rawMapping.kind === 'lesson_coverage' || rawMapping.coverageEntryId) {
    return {
      kind: 'lesson_coverage',
      coverageEntryId: String(rawMapping.coverageEntryId || rawMapping.rowId || `cov-${itemNumber}`),
      sourceLessonId: String(rawMapping.sourceLessonId || ''),
      sourceLessonIds: Array.isArray(rawMapping.sourceLessonIds) ? rawMapping.sourceLessonIds.map(String) : undefined,
      competencyId: String(rawMapping.competencyId || ''),
      cognitiveCategoryId: String(rawMapping.cognitiveCategoryId || 'remembering'),
      allocationIndex: Number(rawMapping.allocationIndex) || 0,
      allocationItemStart: Number.isSafeInteger(Number(rawMapping.allocationItemStart)) ? Number(rawMapping.allocationItemStart) : itemNumber,
      allocationItemEnd: Number.isSafeInteger(Number(rawMapping.allocationItemEnd)) ? Number(rawMapping.allocationItemEnd) : itemNumber,
      rowId: rawMapping.rowId ? String(rawMapping.rowId) : undefined,
    }
  }
  return {
    kind: 'tos',
    rowId: String(rawMapping.rowId || `row-${itemNumber}`),
    competencyId: String(rawMapping.competencyId || `comp-${itemNumber}`),
    cognitiveCategoryId: String(rawMapping.cognitiveCategoryId || 'remembering'),
    allocationItemStart: Number.isSafeInteger(Number(rawMapping.allocationItemStart)) ? Number(rawMapping.allocationItemStart) : itemNumber,
    allocationItemEnd: Number.isSafeInteger(Number(rawMapping.allocationItemEnd)) ? Number(rawMapping.allocationItemEnd) : itemNumber,
    allocationIndex: Number(rawMapping.allocationIndex) || 0,
  }
}

export function normalizeAssessmentBlueprint(assessment: AssessmentBlueprint): AssessmentBlueprint {
  const isPerfTask = assessment.mode === 'performance_task' || Boolean(assessment.performanceTask)
  const items = Array.isArray(assessment.items) ? assessment.items.map((item, index) => {
    const rawNumber = Number(item.itemNumber)
    const itemNumber = Number.isSafeInteger(rawNumber) && rawNumber > 0 ? rawNumber : index + 1
    const pointsPossible = normalizeItemPoints(item)
    return {
      ...item,
      itemNumber,
      mapping: normalizeItemMapping(item.mapping, itemNumber),
      pointsPossible,
      points: pointsPossible,
      authorshipState: (item.authorshipState || 'empty') as AssessmentAuthorshipState,
      qaState: item.qaState || 'empty',
      locked: Boolean(item.locked),
      history: Array.isArray(item.history) ? clone(item.history) : [],
    }
  }) : []

  const totalPoints = isPerfTask
    ? (assessment.performanceTask?.rubric?.totalPoints || calculateRubricTotalPoints(assessment.performanceTask?.rubric) || assessment.totalPoints || 0)
    : deriveAssessmentTotalPoints(items)

  const mode: AssessmentMode = assessment.mode || (isPerfTask ? 'performance_task' : assessment.sourceLesson ? 'lesson_quiz' : assessment.sourceLessons ? 'unit_quiz' : 'standard')
  const sourceType: AssessmentSourceType = assessment.sourceType || (assessment.sourceLesson ? 'lesson_plan' : assessment.sourceLessons ? 'multi_lesson_plan' : 'tos')

  return {
    ...clone(assessment),
    mode,
    sourceType,
    totalItems: isPerfTask ? 0 : items.length,
    totalPoints,
    items,
  }
}

export function duplicateAssessmentBlueprint(assessment: AssessmentBlueprint, options: AssessmentFactoryOptions = {}): AssessmentBlueprint {
  const normalized = normalizeAssessmentBlueprint(assessment)
  const now = timestamp(options)
  const items: AssessmentItem[] = normalized.items.map((item) => ({
    ...clone(item),
    id: stableId('assessment-item'),
  }))
  return {
    ...clone(normalized),
    id: options.id || stableId('assessment'),
    title: options.title ?? `${normalized.title} (Copy)`,
    status: 'draft',
    versionNumber: 1,
    items,
    createdAt: now,
    updatedAt: now,
  }
}

function assertSourceIsFinal(tos: TosRecord) {
  if (tos.status !== 'final') throw new Error('Assessments can only be created from a finalized TOS.')
  if (!tos.id) throw new Error('The finalized TOS needs a persisted document ID before assessment creation.')
}

export const buildAssessmentBlueprint = createAssessmentBlueprint
export const createAssessmentFromTos = createAssessmentBlueprint
export const duplicateAssessment = duplicateAssessmentBlueprint
export const normalizeAssessment = normalizeAssessmentBlueprint
