import { describe, expect, it } from 'vitest'
import {
  assessmentItemNumberLabel,
  buildV2PointBuckets,
  minimumAssessmentV2Points,
  validateAndFinalizeMasterPlan,
  validateAssessmentV2Setup,
} from '../../src/lib/assessmentGenerationV2'
import { createAssessmentBlueprintV2 } from '../../src/lib/assessmentBlueprint'
import { validateAssessment } from '../../src/lib/assessmentValidation'
import { buildAssessmentStudentExportModel } from '../../src/lib/assessmentExportModel'
import { buildAssessmentPaperPresentation } from '../../src/lib/assessmentExportPresentation'
import type { AssessmentV2PointBucket, QuestionType } from '../../src/types/assessment'
import type { TosCognitiveCategory, TosRecord } from '../../src/types/tos'

const CPDS = [
  ['remembering', 'Remembering', 'R'],
  ['understanding', 'Understanding', 'U'],
  ['applying', 'Applying', 'Ap'],
  ['analyzing', 'Analyzing', 'An'],
  ['evaluating', 'Evaluating', 'E'],
  ['creating', 'Creating', 'C'],
] as const

function tosWithAllCpds(): TosRecord {
  const categories: TosCognitiveCategory[] = CPDS.map(([id, label, shortLabel], index) => ({ id, label, shortLabel, weight: '1', sortOrder: index }))
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'teacher-1',
    assignmentId: '22222222-2222-4222-8222-222222222222',
    title: 'Final Math TOS',
    schoolYear: '2026-2027',
    academicPeriodLabel: 'Quarter 1',
    status: 'final',
    versionNumber: 1,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    content: {
      schemaVersion: 1,
      title: 'Final Math TOS',
      assessmentTitle: 'Summative Assessment',
      gradeLevel: 'Grade 7',
      learningArea: 'Mathematics',
      sections: ['A'],
      schoolYear: '2026-2027',
      gradingTermId: 'q1',
      gradingTermLabel: 'Quarter 1',
      curriculumVersionId: 'cv1',
      curriculumVersionCode: 'MATATAG',
      curriculumVersionName: 'MATATAG',
      curriculumSubjectId: 'math7',
      curriculumPeriodIds: ['q1'],
      curriculumPeriodLabels: ['Quarter 1'],
      sourceTitle: 'Curriculum',
      sourceUrl: '',
      totalItems: 6,
      weightingMethod: 'equal',
      cognitiveCategories: categories,
      rows: [{
        id: '33333333-3333-4333-8333-333333333333',
        sortOrder: 0,
        competency: {
          id: '44444444-4444-4444-8444-444444444444',
          code: 'M7-Q1-1',
          text: 'Solve and explain mathematical relationships.',
          sourcePage: 1,
          sourceTitle: 'Curriculum',
          sourceUrl: null,
          academicPeriodId: 'q1',
          curriculumPeriodLabel: 'Quarter 1',
          verificationStatus: 'verified',
        },
        instructionalMinutes: '60',
        manualWeight: '',
        itemCountOverride: '',
        cognitiveWeights: {},
        notes: '',
        computedWeightPercent: '100',
        itemCount: 6,
        itemStart: 1,
        itemEnd: 6,
        itemRangeLabel: '1-6',
        cognitiveAllocations: CPDS.map(([categoryId, label, shortLabel], index) => ({
          categoryId,
          label,
          shortLabel,
          itemCount: 1,
          itemStart: index + 1,
          itemEnd: index + 1,
          rangeLabel: String(index + 1),
        })),
      }],
      notes: '',
      calculation: { engine: 'hamilton-largest-remainder-v1', valid: true, totalAllocated: 6, calculatedAt: null, warnings: [] },
    },
  }
}

const ALL_TYPES: QuestionType[] = [
  'multiple_choice', 'true_false', 'short_answer', 'constructed_response', 'identification',
  'fill_in_the_blank', 'numerical_answer', 'problem_solving', 'matching', 'multiple_select', 'essay',
]

