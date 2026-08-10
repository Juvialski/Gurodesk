import { describe, expect, it } from 'vitest'
import { AssessmentContractError, validateAssessmentCandidate as validateEdgeCandidate } from '../../supabase/functions/_shared/assessment-contract'
import { ASSESSMENT_QUESTION_TYPES, type QuestionType } from '../../src/types/assessment'
import { cloneCandidate } from './assessmentContractFixtures'

/**
 * The browser and Edge validators intentionally share the same provider
 * contract but have separate runtimes.  These tests consume the Edge export
 * directly so a browser-only contract change cannot ship untested.
 */
function edgeCandidate(questionType: QuestionType) {
  return { ...cloneCandidate(questionType), visual: null }
}

describe('Edge assessment candidate contract regressions', () => {
  it.each(ASSESSMENT_QUESTION_TYPES)('accepts a valid %s candidate', (questionType) => {
    const result = validateEdgeCandidate(edgeCandidate(questionType), questionType, [])
    expect(result.questionType).toBe(questionType)
    expect(result.visual).toBeNull()
  })

  it('deduplicates equivalent fill-in-the-blank accepted answers instead of rejecting the generated item', () => {
    const candidate = {
      ...edgeCandidate('fill_in_the_blank'),
      answer: {
        type: 'fill_in_the_blank',
        blanks: [{ id: 'blank-1', acceptedAnswers: ['Hexagon', 'hexagon.', '  HEXAGON!  '], caseSensitive: false }],
      },
    }
    const result = validateEdgeCandidate(candidate, 'fill_in_the_blank', [])
    expect(result.answer).toMatchObject({ type: 'fill_in_the_blank', blanks: [{ id: 'blank-1', acceptedAnswers: ['Hexagon'] }] })
  })

  it.each(ASSESSMENT_QUESTION_TYPES)('rejects malformed JSON for %s', (questionType) => {
    expect(() => validateEdgeCandidate('{"questionType":', questionType)).toThrowError(AssessmentContractError)
  })

  it.each(ASSESSMENT_QUESTION_TYPES)('rejects missing answer, wrong type, and unsupported answer fields for %s', (questionType) => {
    const candidate = edgeCandidate(questionType)
    const missingAnswer = { ...candidate }
    delete (missingAnswer as Record<string, unknown>).answer
    expect(() => validateEdgeCandidate(missingAnswer, questionType, [])).toThrow()

    const wrongType: QuestionType = questionType === 'multiple_choice' ? 'true_false' : 'multiple_choice'
    expect(() => validateEdgeCandidate({ ...candidate, questionType: wrongType }, questionType, [])).toThrow(/question type/u)
    expect(() => validateEdgeCandidate({ ...candidate, answer: { ...(candidate.answer as unknown as Record<string, unknown>), type: wrongType } }, questionType, [])).toThrow(/answer type/u)
    expect(() => validateEdgeCandidate({ ...candidate, answer: { ...(candidate.answer as unknown as Record<string, unknown>), unsupportedEdgeField: true } }, questionType, [])).toThrow(/unsupported/u)
  })

  it.each(ASSESSMENT_QUESTION_TYPES)('rejects invented resources and immutable context changes for %s', (questionType) => {
    const candidate = edgeCandidate(questionType)
    expect(() => validateEdgeCandidate({ ...candidate, referencedResources: ['unlisted module'] }, questionType, [])).toThrow(/unlisted|resource/u)
    expect(() => validateEdgeCandidate({ ...candidate, itemNumber: 42 }, questionType, [], true, { itemNumber: 1, questionType })).toThrow(/immutable|unsupported/u)
  })
})
