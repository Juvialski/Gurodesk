import { describe, expect, it } from 'vitest'
import { applyAssessmentItemCandidate, validateAssessmentCandidate } from '../../src/lib/assessmentGeneration'
import { IRREGULAR_CONCAVE_PENTAGON_VISUAL } from '../../src/lib/assessmentVisualFixtures'
import { ASSESSMENT_QUESTION_TYPES, type QuestionType } from '../../src/types/assessment'
import { assessmentItem } from './fixtures'
import { cloneCandidate, VALID_ASSESSMENT_CANDIDATES } from './assessmentContractFixtures'

describe('assessment AI candidate contract regressions', () => {
  it.each(ASSESSMENT_QUESTION_TYPES)('accepts a deterministic valid %s candidate', (questionType) => {
    const parsed = validateAssessmentCandidate(cloneCandidate(questionType), questionType, [])
    expect(parsed.questionType).toBe(questionType)
    expect(parsed.prompt.length).toBeGreaterThan(3)
    expect(parsed.rationale.length).toBeGreaterThan(3)
  })

  it('keeps the supported question-type registry and fixture table in lockstep', () => {
    expect(Object.keys(VALID_ASSESSMENT_CANDIDATES).sort()).toEqual([...ASSESSMENT_QUESTION_TYPES].sort())
  })

  it.each(ASSESSMENT_QUESTION_TYPES)('rejects malformed JSON before parsing %s candidate fields', (questionType) => {
    expect(() => validateAssessmentCandidate('{"questionType":"multiple_choice"', questionType)).toThrow(/not valid JSON/u)
  })

  it.each(ASSESSMENT_QUESTION_TYPES)('rejects a missing top-level field for %s', (questionType) => {
    const candidate = cloneCandidate(questionType) as unknown as Record<string, unknown>
    delete candidate.answer
    expect(() => validateAssessmentCandidate(candidate, questionType, [])).toThrow()
  })

  it.each(ASSESSMENT_QUESTION_TYPES)('rejects a wrong questionType or wrong answer discriminator for %s', (questionType) => {
    const wrongType: QuestionType = questionType === 'multiple_choice' ? 'true_false' : 'multiple_choice'
    const wrongQuestionType = { ...cloneCandidate(questionType), questionType: wrongType }
    expect(() => validateAssessmentCandidate(wrongQuestionType, questionType, [])).toThrow(/question type does not match/u)

    const wrongAnswer = { ...cloneCandidate(questionType), answer: { ...cloneCandidate(questionType).answer, type: wrongType } }
    expect(() => validateAssessmentCandidate(wrongAnswer, questionType, [])).toThrow(/answer type does not match/u)
  })

  it.each(ASSESSMENT_QUESTION_TYPES)('rejects unsupported fields in the %s answer shape', (questionType) => {
    const candidate = cloneCandidate(questionType)
    const answer = { ...(candidate.answer as unknown as Record<string, unknown>), unsupportedField: 'must not cross the boundary' }
    expect(() => validateAssessmentCandidate({ ...candidate, answer }, questionType, [])).toThrow(/unsupported|shape/u)
  })

  it('rejects unsupported top-level fields instead of silently accepting model metadata', () => {
    expect(() => validateAssessmentCandidate({ ...cloneCandidate('multiple_choice'), model: 'gemini', itemNumber: 1 }, 'multiple_choice', [])).toThrow(/unsupported fields/u)
  })

  it('rejects invented resources for every question type and resource-like claims while allowing exact teacher-listed resources', () => {
    for (const questionType of ASSESSMENT_QUESTION_TYPES) {
      const candidate = cloneCandidate(questionType)
      expect(() => validateAssessmentCandidate({ ...candidate, referencedResources: ['unlisted module'] }, questionType, []), questionType).toThrow(/unlisted teacher resource/u)
    }
    const candidate = cloneCandidate('multiple_choice')
    expect(() => validateAssessmentCandidate({ ...candidate, prompt: 'Use the textbook to answer this item.' }, 'multiple_choice', [])).toThrow(/unverified resource/u)

    const resource = 'Teacher handout: Integers, page 2'
    const grounded = { ...candidate, prompt: `${candidate.prompt} See ${resource}.`, referencedResources: [resource] }
    expect(validateAssessmentCandidate(grounded, 'multiple_choice', [resource]).referencedResources).toEqual([resource])
  })

  it.each(ASSESSMENT_QUESTION_TYPES)('applies only candidate-owned content and preserves immutable mapping, identity, type, and points for %s', (questionType) => {
    const source = assessmentItem(questionType, {
      id: `immutable-${questionType}`,
      itemNumber: 7,
      pointsPossible: 4,
      points: 4,
      prompt: '',
    })
    const next = applyAssessmentItemCandidate(source, cloneCandidate(questionType))

    expect(next.id).toBe(source.id)
    expect(next.itemNumber).toBe(source.itemNumber)
    expect(next.questionType).toBe(source.questionType)
    expect(next.pointsPossible).toBe(source.pointsPossible)
    expect(next.points).toBe(source.points)
    expect(next.mapping).toEqual(source.mapping)
    expect(next.competencySnapshot).toEqual(source.competencySnapshot)
    expect(next.cognitiveCategorySnapshot).toEqual(source.cognitiveCategorySnapshot)
    expect(source.prompt).toBe('')
    expect(next.prompt).toBe(cloneCandidate(questionType).prompt)
  })

  it('does not allow a candidate to replace locked or already-authored content implicitly', () => {
    const candidate = cloneCandidate('multiple_choice')
    const locked = assessmentItem('multiple_choice', { locked: true, qaState: 'locked' })
    expect(() => applyAssessmentItemCandidate(locked, candidate)).toThrow(/locked/iu)

    const authored = assessmentItem('multiple_choice', { prompt: 'Teacher-authored prompt', authorshipState: 'teacher_accepted' })
    expect(() => applyAssessmentItemCandidate(authored, candidate)).toThrow(/protected/u)
    const alternative = applyAssessmentItemCandidate(authored, candidate, { alternative: true })
    expect(alternative.prompt).toBe(candidate.prompt)
    expect(alternative.history?.at(-1)?.prompt).toBe(authored.prompt)
  })

  it('preserves a visual only when the provider omits it and removes it on explicit null', () => {
    const source = assessmentItem('multiple_choice', { visual: IRREGULAR_CONCAVE_PENTAGON_VISUAL })
    const omitted = applyAssessmentItemCandidate(source, cloneCandidate('multiple_choice'))
    expect(omitted.visual).toEqual(IRREGULAR_CONCAVE_PENTAGON_VISUAL)

    const removed = applyAssessmentItemCandidate(source, { ...cloneCandidate('multiple_choice'), visual: null })
    expect(removed.visual).toBeUndefined()

    const replacement = applyAssessmentItemCandidate(source, { ...cloneCandidate('multiple_choice'), visual: { ...IRREGULAR_CONCAVE_PENTAGON_VISUAL, id: 'visual-replacement' } })
    expect(replacement.visual?.id).toBe('visual-replacement')
  })
})
