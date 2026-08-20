import type {
  AssessmentBlueprint,
  AssessmentCognitiveCategorySnapshot,
  AssessmentCompetencySnapshot,
  AssessmentItem,
  AssessmentItemMapping,
} from '../../types/assessment'

export type ExternalExamOptions = {
  id?: string
  userId: string
  assignmentId?: string | null
  title: string
  gradeLevel: string
  learningArea: string
  schoolYear?: string
  gradingTermLabel?: string
  totalItems: number
  choicesPerItem?: number // default 4 (A–D)
  keyMap: Record<number, string> // 1-based item number -> choice letter or 'T'/'F'
  defaultQuestionType?: 'multiple_choice' | 'true_false'
}

/**
 * Creates a standard GuroDesk AssessmentBlueprint from an external exam answer key.
 * Enables teachers to generate printable Smart Answer Sheets and scan existing tests.
 * External items are explicitly UNMAPPED to prevent fabricating official DepEd competencies.
 */
export function createExternalExamBlueprint(options: ExternalExamOptions): AssessmentBlueprint {
  const {
    id = `ext-asm-${Date.now()}`,
    userId,
    assignmentId = null,
    title,
    gradeLevel,
    learningArea,
    schoolYear = '2026-2027',
    gradingTermLabel = 'Quarter 1',
    totalItems,
    choicesPerItem = 4,
    keyMap,
    defaultQuestionType = 'multiple_choice',
  } = options

  // External exams do not fabricate official DepEd competencies
  const defaultComp: AssessmentCompetencySnapshot = {
    id: 'comp-ext-unmapped',
    code: null,
    text: 'Unmapped External Assessment Item',
    sourcePage: null,
    academicPeriodId: null,
    curriculumPeriodId: null,
    curriculumPeriodLabel: 'External',
  }

  const defaultCognitive: AssessmentCognitiveCategorySnapshot = {
    id: 'cog-ext-unmapped',
    label: 'Uncategorized',
    shortLabel: 'Uncat',
  }

  const items: AssessmentItem[] = []
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']

  for (let i = 1; i <= totalItems; i++) {
    const rawKey = (keyMap[i] || 'A').toUpperCase()
    const isTrueFalse = defaultQuestionType === 'true_false' || rawKey === 'T' || rawKey === 'F'

    const mapping: AssessmentItemMapping = {
      rowId: `row-ext-${i}`,
      competencyId: defaultComp.id,
      cognitiveCategoryId: defaultCognitive.id,
      allocationItemStart: i,
      allocationItemEnd: i,
      allocationIndex: i,
    }

    if (isTrueFalse) {
      const boolVal = rawKey === 'T' || rawKey === 'TRUE'
      items.push({
        id: `ext-item-${i}`,
        itemNumber: i,
        questionType: 'true_false',
        prompt: `Question ${i}`,
        pointsPossible: 1,
        points: 1,
        authorshipState: 'teacher_accepted',
        competencySnapshot: defaultComp,
        cognitiveCategorySnapshot: defaultCognitive,
        mapping,
        answer: {
          type: 'true_false',
          value: boolVal,
        },
      })
    } else {
      const numChoices = Math.max(2, Math.min(6, choicesPerItem))
      const choices = letters.slice(0, numChoices).map((letter) => ({
        id: letter,
        text: `Option ${letter}`,
      }))

      const choiceId = choices.some((c) => c.id === rawKey) ? rawKey : choices[0].id

      items.push({
        id: `ext-item-${i}`,
        itemNumber: i,
        questionType: 'multiple_choice',
        prompt: `Question ${i}`,
        pointsPossible: 1,
        points: 1,
        authorshipState: 'teacher_accepted',
        competencySnapshot: defaultComp,
        cognitiveCategorySnapshot: defaultCognitive,
        mapping,
        answer: {
          type: 'multiple_choice',
          choices,
          choiceId,
        },
      })
    }
  }

  return {
    id,
    userId,
    assignmentId,
    title: title.trim() || 'External Exam (Answer Sheet)',
    instructions: 'Shade the circle corresponding to your answer for each item.',
    gradeLevel,
    learningArea,
    schoolYear,
    gradingTermId: 'q1',
    gradingTermLabel,
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: [gradingTermLabel],
    totalItems,
    items,
    versionNumber: 1,
    status: 'final',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
