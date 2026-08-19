import { describe, expect, it } from 'vitest'
import { calculateAnswerSheetCompatibility, isQuestionTypeMachineCheckable } from '../../src/lib/answerSheet/compatibility'
import type { AssessmentBlueprint, AssessmentItem, QuestionType } from '../../src/types/assessment'

function mockItem(itemNumber: number, questionType: QuestionType, points = 1): AssessmentItem {
  return {
    id: `item-${itemNumber}`,
    itemNumber,
    questionType,
    pointsPossible: points,
    points,
    prompt: `Sample prompt for question ${itemNumber}`,
    authorshipState: 'teacher_accepted',
    competencySnapshot: {
      id: 'comp-1',
      code: 'M7NS-Ia-1',
      text: 'Sample competency',
      sourcePage: 12,
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
        { id: 'c1', text: 'Option A' },
        { id: 'c2', text: 'Option B' },
        { id: 'c3', text: 'Option C' },
        { id: 'c4', text: 'Option D' },
      ],
      choiceId: 'c1',
    },
  }
}

describe('Answer Sheet Question Type Compatibility', () => {
  it('correctly classifies initial OMR vs manual scoring question types', () => {
    // Initial 4 fully local OMR types
    expect(isQuestionTypeMachineCheckable('multiple_choice')).toBe(true)
    expect(isQuestionTypeMachineCheckable('true_false')).toBe(true)
    expect(isQuestionTypeMachineCheckable('multiple_select')).toBe(true)
    expect(isQuestionTypeMachineCheckable('matching')).toBe(true)

    // Manual / Subjective / Future transcription types
    expect(isQuestionTypeMachineCheckable('identification')).toBe(false)
    expect(isQuestionTypeMachineCheckable('fill_in_the_blank')).toBe(false)
    expect(isQuestionTypeMachineCheckable('numerical_answer')).toBe(false)
    expect(isQuestionTypeMachineCheckable('short_answer')).toBe(false)
    expect(isQuestionTypeMachineCheckable('problem_solving')).toBe(false)
    expect(isQuestionTypeMachineCheckable('constructed_response')).toBe(false)
    expect(isQuestionTypeMachineCheckable('essay')).toBe(false)
  })

  it('computes 100% machine-checkable compatibility for pure MCQ assessment', () => {
    const items: AssessmentItem[] = Array.from({ length: 30 }, (_, i) => mockItem(i + 1, 'multiple_choice', 1))
    const blueprint: Pick<AssessmentBlueprint, 'items' | 'totalItems'> = { items, totalItems: 30 }

    const compat = calculateAnswerSheetCompatibility(blueprint)
    expect(compat.totalQuestions).toBe(30)
    expect(compat.totalPoints).toBe(30)
    expect(compat.machineCheckableCount).toBe(30)
    expect(compat.manualScoringCount).toBe(0)
    expect(compat.machineCheckablePercentage).toBe(100)
    expect(compat.isFullyMachineCheckable).toBe(true)
    expect(compat.isScanReady).toBe(true)
    expect(compat.typesBreakdown.length).toBe(1)
    expect(compat.typesBreakdown[0].questionType).toBe('multiple_choice')
    expect(compat.typesBreakdown[0].count).toBe(30)
  })

  it('accurately calculates mixed assessments with automatic and manual items', () => {
    // Example from prompt:
    // 30 multiple choice, 5 true/false, 3 problem solving (5 pts each), 2 essay (10 pts each)
    const items: AssessmentItem[] = [
      ...Array.from({ length: 30 }, (_, i) => mockItem(i + 1, 'multiple_choice', 1)),
      ...Array.from({ length: 5 }, (_, i) => mockItem(31 + i, 'true_false', 1)),
      ...Array.from({ length: 3 }, (_, i) => mockItem(36 + i, 'problem_solving', 5)),
      ...Array.from({ length: 2 }, (_, i) => mockItem(39 + i, 'essay', 10)),
    ]
    const blueprint: Pick<AssessmentBlueprint, 'items' | 'totalItems'> = { items, totalItems: 40 }

    const compat = calculateAnswerSheetCompatibility(blueprint)
    expect(compat.totalQuestions).toBe(40)
    expect(compat.machineCheckableCount).toBe(35) // 30 MCQ + 5 TF
    expect(compat.manualScoringCount).toBe(5) // 3 PS + 2 Essay
    expect(compat.machineCheckablePoints).toBe(35)
    expect(compat.manualScoringPoints).toBe(35) // 3*5 + 2*10
    expect(compat.totalPoints).toBe(70)
    expect(compat.machineCheckablePercentage).toBe(88) // 35/40 = 87.5% -> 88%
    expect(compat.isFullyMachineCheckable).toBe(false)
    expect(compat.isScanReady).toBe(true)
  })

  it('handles manual-only assessments cleanly without failing', () => {
    const items: AssessmentItem[] = [
      mockItem(1, 'constructed_response', 5),
      mockItem(2, 'essay', 10),
    ]
    const compat = calculateAnswerSheetCompatibility({ items, totalItems: 2 })
    expect(compat.totalQuestions).toBe(2)
    expect(compat.machineCheckableCount).toBe(0)
    expect(compat.manualScoringCount).toBe(2)
    expect(compat.machineCheckablePercentage).toBe(0)
    expect(compat.isFullyMachineCheckable).toBe(false)
    expect(compat.isScanReady).toBe(false)
  })
})
