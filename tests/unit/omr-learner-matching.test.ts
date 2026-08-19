import { describe, expect, it } from 'vitest'
import { filterLearnerCandidates, matchScanToLearner } from '../../src/lib/omr/learnerMatching'
import type { OmrScanResult } from '../../src/types/omr'
import type { ResultLearnerSnapshot } from '../../src/types/results'

const SAMPLE_LEARNERS: ResultLearnerSnapshot[] = [
  { participantId: 'p1', learnerId: 'l1', displayName: 'Alcantara, Gabriel', localReference: 'LRN-101', learnerWasActive: true },
  { participantId: 'p2', learnerId: 'l2', displayName: 'Bautista, Maria Clara', localReference: 'LRN-102', learnerWasActive: true },
  { participantId: 'p3', learnerId: 'l3', displayName: 'Cruz, Juan', localReference: 'LRN-103', learnerWasActive: true },
  { participantId: 'p4', learnerId: 'l4', displayName: 'Dizon, Andres', localReference: 'LRN-104', learnerWasActive: true },
]

describe('Learner Matching & Roster Resolution', () => {
  it('automatically matches a personalized QR scan to the exact roster learner', () => {
    const scanResult: OmrScanResult = {
      status: 'SUCCESS',
      success: true,
      needsReview: false,
      mode: 'personalized',
      learnerId: 'l2',
      recognizedItems: [],
      summary: { totalQuestions: 10, machineScanned: 10, filledCount: 10, emptyCount: 0, multipleCount: 0, ambiguousCount: 0, manualScoringCount: 0, needsReviewCount: 0 },
      imageFingerprint: 'img-123',
      processingTimeMs: 40,
    }

    const result = matchScanToLearner(scanResult, SAMPLE_LEARNERS)

    expect(result.isPersonalized).toBe(true)
    expect(result.isAutoMatched).toBe(true)
    expect(result.matchedLearner).toBeDefined()
    expect(result.matchedLearner?.displayName).toBe('Bautista, Maria Clara')
  })

  it('leaves matchedLearner null on generic sheets and tracks unscanned candidates', () => {
    const scanResult: OmrScanResult = {
      status: 'SUCCESS',
      success: true,
      needsReview: false,
      mode: 'generic',
      recognizedItems: [],
      summary: { totalQuestions: 10, machineScanned: 10, filledCount: 10, emptyCount: 0, multipleCount: 0, ambiguousCount: 0, manualScoringCount: 0, needsReviewCount: 0 },
      imageFingerprint: 'img-456',
      processingTimeMs: 42,
    }

    const scannedIds = new Set(['l1', 'l2'])
    const result = matchScanToLearner(scanResult, SAMPLE_LEARNERS, scannedIds)

    expect(result.isPersonalized).toBe(false)
    expect(result.isAutoMatched).toBe(false)
    expect(result.matchedLearner).toBeNull()
    expect(result.unscannedCandidates.length).toBe(2)
    expect(result.unscannedCandidates.map((l) => l.learnerId)).toEqual(['l3', 'l4'])
  })

  it('filters learner candidate roster by name or LRN', () => {
    const byName = filterLearnerCandidates(SAMPLE_LEARNERS, 'maria')
    expect(byName.length).toBe(1)
    expect(byName[0].displayName).toBe('Bautista, Maria Clara')

    const byLrn = filterLearnerCandidates(SAMPLE_LEARNERS, '104')
    expect(byLrn.length).toBe(1)
    expect(byLrn[0].displayName).toBe('Dizon, Andres')
  })
})
