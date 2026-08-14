import { describe, expect, it } from 'vitest'
import {
  createLessonSourceSnapshot,
  isLessonSourceSnapshot,
} from '../../src/lib/assessmentLessonSnapshot'
import {
  allocateLessonCoverage,
  allocateLargestRemainder,
} from '../../src/lib/assessmentCoveragePlan'
import {
  calculateRubricTotalPoints,
  createDefaultPerformanceTaskRubric,
  createPerformanceTaskContent,
  validatePerformanceTaskRubric,
} from '../../src/lib/performanceTaskRubric'
import {
  createLessonQuizBlueprint,
  createUnitQuizBlueprint,
  createPerformanceTaskBlueprint,
  duplicateAssessmentBlueprint,
} from '../../src/lib/assessmentBlueprint'
import { validateAssessmentDraft } from '../../src/lib/assessmentValidation'
import {
  createAssessmentFromLessonPlan,
  createAssessmentFromUnitLessons,
  resolveAssessmentCreationAssignment,
} from '../../src/lib/assessmentRepository'
import type { LessonPlanRecord } from '../../src/types/lessonPlan'

function createSampleLesson(id: string, title: string, competenciesCount: number = 2): LessonPlanRecord {
  return {
    id,
    userId: 'teacher-1',
    assignmentId: 'assignment-1',
    title,
    schoolYear: '2026-2027',
    academicPeriodLabel: 'Quarter 2',
    status: 'final',
    versionNumber: 1,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
    content: {
      intentions: {
        learningObjectives: [
          'Identify the parts of a plant cell',
          'Compare plant and animal cell structures',
        ],
      },
      curriculumAlignments: Array.from({ length: competenciesCount }, (_, i) => ({
        id: `comp-${id}-${i + 1}`,
        competencyCode: `SCI8-Q2-C${i + 1}`,
        statement: `Competency ${i + 1} for ${title}`,
      })),
      lessonStages: [],
      materials: ['Microscope', 'Prepared slides'],
      evaluation: '10-item formative quiz',
    },
  } as unknown as LessonPlanRecord
}

