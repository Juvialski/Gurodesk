import { describe, expect, it, vi } from 'vitest'
import { generateMissingAssessmentItems, type AssessmentItemSuggestion } from '../../src/lib/assessmentGeneration'
import {
  checkpointAssessmentGenerationFailure,
  checkpointAssessmentGenerationSuccess,
  createAssessmentGenerationCheckpoint,
  loadAssessmentGenerationCheckpoint,
  pendingAssessmentGenerationItemIds,
  recoverAssessmentGenerationItems,
  saveAssessmentGenerationCheckpoint,
} from '../../src/lib/assessmentGenerationResume'
import { assessmentItem, assessmentRecord } from './fixtures'

function suggestionFor(itemId: string): AssessmentItemSuggestion {
  return {
    assessmentId: 'assessment-1',
    itemId,
    questionType: 'multiple_choice',
    candidate: {
      questionType: 'multiple_choice',
      prompt: `Generated question for ${itemId}?`,
      answer: {
        type: 'multiple_choice',
        choices: [
          { id: 'A', text: 'Correct' },
          { id: 'B', text: 'Incorrect' },
        ],
        choiceId: 'A',
      },
      rationale: 'Deterministic test rationale.',
      referencedResources: [],
    },
    model: 'test-model',
    fallbackUsed: false,
    editable: true,
    qaState: 'verified',
  }
}

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('assessment generation progress and resume checkpoints', () => {
  it('reports generated successes separately from processed failures', async () => {
    const items = [1, 2, 3].map((itemNumber) => assessmentItem('multiple_choice', {
      id: `item-${itemNumber}`,
      itemNumber,
      mapping: {
        rowId: 'row-1',
        competencyId: 'competency-1',
        cognitiveCategoryId: 'remembering',
        allocationItemStart: 1,
        allocationItemEnd: 3,
        allocationIndex: itemNumber - 1,
      },
    }))
    const progress: Array<{ processed: number; succeeded: number; failed: number; remaining: number }> = []
    const generate = vi.fn(async ({ item }: { item: typeof items[number] }) => {
      if (item.id === 'item-2') throw new Error('Provider returned malformed structured output.')
      return suggestionFor(item.id)
    })

    const summary = await generateMissingAssessmentItems({
      assessment: assessmentRecord(items),
      demo: false,
      concurrency: 1,
      generate,
      onProgress: (value) => progress.push({
        processed: value.processed,
        succeeded: value.succeeded,
        failed: value.failed,
        remaining: value.remaining,
      }),
    })

    expect(summary.succeeded).toBe(2)
    expect(summary.failed).toBe(1)
    expect(summary.results).toHaveLength(2)
    expect(progress[progress.length - 1]).toEqual({ processed: 3, succeeded: 2, failed: 1, remaining: 0 })
  })


  it('pauses the remaining batch after an exhausted quota boundary instead of burning every item', async () => {
    const items = [1, 2, 3, 4].map((itemNumber) => assessmentItem('multiple_choice', {
      id: `quota-item-${itemNumber}`,
      itemNumber,
    }))
    const generate = vi.fn(async ({ item }: { item: typeof items[number] }) => {
      if (item.id === 'quota-item-2') throw new Error('Gemini provider limit reached (429 quota).')
      return suggestionFor(item.id)
    })

    const summary = await generateMissingAssessmentItems({
      assessment: assessmentRecord(items),
      demo: false,
      concurrency: 1,
      generate,
    })

    expect(generate).toHaveBeenCalledTimes(2)
    expect(summary.succeeded).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.cancelled).toBe(2)
  })

  it('recovers successful items after refresh and resumes only never-processed items', () => {
    const storage = memoryStorage()
    const items = [1, 2, 3].map((itemNumber) => assessmentItem('multiple_choice', {
      id: `item-${itemNumber}`,
      itemNumber,
    }))
    const record = assessmentRecord(items)
    let checkpoint = createAssessmentGenerationCheckpoint({
      assessmentId: record.id,
      userId: record.userId,
      itemIds: items.map((item) => item.id),
      now: new Date('2026-08-09T10:00:00.000Z'),
    })
    checkpoint = checkpointAssessmentGenerationSuccess(checkpoint, {
      ...items[0],
      prompt: 'Recovered generated question?',
      authorshipState: 'ai_suggestion',
      qaState: 'verified',
    }, new Date('2026-08-09T10:01:00.000Z'))
    checkpoint = checkpointAssessmentGenerationFailure(checkpoint, items[1].id, 'Invalid answer shape.', new Date('2026-08-09T10:02:00.000Z'))
    expect(saveAssessmentGenerationCheckpoint(checkpoint, storage)).toBe(true)

    const loaded = loadAssessmentGenerationCheckpoint(record.id, record.userId, {
      storage,
      now: new Date('2026-08-09T10:03:00.000Z'),
    })
    expect(loaded).not.toBeNull()
    expect(pendingAssessmentGenerationItemIds(loaded!)).toEqual(['item-3'])

    const recovered = recoverAssessmentGenerationItems(record, loaded!)
    expect(recovered.recovered).toBe(1)
    expect(recovered.record.items[0].prompt).toBe('Recovered generated question?')
    expect(recovered.record.items[1].prompt).toBe('')
    expect(recovered.record.items[2].prompt).toBe('')
  })
})
