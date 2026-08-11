import { describe, expect, it, vi } from 'vitest'
import { enrichAssessmentVisualsSequentially } from '../../src/lib/assessmentGeneration'
import { assessmentVisualSemanticFindings } from '../../src/lib/assessmentFinalQa'
import { ASSESSMENT_VISUAL_FIXTURES } from '../../src/lib/assessmentVisualFixtures'
import {
  assessmentVisualPlanForItem,
  assessmentVisualSourceHash,
  invalidateAssessmentVisualAfterContentEdit,
  withResolvedAssessmentVisualPlan,
} from '../../src/lib/assessmentVisualPlanning'
import type { AssessmentItem } from '../../src/types/assessment'
import { assessmentItem, assessmentRecord } from './fixtures'

function plannedVisualItem(itemNumber: number, requirement: 'helpful' | 'required' = 'helpful'): AssessmentItem {
  const prompt = requirement === 'required'
    ? `Use the diagram shown to compare angles for item ${itemNumber}.`
    : `Compare the angle relationships in parallel lines for item ${itemNumber}.`
  return withResolvedAssessmentVisualPlan(assessmentItem('multiple_choice', {
    id: `visual-item-${itemNumber}`,
    itemNumber,
    prompt,
    answer: {
      type: 'multiple_choice',
      choices: [{ id: 'A', text: 'Adjacent' }, { id: 'B', text: 'Vertical' }],
      choiceId: 'B',
    },
    authorshipState: 'teacher_accepted',
    qaState: 'verified',
    visualRequirement: requirement,
    visualIntent: `Draw safe geometry for item ${itemNumber}.`,
  }))
}

describe('separate sequential assessment visual enrichment', () => {
  it('runs in stable item order with one in-flight request and never rewrites questions', async () => {
    const items = [plannedVisualItem(3), plannedVisualItem(1), plannedVisualItem(2)]
    const originals = new Map(items.map((item) => [item.id, { prompt: item.prompt, answer: structuredClone(item.answer) }]))
    let inFlight = 0
    let maxInFlight = 0
    const callOrder: number[] = []
    const generate = vi.fn(async ({ item }: { item: AssessmentItem }) => {
      callOrder.push(item.itemNumber)
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Promise.resolve()
      inFlight -= 1
      return {
        visual: { ...structuredClone(ASSESSMENT_VISUAL_FIXTURES.marksAndLabels), id: `generated-${item.id}` },
        model: 'visual-test-model',
        fallbackUsed: false,
        requestsUsed: 1,
      }
    })

    const summary = await enrichAssessmentVisualsSequentially({
      assessment: assessmentRecord(items),
      demo: false,
      generate,
    })

    expect(callOrder).toEqual([1, 2, 3])
    expect(maxInFlight).toBe(1)
    expect(summary).toMatchObject({ eligible: 3, attempted: 3, succeeded: 3, failed: 0, cancelled: 0, providerPaused: false })
    expect(summary.results.map((item) => item.itemNumber)).toEqual([1, 2, 3])
    for (const item of summary.results) {
      expect(item.prompt).toBe(originals.get(item.id)?.prompt)
      expect(item.answer).toEqual(originals.get(item.id)?.answer)
      expect(item.visualStatus).toBe('succeeded')
      expect(item.visualSourceHash).toBe(assessmentVisualSourceHash(item))
      expect(item.visualAttempts).toBe(1)
    }
  })

  it('keeps an optional question when its helpful visual fails', async () => {
    const item = plannedVisualItem(1, 'helpful')
    const summary = await enrichAssessmentVisualsSequentially({
      assessment: assessmentRecord([item]),
      demo: false,
      generate: async () => { throw new Error('Diagram provider returned malformed geometry.') },
    })

    expect(summary).toMatchObject({ succeeded: 0, failed: 1, helpfulFailed: 1, requiredFailed: 0, providerPaused: false })
    expect(summary.results[0]).toMatchObject({ id: item.id, prompt: item.prompt, answer: item.answer, visualStatus: 'failed', visualAttempts: 1 })
    expect(summary.results[0].visual).toBeUndefined()
    expect(assessmentVisualSemanticFindings(summary.results[0])).toContainEqual(expect.objectContaining({ code: 'helpful-visual-missing', severity: 'warning' }))
  })

  it('retains a hard final-QA blocker when a required visual cannot be produced', async () => {
    const item = plannedVisualItem(1, 'required')
    const summary = await enrichAssessmentVisualsSequentially({
      assessment: assessmentRecord([item]),
      demo: false,
      generate: async () => ({ model: 'visual-test-model', fallbackUsed: false, requestsUsed: 1 }),
    })

    expect(summary).toMatchObject({ failed: 1, helpfulFailed: 0, requiredFailed: 1 })
    expect(summary.results[0].prompt).toBe(item.prompt)
    expect(assessmentVisualSemanticFindings(summary.results[0])).toContainEqual(expect.objectContaining({ code: 'required-visual-missing', severity: 'error' }))
  })

  it('pauses at a provider boundary without burning later visual requests', async () => {
    const items = [plannedVisualItem(1), plannedVisualItem(2), plannedVisualItem(3)]
    const generate = vi.fn(async () => {
      throw Object.assign(new Error('Provider quota reached (429).'), { failureCategory: 'provider_quota', status: 429 })
    })
    const progress: string[] = []
    const summary = await enrichAssessmentVisualsSequentially({
      assessment: assessmentRecord(items),
      demo: false,
      generate,
      onProgress: (value) => progress.push(`${value.itemNumber}:${value.status}`),
    })

    expect(generate).toHaveBeenCalledTimes(1)
    expect(summary).toMatchObject({ attempted: 1, failed: 1, cancelled: 2, providerPaused: true })
    expect(progress).toEqual(['1:failed', '2:cancelled', '3:cancelled'])
  })

  it('upgrades conservative geometry prompts and marks edited visuals stale', () => {
    const unplanned = assessmentItem('short_answer', {
      prompt: 'Explain the relationship between vertical angles and adjacent angles.',
      answer: { type: 'short_answer', acceptedAnswers: ['Vertical angles are congruent.'] },
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    })
    const plan = assessmentVisualPlanForItem(unplanned)
    expect(plan).toMatchObject({ requirement: 'helpful', eligible: true, heuristicUpgraded: true })

    const visualized = withResolvedAssessmentVisualPlan({ ...unplanned, visual: ASSESSMENT_VISUAL_FIXTURES.marksAndLabels })
    const current = { ...visualized, visualSourceHash: assessmentVisualSourceHash(visualized), visualStatus: 'succeeded' as const }
    const edited = invalidateAssessmentVisualAfterContentEdit(current, { ...current, prompt: `${current.prompt} Give one example.` })
    expect(edited.visual).toEqual(current.visual)
    expect(edited.visualStatus).toBe('stale')
    expect(assessmentVisualPlanForItem(edited).current).toBe(false)
  })
})

