import { describe, expect, it, vi } from 'vitest'
import {
  applyAssessmentItemSuggestion,
  applyCheckpointedAssessmentItemSuggestion,
  generateMissingAssessmentItems,
  type AssessmentItemSuggestion,
} from '../../src/lib/assessmentGeneration'
import { applyQuestionTypeDistributionToEmptySlots } from '../../src/lib/assessmentDistribution'
import { ASSESSMENT_QUESTION_TYPES, type AssessmentSettings } from '../../src/types/assessment'
import {
  checkpointAssessmentGenerationFailure,
  checkpointAssessmentGenerationSuccess,
  createAssessmentGenerationCheckpoint,
  pauseAssessmentGenerationCheckpoint,
  pendingAssessmentGenerationItemIds,
  resumeAssessmentGenerationCheckpoint,
} from '../../src/lib/assessmentGenerationResume'
import { assessmentItem, assessmentRecord } from './fixtures'
import { cloneCandidate } from './assessmentContractFixtures'

function suggestionFor(itemId: string, questionType: 'multiple_choice' = 'multiple_choice'): AssessmentItemSuggestion {
  return {
    assessmentId: 'assessment-1',
    itemId,
    questionType,
    candidate: cloneCandidate(questionType),
    model: 'test-model',
    fallbackUsed: false,
    editable: true,
    qaState: 'verified',
  }
}

function items(count: number) {
  return Array.from({ length: count }, (_, index) => assessmentItem('multiple_choice', {
    id: `batch-item-${index + 1}`,
    itemNumber: index + 1,
  }))
}

