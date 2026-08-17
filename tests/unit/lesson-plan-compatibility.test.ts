import { describe, expect, it } from 'vitest'
import {
  emptyLessonCompetencySnapshot,
  removeLessonCompetency,
  setLessonPrimaryCompetency,
  syncLessonCompetencyProjection,
} from '../../src/lib/lessonPlanAlignment'
import { createBlankLessonContent, normalizeLessonContent } from '../../src/lib/lessonPlanFactory'
import { validateLessonPlan } from '../../src/lib/lessonPlanValidation'
import type { TeacherAssignment } from '../../src/types/app'
import type {
  LegacyLessonPlanContentV1,
  LessonPlanCompetencySnapshot,
  LessonPlanContent,
} from '../../src/types/lessonPlan'

const assignment: TeacherAssignment = {
  id: 'assignment-1',
  userId: 'teacher-1',
  schoolYear: '2026-2027',
  gradeLevel: 'Grade 7',
  learningArea: 'Mathematics',
  sections: ['A'],
  isActive: true,
  curriculumSourceKind: 'official',
  curriculumVersionId: 'curriculum-version-1',
}

function competency(id: string, text: string, overrides: Partial<LessonPlanCompetencySnapshot> = {}) {
  return emptyLessonCompetencySnapshot({
    id,
    code: `CODE-${id}`,
    text,
    sourcePage: 42,
    sourceTitle: 'Verified curriculum guide',
    academicPeriodId: 'period-1',
    curriculumPeriodLabel: 'Quarter 1',
    domainId: 'domain-1',
    contentArea: 'Numbers and Algebra',
    contentStandards: ['The learner demonstrates understanding of the selected concepts.'],
    performanceStandards: ['The learner applies the selected concepts accurately.'],
    ...overrides,
  })
}

function readyContent(): LessonPlanContent {
  const content = createBlankLessonContent(assignment)
  content.lessonTitle = 'A complete lesson plan'
  content.lessonFocus = 'Reviewing percentage increase and decrease'
  content.curriculumPeriodLabel = 'Quarter 1'
  content.gradingTermLabel = 'First Quarter'
  content.resourcesVerifiedByTeacher = true
  content.learnerContext = 'Learners have prior experience comparing fractions and decimals.'
  content.intentions.learningObjectives = 'Learners calculate and explain percentage increases and decreases in familiar contexts.'
  content.learningExperience.resources = 'Teacher-made task cards'
  content.learningExperience.preLessonActivity = 'Recall the relationship between fractions, decimals, and percentages.'
  content.learningExperience.lessonFlow = 'Model one example, guide pair practice, discuss strategies, and let learners complete an independent application task.'
  content.learningExperience.integrationContextualization = 'Use familiar price changes from a classroom market scenario.'
  content.assessingLearning.formativeAssessments = 'Check worked examples and ask learners to justify each operation during pair practice.'
  content.assessingLearning.evidenceOfLearning = 'Accurate solutions with short written explanations.'
  content.waysForward.nextSteps = 'Reteach the comparison step or provide an enrichment problem based on the evidence.'
  return content
}

function legacyContent(): LegacyLessonPlanContentV1 {
  return {
    schemaVersion: 1,
    framework: 'ILAW',
    policyCode: 'DO 016, s. 2026',
    lessonTitle: 'Historical polygons lesson',
    gradeLevel: 'Grade 7',
    learningArea: 'Mathematics',
    sections: ['Legacy A'],
    schoolYear: '2025-2026',
    curriculumPeriodLabel: 'Quarter 1',
    gradingTermLabel: 'First Quarter',
    lessonDate: '2025-08-12',
    weekLabel: 'Week 3',
    numberOfSessions: 2,
    durationMinutes: 45,
    references: 'Teacher-entered reference',
    resourcesVerifiedByTeacher: true,
    competency: {
      id: 'legacy-competency-id',
      code: 'M7GE-Ia-1',
      text: 'Classify polygons according to the number of sides and other properties.',
      sourcePage: 17,
      sourceTitle: 'Historical verified curriculum guide',
    },
    performanceStandard: 'The learner applies polygon concepts in practical situations.',
    learnerContext: 'The class has previously identified common two-dimensional shapes.',
    intentions: { learningObjectives: 'Learners classify regular, irregular, convex, and concave polygons accurately.' },
    learningExperience: {
      resources: 'Teacher-created polygon cards',
      homeBasedAlternative: 'Classify safe household objects by their visible shape.',
      preLessonActivity: 'Sort familiar shapes by their number of sides.',
      lessonFlow: 'Compare examples and non-examples, discuss defining attributes, and complete a classification task in pairs.',
      integrationContextualization: 'Use shapes visible in local buildings and classroom objects.',
      inclusionAccommodations: 'Provide large-print shape cards and allow oral explanations.',
    },
    assessingLearning: {
      formativeAssessments: 'Observe the card sort and ask learners to explain the attribute used for each group.',
      evidenceOfLearning: 'A correct classification table with a brief explanation.',
    },
    waysForward: {
      reflection: 'Historical teacher reflection is retained.',
      nextSteps: 'Reteach confusing attributes and extend learning with composite figures.',
      extendedLearning: 'Find and sketch polygon examples in the community.',
    },
    aiDeclaration: {
      used: false,
      categories: [],
      operations: [],
      statement: 'No AI assistance was used in the preparation of this lesson plan.',
      reviewedByTeacher: false,
    },
    aiSuggestionReview: { pendingSections: [], lastQuickDraftAt: null },
  }
}

