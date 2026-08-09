import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assessmentItem, assessmentRecord } from './fixtures'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  queuedModels: [] as string[],
}))

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke: mocks.invoke } },
}))

vi.mock('../../src/lib/assessmentRequestScheduler', () => ({
  assessmentRequestScheduler: {
    enqueue: async <T>(model: string, task: (context: { attempt: number; model: string }) => Promise<T>) => {
      mocks.queuedModels.push(model)
      return task({ attempt: 1, model })
    },
  },
}))

import {
  generateAssessmentItemSuggestion,
  validateAssessmentCandidate,
} from '../../src/lib/assessmentGeneration'

function multipleChoiceCandidate() {
  return {
    questionType: 'multiple_choice' as const,
    prompt: 'Which shape has three sides?',
    answer: {
      type: 'multiple_choice' as const,
      choices: [
        { id: 'A', text: 'Triangle' },
        { id: 'B', text: 'Square' },
      ],
      choiceId: 'A',
    },
    rationale: 'A triangle has exactly three sides.',
    referencedResources: [],
  }
}

function problemCandidate(prompt = 'Solve the equation x + 2 = 5 and show the key steps.') {
  return {
    questionType: 'problem_solving' as const,
    prompt,
    answer: {
      type: 'problem_solving' as const,
      finalAnswer: 'x = 3',
      solutionOutline: 'Subtract 2 from both sides of the equation.',
    },
    rationale: 'The item checks an exact multi-step mathematical response.',
    referencedResources: [],
  }
}

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.queuedModels.length = 0
})

describe('quota-free assessment AI orchestration', () => {
  it('uses generation only for a valid low-risk item', async () => {
    const item = assessmentItem('multiple_choice')
    const assessment = assessmentRecord([item])
    mocks.invoke.mockResolvedValueOnce({
      data: { candidate: multipleChoiceCandidate(), model: 'gemini-3.5-flash-lite', fallbackUsed: false },
      error: null,
    })

    const suggestion = await generateAssessmentItemSuggestion({ assessment, item, demo: false })

    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    expect(suggestion.risk?.level).toBe('low')
    expect(suggestion.requestsUsed).toBe(1)
    expect(suggestion.repairAttempted).toBe(false)
  })

  it('reviews a high-risk item and performs only one targeted repair', async () => {
    const item = assessmentItem('problem_solving', {
      cognitiveCategorySnapshot: { id: 'analyzing', label: 'Analyzing', shortLabel: 'A' },
    })
    const assessment = assessmentRecord([item])
    mocks.invoke
      .mockResolvedValueOnce({
        data: { candidate: problemCandidate(), model: 'gemini-3.5-flash-lite', fallbackUsed: false },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          verifier: {
            status: 'needs_repair',
            answerValid: false,
            competencyAligned: true,
            cognitiveAlignment: 'good',
            ambiguityDetected: false,
            factualOrMathIssue: true,
            issues: ['The explanation needs a clearer inverse-operation step.'],
            repairGuidance: ['State that 2 is subtracted from each side.'],
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { candidate: problemCandidate('Solve x + 2 = 5. Subtract 2 from each side and state x.'), approvedResources: [] },
        error: null,
      })

    const suggestion = await generateAssessmentItemSuggestion({ assessment, item, demo: false })

    expect(mocks.invoke).toHaveBeenCalledTimes(3)
    expect(mocks.invoke.mock.calls.map(([_, options]) => options.body.operation ?? 'generate')).toEqual([
      'generate',
      'verify',
      'repair',
    ])
    expect(suggestion.risk?.verifyRecommended).toBe(true)
    expect(suggestion.repairAttempted).toBe(true)
    expect(suggestion.requestsUsed).toBe(3)
    expect(mocks.queuedModels).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
    ])
  })

  it('rejects malformed provider JSON before it can change a draft', () => {
    expect(() => validateAssessmentCandidate('{not-json', 'multiple_choice')).toThrow(/not valid JSON/u)
  })

  it('never calls a provider in demo mode', async () => {
    const item = assessmentItem('multiple_choice')
    const suggestion = await generateAssessmentItemSuggestion({ assessment: assessmentRecord([item]), item, demo: true })
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(suggestion.model).toBe('demo-local-preview')
  })
})
