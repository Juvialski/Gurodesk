import { describe, expect, it } from 'vitest'
import { createLessonQuizBlueprint } from '../../src/lib/assessmentBlueprint'
import type { LessonPlanRecord } from '../../src/types/lessonPlan'

describe('Phase 4 — Flexible Lesson Quiz', () => {
  const mockLessonPlan = {
    id: 'lesson-123',
    userId: 'teacher-1',
    assignmentId: 'assign-1',
    title: 'Photosynthesis & Cellular Respiration',
    status: 'final',
    schoolYear: '2026-2027',
    gradeLevel: 'Grade 9',
    learningArea: 'Science',
    versionNumber: 1,
    content: {
      lessonFocus: 'Photosynthesis light-dependent reactions',
      lessonTitle: 'Photosynthesis & Cellular Respiration',
      lessonDate: '2026-08-20',
      durationMinutes: 60,
      sections: ['Newton'],
      teachingApproaches: ['Direct instruction', 'Guided practice'],
      curriculumPeriodLabel: 'Quarter 1',
      gradingTermLabel: 'Quarter 1',
      references: 'DepEd Science 9 Learner Material',
      intentions: {
        learningObjectives: 'Explain the stages of photosynthesis and differentiate light-dependent from Calvin cycle.',
      },
      alignmentMode: 'curriculum_aligned',
      curriculumAlignments: [
        {
          id: 'comp-1',
          code: 'S9LT-lga-21',
          text: 'Differentiate basic features and importance of photosynthesis and respiration',
          verificationStatus: 'verified',
        },
      ],
      primaryCompetencyId: 'comp-1',
      competency: {
        id: 'comp-1',
        code: 'S9LT-lga-21',
        text: 'Differentiate basic features and importance of photosynthesis and respiration',
      },
      resourcesVerifiedByTeacher: true,
      learningExperience: {
        preLessonActivity: 'Review chloroplast structure',
        lessonFlow: '1. Present diagrams. 2. Guided step-by-step reaction walk-through. 3. Formative check.',
        resources: 'DepEd Science 9 LM',
      },
      assessingLearning: {
        formativeAssessments: '5-item quick check on light-dependent reactions',
        evidenceOfLearning: 'Student exit tickets',
      },
      waysForward: {
        nextSteps: 'Proceed to light-independent reactions tomorrow',
      },
      aiDeclaration: { used: false },
    },
    createdAt: '2026-08-19T00:00:00Z',
    updatedAt: '2026-08-19T00:00:00Z',
  } as unknown as LessonPlanRecord

  it('defaults to 5 items when totalItems is unspecified or invalid', () => {
    const defaultBlueprint = createLessonQuizBlueprint(mockLessonPlan, {})
    expect(defaultBlueprint.items.length).toBe(5)
    expect(defaultBlueprint.totalItems).toBe(5)
    expect(defaultBlueprint.mode).toBe('lesson_quiz')
  })

  it('generates exactly 5 items when requested (recommended default)', () => {
    const blueprint5 = createLessonQuizBlueprint(mockLessonPlan, { totalItems: 5 })
    expect(blueprint5.items.length).toBe(5)
    expect(blueprint5.totalItems).toBe(5)
    expect(blueprint5.items.map((i) => i.itemNumber)).toEqual([1, 2, 3, 4, 5])
  })

  it('generates standard expanded presets: 10, 15, 20 items', () => {
    const blueprint10 = createLessonQuizBlueprint(mockLessonPlan, { totalItems: 10 })
    expect(blueprint10.items.length).toBe(10)

    const blueprint15 = createLessonQuizBlueprint(mockLessonPlan, { totalItems: 15 })
    expect(blueprint15.items.length).toBe(15)

    const blueprint20 = createLessonQuizBlueprint(mockLessonPlan, { totalItems: 20 })
    expect(blueprint20.items.length).toBe(20)
  })

  it('supports custom quantities within safe limits', () => {
    const blueprint7 = createLessonQuizBlueprint(mockLessonPlan, { totalItems: 7 })
    expect(blueprint7.items.length).toBe(7)
    expect(blueprint7.totalItems).toBe(7)

    const blueprint12 = createLessonQuizBlueprint(mockLessonPlan, { totalItems: 12 })
    expect(blueprint12.items.length).toBe(12)
    expect(blueprint12.totalItems).toBe(12)
  })

  it('maintains strict lesson grounding across all generated items', () => {
    const blueprint = createLessonQuizBlueprint(mockLessonPlan, { totalItems: 5 })
    expect(blueprint.sourceLesson?.id).toBe('lesson-123')
    expect(blueprint.sourceLesson?.title).toBe('Photosynthesis & Cellular Respiration')

    blueprint.items.forEach((item) => {
      expect(item.competencySnapshot.id).toBe('comp-1')
      expect(item.competencySnapshot.text).toContain('photosynthesis')
      expect(item.cognitiveCategorySnapshot.id).toBeDefined()
    })
  })
})
