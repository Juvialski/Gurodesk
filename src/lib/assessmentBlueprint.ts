import type {
  Assessment,
  AssessmentAnswer,
  AssessmentAuthorshipState,
  AssessmentBlueprint,
  AssessmentCompetencySnapshot,
  AssessmentFactoryOptions,
  AssessmentItem,
  AssessmentItemMapping,
  AssessmentMasterPlan,
  AssessmentTosSnapshot,
  AssessmentSettings,
  QuestionType,
} from '../types/assessment'
import type { TosContent, TosRecord } from '../types/tos'
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
  // Browser and supported Node runtimes provide randomUUID.  This fallback is
  // only for constrained test environments and remains a stable opaque ID once
  // persisted; it is not used to make any assessment decision.
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

const DEFAULT_ASSESSMENT_SETTINGS: AssessmentSettings = {
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
  if (expected.size !== total || [...expected].some((item, index) => item !== index + 1)) throw new Error('The finalized TOS item ranges must cover exactly 1..N.')
}

/**
 * Expand a finalized TOS allocation into exactly one deterministic item per
 * allocated number.  There is no model/AI call here: row and category ranges
 * are the sole source of item-to-competency mapping.
 */
export function createAssessmentBlueprint(tos: TosRecord, options: AssessmentFactoryOptions = {}): AssessmentBlueprint {
  if (tos.status !== 'final') throw new Error('Assessments can only be created from a finalized TOS.')
  validateAllocationRanges(tos)
  const sourceTos = sourceSnapshot(tos)
  const content = sourceTos.content
  const rows = [...content.rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, 'en'))
  const items: AssessmentItem[] = []
  rows.forEach((row) => {
    const rowCompetency = competencySnapshot(row)
    const allocations = [...row.cognitiveAllocations].sort((a, b) => {
      const aStart = a.itemStart ?? Number.MAX_SAFE_INTEGER
      const bStart = b.itemStart ?? Number.MAX_SAFE_INTEGER
      return aStart - bStart || a.categoryId.localeCompare(b.categoryId, 'en')
    })
    allocations.forEach((allocation) => {
      if (!allocation.itemCount || allocation.itemStart === null || allocation.itemEnd === null) return
      const category = categoryForAllocation(content, allocation)
      for (let itemNumber = allocation.itemStart; itemNumber <= allocation.itemEnd; itemNumber += 1) {
        const mapping: AssessmentItemMapping = {
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
          competencySnapshot: clone(rowCompetency),
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
    sourceTos: clone(sourceTos),
    items,
    createdAt: now,
    updatedAt: now,
  }
}



/**
 * Build a V2 logical-question blueprint from a frozen master plan.  The source
 * TOS remains immutable, while point ranges become the learner-facing
 * numbering unit.  One logical question may therefore consume multiple points.
 */
export function createAssessmentBlueprintV2(
  tos: TosRecord,
  masterPlan: AssessmentMasterPlan,
  options: AssessmentFactoryOptions = {},
): AssessmentBlueprint {
  if (tos.status !== 'final') throw new Error('Assessments can only be created from a finalized TOS.')
  validateAllocationRanges(tos)
  if (masterPlan.generationVersion !== 'v2' || masterPlan.numberingMode !== 'point_ranges') throw new Error('A valid V2 master plan is required.')
  if (!Number.isSafeInteger(masterPlan.totalPoints) || masterPlan.totalPoints < 1) throw new Error('The V2 master plan must have a positive whole-number point total.')
  if (masterPlan.entries.length !== masterPlan.logicalItemCount || !masterPlan.entries.length) throw new Error('The V2 master plan logical question count is invalid.')
  const sourceTos = sourceSnapshot(tos)
  const content = sourceTos.content
  const rowMap = new Map(content.rows.map((row) => [row.id, row]))
  const bucketMap = new Map(masterPlan.pointBuckets.map((bucket) => [bucket.id, bucket]))
  let pointCursor = 1
  const items = masterPlan.entries.map((entry, index): AssessmentItem => {
    if (entry.itemNumber !== index + 1) throw new Error('V2 master plan logical item numbers must be contiguous from 1.')
    if (entry.pointStart !== pointCursor || entry.pointEnd !== entry.pointStart + entry.pointsPossible - 1) throw new Error('V2 master plan point ranges must be exactly contiguous.')
    pointCursor = entry.pointEnd + 1
    const bucket = bucketMap.get(entry.bucketId)
    const row = rowMap.get(entry.rowId)
    if (!bucket || !row || row.id !== bucket.rowId || row.competency.id !== entry.competencyId || bucket.competencyId !== entry.competencyId || bucket.cognitiveCategoryId !== entry.cognitiveCategoryId) {
      throw new Error('The V2 master plan mapping no longer matches the finalized TOS snapshot.')
    }
    const allocation = row.cognitiveAllocations.find((candidate) => candidate.categoryId === entry.cognitiveCategoryId)
    if (!allocation || allocation.itemStart === null || allocation.itemEnd === null || allocation.itemCount < 1) throw new Error('The V2 master plan references a missing finalized TOS cognitive allocation.')
    const category = categoryForAllocation(content, allocation)
    // V2 logical questions are point-based chunks, not one-to-one copies of
    // source TOS item slots. Keep a stable anchor inside the immutable source
    // allocation rather than pretending logical order is a source item index.
    const allocationIndex = 0
    const mapping: AssessmentItemMapping = {
      rowId: row.id,
      competencyId: row.competency.id,
      cognitiveCategoryId: category.id,
      allocationItemStart: allocation.itemStart,
      allocationItemEnd: allocation.itemEnd,
      allocationIndex,
    }
    return {
      id: stableId('assessment-item'),
      itemNumber: entry.itemNumber,
      pointStart: entry.pointStart,
      pointEnd: entry.pointEnd,
      planEntryId: entry.id,
      competencySnapshot: clone(competencySnapshot(row)),
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
  })
  if (pointCursor !== masterPlan.totalPoints + 1) throw new Error('The V2 master plan does not cover exactly 1..total points.')
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
      schemaVersion: 2,
      generationVersion: 'v2',
      numberingMode: 'point_ranges',
      visualPolicy: 'balanced',
      mode: 'manual_per_item',
      allowedTypes: [...new Set(masterPlan.entries.map((entry) => entry.questionType))],
      targetTotalPoints: masterPlan.totalPoints,
      masterPlan: clone(masterPlan),
    },
    versionNumber: options.versionNumber ?? 1,
    status: 'draft',
    sourceTos: clone(sourceTos),
    items,
    createdAt: now,
    updatedAt: now,
  }
}

export const createAssessmentFromTos = createAssessmentBlueprint
export const buildAssessmentBlueprint = createAssessmentBlueprint

function normalizeAnswer(answer: AssessmentAnswer | undefined, questionType: QuestionType): AssessmentAnswer {
  if (!answer || answer.type !== questionType) return emptyAnswer(questionType)
  return clone(answer)
}

function normalizeSettings(settings: AssessmentSettings | undefined): AssessmentSettings {
  const source = (settings && typeof settings === 'object' ? settings : {}) as AssessmentSettings
  const allowed = Array.isArray(source.allowedTypes) && source.allowedTypes.length
    ? [...new Set(source.allowedTypes)] as QuestionType[]
    : [...DEFAULT_ASSESSMENT_SETTINGS.allowedTypes]
  const mode = source.mode === 'fixed_counts' || source.mode === 'percentages' || source.mode === 'manual_per_item'
    ? source.mode
    : 'auto_balanced'
  return {
    ...clone(DEFAULT_ASSESSMENT_SETTINGS),
    ...clone(source),
    schemaVersion: Number(source.schemaVersion ?? 1),
    generationVersion: source.generationVersion === 'v2' ? 'v2' : 'v1',
    numberingMode: source.numberingMode === 'point_ranges' ? 'point_ranges' : 'legacy_items',
    generationInstructions: String(source.generationInstructions ?? '').slice(0, 4000),
    masterPlan: source.masterPlan === undefined ? undefined : clone(source.masterPlan),
    mode,
    visualPolicy: source.visualPolicy === 'off' || source.visualPolicy === 'more_visuals' ? source.visualPolicy : 'balanced',
    allowedTypes: allowed,
    counts: source.counts ? { ...source.counts } : undefined,
    percentages: source.percentages ? { ...source.percentages } : undefined,
    defaultPoints: { ...DEFAULT_ASSESSMENT_SETTINGS.defaultPoints, ...(source.defaultPoints ?? {}) },
    targetTotalPoints: source.targetTotalPoints === null || source.targetTotalPoints === undefined ? null : Number(source.targetTotalPoints),
  }
}

/** Normalize persisted/imported data without changing the immutable source snapshot. */
export function normalizeAssessmentBlueprint(input: AssessmentBlueprint): AssessmentBlueprint {
  const result = clone(input)
  result.status = result.status === 'final' || result.status === 'archived' ? result.status : 'draft'
  result.instructions = result.instructions ?? ''
  result.curriculumPeriodIds = [...(result.curriculumPeriodIds ?? [])]
  result.curriculumPeriodLabels = [...(result.curriculumPeriodLabels ?? [])]
  result.totalItems = Number(result.totalItems)
  result.settings = normalizeSettings(result.settings)
  result.items = (result.items ?? []).map((item, index) => withResolvedAssessmentVisualPlan({
    ...item,
    id: item.id || stableId('assessment-item'),
    itemNumber: Number(item.itemNumber ?? index + 1),
    pointStart: item.pointStart === undefined ? undefined : Number(item.pointStart),
    pointEnd: item.pointEnd === undefined ? undefined : Number(item.pointEnd),
    planEntryId: item.planEntryId ? String(item.planEntryId) : undefined,
    prompt: item.prompt ?? '',
    questionType: item.questionType ?? 'multiple_choice',
    answer: normalizeAnswer(item.answer, item.questionType ?? 'multiple_choice'),
    authorshipState: (['empty', 'ai_suggestion', 'teacher_accepted', 'teacher_edited', 'manual'] as AssessmentAuthorshipState[]).includes(item.authorshipState) ? item.authorshipState : 'empty',
    rationale: item.rationale ?? '',
    teacherNotes: item.teacherNotes ?? '',
    pointsPossible: normalizeItemPoints(item),
    points: item.points === null || item.points === undefined ? normalizeItemPoints(item) : Number(item.points),
    qaState: (['empty', 'generated', 'verified', 'needs_review', 'teacher_edited', 'answer_needs_recheck', 'locked', 'repair_needed'] as const).includes(item.qaState as never) ? item.qaState : 'empty',
    locked: item.locked === true,
    history: Array.isArray(item.history) ? item.history.slice(-5).map((version) => clone(version)) : [],
  })).sort((a, b) => a.itemNumber - b.itemNumber)
  result.totalPoints = deriveAssessmentTotalPoints(result.items)
  return result
}

export const normalizeAssessment = normalizeAssessmentBlueprint

/** Duplicate an assessment while preserving every source/mapping snapshot. */
export function duplicateAssessmentBlueprint(source: AssessmentBlueprint, options: AssessmentFactoryOptions = {}): AssessmentBlueprint {
  const normalized = normalizeAssessmentBlueprint(source)
  const now = timestamp(options)
  return {
    ...normalized,
    id: options.id || stableId('assessment'),
    title: options.title ?? `${normalized.title || 'Assessment'} — Copy`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    sourceTos: clone(normalized.sourceTos),
    items: normalized.items.map((item) => ({ ...clone(item), id: stableId('assessment-item') })),
  }
}

export const duplicateAssessment = duplicateAssessmentBlueprint