describe('lesson plan schema v2 compatibility', () => {
  it('starts a new lesson awaiting curriculum alignment instead of opting out implicitly', () => {
    const blank = createBlankLessonContent(assignment)
    expect(blank.schemaVersion).toBe(2)
    expect(blank.alignmentMode).toBe('curriculum_aligned')
    expect(blank.alignmentPurpose).toBe('regular')
    expect(blank.curriculumAlignments).toEqual([])
    expect(blank.primaryCompetencyId).toBeNull()
    expect(blank.lessonPlanFormat).toBe('ilaw')
  })

  it('requires four sessions when a lesson is explicitly configured as a Daily Lesson Log', () => {
    const content = readyContent()
    content.lessonPlanFormat = 'daily_lesson_log'
    content.numberOfSessions = 1
    expect(validateLessonPlan(content).items.find((item) => item.key === 'daily-lesson-log-sessions')?.passed).toBe(false)

    content.numberOfSessions = 4
    expect(validateLessonPlan(content).items.find((item) => item.key === 'daily-lesson-log-sessions')?.passed).toBe(true)
  })

  it('adapts a v1 lesson without mutating it or losing its competency snapshot', () => {
    const legacy = legacyContent()
    const before = structuredClone(legacy)
    const normalized = normalizeLessonContent(legacy, 'final')

    expect(legacy).toEqual(before)
    expect(normalized.schemaVersion).toBe(2)
    expect(normalized.lessonFocus).toBe(legacy.lessonTitle)
    expect(normalized.lessonFocusSource).toBe('teacher')
    expect(normalized.lessonFocusSourceId).toBeNull()
    expect(normalized.alignmentMode).toBe('curriculum_aligned')
    expect(normalized.primaryCompetencyId).toBe(legacy.competency.id)
    expect(normalized.curriculumAlignments).toHaveLength(1)
    expect(normalized.curriculumAlignments[0]).toMatchObject(legacy.competency)
    expect(normalized.competency).toMatchObject(legacy.competency)
    expect(normalized.sections).toEqual(legacy.sections)
    expect(normalized.waysForward.reflection).toBe(legacy.waysForward.reflection)
    expect(validateLessonPlan(normalized).ready).toBe(true)
  })

  it('accepts a complete topic-only review lesson with no invented curriculum alignment', () => {
    const content = readyContent()
    content.alignmentMode = 'topic_only'
    content.alignmentPurpose = 'review'
    content.curriculumAlignments = []
    content.primaryCompetencyId = null
    content.competency = emptyLessonCompetencySnapshot()

    const result = validateLessonPlan(content)
    expect(result.items.find((item) => item.key === 'lesson-focus')?.passed).toBe(true)
    expect(result.items.find((item) => item.key === 'competency')?.passed).toBe(true)
    expect(result.ready).toBe(true)
  })

  it('requires a note when the topic-only purpose is other', () => {
    const content = readyContent()
    content.alignmentMode = 'topic_only'
    content.alignmentPurpose = 'other'
    expect(validateLessonPlan(content).items.find((item) => item.key === 'competency')?.passed).toBe(false)

    content.alignmentNote = 'Locally requested school activity'
    expect(validateLessonPlan(content).items.find((item) => item.key === 'competency')?.passed).toBe(true)
  })

  it('supports a topic with one verified competency and synchronizes the legacy projection', () => {
    const content = readyContent()
    const selected = competency('competency-1', 'Solve routine and non-routine problems involving percentage change.')
    const aligned = syncLessonCompetencyProjection({
      ...content,
      curriculumAlignments: [selected],
      primaryCompetencyId: selected.id,
    })

    expect(aligned.alignmentMode).toBe('curriculum_aligned')
    expect(aligned.primaryCompetencyId).toBe(selected.id)
    expect(aligned.competency).toEqual(selected)
    expect(validateLessonPlan(aligned).items.find((item) => item.key === 'competency')?.passed).toBe(true)
  })

  it('supports multiple alignments, changes primary, and promotes deterministically after removal', () => {
    const first = competency('competency-1', 'Represent percentage increase and decrease in familiar contexts.')
    const second = competency('competency-2', 'Solve problems involving percentage increase and decrease.')
    const third = competency('competency-3', 'Explain solutions to percentage change problems using appropriate representations.')
    const aligned = syncLessonCompetencyProjection({
      ...readyContent(),
      curriculumAlignments: [first, second, third],
      primaryCompetencyId: first.id,
    })
    const secondPrimary = setLessonPrimaryCompetency(aligned, second.id)

    expect(secondPrimary.curriculumAlignments.map((item) => item.id)).toEqual([first.id, second.id, third.id])
    expect(secondPrimary.primaryCompetencyId).toBe(second.id)
    expect(secondPrimary.competency).toEqual(second)

    const promoted = removeLessonCompetency(secondPrimary, second.id)
    expect(promoted.curriculumAlignments.map((item) => item.id)).toEqual([first.id, third.id])
    expect(promoted.primaryCompetencyId).toBe(first.id)
    expect(promoted.competency).toEqual(first)
    expect(validateLessonPlan(promoted).items.find((item) => item.key === 'competency')?.passed).toBe(true)
  })

  it('deduplicates alignments without changing their first-seen order', () => {
    const first = competency('competency-1', 'Represent percentage increase and decrease in familiar contexts.')
    const second = competency('competency-2', 'Solve problems involving percentage increase and decrease.')
    const normalized = syncLessonCompetencyProjection({
      ...readyContent(),
      curriculumAlignments: [first, first, second],
      primaryCompetencyId: second.id,
    })

    expect(normalized.curriculumAlignments.map((item) => item.id)).toEqual([first.id, second.id])
    expect(normalized.primaryCompetencyId).toBe(second.id)
  })

  it('does not relabel an explicitly unverified runtime snapshot as verified', () => {
    const untrusted = {
      ...competency('pending-competency', 'A curriculum statement awaiting verification.'),
      verificationStatus: 'pending',
    } as unknown as LessonPlanCompetencySnapshot
    const normalized = normalizeLessonContent({
      ...readyContent(),
      curriculumAlignments: [untrusted],
      primaryCompetencyId: untrusted.id,
      competency: untrusted,
    })

    expect(normalized.curriculumAlignments).toEqual([])
    expect(normalized.primaryCompetencyId).toBeNull()
    expect(normalized.competency).toEqual(emptyLessonCompetencySnapshot())
  })

  it('does not treat a v2 runtime snapshot with omitted verification status as verified', () => {
    const missingStatus = competency('status-missing', 'A runtime statement with incomplete provenance.') as unknown as Record<string, unknown>
    delete missingStatus.verificationStatus
    const normalized = normalizeLessonContent({
      ...readyContent(),
      curriculumAlignments: [missingStatus as unknown as LessonPlanCompetencySnapshot],
      primaryCompetencyId: String(missingStatus.id),
      competency: missingStatus as unknown as LessonPlanCompetencySnapshot,
    })

    expect(normalized.curriculumAlignments).toEqual([])
    expect(normalized.primaryCompetencyId).toBeNull()
    expect(normalized.competency).toEqual(emptyLessonCompetencySnapshot())
  })

  it('preserves an exact serialized v2 round trip through normalization', () => {
    const first = competency('competency-1', 'Represent percentage increase and decrease in familiar contexts.')
    const second = competency('competency-2', 'Solve problems involving percentage increase and decrease.')
    const content = setLessonPrimaryCompetency(syncLessonCompetencyProjection({
      ...readyContent(),
      lessonFocusSource: 'curriculum_derived',
      lessonFocusSourceId: 'domain-1',
      curriculumAlignments: [first, second],
      primaryCompetencyId: first.id,
    }), second.id)
    const serialized = JSON.stringify(content)
    const reloaded = normalizeLessonContent(JSON.parse(serialized) as LessonPlanContent)

    expect(JSON.stringify(reloaded)).toBe(serialized)
    expect(reloaded).toEqual(content)
    expect(reloaded).not.toBe(content)
    expect(reloaded.curriculumAlignments).not.toBe(content.curriculumAlignments)
  })
})
