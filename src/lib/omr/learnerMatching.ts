import type { ClassLearner, ResultLearnerSnapshot } from '../../types/results'
import type { OmrScanResult } from '../../types/omr'

export type LearnerMatchResult = {
  matchedLearner: ResultLearnerSnapshot | null
  isPersonalized: boolean
  isAutoMatched: boolean
  availableCandidates: ResultLearnerSnapshot[]
  unscannedCandidates: ResultLearnerSnapshot[]
}

/**
 * Matches an OMR scan result to a learner from the active result session or class roster.
 */
export function matchScanToLearner(
  scanResult: OmrScanResult,
  sessionLearners: ResultLearnerSnapshot[],
  scannedLearnerIds: Set<string> = new Set(),
): LearnerMatchResult {
  const isPersonalized = scanResult.mode === 'personalized' && Boolean(scanResult.learnerId)
  let matchedLearner: ResultLearnerSnapshot | null = null

  if (isPersonalized && scanResult.learnerId) {
    matchedLearner = sessionLearners.find((l) => l.learnerId === scanResult.learnerId) || null
  }

  const unscannedCandidates = sessionLearners.filter((l) => !scannedLearnerIds.has(l.learnerId))

  return {
    matchedLearner,
    isPersonalized,
    isAutoMatched: Boolean(matchedLearner),
    availableCandidates: sessionLearners,
    unscannedCandidates,
  }
}

/**
 * Filters learner candidates by search text (name or local reference / LRN).
 */
export function filterLearnerCandidates(
  candidates: ResultLearnerSnapshot[],
  query: string,
): ResultLearnerSnapshot[] {
  const q = query.trim().toLocaleLowerCase('en-US')
  if (!q) return candidates

  return candidates.filter((l) => {
    const name = l.displayName.toLocaleLowerCase('en-US')
    const ref = (l.localReference ?? '').toLocaleLowerCase('en-US')
    return name.includes(q) || ref.includes(q)
  })
}