describe('Lesson-Plan-Based Assessment System', () => {
  describe('Lesson Snapshots', () => {
    it('creates an immutable snapshot from a lesson plan record', () => {
      const lesson = createSampleLesson('lesson-101', 'Cell Structure and Function')
      const snapshot = createLessonSourceSnapshot(lesson)

      expect(snapshot.id).toBe('lesson-101')
      expect(snapshot.title).toBe('Cell Structure and Function')
      expect(snapshot.learningObjectives).toHaveLength(2)
      expect(snapshot.competencies).toHaveLength(2)
      expect(snapshot.competencies[0].code).toBe('SCI8-Q2-C1')
      expect(isLessonSourceSnapshot(snapshot)).toBe(true)
    })
  })

  describe('Coverage Allocation & Multi-Lesson Distribution', () => {
    it('distributes items accurately using Largest Remainder (Hamilton) method', () => {
      const allocation = allocateLargestRemainder(10, [3, 3, 3])
      expect(allocation.reduce((a, b) => a + b, 0)).toBe(10)
      expect(allocation).toEqual([4, 3, 3])
    })

    it('allocates single-lesson coverage cleanly across competencies and cognitive levels', () => {
      const lesson = createLessonSourceSnapshot(createSampleLesson('lesson-1', 'Photosynthesis', 2))
      const coverage = allocateLessonCoverage({
        lessons: [lesson],
        totalItems: 10,
      })

      expect(coverage.totalItems).toBe(10)
      expect(coverage.entries.length).toBeGreaterThan(0)
      const allocatedSum = coverage.entries.reduce((sum, e) => sum + e.targetItemCount, 0)
      expect(allocatedSum).toBe(10)

      const allItemNumbers = coverage.entries.flatMap((e) => e.allocatedItemNumbers).sort((a, b) => a - b)
      expect(allItemNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it('allocates multi-lesson unit coverage with weights', () => {
      const l1 = createLessonSourceSnapshot(createSampleLesson('l1', 'Cell Division', 2))
      const l2 = createLessonSourceSnapshot(createSampleLesson('l2', 'Genetics', 2))
      const l3 = createLessonSourceSnapshot(createSampleLesson('l3', 'Ecosystems', 2))

      const coverage = allocateLessonCoverage({
        lessons: [l1, l2, l3],
        totalItems: 15,
        lessonWeights: { l1: 2, l2: 2, l3: 1 },
      })

      expect(coverage.totalItems).toBe(15)
      const lessonAllocations = new Map<string, number>()
      coverage.entries.forEach((e) => {
        lessonAllocations.set(e.sourceLessonId, (lessonAllocations.get(e.sourceLessonId) || 0) + e.targetItemCount)
      })

      expect(lessonAllocations.get('l1')).toBe(6)
      expect(lessonAllocations.get('l2')).toBe(6)
      expect(lessonAllocations.get('l3')).toBe(3)
    })
  })

  describe('Performance Task Rubric Logic', () => {
    it('creates default analytic rubric with 4 levels', () => {
      const rubric = createDefaultPerformanceTaskRubric('Scientific Investigation')
      expect(rubric.title).toBe('Scientific Investigation')
      expect(rubric.criteria.length).toBeGreaterThan(0)
      expect(rubric.criteria[0].levels).toHaveLength(4)
      expect(calculateRubricTotalPoints(rubric)).toBe(rubric.totalPoints)
    })

    it('validates a valid rubric successfully', () => {
      const rubric = createDefaultPerformanceTaskRubric('Model Building')
      const result = validatePerformanceTaskRubric(rubric)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('creates performance task content structure with scenario and expected output', () => {
      const content = createPerformanceTaskContent({
        title: 'Cell Model Construction',
        scenario: 'Students will construct a 3D plant cell model.',
        expectedOutput: 'A labeled 3D physical model or diagram.',
      })
      expect(content.title).toBe('Cell Model Construction')
      expect(content.scenario).toContain('3D plant cell')
      expect(content.rubric.totalPoints).toBeGreaterThan(0)
    })
  })

  describe('Blueprint Factory & Multi-Mode Integration', () => {
    it('generates a valid single-lesson quiz blueprint', () => {
      const lesson = createSampleLesson('l-100', 'Force and Motion')
      const blueprint = createLessonQuizBlueprint(lesson, { totalItems: 10 })

      expect(blueprint.mode).toBe('lesson_quiz')
      expect(blueprint.sourceType).toBe('lesson_plan')
      expect(blueprint.totalItems).toBe(10)
      expect(blueprint.items).toHaveLength(10)
      expect(blueprint.sourceLesson?.id).toBe('l-100')

      const validation = validateAssessmentDraft(blueprint)
      expect(validation.errors).toHaveLength(0)
    })

    it('generates a valid multi-lesson unit quiz blueprint', () => {
      const lessons = [
        createSampleLesson('u-1', 'Newton First Law'),
        createSampleLesson('u-2', 'Newton Second Law'),
      ]
      const blueprint = createUnitQuizBlueprint(lessons, { totalItems: 12 })

      expect(blueprint.mode).toBe('unit_quiz')
      expect(blueprint.sourceType).toBe('multi_lesson_plan')
      expect(blueprint.totalItems).toBe(12)
      expect(blueprint.items).toHaveLength(12)
      expect(blueprint.sourceLessons).toHaveLength(2)

      const validation = validateAssessmentDraft(blueprint)
      expect(validation.errors).toHaveLength(0)
    })

    it('generates a valid authentic performance task blueprint', () => {
      const lesson = createSampleLesson('pt-1', 'Ecosystem Conservation')
      const blueprint = createPerformanceTaskBlueprint({ lesson }, {
        title: 'Community Biodiversity Campaign',
      })

      expect(blueprint.mode).toBe('performance_task')
      expect(blueprint.sourceType).toBe('lesson_plan')
      expect(blueprint.totalItems).toBe(0)
      expect(blueprint.items).toHaveLength(0)
      expect(blueprint.performanceTask).toBeDefined()
      expect(blueprint.totalPoints).toBe(blueprint.performanceTask?.rubric.totalPoints)

      const validation = validateAssessmentDraft(blueprint)
      expect(validation.errors).toHaveLength(0)
    })

    it('supports duplicateAssessmentBlueprint for new assessment modes', () => {
      const lesson = createSampleLesson('l-copy', 'Thermodynamics')
      const original = createLessonQuizBlueprint(lesson, { totalItems: 5 })
      const copy = duplicateAssessmentBlueprint(original)

      expect(copy.id).not.toBe(original.id)
      expect(copy.mode).toBe('lesson_quiz')
      expect(copy.sourceType).toBe('lesson_plan')
      expect(copy.sourceLesson?.id).toBe(original.sourceLesson?.id)
      expect(copy.items).toHaveLength(5)
    })
  })
})

describe('assessment creation assignment resolution', () => {
  it('lets a teacher explicitly place a legacy unlinked lesson into an active assignment', () => {
    expect(resolveAssessmentCreationAssignment([null], 'assignment-2')).toBe('assignment-2')
  })

  it('creates a legacy lesson quiz using the explicitly selected teaching assignment', async () => {
    const legacyLesson = createSampleLesson('legacy-lesson', 'Legacy Lesson')
    legacyLesson.assignmentId = null
    const assessment = await createAssessmentFromLessonPlan(legacyLesson, 'teacher-1', true, {
      assignmentId: 'assignment-2',
      totalItems: 5,
    })
    expect(assessment.assignmentId).toBe('assignment-2')
    expect(assessment.mode).toBe('lesson_quiz')
  })

  it('keeps the source assignment when a lesson or TOS is already linked', () => {
    expect(resolveAssessmentCreationAssignment(['assignment-1'], 'assignment-1')).toBe('assignment-1')
    expect(resolveAssessmentCreationAssignment(['assignment-1'])).toBe('assignment-1')
  })

  it('rejects overriding an already linked source with a different assignment', () => {
    expect(() => resolveAssessmentCreationAssignment(['assignment-1'], 'assignment-2'))
      .toThrow('does not match the assessment source')
  })

  it('rejects unit sources that belong to different teaching assignments', () => {
    expect(() => resolveAssessmentCreationAssignment(['assignment-1', null, 'assignment-2']))
      .toThrow('different teaching assignments')
  })

  it('rejects a unit quiz assembled from lessons linked to different classes', async () => {
    const first = createSampleLesson('lesson-a', 'Lesson A')
    const second = createSampleLesson('lesson-b', 'Lesson B')
    second.assignmentId = 'assignment-2'
    await expect(createAssessmentFromUnitLessons([first, second], 'teacher-1', true, { totalItems: 10 }))
      .rejects.toThrow('different teaching assignments')
  })
})

