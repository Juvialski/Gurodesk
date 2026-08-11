import { describe, expect, it, vi } from 'vitest'
import { generateMissingAssessmentItems, type AssessmentItemSuggestion } from '../../src/lib/assessmentGeneration'
import {
  beginAssessmentVisualGeneration,
  checkpointAssessmentGenerationFailure,
  checkpointAssessmentGenerationSuccess,
  checkpointAssessmentVisualFailure,
  checkpointAssessmentVisualSuccess,
  createAssessmentGenerationCheckpoint,
  loadAssessmentGenerationCheckpoint,
  pendingAssessmentGenerationItemIds,
  pendingAssessmentVisualItemIds,
  recoverAssessmentGenerationItems,
  saveAssessmentGenerationCheckpoint,
} from '../../src/lib/assessmentGenerationResume'
import { ASSESSMENT_VISUAL_FIXTURES } from '../../src/lib/assessmentVisualFixtures'
import { assessmentVisualSourceHash } from '../../src/lib/assessmentVisualPlanning'
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

  it('recovers a visual checkpoint only onto the exact saved question', () => {
    const storage = memoryStorage()
    const candidate = suggestionFor('item-1').candidate
    const generated = assessmentItem('multiple_choice', {
      id: 'item-1',
      prompt: candidate.prompt,
      answer: candidate.answer,
      rationale: candidate.rationale,
      authorshipState: 'ai_suggestion',
      qaState: 'verified',
      visualRequirement: 'helpful',
      visualIntent: 'Draw the relevant relationship without revealing the answer.',
      visualStatus: 'pending',
    })
    const record = assessmentRecord([generated])
    let checkpoint = createAssessmentGenerationCheckpoint({
      assessmentId: record.id,
      userId: record.userId,
      itemIds: [generated.id],
      now: new Date('2026-08-09T10:00:00.000Z'),
    })
    checkpoint = checkpointAssessmentGenerationSuccess(checkpoint, generated)
    checkpoint = beginAssessmentVisualGeneration(checkpoint, [generated.id])
    const visualized = {
      ...generated,
      visual: ASSESSMENT_VISUAL_FIXTURES.marksAndLabels,
      visualStatus: 'succeeded' as const,
      visualAttempts: 1,
      visualSourceHash: assessmentVisualSourceHash(generated),
      visualUpdatedAt: '2026-08-09T10:02:00.000Z',
    }
    checkpoint = checkpointAssessmentVisualSuccess(checkpoint, visualized)
    expect(saveAssessmentGenerationCheckpoint(checkpoint, storage)).toBe(true)

    const loaded = loadAssessmentGenerationCheckpoint(record.id, record.userId, { storage, now: new Date('2026-08-09T10:03:00.000Z') })
    expect(loaded?.schemaVersion).toBe(2)
    expect(loaded?.phase).toBe('visuals')
    expect(pendingAssessmentVisualItemIds(loaded!)).toEqual([])
    const recovered = recoverAssessmentGenerationItems(record, loaded!)
    expect(recovered).toMatchObject({ recovered: 0, visualRecovered: 1 })
    expect(recovered.record.items[0].prompt).toBe(generated.prompt)
    expect(recovered.record.items[0].answer).toEqual(generated.answer)
    expect(recovered.record.items[0].visual).toEqual(ASSESSMENT_VISUAL_FIXTURES.marksAndLabels)

    const edited = assessmentRecord([{ ...generated, prompt: `${generated.prompt} Teacher edit.` }])
    const rejected = recoverAssessmentGenerationItems(edited, loaded!)
    expect(rejected.visualRecovered).toBe(0)
    expect(rejected.record.items[0].visual).toBeUndefined()
  })

  it('keeps checkpointed questions after a later failure and retries visuals only within the attempt bound', () => {
    const item = assessmentItem('multiple_choice', {
      id: 'item-1',
      prompt: 'Checkpointed question?',
      authorshipState: 'ai_suggestion',
      qaState: 'verified',
      visualRequirement: 'helpful',
      visualStatus: 'pending',
    })
    let checkpoint = createAssessmentGenerationCheckpoint({ assessmentId: 'assessment-1', userId: 'teacher-a', itemIds: [item.id] })
    checkpoint = checkpointAssessmentGenerationSuccess(checkpoint, item)
    checkpoint = checkpointAssessmentGenerationFailure(checkpoint, item.id, 'Verifier became unavailable after the question was saved.')
    expect(checkpoint.generatedItems[item.id].prompt).toBe(item.prompt)
    expect(pendingAssessmentGenerationItemIds(checkpoint)).toEqual([])

    checkpoint = beginAssessmentVisualGeneration(checkpoint, [item.id])
    checkpoint = checkpointAssessmentVisualFailure(checkpoint, { ...item, visualStatus: 'failed', visualAttempts: 1 }, 'Visual provider unavailable.')
    expect(pendingAssessmentVisualItemIds(checkpoint, 2)).toEqual([item.id])
    expect(pendingAssessmentVisualItemIds(checkpoint, 1)).toEqual([])
  })

  it('loads schema-v1 checkpoints as question-phase schema-v2 checkpoints', () => {
    const storage = memoryStorage()
    const item = assessmentItem('multiple_choice', { id: 'legacy-item' })
    const current = createAssessmentGenerationCheckpoint({
      assessmentId: 'legacy-assessment',
      userId: 'teacher-a',
      itemIds: [item.id],
      now: new Date('2026-08-09T10:00:00.000Z'),
    })
    const { phase: _phase, visualItemIds: _visualItemIds, visualItems: _visualItems, visualFailures: _visualFailures, ...legacyFields } = current
    storage.setItem('gurodesk.assessment.generation.batch.v1:legacy-assessment', JSON.stringify({ ...legacyFields, schemaVersion: 1 }))

    const loaded = loadAssessmentGenerationCheckpoint('legacy-assessment', 'teacher-a', {
      storage,
      now: new Date('2026-08-09T10:01:00.000Z'),
    })
    expect(loaded).toMatchObject({ schemaVersion: 2, phase: 'questions', visualItemIds: [], visualItems: {}, visualFailures: {} })
  })
})
