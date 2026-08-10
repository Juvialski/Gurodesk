import { describe, expect, it } from 'vitest'
import { applyQuestionTypeDistributionToEmptySlots } from '../../src/lib/assessmentDistribution'
import { generateMissingAssessmentItems, validateAssessmentCandidate } from '../../src/lib/assessmentGeneration'
import type { AssessmentItem, AssessmentRecord, AssessmentSettings, QuestionType } from '../../src/types/assessment'
import { ASSESSMENT_QUESTION_TYPES } from '../../src/types/assessment'
import { generationConfigFor } from '../../supabase/functions/_shared/ai-models'

function item(index: number, options: { prompt?: string; type?: QuestionType; state?: AssessmentItem['authorshipState']; locked?: boolean } = {}): AssessmentItem {
  const type = options.type ?? 'multiple_choice'
  return {
    id: `item-${index}`,
    itemNumber: index,
    competencySnapshot: { id: 'competency', code: null, text: 'Competency', sourcePage: null, academicPeriodId: null, curriculumPeriodId: null, curriculumPeriodLabel: 'Quarter 1' },
    cognitiveCategorySnapshot: { id: 'remembering', label: 'Remembering', shortLabel: 'R' },
    mapping: { rowId: 'row-1', competencyId: 'competency', cognitiveCategoryId: 'remembering', allocationItemStart: 1, allocationItemEnd: 40, allocationIndex: index - 1 },
    prompt: options.prompt ?? '',
    questionType: type,
    answer: type === 'multiple_choice'
      ? { type: 'multiple_choice', choices: [], choiceId: '' }
      : { type: 'true_false', value: false } as never,
    authorshipState: options.state ?? 'empty',
    pointsPossible: 1,
    points: 1,
    qaState: options.locked ? 'locked' : 'empty',
    locked: options.locked ?? false,
  }
}

function balancedSettings(): AssessmentSettings {
  return {
    mode: 'auto_balanced',
    allowedTypes: [...ASSESSMENT_QUESTION_TYPES],
    defaultPoints: {
      multiple_choice: 1,
      true_false: 1,
      short_answer: 1,
      constructed_response: 5,
      identification: 1,
      fill_in_the_blank: 1,
      numerical_answer: 1,
      problem_solving: 3,
      matching: 1,
      multiple_select: 1,
      essay: 10,
    },
    targetTotalPoints: null,
  }
}

function record(items: AssessmentItem[]): AssessmentRecord {
  return {
    id: 'assessment-1',
    userId: 'user-1',
    assignmentId: null,
    title: 'Assessment',
    instructions: '',
    gradeLevel: 'Grade 7',
    learningArea: 'Mathematics',
    schoolYear: '2026-2027',
    gradingTermId: 'term-1',
    gradingTermLabel: 'Term 1',
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: items.length,
    settings: balancedSettings(),
    versionNumber: 1,
    status: 'draft',
    sourceTos: {} as AssessmentRecord['sourceTos'],
    items,
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  }
}

