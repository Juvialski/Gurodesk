import { describe, expect, it, vi } from 'vitest'
import { enrichAssessmentVisualsSequentially } from '../../src/lib/assessmentGeneration'
import { assessmentVisualSemanticFindings } from '../../src/lib/assessmentFinalQa'
import { ASSESSMENT_VISUAL_FIXTURES } from '../../src/lib/assessmentVisualFixtures'
import {
  assessmentVisualItemIdsForAssessment,
  assessmentVisualPlanForItem,
  assessmentVisualSourceHash,
  invalidateAssessmentVisualAfterContentEdit,
  promptRequiresAssessmentVisual,
  resolveAssessmentVisualPlans,
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

  it('treats an explicit empty work list as no visual work', async () => {
    const item = plannedVisualItem(1)
    const generate = vi.fn()
    const summary = await enrichAssessmentVisualsSequentially({
      assessment: assessmentRecord([item]),
      demo: false,
      itemIds: [],
      generate,
    })
    expect(generate).not.toHaveBeenCalled()
    expect(summary).toMatchObject({ eligible: 0, attempted: 0, succeeded: 0, failed: 0 })
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

  it('does not force a diagram because a question merely says polygon', () => {
    const item = assessmentItem('multiple_choice', {
      prompt: 'What is a polygon?',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    })
    expect(promptRequiresAssessmentVisual(item.prompt)).toBe(false)
    expect(assessmentVisualPlanForItem(item)).toMatchObject({ requirement: 'none', status: 'not_required', eligible: false })
  })

  it('does not persist a visual suppression decision for empty blueprint slots', () => {
    const empty = assessmentItem('multiple_choice', {
      id: 'empty-before-generation',
      prompt: '',
      authorshipState: 'empty',
      qaState: 'empty',
      visualRequirement: 'none',
      visualStatus: 'not_required',
    })
    const balanced = resolveAssessmentVisualPlans([empty])
    expect(balanced.items[0].visualRequirement).toBeUndefined()
    expect(balanced.items[0].visualStatus).toBeUndefined()

    const generated = {
      ...balanced.items[0],
      prompt: 'An interior angle and its adjacent exterior angle form a linear pair. Find the missing angle.',
      authorshipState: 'ai_suggestion' as const,
      qaState: 'generated' as const,
    }
    expect(assessmentVisualPlanForItem(generated)).toMatchObject({ requirement: 'helpful', status: 'pending', eligible: true })
  })

  it('selects a balanced non-zero visual set for a geometry-heavy twenty-item paper', () => {
    const items = Array.from({ length: 20 }, (_, index) => assessmentItem('multiple_choice', {
      id: `geometry-paper-${index + 1}`,
      itemNumber: index + 1,
      prompt: index % 2 === 0
        ? `Compare the interior angle and exterior angle in polygon situation ${index + 1}.`
        : `Analyze the linear pair in angle relationship ${index + 1}.`,
      authorshipState: 'ai_suggestion',
      qaState: 'generated',
      competencySnapshot: {
        ...assessmentItem().competencySnapshot,
        id: `geometry-competency-${Math.floor(index / 4) + 1}`,
      },
    }))
    const balance = resolveAssessmentVisualPlans(items)
    expect(balance.optionalBudget).toBe(5)
    expect(balance.optionalItemIds).toHaveLength(5)
    expect(assessmentVisualItemIdsForAssessment(balance.items)).toHaveLength(5)
  })

  it('caps optional diagrams at roughly one per four questions and spreads them across competencies', () => {
    const items = Array.from({ length: 8 }, (_, index) => assessmentItem('multiple_choice', {
      id: 'balanced-' + (index + 1),
      itemNumber: index + 1,
      prompt: 'Compare the vertical angles in relationship ' + (index + 1) + '.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
      competencySnapshot: {
        ...assessmentItem().competencySnapshot,
        id: index < 4 ? 'competency-a' : 'competency-b',
      },
    }))
    const balance = resolveAssessmentVisualPlans(items)
    expect(balance.optionalBudget).toBe(2)
    expect(balance.optionalItemIds).toEqual(['balanced-1', 'balanced-5'])
    expect(balance.skippedOptionalItemIds).toHaveLength(6)
    expect(balance.items.filter((item) => item.visualRequirement === 'none' && item.visualStatus === 'not_required')).toHaveLength(6)
    expect(assessmentVisualItemIdsForAssessment(items)).toEqual(balance.optionalItemIds)
  })

  it('always keeps genuinely required prompts in the work list', () => {
    const items = Array.from({ length: 8 }, (_, index) => assessmentItem('multiple_choice', {
      id: 'required-balance-' + (index + 1),
      itemNumber: index + 1,
      prompt: index === 3
        ? 'Use the diagram shown to identify the marked angle.'
        : 'Compare the vertical angles in relationship ' + (index + 1) + '.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    }))
    const balance = resolveAssessmentVisualPlans(items)
    expect(balance.requiredItemIds).toEqual(['required-balance-4'])
    expect(assessmentVisualItemIdsForAssessment(items)).toContain('required-balance-4')
    expect(balance.items[3]).toMatchObject({ visualRequirement: 'required', visualStatus: 'pending' })
  })

  it('does not fill the optional budget with near-identical questions from one competency', () => {
    const items = Array.from({ length: 8 }, (_, index) => assessmentItem('multiple_choice', {
      id: 'repeat-' + (index + 1),
      itemNumber: index + 1,
      prompt: 'Compare the vertical angles in the parallel lines.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    }))
    const balance = resolveAssessmentVisualPlans(items)
    expect(balance.optionalBudget).toBe(2)
    expect(balance.optionalItemIds).toEqual(['repeat-1'])
    expect(balance.items.filter((item) => item.visualRequirement === 'none')).toHaveLength(7)
  })

  it('preserves an existing visual even when the optional budget is already occupied', () => {
    const existing = withResolvedAssessmentVisualPlan(assessmentItem('multiple_choice', {
      id: 'existing-visual',
      itemNumber: 1,
      prompt: 'Compare the vertical angles in the parallel lines.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
      visual: ASSESSMENT_VISUAL_FIXTURES.marksAndLabels,
      visualRequirement: 'helpful',
    }))
    const pending = assessmentItem('multiple_choice', {
      id: 'pending-visual',
      itemNumber: 2,
      prompt: 'Compare the adjacent angles in the parallel lines.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    })
    const balance = resolveAssessmentVisualPlans([existing, pending, ...Array.from({ length: 6 }, (_, index) => assessmentItem('multiple_choice', {
      id: 'plain-' + index,
      itemNumber: index + 3,
      prompt: 'State the vertical angles relationship ' + index + '.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    }))])
    expect(balance.items[0].visual).toEqual(existing.visual)
    expect(balance.items[0].visualStatus).toBe('succeeded')
    expect(balance.items[0].visualRequirement).toBe('helpful')
  })

  it('marks skipped optional plans as settled while allowing explicit force to recover them', () => {
    const items = Array.from({ length: 8 }, (_, index) => assessmentItem('multiple_choice', {
      id: 'force-' + (index + 1),
      itemNumber: index + 1,
      prompt: 'Compare the vertical angles in relationship ' + (index + 1) + '.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    }))
    const balance = resolveAssessmentVisualPlans(items)
    const skipped = balance.items.find((item) => item.id === 'force-8')
    expect(skipped).toMatchObject({ visualRequirement: 'none', visualStatus: 'not_required' })
    expect(assessmentVisualPlanForItem(skipped!)).toMatchObject({ requirement: 'none', eligible: false })
    expect(assessmentVisualPlanForItem(skipped!, { force: true })).toMatchObject({ requirement: 'helpful', eligible: true })
  })

  it('lets explicit regeneration enrich a balanced-out optional item', async () => {
    const items = Array.from({ length: 8 }, (_, index) => assessmentItem('multiple_choice', {
      id: 'forced-enrichment-' + (index + 1),
      itemNumber: index + 1,
      prompt: 'Compare the vertical angles in relationship ' + (index + 1) + '.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    }))
    const skipped = resolveAssessmentVisualPlans(items).items[7]
    const generate = vi.fn(async () => ({ visual: ASSESSMENT_VISUAL_FIXTURES.marksAndLabels, model: 'test', fallbackUsed: false, requestsUsed: 1 }))
    const summary = await enrichAssessmentVisualsSequentially({
      assessment: assessmentRecord([skipped]),
      demo: false,
      itemIds: [skipped.id],
      force: true,
      generate,
    })
    expect(generate).toHaveBeenCalledOnce()
    expect(summary).toMatchObject({ eligible: 1, attempted: 1, succeeded: 1, failed: 0 })
    expect(summary.results[0]).toMatchObject({ id: skipped.id, visualRequirement: 'helpful', visualStatus: 'succeeded' })
  })
})
