import type { ResultItemOutcome } from '../../types/results'
import type { OmrScanResult } from '../../types/omr'
import { calculateResultTotals } from '../resultsScoring'

export type DuplicateCollisionType = 'IDENTICAL_IMAGE' | 'EXISTING_LEARNER_RECORD' | 'NONE'

export type DuplicateResolutionAction = 'REPLACE' | 'KEEP_CURRENT' | 'SKIP'

export type DuplicateCheckResult = {
  hasCollision: boolean
  collisionType: DuplicateCollisionType
  learnerId?: string
  learnerName?: string
  existingOutcomeCount: number
  existingTotalScore: number
  newTotalScore: number
  message: string
}

/**
 * Detects whether a newly scanned sheet collides with already recorded scores or an identical image.
 * CRITICAL SAFETY RULE: Existing learner scores must never be silently overwritten.
 */
export function checkDuplicateScan(
  scanResult: OmrScanResult,
  learnerId: string | null | undefined,
  learnerName: string | undefined,
  newOutcomes: ResultItemOutcome[],
  existingOutcomes: ResultItemOutcome[],
  scannedFingerprints: Set<string> = new Set(),
  excludeFingerprint?: string,
): DuplicateCheckResult {
  const newTotals = calculateResultTotals(newOutcomes)

  // 1. Check for identical image fingerprint (re-scanning the exact same photo)
  if (
    scanResult.imageFingerprint &&
    scanResult.imageFingerprint !== excludeFingerprint &&
    scannedFingerprints.has(scanResult.imageFingerprint)
  ) {
    const existingLearnerOutcomes = learnerId
      ? existingOutcomes.filter((o) => o.learnerId === learnerId)
      : []
    const existingTotals = calculateResultTotals(existingLearnerOutcomes)

    return {
      hasCollision: true,
      collisionType: 'IDENTICAL_IMAGE',
      learnerId: learnerId ?? undefined,
      learnerName,
      existingOutcomeCount: existingLearnerOutcomes.length,
      existingTotalScore: existingTotals.rawScore,
      newTotalScore: newTotals.rawScore,
      message: 'This exact photo has already been scanned in this session.',
    }
  }

  // 2. Check if the learner already has recorded answers in this session
  if (learnerId) {
    const existingLearnerOutcomes = existingOutcomes.filter(
      (o) => o.learnerId === learnerId && (o.answer !== null || o.earnedPoints > 0),
    )

    if (existingLearnerOutcomes.length > 0) {
      const existingTotals = calculateResultTotals(existingLearnerOutcomes)

      return {
        hasCollision: true,
        collisionType: 'EXISTING_LEARNER_RECORD',
        learnerId,
        learnerName,
        existingOutcomeCount: existingLearnerOutcomes.length,
        existingTotalScore: existingTotals.rawScore,
        newTotalScore: newTotals.rawScore,
        message: `${learnerName || 'This student'} already has recorded results (${existingTotals.rawScore} pts). Would you like to replace the existing score or keep the current one?`,
      }
    }
  }

  return {
    hasCollision: false,
    collisionType: 'NONE',
    existingOutcomeCount: 0,
    existingTotalScore: 0,
    newTotalScore: newTotals.rawScore,
    message: 'No duplicate collision.',
  }
}

/**
 * Merges new outcomes into existing session outcomes based on the teacher's explicit resolution choice.
 */
export function resolveDuplicateOutcomes(
  action: DuplicateResolutionAction,
  existingOutcomes: ResultItemOutcome[],
  newOutcomes: ResultItemOutcome[],
  learnerId: string,
): ResultItemOutcome[] {
  if (action === 'KEEP_CURRENT' || action === 'SKIP') {
    return existingOutcomes
  }

  // action === 'REPLACE': remove prior outcomes for this learner and append new ones
  const filtered = existingOutcomes.filter((o) => o.learnerId !== learnerId)
  return [...filtered, ...newOutcomes]
}
