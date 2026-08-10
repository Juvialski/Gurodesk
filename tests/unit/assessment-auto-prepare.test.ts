import { describe, expect, it, vi } from 'vitest'
import { assessmentAutomationBlockers, autoPrepareAssessmentPaper } from '../../src/lib/assessmentAutoPrepare'
import type { AssessmentItemSuggestion } from '../../src/lib/assessmentGeneration'
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
})
