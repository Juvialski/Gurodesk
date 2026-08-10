import { describe, expect, it, vi } from 'vitest'
import { assessmentAutomationBlockers, autoPrepareAssessmentPaper } from '../../src/lib/assessmentAutoPrepare'
import type { AssessmentItemSuggestion } from '../../src/lib/assessmentGeneration'
import { IRREGULAR_CONCAVE_PENTAGON_VISUAL } from '../../src/lib/assessmentVisualFixtures'
import type { AssessmentItem, AssessmentRecord } from '../../src/types/assessment'
import { assessmentItem, assessmentRecord } from './fixtures'
import { cloneCandidate } from './assessmentContractFixtures'

function mappedRecord(items: AssessmentItem[]): AssessmentRecord {
  const record = assessmentRecord(items)
  return {
    ...record,
    settings: {
      mode: 'auto_balanced',
      allowedTypes: ['multiple_choice'],
      defaultPoints: { multiple_choice: 1 },
      targetTotalPoints: null,
    },
    sourceTos: {
      ...record.sourceTos,
      content: {
        rows: [{
          competency: { id: 'competency-1' },
          cognitiveAllocations: [{ categoryId: 'remembering', itemStart: 1, itemEnd: items.length }],
        }],
      } as AssessmentRecord['sourceTos']['content'],
    },
  }
}

function generatedItem(id: string, itemNumber: number, prompt: string, authorshipState: AssessmentItem['authorshipState'] = 'ai_suggestion') {
  const candidate = cloneCandidate('multiple_choice')
  return assessmentItem('multiple_choice', {
    id,
    itemNumber,
    prompt,
    answer: candidate.answer,
    rationale: candidate.rationale,
    authorshipState,
    qaState: 'verified',
    mapping: { ...assessmentItem().mapping, allocationItemStart: itemNumber, allocationItemEnd: itemNumber },
  })
}