function twoCpdTos(): TosRecord {
  const base = tosWithAllCpds()
  const row = base.content.rows[0]
  const remembering = base.content.cognitiveCategories.find((category) => category.id === 'remembering')!
  const creating = base.content.cognitiveCategories.find((category) => category.id === 'creating')!
  return {
    ...base,
    content: {
      ...base.content,
      totalItems: 2,
      cognitiveCategories: [remembering, creating],
      rows: [{
        ...row,
        itemCount: 2,
        itemStart: 1,
        itemEnd: 2,
        itemRangeLabel: '1-2',
        cognitiveAllocations: [
          { categoryId: 'remembering', label: 'Remembering', shortLabel: 'R', itemCount: 1, itemStart: 1, itemEnd: 1, rangeLabel: '1' },
          { categoryId: 'creating', label: 'Creating', shortLabel: 'C', itemCount: 1, itemStart: 2, itemEnd: 2, rangeLabel: '2' },
        ],
      }],
      calculation: { ...base.content.calculation, totalAllocated: 2 },
    },
  }
}

function twoCpdPlan() {
  const tos = twoCpdTos()
  const setup = { totalPoints: 5, allowedTypes: ['multiple_choice', 'essay'] as QuestionType[], visualPolicy: 'off' as const }
  const validation = validateAssessmentV2Setup(tos, setup)
  if (!validation.ready) throw new Error(validation.errors.map((entry) => entry.message).join(' | '))
  const remembering = validation.pointBuckets.find((bucket) => bucket.cpdKey === 'remembering')!
  const creating = validation.pointBuckets.find((bucket) => bucket.cpdKey === 'creating')!
  let id = 0
  const plan = validateAndFinalizeMasterPlan({ entries: [
    { bucketId: remembering.id, questionType: 'multiple_choice', pointsPossible: 1, taskIntent: 'Recall one concept accurately.', visualRequirement: 'none', visualIntent: '' },
    { bucketId: creating.id, questionType: 'essay', pointsPossible: 4, taskIntent: 'Create and justify a complete response.', visualRequirement: 'none', visualIntent: '' },
  ] }, {
    pointBuckets: validation.pointBuckets,
    allowedTypes: setup.allowedTypes,
    learningArea: tos.content.learningArea,
    totalPoints: setup.totalPoints,
    plannerModel: 'test-planner',
    visualPolicy: setup.visualPolicy,
    now: '2026-08-12T00:00:00.000Z',
    idFactory: () => `plan-${++id}`,
  })
  return { tos, plan }
}

