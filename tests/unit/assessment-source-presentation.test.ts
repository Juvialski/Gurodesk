import { describe, expect, it } from 'vitest'
import { assessmentItemSourcePresentation, assessmentSourcePresentation } from '../../src/lib/assessmentSourcePresentation'
import type { AssessmentItem, AssessmentRecord } from '../../src/types/assessment'

function record(overrides: Partial<AssessmentRecord>): AssessmentRecord {
  return {
    id: 'assessment-1', userId: 'user-1', assignmentId: 'assignment-1', title: 'Trial', status: 'draft',
    mode: 'standard', sourceType: 'tos', schoolYear: '2026-2027', gradeLevel: 'Grade 7', learningArea: 'Mathematics',
    gradingTermLabel: 'Quarter 1', instructions: '', totalItems: 0, totalPoints: 0, items: [], createdAt: '', updatedAt: '',
    ...overrides,
  } as AssessmentRecord
}

describe('assessment source presentation', () => {
  it('keeps standard assessments explicitly TOS-based', () => {
    const source = assessmentSourcePresentation(record({ sourceTos: { id: 'tos-1', title: 'Q1 TOS' } as AssessmentRecord['sourceTos'] }))
    expect(source.label).toBe('Based on finalized TOS')
    expect(source.title).toBe('Q1 TOS')
    expect(source.protectionText).toContain('TOS mapping')
  })

  it('shows a reloaded single-lesson quiz as lesson-based', () => {
    const source = assessmentSourcePresentation(record({
      mode: 'lesson_quiz', sourceType: 'lesson_plan',
      sourceLesson: { id: 'lesson-1', title: 'Constructing Triangles' } as AssessmentRecord['sourceLesson'],
      sourceTos: undefined,
    }))
    expect(source.label).toBe('Based on lesson plan')
    expect(source.title).toBe('Constructing Triangles')
    expect(source.protectionText).toContain('Lesson coverage')
  })

  it('shows unit quizzes from multiple lesson plans without falling back to TOS', () => {
    const source = assessmentSourcePresentation(record({
      mode: 'unit_quiz', sourceType: 'multi_lesson_plan', sourceTos: undefined,
      sourceLessons: [
        { id: 'lesson-1', title: 'Lesson A' },
        { id: 'lesson-2', title: 'Lesson B' },
      ] as AssessmentRecord['sourceLessons'],
    }))
    expect(source.label).toBe('Based on lesson plans')
    expect(source.title).toBe('Lesson A + 1 more lesson')
  })

  it('keeps performance-task provenance mode-aware', () => {
    const source = assessmentSourcePresentation(record({
      mode: 'performance_task', sourceType: 'lesson_plan', sourceTos: undefined,
      sourceLesson: { id: 'lesson-1', title: 'Performance Anchor Lesson' } as AssessmentRecord['sourceLesson'],
    }))
    expect(source.label).toBe('Based on lesson plan')
    expect(source.title).toBe('Performance Anchor Lesson')
    expect(source.protectionText).toContain('rubric alignment')
  })

  it('labels lesson-coverage item mappings without TOS language', () => {
    const item = { mapping: { kind: 'lesson_coverage', coverageEntryId: 'coverage-1', sourceLessonId: 'lesson-1' } } as AssessmentItem
    expect(assessmentItemSourcePresentation(item)).toEqual({
      label: 'Based on lesson coverage',
      lockLabel: 'Lesson coverage mapping locked',
    })
  })
})