describe('one-click assessment paper preparation', () => {
  it('targets a duplicated AI-generated item but protects teacher-edited blockers', () => {
    const first = generatedItem('item-1', 1, 'Which value is equal to 2 + 2?')
    const duplicate = generatedItem('item-2', 2, 'Which value is equal to 2 + 2?')
    const blockers = assessmentAutomationBlockers(mappedRecord([first, duplicate]))
    expect(blockers.repairableItemIds).toContain('item-2')

    const teacherEdited = generatedItem('item-2', 2, 'Use the diagram shown to identify the polygon.', 'teacher_edited')
    const protectedBlockers = assessmentAutomationBlockers(mappedRecord([first, teacherEdited]))
    expect(protectedBlockers.repairableItemIds).not.toContain('item-2')
    expect(protectedBlockers.unresolvedItemIds).toContain('item-2')
  })

  it('regenerates an AI blocker within a bounded QA loop and reaches structural readiness', async () => {
    const first = generatedItem('item-1', 1, 'Which value is equal to 2 + 2?')
    const duplicate = generatedItem('item-2', 2, 'Which value is equal to 2 + 2?')
    const record = mappedRecord([first, duplicate])
    const replacementCandidate = cloneCandidate('multiple_choice')
    replacementCandidate.prompt = 'Which value is equal to 3 + 4?'
    replacementCandidate.answer = {
      type: 'multiple_choice',
      choices: [{ id: 'A', text: '6' }, { id: 'B', text: '7' }, { id: 'C', text: '8' }],
      choiceId: 'B',
    }
    replacementCandidate.rationale = 'Seven is the correct sum.'
    const suggestion: AssessmentItemSuggestion = {
      assessmentId: record.id,
      itemId: 'item-2',
      questionType: 'multiple_choice',
      candidate: replacementCandidate,
      model: 'test-model',
      fallbackUsed: false,
      editable: true,
      qaState: 'verified',
    }
    const generateItem = vi.fn(async () => suggestion)

    const result = await autoPrepareAssessmentPaper({
      assessment: record,
      demo: true,
      maxRounds: 2,
      generateItem,
      generateMissing: vi.fn(async () => ({ attempted: 0, succeeded: 0, skipped: 2, failed: 0, cancelled: 0, results: [], errors: [] })),
    })

    expect(generateItem).toHaveBeenCalledTimes(1)
    expect(result.regenerated).toBe(1)
    expect(result.providerPaused).toBe(false)
    expect(result.review.hardErrors.filter((issue) => issue.code !== 'teacher-review')).toEqual([])
  })

  it('persists a locked AI blocker as unlocked before requesting the server-side replacement', async () => {
    const first = generatedItem('item-1', 1, 'Which value is equal to 2 + 2?', 'teacher_accepted')
    const duplicate = { ...generatedItem('item-2', 2, 'Which value is equal to 2 + 2?', 'teacher_accepted'), locked: true, qaState: 'locked' as const }
    const record = mappedRecord([first, duplicate])
    const replacementCandidate = cloneCandidate('multiple_choice')
    replacementCandidate.prompt = 'Which value is equal to 8 - 3?'
    replacementCandidate.answer = {
      type: 'multiple_choice',
      choices: [{ id: 'A', text: '4' }, { id: 'B', text: '5' }, { id: 'C', text: '6' }],
      choiceId: 'B',
    }
    replacementCandidate.rationale = 'Five is the correct difference.'
    let persistedUnlocked = false
    let repairContext = ''
    const onCheckpoint = vi.fn(async (checkpoint: AssessmentRecord) => {
      const item = checkpoint.items.find((candidate) => candidate.id === 'item-2')
      if (item && item.locked !== true && item.qaState !== 'locked') persistedUnlocked = true
    })
    const generateItem = vi.fn(async (args: Parameters<NonNullable<Parameters<typeof autoPrepareAssessmentPaper>[0]['generateItem']>>[0]): Promise<AssessmentItemSuggestion> => {
      if (!persistedUnlocked) throw new Error('This item is locked. Unlock it before requesting AI generation or review.')
      repairContext = args.teacherContext ?? ''
      return {
        assessmentId: record.id,
        itemId: 'item-2',
        questionType: 'multiple_choice' as const,
        candidate: replacementCandidate,
        model: 'test-model',
        fallbackUsed: false,
        editable: true,
        qaState: 'verified' as const,
      }
    })

    const result = await autoPrepareAssessmentPaper({
      assessment: record,
      demo: true,
      maxRounds: 3,
      generateItem,
      onCheckpoint,
      generateMissing: vi.fn(async () => ({ attempted: 0, succeeded: 0, skipped: 2, failed: 0, cancelled: 0, results: [], errors: [] })),
    })

    expect(persistedUnlocked).toBe(true)
    expect(generateItem).toHaveBeenCalledTimes(1)
    expect(repairContext).toMatch(/AUTOMATIC REPAIR REQUIREMENTS/u)
    expect(repairContext).toMatch(/duplicate/u)
    expect(result.repairFailures).toEqual([])
    expect(result.review.hardErrors.filter((issue) => issue.code !== 'teacher-review')).toEqual([])
  })

  it('repairs a visual-only blocker without regenerating the question or answer', async () => {
    const base = cloneCandidate('multiple_choice')
    const prompt = 'Examine the polygon shown in the visual. Which option names the number of sides?'
    const item = generatedItem('item-1', 1, prompt)
    item.answer = base.answer
    item.visual = undefined
    const record = mappedRecord([item])
    const originalAnswer = structuredClone(item.answer)
    const generateItem = vi.fn(async () => { throw new Error('full question generation must not run for a visual-only blocker') })
    const generateVisual = vi.fn(async () => ({ visual: IRREGULAR_CONCAVE_PENTAGON_VISUAL, model: 'test-visual-model', fallbackUsed: false, requestsUsed: 1 }))

    const result = await autoPrepareAssessmentPaper({
      assessment: record,
      demo: true,
      maxRounds: 1,
      generateItem,
      generateVisual,
      onCheckpoint: vi.fn(async () => undefined),
      generateMissing: vi.fn(async () => ({ attempted: 0, succeeded: 0, skipped: 1, failed: 0, cancelled: 0, results: [], errors: [] })),
    })

    expect(generateVisual).toHaveBeenCalledTimes(1)
    expect(generateItem).not.toHaveBeenCalled()
    expect(result.assessment.items[0].prompt).toBe(prompt)
    expect(result.assessment.items[0].answer).toEqual(originalAnswer)
    expect(result.assessment.items[0].visual).toEqual(IRREGULAR_CONCAVE_PENTAGON_VISUAL)
  })

  it('does not swallow non-provider repair failures', async () => {
    const first = generatedItem('item-1', 1, 'Which value is equal to 2 + 2?')
    const duplicate = generatedItem('item-2', 2, 'Which value is equal to 2 + 2?')
    const record = mappedRecord([first, duplicate])
    const result = await autoPrepareAssessmentPaper({
      assessment: record,
      demo: true,
      maxRounds: 1,
      generateItem: vi.fn(async () => { throw new Error('server still considers item locked') }),
      onCheckpoint: vi.fn(async () => undefined),
      generateMissing: vi.fn(async () => ({ attempted: 0, succeeded: 0, skipped: 2, failed: 0, cancelled: 0, results: [], errors: [] })),
    })

    expect(result.regenerated).toBe(0)
    expect(result.repairFailures).toEqual([expect.objectContaining({ itemId: 'item-2', message: 'server still considers item locked' })])
  })

})
