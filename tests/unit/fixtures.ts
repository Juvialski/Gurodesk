import type { AssessmentItem, AssessmentRecord, QuestionType } from '../../src/types/assessment'

export const fixedNow = '2026-08-09T00:00:00.000Z'

export function assessmentItem(
  questionType: QuestionType = 'multiple_choice',
  overrides: Partial<AssessmentItem> = {},
): AssessmentItem {
  const answer: AssessmentItem['answer'] = questionType === 'problem_solving'
    ? { type: 'problem_solving', finalAnswer: '', solutionOutline: '' }
    : questionType === 'essay'
      ? { type: 'essay', keyPoints: [], rubric: [] }
      : { type: 'multiple_choice', choices: [], choiceId: '' }

  return {
    id: 'item-1',
    itemNumber: 1,
    competencySnapshot: {
      id: 'competency-1',
      code: 'G7NS-Ia-1',
      text: 'Represents integers in classroom contexts',
      sourcePage: 1,
      academicPeriodId: 'period-1',
      curriculumPeriodId: 'period-1',
      curriculumPeriodLabel: 'Quarter 1',
    },
    cognitiveCategorySnapshot: {
      id: 'remembering',
      label: 'Remembering',
      shortLabel: 'R',
    },
    mapping: {
      rowId: 'row-1',
      competencyId: 'competency-1',
      cognitiveCategoryId: 'remembering',
      allocationItemStart: 1,
      allocationItemEnd: 1,
      allocationIndex: 0,
    },
    prompt: '',
    questionType,
    answer,
    authorshipState: 'empty',
    rationale: '',
    teacherNotes: '',
    pointsPossible: questionType === 'problem_solving' ? 5 : questionType === 'essay' ? 10 : 1,
    points: questionType === 'problem_solving' ? 5 : questionType === 'essay' ? 10 : 1,
    qaState: 'empty',
    locked: false,
    history: [],
    ...overrides,
  }
}

export function assessmentRecord(items: AssessmentItem[]): AssessmentRecord {
  return {
    id: 'assessment-1',
    userId: 'teacher-a',
    assignmentId: 'assignment-1',
    title: 'Grade 7 Mathematics Assessment',
    instructions: 'Answer every item.',
    gradeLevel: 'Grade 7',
    learningArea: 'Mathematics',
    schoolYear: '2026-2027',
    gradingTermId: 'term-1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['period-1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: items.length,
    totalPoints: items.reduce((sum, item) => sum + item.pointsPossible, 0),
    settings: {
      mode: 'auto_balanced',
      allowedTypes: ['multiple_choice', 'problem_solving', 'essay'],
      defaultPoints: { multiple_choice: 1, problem_solving: 5, essay: 10 },
      targetTotalPoints: null,
    },
    versionNumber: 1,
    status: 'draft',
    sourceTos: {
      id: 'tos-1',
      versionNumber: 1,
      title: 'Finalized TOS',
      status: 'final',
      assignmentId: 'assignment-1',
      schoolYear: '2026-2027',
      academicPeriodLabel: 'Quarter 1',
      content: {
        rows: [],
      } as unknown as AssessmentRecord['sourceTos']['content'],
    },
    items,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  }
}
