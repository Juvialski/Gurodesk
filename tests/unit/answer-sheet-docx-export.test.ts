import { describe, expect, it } from 'vitest'
import {
  buildAnswerSheetDocxBlob,
  resolveSlipsPerPage,
} from '../../src/lib/answerSheet/answerSheetDocxExport'
import type { AssessmentRecord, AssessmentItem } from '../../src/types/assessment'

function mockItem(itemNumber: number): AssessmentItem {
  return {
    id: `item-${itemNumber}`,
    itemNumber,
    questionType: itemNumber % 3 === 0 ? 'true_false' : 'multiple_choice',
    pointsPossible: 1,
    points: 1,
    prompt: `Question prompt ${itemNumber}`,
    authorshipState: 'teacher_accepted',
    competencySnapshot: {
      id: 'comp-1',
      code: 'M7NS-Ia-1',
      text: 'Square roots',
      sourcePage: 10,
      academicPeriodId: 'q1',
      curriculumPeriodId: 'q1',
      curriculumPeriodLabel: 'Quarter 1',
    },
    cognitiveCategorySnapshot: {
      id: 'cog-1',
      label: 'Remembering',
      shortLabel: 'Rem',
    },
    mapping: {
      rowId: 'row-1',
      competencyId: 'comp-1',
      cognitiveCategoryId: 'cog-1',
      allocationItemStart: itemNumber,
      allocationItemEnd: itemNumber,
      allocationIndex: 1,
    },
    answer: {
      type: 'multiple_choice',
      choices: [
        { id: 'c1', text: 'Choice A' },
        { id: 'c2', text: 'Choice B' },
        { id: 'c3', text: 'Choice C' },
        { id: 'c4', text: 'Choice D' },
      ],
      choiceId: 'c1',
    },
  }
}

function mockAssessment(itemCount: number): AssessmentRecord {
  return {
    id: 'asm-101',
    userId: 'teacher-1',
    assignmentId: null,
    title: 'Quiz: Square Roots & Irrational Numbers',
    instructions: 'Choose the best answer for each question.',
    learningArea: 'Mathematics',
    gradeLevel: 'Grade 7',
    schoolYear: '2025-2026',
    gradingTermId: 'q1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: itemCount,
    totalPoints: itemCount,
    status: 'final',
    versionNumber: 1,
    items: Array.from({ length: itemCount }, (_, i) => mockItem(i + 1)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('Answer Sheet Docx Export & Density Resolution', () => {
  it('correctly resolves paper-saving slips per page in auto mode', () => {
    // 10 items (short quiz) -> 3-up (1/3 sheet)
    expect(resolveSlipsPerPage(10, 'auto')).toBe(3)
    // 20 items (medium quiz) -> 2-up (half sheet)
    expect(resolveSlipsPerPage(20, 'auto')).toBe(2)
    // 50 items (full exam) -> 1-up (full sheet)
    expect(resolveSlipsPerPage(50, 'auto')).toBe(1)
  })

  it('respects manual density overrides', () => {
    expect(resolveSlipsPerPage(10, '1-up')).toBe(1)
    expect(resolveSlipsPerPage(10, '2-up')).toBe(2)
    expect(resolveSlipsPerPage(50, '3-up')).toBe(3)
    expect(resolveSlipsPerPage(50, '4-up')).toBe(4)
  })

  it('builds a valid DOCX binary blob for generic multi-up answer sheet', async () => {
    const assessment = mockAssessment(15)
    const blob = await buildAnswerSheetDocxBlob(assessment, {
      mode: 'generic',
      paperSize: 'a4',
      density: '2-up',
      copies: 4,
    })

    expect(blob).toBeDefined()
    expect(blob.size).toBeGreaterThan(1000)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('builds a valid DOCX binary blob for personalized student roster answer sheets', async () => {
    const assessment = mockAssessment(10)
    const now = new Date().toISOString()
    const learners = [
      {
        id: 'l1',
        userId: 'teacher-1',
        assignmentId: 'asg-1',
        sectionName: 'Grade 7 - Diamond',
        displayName: 'Dela Cruz, Juan',
        localReference: '123456789012',
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'l2',
        userId: 'teacher-1',
        assignmentId: 'asg-1',
        sectionName: 'Grade 7 - Diamond',
        displayName: 'Santos, Maria',
        localReference: '123456789013',
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'l3',
        userId: 'teacher-1',
        assignmentId: 'asg-1',
        sectionName: 'Grade 7 - Diamond',
        displayName: 'Reyes, Pedro',
        localReference: '123456789014',
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const blob = await buildAnswerSheetDocxBlob(assessment, {
      mode: 'personalized',
      paperSize: 'letter',
      density: '3-up',
      learners,
      sectionName: 'Grade 7 - Diamond',
    })

    expect(blob).toBeDefined()
    expect(blob.size).toBeGreaterThan(1000)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })
})
