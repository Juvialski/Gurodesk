import { describe, expect, it } from 'vitest'
import { assessmentAttentionCount, assessmentItemNeedsAttention, assessmentItemStatus, assessmentItemStatusLabel, assessmentPreparationStageLabel, assessmentReadyCount, assessmentVisualStatusLabel } from '../../src/pages/assessmentUi'
import { assessmentItem, assessmentRecord } from './fixtures'

describe('teacher-facing assessment status translations', () => {
  it('maps lifecycle values without exposing provider or persistence terms', () => {
    expect(assessmentItemStatusLabel('empty')).toBe('Missing')
    expect(assessmentItemStatusLabel('generated')).toBe('Ready')
    expect(assessmentItemStatusLabel('verified')).toBe('Ready')
    expect(assessmentItemStatusLabel('locked')).toBe('Ready')
    expect(assessmentItemStatusLabel('teacher_edited')).toBe('Edited')
    expect(assessmentItemStatusLabel('answer_needs_recheck')).toBe('Check needed')
    expect(assessmentItemStatusLabel('repair_needed')).toBe('Needs review')
  })

  it('preserves helpful visual failures as ready and blocks required visuals', () => {
    expect(assessmentVisualStatusLabel('pending', 'helpful')).toBe('Adding diagram')
    expect(assessmentVisualStatusLabel('succeeded', 'helpful')).toBe('Diagram ready')
    expect(assessmentVisualStatusLabel('failed', 'helpful')).toBe('Ready · diagram skipped')
    expect(assessmentVisualStatusLabel('failed', 'required')).toBe('Needs diagram')
    expect(assessmentVisualStatusLabel(undefined, 'none')).toBe('No diagram needed')
  })

  it('translates preparation phases into teacher workflow language', () => {
    expect(assessmentPreparationStageLabel('questions')).toBe('Creating questions')
    expect(assessmentPreparationStageLabel('visuals')).toBe('Adding diagrams')
    expect(assessmentPreparationStageLabel('qa')).toBe('Checking paper')
  })

  it('counts only actionable blockers as attention items', () => {
    const ready = assessmentItem('multiple_choice', { prompt: 'A ready question', authorshipState: 'manual', qaState: 'generated' })
    const helpfulFailed = assessmentItem('multiple_choice', { id: 'item-2', itemNumber: 2, prompt: 'A question without its optional diagram', authorshipState: 'manual', qaState: 'generated', visualRequirement: 'helpful', visualStatus: 'failed' })
    const requiredFailed = assessmentItem('multiple_choice', { id: 'item-3', itemNumber: 3, prompt: 'A question that needs a diagram', authorshipState: 'manual', qaState: 'generated', visualRequirement: 'required', visualStatus: 'failed' })
    const draft = assessmentRecord([ready, helpfulFailed, requiredFailed])
    expect(assessmentItemNeedsAttention(ready)).toBe(false)
    expect(assessmentItemNeedsAttention(helpfulFailed)).toBe(false)
    expect(assessmentItemNeedsAttention(requiredFailed)).toBe(true)
    expect(assessmentReadyCount(draft)).toBe(2)
    expect(assessmentAttentionCount(draft)).toBe(1)
  })

  it('keeps structurally generated AI suggestions in teacher review', () => {
    const suggestion = assessmentItem('multiple_choice', { prompt: 'An AI-prepared question', authorshipState: 'ai_suggestion', qaState: 'generated' })
    const draft = assessmentRecord([suggestion])
    expect(assessmentItemStatus(suggestion)).toBe('Needs review')
    expect(assessmentItemNeedsAttention(suggestion)).toBe(true)
    expect(assessmentReadyCount(draft)).toBe(0)
    expect(assessmentAttentionCount(draft)).toBe(1)
  })
})
