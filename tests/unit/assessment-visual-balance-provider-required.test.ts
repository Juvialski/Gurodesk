import { describe, expect, it } from 'vitest'
import { assessmentVisualItemIdsForAssessment, resolveAssessmentVisualPlans } from '../../src/lib/assessmentVisualPlanning'
import { assessmentItem } from './fixtures'

describe('assessment visual balance against over-eager provider metadata', () => {
  it('does not let Gemini required metadata turn an ordinary 20-item paper into 20 diagram calls', () => {
    const items = Array.from({ length: 20 }, (_, index) => assessmentItem('multiple_choice', {
      id: `provider-required-${index + 1}`,
      itemNumber: index + 1,
      prompt: `Compare the supplementary angle relationship in case ${index + 1}.`,
      visualRequirement: 'required',
      visualIntent: 'Show the angle relationship clearly.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    }))
    const balance = resolveAssessmentVisualPlans(items)
    expect(balance.optionalBudget).toBe(5)
    expect(balance.requiredItemIds).toEqual([])
    expect(balance.optionalItemIds.length).toBeLessThanOrEqual(5)
    expect(assessmentVisualItemIdsForAssessment(items).length).toBeLessThanOrEqual(5)
  })

  it('still keeps a diagram outside the optional budget when the learner prompt explicitly depends on it', () => {
    const required = assessmentItem('multiple_choice', {
      id: 'actual-required',
      itemNumber: 1,
      prompt: 'Use the diagram shown to determine the marked angle.',
      visualRequirement: 'required',
      visualIntent: 'Draw the marked angle referenced by the prompt.',
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    })
    const balance = resolveAssessmentVisualPlans([required])
    expect(balance.requiredItemIds).toEqual(['actual-required'])
    expect(balance.items[0]).toMatchObject({ visualRequirement: 'required', visualStatus: 'pending' })
  })
})