describe('assessment generation batch accounting and resume regressions', () => {

  it('finalizes only the exact AI question checkpointed before the QA pass', () => {
    const source = assessmentItem('multiple_choice', { id: 'v2-checkpoint-item', itemNumber: 1 })
    const passOne = suggestionFor(source.id)
    const checkpointed = applyAssessmentItemSuggestion(source, passOne, { source: 'generated' })
    const finalized = {
      ...passOne,
      qaState: 'verified' as const,
      candidate: { ...passOne.candidate, rationale: 'Verifier-approved rationale.' },
    }

    const result = applyCheckpointedAssessmentItemSuggestion(checkpointed, checkpointed, finalized)

    expect(result.prompt).toBe(checkpointed.prompt)
    expect(result.rationale).toBe('Verifier-approved rationale.')
    expect(result.qaState).toBe('verified')
    expect(result.authorshipState).toBe('ai_suggestion')
  })

  it('refuses final QA replacement when the checkpoint was edited after it was saved', () => {
    const source = assessmentItem('multiple_choice', { id: 'v2-protected-item', itemNumber: 1 })
    const passOne = suggestionFor(source.id)
    const checkpointed = applyAssessmentItemSuggestion(source, passOne, { source: 'generated' })
    const teacherEdited = { ...checkpointed, prompt: 'Teacher changed this question.', authorshipState: 'teacher_edited' as const }

    expect(() => applyCheckpointedAssessmentItemSuggestion(teacherEdited, checkpointed, passOne))
      .toThrow(/Existing content was preserved/)
  })


  it('recovers a blank machine-owned slot left behind by an interrupted AI attempt', async () => {
    const stale = assessmentItem('multiple_choice', {
      id: 'stale-ai-blank',
      itemNumber: 1,
      prompt: '',
      authorshipState: 'ai_suggestion',
      qaState: 'needs_review',
    })
    const generate = vi.fn(async ({ item, alternative }: { item: typeof stale; alternative?: boolean }) => {
      expect(alternative).toBe(true)
      return suggestionFor(item.id)
    })

    const summary = await generateMissingAssessmentItems({
      assessment: assessmentRecord([stale]),
      demo: false,
      concurrency: 1,
      generate,
    })

    expect(generate).toHaveBeenCalledTimes(1)
    expect(summary.succeeded).toBe(1)
    expect(summary.failed).toBe(0)
    expect(summary.results[0].prompt).not.toBe('')
  })

  it('does not recover a blank teacher-owned or manual slot automatically', async () => {
    const protectedItems = [
      assessmentItem('multiple_choice', { id: 'teacher-edited-blank', itemNumber: 1, prompt: '', authorshipState: 'teacher_edited' }),
      assessmentItem('multiple_choice', { id: 'teacher-accepted-blank', itemNumber: 2, prompt: '', authorshipState: 'teacher_accepted' }),
      assessmentItem('multiple_choice', { id: 'manual-blank', itemNumber: 3, prompt: '', authorshipState: 'manual' }),
    ]
    const generate = vi.fn(async ({ item }: { item: typeof protectedItems[number] }) => suggestionFor(item.id))

    const summary = await generateMissingAssessmentItems({
      assessment: assessmentRecord(protectedItems),
      demo: false,
      concurrency: 1,
      generate,
    })

    expect(generate).not.toHaveBeenCalled()
    expect(summary.attempted).toBe(0)
    expect(summary.skipped).toBe(3)
  })

  it('reconciles Auto/Balanced 40-slot distribution around 16 completed MCQs without rewriting protected mappings', () => {
    const allTypes: AssessmentSettings = {
      mode: 'auto_balanced',
      allowedTypes: [...ASSESSMENT_QUESTION_TYPES],
      defaultPoints: Object.fromEntries(ASSESSMENT_QUESTION_TYPES.map((type) => [type, type === 'essay' ? 10 : type === 'problem_solving' ? 3 : 1])),
      targetTotalPoints: null,
    }
    const sourceItems = Array.from({ length: 40 }, (_, index) => assessmentItem('multiple_choice', {
      id: `balanced-item-${index + 1}`,
      itemNumber: index + 1,
      prompt: index < 16 ? `Completed MCQ ${index + 1}` : '',
      authorshipState: index < 16 ? 'teacher_accepted' : 'empty',
      locked: index === 2,
      qaState: index === 2 ? 'locked' : index < 16 ? 'verified' : 'empty',
    }))
    const protectedSnapshot = structuredClone(sourceItems.slice(0, 16))
    const result = applyQuestionTypeDistributionToEmptySlots(sourceItems, allTypes)

    expect(result.items.slice(0, 16)).toEqual(protectedSnapshot)
    expect(result.items[2].locked).toBe(true)
    expect(result.items[2].qaState).toBe('locked')
    expect(result.changedItemIds).toHaveLength(24)
    expect(result.items.slice(16).every((item) => item.questionType !== 'multiple_choice')).toBe(true)
    expect(result.finalCounts.multiple_choice).toBe(16)
    expect(Object.values(result.finalCounts).reduce((sum, value) => sum + (value ?? 0), 0)).toBe(40)
    expect(result.targetCounts).toMatchObject({ multiple_choice: 4, true_false: 4, short_answer: 4 })
    const remainingTypes = result.items.slice(16).map((item) => item.questionType)
    // Even when earlier completed items overrepresent one type, remaining empty
    // slots stay grouped by type rather than alternating round-robin.
    const transitions = remainingTypes.reduce((count, type, index) => count + (index > 0 && type !== remainingTypes[index - 1] ? 1 : 0), 0)
    expect(transitions).toBeLessThanOrEqual(ASSESSMENT_QUESTION_TYPES.length - 2)
  })

  it('reports eligible counts separately from skipped, generated, failed, and cancelled work', async () => {
    const sourceItems = items(5)
    sourceItems[0] = { ...sourceItems[0], prompt: 'Teacher accepted item', authorshipState: 'teacher_accepted' }
    sourceItems[1] = { ...sourceItems[1], locked: true, qaState: 'locked' }
    const progress: Array<{ processed: number; total: number; succeeded: number; failed: number; cancelled: number; remaining: number; status: string }> = []
    const generate = vi.fn(async ({ item }: { item: typeof sourceItems[number] }) => suggestionFor(item.id))

    const summary = await generateMissingAssessmentItems({
      assessment: assessmentRecord(sourceItems),
      demo: false,
      concurrency: 1,
      generate,
      onProgress: (value) => progress.push({
        processed: value.processed,
        total: value.total,
        succeeded: value.succeeded,
        failed: value.failed,
        cancelled: value.cancelled,
        remaining: value.remaining,
        status: value.status,
      }),
    })

    expect(summary.skipped).toBe(2)
    expect(summary.attempted).toBe(3)
    expect(summary.succeeded).toBe(3)
    expect(summary.failed).toBe(0)
    expect(summary.cancelled).toBe(0)
    expect(summary.results.map((item) => item.id)).toEqual(['batch-item-3', 'batch-item-4', 'batch-item-5'])
    expect(generate).toHaveBeenCalledTimes(3)
    expect(progress).toHaveLength(3)
    expect(progress.at(-1)).toEqual({ processed: 3, total: 3, succeeded: 3, failed: 0, cancelled: 0, remaining: 0, status: 'success' })
  })

  it('leaves a non-quota failure retryable without changing the source item', async () => {
    const sourceItems = items(2)
    const source = assessmentRecord(sourceItems)
    const firstAttempt = await generateMissingAssessmentItems({
      assessment: source,
      demo: false,
      concurrency: 1,
      generate: vi.fn(async ({ item }: { item: typeof sourceItems[number] }) => {
        if (item.id === 'batch-item-1') throw new Error('Candidate validation failed; please retry this item.')
        return suggestionFor(item.id)
      }),
    })

    expect(firstAttempt.failed).toBe(1)
    expect(firstAttempt.succeeded).toBe(1)
    expect(firstAttempt.errors).toEqual([{ itemId: 'batch-item-1', message: 'Candidate validation failed; please retry this item.' }])
    expect(source.items[0].prompt).toBe('')

    const retry = await generateMissingAssessmentItems({
      assessment: source,
      demo: false,
      concurrency: 1,
      itemIds: ['batch-item-1'],
      generate: vi.fn(async ({ item }: { item: typeof sourceItems[number] }) => suggestionFor(item.id)),
    })

    expect(retry.attempted).toBe(1)
    expect(retry.succeeded).toBe(1)
    expect(retry.failed).toBe(0)
    expect(retry.results[0].id).toBe('batch-item-1')
  })

  it('pauses a checkpoint on quota boundaries and resumes only pending item IDs', () => {
    const checkpoint = createAssessmentGenerationCheckpoint({
      assessmentId: 'assessment-1',
      userId: 'teacher-a',
      itemIds: ['batch-item-1', 'batch-item-2', 'batch-item-3'],
      now: new Date('2026-08-09T10:00:00.000Z'),
    })
    const generated = checkpointAssessmentGenerationSuccess(checkpoint, assessmentItem('multiple_choice', { id: 'batch-item-1', prompt: 'Generated item' }), new Date('2026-08-09T10:01:00.000Z'))
    const failed = checkpointAssessmentGenerationFailure(generated, 'batch-item-2', 'Gemini provider limit reached.', new Date('2026-08-09T10:02:00.000Z'))
    const paused = pauseAssessmentGenerationCheckpoint(failed, new Date('2026-08-09T10:03:00.000Z'))

    expect(paused.status).toBe('paused')
    expect(paused.autoResume).toBe(false)
    expect(pendingAssessmentGenerationItemIds(paused)).toEqual(['batch-item-3'])
    const resumed = resumeAssessmentGenerationCheckpoint(paused, new Date('2026-08-09T10:04:00.000Z'))
    expect(resumed.status).toBe('running')
    expect(resumed.autoResume).toBe(true)
    expect(pendingAssessmentGenerationItemIds(resumed)).toEqual(['batch-item-3'])
  })

  it('checkpoints validated question content before the separate visual/provider work completes', async () => {
    const source = assessmentRecord(items(1))
    const events: string[] = []
    const generate = vi.fn(async ({ item, onQuestionReady }: { item: typeof source.items[number]; onQuestionReady?: (suggestion: AssessmentItemSuggestion) => void | Promise<void> }) => {
      const suggestion = suggestionFor(item.id)
      events.push('question-provider-done')
      await onQuestionReady?.(suggestion)
      events.push('visual-provider-done')
      return suggestion
    })

    const summary = await generateMissingAssessmentItems({
      assessment: source,
      demo: false,
      concurrency: 1,
      generate,
      onQuestionReady: (item) => {
        events.push(`checkpoint:${item.id}`)
        expect(item.prompt).toBeTruthy()
      },
      onSuggestion: () => {
        events.push('final-suggestion')
      },
    })

    expect(summary.succeeded).toBe(1)
    expect(events).toEqual(['question-provider-done', 'checkpoint:batch-item-1', 'visual-provider-done', 'final-suggestion'])
  })

  it('preserves a generated question and pauses remaining work when its separate visual pass hits quota', async () => {
    const source = assessmentRecord(items(3))
    const generate = vi.fn(async ({ item }: { item: typeof source.items[number] }) => ({ ...suggestionFor(item.id), quotaPaused: item.id === 'batch-item-1' }))

    const summary = await generateMissingAssessmentItems({
      assessment: source,
      demo: false,
      concurrency: 1,
      generate,
    })

    expect(generate).toHaveBeenCalledTimes(1)
    expect(summary.succeeded).toBe(1)
    expect(summary.failed).toBe(0)
    expect(summary.providerPaused).toBe(true)
    expect(summary.cancelled).toBe(2)
    expect(summary.results[0].id).toBe('batch-item-1')
  })

  it('stops the batch after an exhausted Edge transport failure instead of cascading across remaining items', async () => {
    const source = assessmentRecord(items(3))
    const generate = vi.fn(async () => {
      throw Object.assign(new Error('The assessment service could not be reached. GuroDesk retries temporary connection failures automatically; saved work is preserved.'), { failureCategory: 'edge_transport' })
    })

    const summary = await generateMissingAssessmentItems({
      assessment: source,
      demo: false,
      concurrency: 1,
      generate,
    })

    expect(generate).toHaveBeenCalledTimes(1)
    expect(summary.attempted).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.providerPaused).toBe(true)
    expect(summary.cancelled).toBe(2)
  })

  it('does not burn the remainder of a batch after an exhausted quota boundary', async () => {
    const source = assessmentRecord(items(4))
    const statuses: string[] = []
    const generate = vi.fn(async ({ item }: { item: typeof source.items[number] }) => {
      if (item.id === 'batch-item-2') throw new Error('Gemini provider limit reached (429 quota).')
      return suggestionFor(item.id)
    })

    const summary = await generateMissingAssessmentItems({
      assessment: source,
      demo: false,
      concurrency: 1,
      generate,
      onProgress: (value) => statuses.push(value.status),
    })

    expect(generate).toHaveBeenCalledTimes(2)
    expect(summary.attempted).toBe(2)
    expect(summary.succeeded).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.cancelled).toBe(2)
    expect(statuses).toEqual(['success', 'failed', 'cancelled', 'cancelled'])
  })
})
