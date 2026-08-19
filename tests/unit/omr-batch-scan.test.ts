import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateBatchSummary,
  clearBatchScanSession,
  loadBatchScanSession,
  saveBatchScanSession,
} from '../../src/lib/omr/batchScanStorage'
import type { BatchScanItem, BatchScanSession } from '../../src/types/batchScan'
import type { OmrScanResult } from '../../src/types/omr'

// Mock localStorage for node test runner
const memoryStore = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, val: string) => { memoryStore.set(key, val) },
  removeItem: (key: string) => { memoryStore.delete(key) },
  clear: () => { memoryStore.clear() },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

const mockScanResult: OmrScanResult = {
  status: 'SUCCESS',
  success: true,
  needsReview: false,
  recognizedItems: [],
  summary: { totalQuestions: 5, machineScanned: 5, filledCount: 5, emptyCount: 0, multipleCount: 0, ambiguousCount: 0, manualScoringCount: 0, needsReviewCount: 0 },
  imageFingerprint: 'fp-1',
  processingTimeMs: 25,
}

describe('Batch Classroom Scanning & Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads a batch scanning session from localStorage to support session resume', () => {
    const session: BatchScanSession = {
      sessionId: 'sess-batch-101',
      assessmentId: 'asm-101',
      assessmentTitle: 'Grade 9 Science Periodic Exam',
      sectionName: 'Diamond',
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
      items: [
        {
          id: 'item-1',
          scanTimestamp: '2026-08-19T00:01:00.000Z',
          learnerId: 'learner-1',
          learnerName: 'Dela Cruz, Juan',
          scanResult: mockScanResult,
          answers: { 'item-1': { type: 'multiple_choice', choiceId: 'c1' } },
          teacherPoints: {},
          outcomes: [],
          totals: { rawScore: 1, possiblePoints: 1, percentage: 100, attemptedItems: 1, omittedItems: 0, correctItems: 1, incorrectItems: 0, teacherScoredItems: 0, deterministicItems: 1 },
          status: 'CLEAN',
        },
      ],
    }

    saveBatchScanSession(session)

    const loaded = loadBatchScanSession('sess-batch-101')
    expect(loaded).toBeDefined()
    expect(loaded?.sessionId).toBe('sess-batch-101')
    expect(loaded?.items.length).toBe(1)
    expect(loaded?.items[0].learnerName).toBe('Dela Cruz, Juan')
  })

  it('calculates batch scanning summary metrics accurately', () => {
    const session: BatchScanSession = {
      sessionId: 'sess-batch-102',
      assessmentId: 'asm-102',
      assessmentTitle: 'Math 10 Quiz',
      sectionName: 'Gold',
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
      items: [
        {
          id: 'b1',
          scanTimestamp: '2026-08-19T00:01:00.000Z',
          learnerId: 'l1',
          scanResult: mockScanResult,
          answers: {},
          teacherPoints: {},
          outcomes: [],
          totals: { rawScore: 5, possiblePoints: 5, percentage: 100, attemptedItems: 5, omittedItems: 0, correctItems: 5, incorrectItems: 0, teacherScoredItems: 0, deterministicItems: 5 },
          status: 'CLEAN',
        },
        {
          id: 'b2',
          scanTimestamp: '2026-08-19T00:02:00.000Z',
          learnerId: 'l2',
          scanResult: { ...mockScanResult, needsReview: true },
          answers: {},
          teacherPoints: {},
          outcomes: [],
          totals: { rawScore: 3, possiblePoints: 5, percentage: 60, attemptedItems: 4, omittedItems: 1, correctItems: 3, incorrectItems: 1, teacherScoredItems: 0, deterministicItems: 4 },
          status: 'NEEDS_REVIEW',
        },
        {
          id: 'b3',
          scanTimestamp: '2026-08-19T00:03:00.000Z',
          learnerId: 'l1', // duplicate of l1
          scanResult: mockScanResult,
          answers: {},
          teacherPoints: {},
          outcomes: [],
          totals: { rawScore: 5, possiblePoints: 5, percentage: 100, attemptedItems: 5, omittedItems: 0, correctItems: 5, incorrectItems: 0, teacherScoredItems: 0, deterministicItems: 5 },
          status: 'DUPLICATE',
        },
      ],
    }

    const summary = calculateBatchSummary(session, 10) // 10 total learners in roster

    expect(summary.totalRosterCount).toBe(10)
    expect(summary.totalScanned).toBe(3)
    expect(summary.cleanCount).toBe(1)
    expect(summary.needsReviewCount).toBe(1)
    expect(summary.duplicateCount).toBe(1)
    expect(summary.unscannedCount).toBe(8) // 10 total - 2 unique learners (l1, l2)
  })

  it('clears batch session from localStorage upon commit', () => {
    const session: BatchScanSession = {
      sessionId: 'sess-batch-103',
      assessmentId: 'asm-103',
      assessmentTitle: 'Filipino 7',
      sectionName: 'Emerald',
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
      items: [],
    }

    saveBatchScanSession(session)
    expect(loadBatchScanSession('sess-batch-103')).toBeDefined()

    clearBatchScanSession('sess-batch-103')
    expect(loadBatchScanSession('sess-batch-103')).toBeNull()
  })
})
