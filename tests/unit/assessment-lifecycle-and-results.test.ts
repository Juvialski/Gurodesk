import { describe, expect, it } from 'vitest'
import {
  editAssessmentItem,
  lockAssessmentItem,
  recoverSingleFillBlankStructure,
  replaceAssessmentItem,
  unlockAssessmentItem,
} from '../../src/lib/assessmentItemLifecycle'
import { calculateResultTotals, scoreAnswerSheet } from '../../src/lib/resultsScoring'
import type { LearnerItemAnswer, ResultAssessmentItemSnapshot } from '../../src/types/results'
import { assessmentItem, assessmentRecord, fixedNow } from './fixtures'

describe('per-item replacement and lock protection', () => {
  it('replaces exactly one item while preserving every other identity and mapping', () => {
    const first = assessmentItem('multiple_choice')
    const second = assessmentItem('multiple_choice', { id: 'item-2', itemNumber: 2 })
    const assessment = assessmentRecord([first, second])
    const replacement = { ...first, prompt: 'Which value is even?' }

    const next = replaceAssessmentItem(assessment, first.id, replacement)

    expect(next.items[0].prompt).toBe('Which value is even?')
    expect(next.items[0].mapping).toEqual(first.mapping)
    expect(next.items[1]).toBe(second)
  })

  it('requires the supported explicit unlock flow before editing a locked item', () => {
    const locked = lockAssessmentItem(assessmentItem('multiple_choice'))
    expect(() => editAssessmentItem(locked, { prompt: 'Changed' })).toThrow(/must be unlocked/u)

    const unlocked = unlockAssessmentItem(locked)
    const edited = editAssessmentItem(unlocked, { prompt: 'Changed safely' })
    expect(edited.prompt).toBe('Changed safely')
    expect(edited.locked).toBe(false)
    expect(edited.qaState).toBe('answer_needs_recheck')
  })


  it('recovers one lost structured blank from the newest valid item history', () => {
    const source = assessmentItem('fill_in_the_blank', {
      prompt: 'If one complementary angle is 42 degrees, the other angle is ____ degrees.',
      answer: { type: 'fill_in_the_blank', blanks: [] },
      locked: true,
      qaState: 'locked',
      history: [{
        id: 'prior-fill',
        savedAt: '2026-08-10T00:00:00.000Z',
        source: 'generated',
        prompt: 'If one complementary angle is 42 degrees, the other angle is ____ degrees.',
        questionType: 'fill_in_the_blank',
        answer: { type: 'fill_in_the_blank', blanks: [{ id: 'blank-1', acceptedAnswers: ['48'] }] },
        rationale: 'Complementary angles total 90 degrees.',
        teacherNotes: '',
        pointsPossible: 1,
        points: 1,
        qaState: 'generated',
      }],
    })

    const recovered = recoverSingleFillBlankStructure(source)
    expect(recovered.answer).toEqual({ type: 'fill_in_the_blank', blanks: [{ id: 'blank-1', acceptedAnswers: ['48'] }] })
    const unlocked = unlockAssessmentItem(recovered)
    expect(unlocked.locked).toBe(false)
    expect(unlocked.qaState).toBe('needs_review')
  })

  it('creates only a blank shell for one visible marker when no prior answer exists, and does not guess multi-blank structure', () => {
    const one = assessmentItem('fill_in_the_blank', {
      prompt: 'The missing value is ____.',
      answer: { type: 'fill_in_the_blank', blanks: [] },
    })
    expect(recoverSingleFillBlankStructure(one).answer).toEqual({ type: 'fill_in_the_blank', blanks: [{ id: 'blank-1', acceptedAnswers: [] }] })

    const many = assessmentItem('fill_in_the_blank', {
      prompt: 'The values are ____ and ____.',
      answer: { type: 'fill_in_the_blank', blanks: [] },
    })
    expect(recoverSingleFillBlankStructure(many).answer).toEqual({ type: 'fill_in_the_blank', blanks: [] })
  })
})

describe('partial-credit totals regression', () => {
  it('sums earned points instead of counting only fully correct items', () => {
    const base = assessmentItem('multiple_choice')
    const items: ResultAssessmentItemSnapshot[] = [
      {
        ...base,
        id: 'objective-1',
        itemNumber: 1,
        prompt: 'Choose A.',
        answer: { type: 'multiple_choice', choices: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }], choiceId: 'A' },
        pointsPossible: 1,
        points: 1,
      },
      {
        ...base,
        id: 'partial-5',
        itemNumber: 2,
        prompt: 'Complete five parts.',
        questionType: 'fill_in_the_blank',
        answer: {
          type: 'fill_in_the_blank',
          blanks: Array.from({ length: 5 }, (_, index) => ({ id: `b${index + 1}`, acceptedAnswers: [`v${index + 1}`], pointsPossible: 1 })),
        },
        pointsPossible: 5,
        points: 5,
      },
      {
        ...base,
        id: 'essay-10',
        itemNumber: 3,
        prompt: 'Explain your reasoning.',
        questionType: 'essay',
        answer: { type: 'essay', keyPoints: ['Clear reasoning'], rubric: [{ id: 'r1', label: 'Reasoning', pointsPossible: 10 }] },
        pointsPossible: 10,
        points: 10,
      },
    ]
    const answers: Record<string, LearnerItemAnswer> = {
      'objective-1': { type: 'multiple_choice', choiceId: 'A' },
      'partial-5': { type: 'fill_in_the_blank', blanks: { b1: 'v1', b2: 'v2', b3: 'v3', b4: 'wrong', b5: 'wrong' } },
      'essay-10': { type: 'essay', text: 'A teacher-reviewed response.' },
    }
    const outcomes = scoreAnswerSheet(
      { id: 'session-1', shortAnswerScoring: { defaultMode: 'manual', itemModes: {} } },
      { participantId: 'participant-1', learnerId: 'learner-1' },
      answers,
      items,
      { 'essay-10': 8 },
      fixedNow,
    )

    expect(outcomes.map((outcome) => outcome.earnedPoints)).toEqual([1, 3, 8])
    const totals = calculateResultTotals(outcomes)
    expect(totals.rawScore).toBe(12)
    expect(totals.possiblePoints).toBe(16)
    expect(totals.rawScore).not.toBe(totals.correctItems)
  })
})