describe('mixed question generation regressions', () => {
  it('balances a fresh 40-item assessment across every enabled question type', () => {
    const source = Array.from({ length: 40 }, (_, index) => item(index + 1))
    const result = applyQuestionTypeDistributionToEmptySlots(source, balancedSettings())

    expect(Object.keys(result.finalCounts).filter((type) => (result.finalCounts[type as QuestionType] ?? 0) > 0)).toHaveLength(ASSESSMENT_QUESTION_TYPES.length)
    expect(Object.values(result.finalCounts).reduce((sum, value) => sum + (value ?? 0), 0)).toBe(40)
    expect(result.finalCounts.multiple_choice).toBeLessThanOrEqual(4)
    expect(result.finalCounts.essay).toBeGreaterThanOrEqual(3)
    expect(result.items.filter((entry) => entry.questionType === 'essay').every((entry) => entry.pointsPossible === 10)).toBe(true)
    expect(result.items.filter((entry) => entry.questionType === 'problem_solving').every((entry) => entry.pointsPossible === 3)).toBe(true)
  })

  it('preserves 16 completed MCQs and assigns the remaining empty slots to other enabled types first', () => {
    const source = Array.from({ length: 40 }, (_, index) => index < 16
      ? item(index + 1, { prompt: `Existing MCQ ${index + 1}`, state: 'ai_suggestion' })
      : item(index + 1))
    const result = applyQuestionTypeDistributionToEmptySlots(source, balancedSettings())

    expect(result.items.slice(0, 16).every((entry) => entry.questionType === 'multiple_choice')).toBe(true)
    expect(result.items.slice(16).every((entry) => entry.questionType !== 'multiple_choice')).toBe(true)
    expect(new Set(result.items.slice(16).map((entry) => entry.questionType)).size).toBeGreaterThan(5)
  })

  it('never sends deprecated Gemini 3.x sampling parameters while preserving JSON output and high Lite thinking', () => {
    const config = generationConfigFor('gemini-3.5-flash-lite', {
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      candidateCount: 2,
      responseFormat: { text: { mimeType: 'application/json' } },
      maxOutputTokens: 2200,
      questionType: 'multiple_choice',
    })

    expect(config).not.toHaveProperty('temperature')
    expect(config).not.toHaveProperty('topP')
    expect(config).not.toHaveProperty('topK')
    expect(config).not.toHaveProperty('candidateCount')
    expect(config).toHaveProperty('responseFormat.text.mimeType', 'application/json')
    expect(config).toHaveProperty('responseFormat.text.schema.properties.answer.properties.type.enum', ['multiple_choice'])
    expect(config).not.toHaveProperty('responseMimeType')
    expect(config).not.toHaveProperty('responseSchema')
    expect(config.maxOutputTokens).toBe(4096)
    expect(config.thinkingConfig).toEqual({ thinkingLevel: 'HIGH' })
  })

  it('accepts valid structured candidates for every supported question type', () => {
    const candidates: Record<QuestionType, unknown> = {
      multiple_choice: { questionType: 'multiple_choice', prompt: 'Which value is equal to 2 + 2?', answer: { type: 'multiple_choice', choices: [{ id: 'A', text: '3' }, { id: 'B', text: '4' }, { id: 'C', text: '5' }], choiceId: 'B' }, rationale: 'Four is the correct sum.', referencedResources: [] },
      true_false: { questionType: 'true_false', prompt: 'A square has four equal sides.', answer: { type: 'true_false', value: true }, rationale: 'This is a defining property of a square.', referencedResources: [] },
      short_answer: { questionType: 'short_answer', prompt: 'What is 3 multiplied by 4?', answer: { type: 'short_answer', acceptedAnswers: ['12'], caseSensitive: false }, rationale: 'The product is 12.', referencedResources: [] },
      constructed_response: { questionType: 'constructed_response', prompt: 'Explain why the angles in a triangle sum to 180 degrees.', answer: { type: 'constructed_response', expectedResponse: 'A valid explanation using a line parallel to one side.', sampleResponse: 'Draw a parallel line through a vertex and use alternate interior angles.' }, rationale: 'The response checks mathematical reasoning.', referencedResources: [] },
      identification: { questionType: 'identification', prompt: 'Name a polygon with five sides.', answer: { type: 'identification', acceptedAnswers: ['pentagon'], caseSensitive: false }, rationale: 'A five-sided polygon is a pentagon.', referencedResources: [] },
      fill_in_the_blank: { questionType: 'fill_in_the_blank', prompt: 'A triangle has ______ sides.', answer: { type: 'fill_in_the_blank', blanks: [{ id: 'blank-1', acceptedAnswers: ['3'] }] }, rationale: 'A triangle has three sides.', referencedResources: [] },
      numerical_answer: { questionType: 'numerical_answer', prompt: 'Find 25% of 80.', answer: { type: 'numerical_answer', value: 20, tolerance: 0 }, rationale: 'One fourth of 80 is 20.', referencedResources: [] },
      problem_solving: { questionType: 'problem_solving', prompt: 'A rectangle is 6 cm by 4 cm. Find its area.', answer: { type: 'problem_solving', finalAnswer: '24 cm²', solutionOutline: 'Multiply length by width: 6 × 4 = 24.' }, rationale: 'The task requires applying the area formula.', referencedResources: [] },
      matching: { questionType: 'matching', prompt: 'Match each shape to its number of sides.', answer: { type: 'matching', prompts: [{ id: 'p1', text: 'Triangle' }, { id: 'p2', text: 'Square' }], choices: [{ id: 'A', text: '3' }, { id: 'B', text: '4' }], mappings: [{ promptId: 'p1', choiceId: 'A' }, { promptId: 'p2', choiceId: 'B' }], reusableChoices: false }, rationale: 'Each shape maps to its side count.', referencedResources: [] },
      multiple_select: { questionType: 'multiple_select', prompt: 'Select all even numbers.', answer: { type: 'multiple_select', choices: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }, { id: 'C', text: '4' }], choiceIds: ['A', 'C'], scoringPolicy: 'all_or_nothing' }, rationale: 'Two and four are even.', referencedResources: [] },
      essay: { questionType: 'essay', prompt: 'Explain two ways geometry is useful in solving real-world design problems.', answer: { type: 'essay', keyPoints: ['Measurement and scale', 'Shape and spatial reasoning'], scoringNotes: 'Award points for two accurate, explained applications.' }, rationale: 'The prompt allows an extended teacher-scored response.', referencedResources: [] },
    }

    for (const type of ASSESSMENT_QUESTION_TYPES) {
      expect(() => validateAssessmentCandidate(candidates[type], type, [])).not.toThrow()
    }
  })

  it('pauses the batch after a provider request-configuration 400 instead of burning every remaining item', async () => {
    const source = record(Array.from({ length: 6 }, (_, index) => item(index + 1)))
    let calls = 0
    const summary = await generateMissingAssessmentItems({
      assessment: source,
      demo: false,
      concurrency: 1,
      generate: async () => {
        calls += 1
        throw new Error('Gemini rejected the request configuration (400). Invalid request configuration.')
      },
    })

    expect(calls).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.cancelled).toBe(5)
    expect(summary.succeeded).toBe(0)
  })
})