describe('Assessment Generation V2 point/CPD planning', () => {
  it('rejects objective-only formats when the finalized TOS requires Evaluating and Creating', () => {
    const validation = validateAssessmentV2Setup(tosWithAllCpds(), {
      totalPoints: 12,
      allowedTypes: ['multiple_choice', 'true_false'],
      visualPolicy: 'balanced',
    })
    expect(validation.ready).toBe(false)
    expect(validation.errors.map((error) => error.message).join(' ')).toMatch(/Evaluating|Creating|cannot validly cover/i)
  })

  it('allocates the requested point total deterministically while preserving every positive CPD bucket', () => {
    const buckets = buildV2PointBuckets(tosWithAllCpds(), 30, ALL_TYPES)
    expect(buckets).toHaveLength(6)
    expect(buckets.every((bucket) => bucket.pointsAllocated > 0)).toBe(true)
    expect(buckets.reduce((sum, bucket) => sum + bucket.pointsAllocated, 0)).toBe(30)
  })

  it('treats a multi-point essay as one logical question while numbering it by its point range', () => {
    const base: Omit<AssessmentV2PointBucket, 'id' | 'cognitiveCategoryId' | 'cognitiveLabel' | 'cognitiveShortLabel' | 'cpdKey' | 'pointsAllocated'> = {
      rowId: '33333333-3333-4333-8333-333333333333',
      competencyId: '44444444-4444-4444-8444-444444444444',
      competencyCode: 'M7-Q1-1',
      competencyText: 'Solve and explain mathematical relationships.',
      sourceItemCount: 1,
      sourceAllocationItemStart: 1,
      sourceAllocationItemEnd: 1,
    }
    const lower: AssessmentV2PointBucket = { ...base, id: 'lower', cognitiveCategoryId: 'remembering', cognitiveLabel: 'Remembering', cognitiveShortLabel: 'R', cpdKey: 'remembering', pointsAllocated: 15 }
    const creating: AssessmentV2PointBucket = { ...base, id: 'create', cognitiveCategoryId: 'creating', cognitiveLabel: 'Creating', cognitiveShortLabel: 'C', cpdKey: 'creating', pointsAllocated: 5 }
    const rawEntries = [
      ...Array.from({ length: 15 }, (_, index) => ({ bucketId: 'lower', questionType: 'multiple_choice', pointsPossible: 1, taskIntent: `Recall target ${index + 1}.`, visualRequirement: 'none', visualIntent: '' })),
      { bucketId: 'create', questionType: 'essay', pointsPossible: 5, taskIntent: 'Create and justify a complete mathematical response.', visualRequirement: 'none', visualIntent: '' },
    ]
    const plan = validateAndFinalizeMasterPlan({ entries: rawEntries }, {
      pointBuckets: [lower, creating],
      allowedTypes: ['multiple_choice', 'essay'],
      learningArea: 'Mathematics',
      totalPoints: 20,
      plannerModel: 'test-planner',
      visualPolicy: 'balanced',
      now: '2026-08-12T00:00:00.000Z',
      idFactory: (() => { let id = 0; return () => `plan-${++id}` })(),
    })
    const essay = plan.entries[15]
    expect(plan.logicalItemCount).toBe(16)
    expect(essay.pointsPossible).toBe(5)
    expect(essay.pointStart).toBe(16)
    expect(essay.pointEnd).toBe(20)
    expect(assessmentItemNumberLabel(essay, 'point_ranges')).toBe('16–20')
  })

  it('rejects a master plan that moves points across deterministic TOS buckets', () => {
    const validation = validateAssessmentV2Setup(tosWithAllCpds(), { totalPoints: 12, allowedTypes: ALL_TYPES, visualPolicy: 'off' })
    expect(validation.ready).toBe(true)
    const first = validation.pointBuckets[0]
    const raw = { entries: [{ bucketId: first.id, questionType: 'multiple_choice', pointsPossible: 1, taskIntent: 'Recall one required fact.', visualRequirement: 'none', visualIntent: '' }] }
    expect(() => validateAndFinalizeMasterPlan(raw, {
      pointBuckets: validation.pointBuckets,
      allowedTypes: ALL_TYPES,
      learningArea: 'Mathematics',
      totalPoints: 12,
      plannerModel: 'test-planner',
      visualPolicy: 'off',
    })).toThrow(/consume every deterministic TOS point bucket|point bucket/i)
  })

  it('suggests the minimum feasible point total when higher-order formats need multi-point questions', () => {
    expect(minimumAssessmentV2Points(twoCpdTos(), ['multiple_choice', 'essay'])).toBe(5)
  })

  it('keeps V2 final validation on logical questions and exact point ranges instead of legacy TOS slot count', () => {
    const { tos, plan } = twoCpdPlan()
    const draft = createAssessmentBlueprintV2(tos, plan, { userId: tos.userId, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
    const items = draft.items.map((item) => item.questionType === 'multiple_choice'
      ? { ...item, prompt: 'Which statement is correct?', answer: { type: 'multiple_choice' as const, choices: [{ id: 'A', text: 'Correct' }, { id: 'B', text: 'Incorrect' }], choiceId: 'A' }, authorshipState: 'teacher_accepted' as const, qaState: 'locked' as const, locked: true }
      : { ...item, prompt: 'Create and justify a mathematical model.', answer: { type: 'essay' as const, keyPoints: ['A coherent model is created and justified.'], rubric: [{ id: 'criterion-1', label: 'Model and justification', pointsPossible: 4 }], scoringNotes: '' }, authorshipState: 'teacher_accepted' as const, qaState: 'locked' as const, locked: true })
    const final = { ...draft, status: 'final' as const, items }
    const result = validateAssessment(final, 'final')
    expect(result.errors).toEqual([])
    expect(final.items).toHaveLength(2)
    expect(final.totalPoints).toBe(5)
    expect(final.items[1].pointStart).toBe(2)
    expect(final.items[1].pointEnd).toBe(5)
  })

  it('keeps Balanced short papers from becoming visual-heavy', () => {
    const tos = twoCpdTos()
    const setup = { totalPoints: 5, allowedTypes: ['multiple_choice', 'essay'] as QuestionType[], visualPolicy: 'balanced' as const }
    const validation = validateAssessmentV2Setup(tos, setup)
    expect(validation.ready).toBe(true)
    const remembering = validation.pointBuckets.find((bucket) => bucket.cpdKey === 'remembering')!
    const creating = validation.pointBuckets.find((bucket) => bucket.cpdKey === 'creating')!
    expect(() => validateAndFinalizeMasterPlan({ entries: [
      { bucketId: remembering.id, questionType: 'multiple_choice', pointsPossible: 1, taskIntent: 'Recall one concept accurately.', visualRequirement: 'none', visualIntent: '' },
      { bucketId: creating.id, questionType: 'essay', pointsPossible: 4, taskIntent: 'Create and justify a complete response.', visualRequirement: 'required', visualIntent: 'A required mathematical diagram.' },
    ] }, {
      pointBuckets: validation.pointBuckets,
      allowedTypes: setup.allowedTypes,
      learningArea: tos.content.learningArea,
      totalPoints: setup.totalPoints,
      plannerModel: 'test-planner',
      visualPolicy: setup.visualPolicy,
    })).toThrow(/Balanced visual policy/i)
  })

  it('does not automatically reserve required visuals outside Mathematics', () => {
    const tos = { ...twoCpdTos(), content: { ...twoCpdTos().content, learningArea: 'English' } }
    const setup = { totalPoints: 5, allowedTypes: ['multiple_choice', 'essay'] as QuestionType[], visualPolicy: 'more_visuals' as const }
    const validation = validateAssessmentV2Setup(tos, setup)
    expect(validation.ready).toBe(true)
    const remembering = validation.pointBuckets.find((bucket) => bucket.cpdKey === 'remembering')!
    const creating = validation.pointBuckets.find((bucket) => bucket.cpdKey === 'creating')!
    expect(() => validateAndFinalizeMasterPlan({ entries: [
      { bucketId: remembering.id, questionType: 'multiple_choice', pointsPossible: 1, taskIntent: 'Recall one concept accurately.', visualRequirement: 'none', visualIntent: '' },
      { bucketId: creating.id, questionType: 'essay', pointsPossible: 4, taskIntent: 'Create and justify a complete response.', visualRequirement: 'required', visualIntent: 'A decorative illustration.' },
    ] }, {
      pointBuckets: validation.pointBuckets,
      allowedTypes: setup.allowedTypes,
      learningArea: tos.content.learningArea,
      totalPoints: setup.totalPoints,
      plannerModel: 'test-planner',
      visualPolicy: setup.visualPolicy,
    })).toThrow(/limited to Mathematics/i)
  })

  it('exports point ranges while omitting redundant item-count metadata in a V2 paper header', () => {
    const { tos, plan } = twoCpdPlan()
    const assessment = createAssessmentBlueprintV2(tos, plan, { userId: tos.userId })
    assessment.items[0].prompt = 'Choose the correct statement.'
    assessment.items[0].answer = { type: 'multiple_choice', choices: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }], choiceId: 'A' }
    assessment.items[1].prompt = 'Create a justified response.'
    assessment.items[1].answer = { type: 'essay', keyPoints: ['Valid response'], rubric: [{ id: 'r1', label: 'Response', pointsPossible: 4 }] }
    const model = buildAssessmentStudentExportModel(assessment)
    const paper = buildAssessmentPaperPresentation(model)
    expect(model.questions.map((question) => question.numberLabel)).toEqual(['1', '2–5'])
    expect(model.metadata.numberingMode).toBe('point_ranges')
    const headerLabels = paper.header.metadataRows.flat().map((entry) => entry.label)
    expect(headerLabels).not.toContain(model.labels.totalItems)
    expect(headerLabels).toContain(model.labels.totalPoints)
  })

})
