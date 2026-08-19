import { describe, expect, it } from 'vitest'
import { checkDuplicateScan, resolveDuplicateOutcomes } from '../../src/lib/omr/duplicateSafety'
import type { OmrScanResult } from '../../src/types/omr'
import type { ResultItemOutcome } from '../../src/types/results'

describe('Duplicate Scan Detection & Collision Safety', () => {
  const existingOutcomes: ResultItemOutcome[] = [
    { id: 'o1', resultSessionId: 'sess-1', participantId: 'p1', learnerId: 'l1', itemId: 'i1', itemNumber: 1, answer: { type: 'multiple_choice', choiceId: 'c1' }, isCorrect: true, earnedPoints: 1, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
    { id: 'o2', resultSessionId: 'sess-1', participantId: 'p1', learnerId: 'l1', itemId: 'i2', itemNumber: 2, answer: { type: 'multiple_choice', choiceId: 'c2' }, isCorrect: true, earnedPoints: 1, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
  ]

  const newOutcomes: ResultItemOutcome[] = [
    { id: 'o3', resultSessionId: 'sess-1', participantId: 'p1', learnerId: 'l1', itemId: 'i1', itemNumber: 1, answer: { type: 'multiple_choice', choiceId: 'c1' }, isCorrect: true, earnedPoints: 1, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
    { id: 'o4', resultSessionId: 'sess-1', participantId: 'p1', learnerId: 'l1', itemId: 'i2', itemNumber: 2, answer: { type: 'multiple_choice', choiceId: 'c3' }, isCorrect: false, earnedPoints: 0, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
  ]

  const baseScanResult: OmrScanResult = {
    status: 'SUCCESS',
    success: true,
    needsReview: false,
    recognizedItems: [],
    summary: { totalQuestions: 2, machineScanned: 2, filledCount: 2, emptyCount: 0, multipleCount: 0, ambiguousCount: 0, manualScoringCount: 0, needsReviewCount: 0 },
    imageFingerprint: 'img-fingerprint-999',
    processingTimeMs: 35,
  }

  it('detects duplicate scan collision when a learner already has recorded scores', () => {
    const collision = checkDuplicateScan(
      baseScanResult,
      'l1',
      'Dela Cruz, Juan',
      newOutcomes,
      existingOutcomes,
    )

    expect(collision.hasCollision).toBe(true)
    expect(collision.collisionType).toBe('EXISTING_LEARNER_RECORD')
    expect(collision.existingTotalScore).toBe(2)
    expect(collision.newTotalScore).toBe(1)
    expect(collision.message).toContain('already has recorded results')
  })

  it('detects identical image fingerprint collision when re-scanning same photo', () => {
    const scannedFingerprints = new Set(['img-fingerprint-999'])

    const collision = checkDuplicateScan(
      baseScanResult,
      'l2', // different learner assigned, but same photo!
      'Santos, Maria',
      newOutcomes,
      existingOutcomes,
      scannedFingerprints,
    )

    expect(collision.hasCollision).toBe(true)
    expect(collision.collisionType).toBe('IDENTICAL_IMAGE')
    expect(collision.message).toContain('already been scanned')
  })

  it('correctly resolves REPLACE action by updating outcomes for the collided learner', () => {
    const merged = resolveDuplicateOutcomes('REPLACE', existingOutcomes, newOutcomes, 'l1')

    expect(merged.length).toBe(2)
    expect(merged[0].id).toBe('o3')
    expect(merged[1].id).toBe('o4')
  })

  it('correctly resolves KEEP_CURRENT or SKIP action without modifying existing scores', () => {
    const keep = resolveDuplicateOutcomes('KEEP_CURRENT', existingOutcomes, newOutcomes, 'l1')
    expect(keep).toEqual(existingOutcomes)

    const skip = resolveDuplicateOutcomes('SKIP', existingOutcomes, newOutcomes, 'l1')
    expect(skip).toEqual(existingOutcomes)
  })
})
