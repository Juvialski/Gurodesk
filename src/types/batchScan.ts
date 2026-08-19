import type { LearnerItemAnswer, ResultItemOutcome } from './results'
import type { ResultTotals } from '../lib/resultsScoring'
import type { OmrScanResult } from './omr'

export type BatchScanItemStatus = 'CLEAN' | 'NEEDS_REVIEW' | 'DUPLICATE' | 'COMMITTED'

export type BatchScanItem = {
  id: string
  scanTimestamp: string
  learnerId: string | null
  participantId?: string
  learnerName?: string
  scanResult: OmrScanResult
  answers: Record<string, LearnerItemAnswer | null>
  teacherPoints: Record<string, number | null>
  outcomes: ResultItemOutcome[]
  totals: ResultTotals
  status: BatchScanItemStatus
  reviewReason?: string
}

export type BatchScanSession = {
  sessionId: string
  assessmentId: string
  assessmentTitle: string
  sectionName: string
  createdAt: string
  updatedAt: string
  items: BatchScanItem[]
}

export type BatchScanSummary = {
  totalRosterCount: number
  totalScanned: number
  cleanCount: number
  needsReviewCount: number
  duplicateCount: number
  unscannedCount: number
}
