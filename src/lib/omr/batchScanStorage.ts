import type { BatchScanItem, BatchScanSession, BatchScanSummary } from '../../types/batchScan'

const STORAGE_PREFIX = 'gurodesk:omr_batch:'

export function getBatchStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`
}

/**
 * Saves uncommitted batch scans to browser localStorage so teachers never lose progress.
 */
export function saveBatchScanSession(session: BatchScanSession): void {
  if (typeof localStorage === 'undefined') return
  try {
    const key = getBatchStorageKey(session.sessionId)
    localStorage.setItem(key, JSON.stringify(session))
  } catch (error) {
    console.warn('[BatchScanStorage] Failed to save batch session to localStorage', error)
  }
}

/**
 * Loads an uncommitted batch scanning session to resume an interrupted workflow.
 */
export function loadBatchScanSession(sessionId: string): BatchScanSession | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const key = getBatchStorageKey(sessionId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as BatchScanSession
  } catch (error) {
    console.warn('[BatchScanStorage] Failed to load batch session from localStorage', error)
    return null
  }
}

/**
 * Clears saved batch scans once successfully committed to the results session.
 */
export function clearBatchScanSession(sessionId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    const key = getBatchStorageKey(sessionId)
    localStorage.removeItem(key)
  } catch {
    // Ignore cleanup error
  }
}

/**
 * Calculates current progress metrics for the batch scanning tray.
 */
export function calculateBatchSummary(
  session: BatchScanSession,
  totalRosterCount: number,
): BatchScanSummary {
  let cleanCount = 0
  let needsReviewCount = 0
  let duplicateCount = 0

  const uniqueLearnerIds = new Set<string>()

  for (const item of session.items) {
    if (item.learnerId) {
      uniqueLearnerIds.add(item.learnerId)
    }
    if (item.status === 'CLEAN') cleanCount++
    else if (item.status === 'NEEDS_REVIEW') needsReviewCount++
    else if (item.status === 'DUPLICATE') duplicateCount++
  }

  const unscannedCount = Math.max(0, totalRosterCount - uniqueLearnerIds.size)

  return {
    totalRosterCount,
    totalScanned: session.items.length,
    cleanCount,
    needsReviewCount,
    duplicateCount,
    unscannedCount,
  }
}
