import type { AssessmentItem, AssessmentRecord } from '../types/assessment'

export type AssessmentGenerationFailure = {
  itemId: string
  message: string
}

export type AssessmentGenerationCheckpoint = {
  schemaVersion: 1
  assessmentId: string
  userId: string
  itemIds: string[]
  generatedItems: Record<string, AssessmentItem>
  failures: Record<string, string>
  status: 'running' | 'paused'
  autoResume: boolean
  startedAt: string
  updatedAt: string
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const STORAGE_PREFIX = 'gurodesk.assessment.generation.batch.v1'
const MAX_CHECKPOINT_AGE_MS = 6 * 60 * 60 * 1000

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function keyFor(assessmentId: string) {
  return `${STORAGE_PREFIX}:${assessmentId}`
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function validCheckpoint(value: unknown): value is AssessmentGenerationCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<AssessmentGenerationCheckpoint>
  return candidate.schemaVersion === 1
    && typeof candidate.assessmentId === 'string'
    && typeof candidate.userId === 'string'
    && Array.isArray(candidate.itemIds)
    && Boolean(candidate.generatedItems && typeof candidate.generatedItems === 'object' && !Array.isArray(candidate.generatedItems))
    && Boolean(candidate.failures && typeof candidate.failures === 'object' && !Array.isArray(candidate.failures))
    && (candidate.status === 'running' || candidate.status === 'paused')
    && typeof candidate.autoResume === 'boolean'
    && typeof candidate.startedAt === 'string'
    && typeof candidate.updatedAt === 'string'
}

export function createAssessmentGenerationCheckpoint(args: {
  assessmentId: string
  userId: string
  itemIds: string[]
  now?: Date
}): AssessmentGenerationCheckpoint {
  const timestamp = (args.now ?? new Date()).toISOString()
  return {
    schemaVersion: 1,
    assessmentId: args.assessmentId,
    userId: args.userId,
    itemIds: uniqueIds(args.itemIds),
    generatedItems: {},
    failures: {},
    status: 'running',
    autoResume: true,
    startedAt: timestamp,
    updatedAt: timestamp,
  }
}

export function saveAssessmentGenerationCheckpoint(
  checkpoint: AssessmentGenerationCheckpoint,
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return false
  try {
    storage.setItem(keyFor(checkpoint.assessmentId), JSON.stringify(checkpoint))
    return true
  } catch {
    return false
  }
}

export function loadAssessmentGenerationCheckpoint(
  assessmentId: string,
  userId: string,
  options: { storage?: StorageLike | null; now?: Date; maxAgeMs?: number } = {},
): AssessmentGenerationCheckpoint | null {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  if (!storage) return null
  try {
    const raw = storage.getItem(keyFor(assessmentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!validCheckpoint(parsed) || parsed.assessmentId !== assessmentId || parsed.userId !== userId) {
      storage.removeItem(keyFor(assessmentId))
      return null
    }
    const updatedAt = Date.parse(parsed.updatedAt)
    const age = (options.now ?? new Date()).getTime() - updatedAt
    if (!Number.isFinite(updatedAt) || age > (options.maxAgeMs ?? MAX_CHECKPOINT_AGE_MS)) {
      storage.removeItem(keyFor(assessmentId))
      return null
    }
    return parsed
  } catch {
    try { storage.removeItem(keyFor(assessmentId)) } catch { /* optional checkpoint */ }
    return null
  }
}

export function clearAssessmentGenerationCheckpoint(
  assessmentId: string,
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return
  try { storage.removeItem(keyFor(assessmentId)) } catch { /* optional checkpoint */ }
}

function updated(checkpoint: AssessmentGenerationCheckpoint, now = new Date()) {
  return { ...checkpoint, updatedAt: now.toISOString() }
}

export function checkpointAssessmentGenerationSuccess(
  checkpoint: AssessmentGenerationCheckpoint,
  item: AssessmentItem,
  now = new Date(),
): AssessmentGenerationCheckpoint {
  const failures = { ...checkpoint.failures }
  delete failures[item.id]
  return updated({
    ...checkpoint,
    generatedItems: { ...checkpoint.generatedItems, [item.id]: item },
    failures,
  }, now)
}

export function checkpointAssessmentGenerationFailure(
  checkpoint: AssessmentGenerationCheckpoint,
  itemId: string,
  message: string,
  now = new Date(),
): AssessmentGenerationCheckpoint {
  const generatedItems = { ...checkpoint.generatedItems }
  delete generatedItems[itemId]
  return updated({
    ...checkpoint,
    generatedItems,
    failures: { ...checkpoint.failures, [itemId]: message },
  }, now)
}

export function pauseAssessmentGenerationCheckpoint(
  checkpoint: AssessmentGenerationCheckpoint,
  now = new Date(),
): AssessmentGenerationCheckpoint {
  return updated({ ...checkpoint, status: 'paused', autoResume: false }, now)
}

export function resumeAssessmentGenerationCheckpoint(
  checkpoint: AssessmentGenerationCheckpoint,
  now = new Date(),
): AssessmentGenerationCheckpoint {
  return updated({ ...checkpoint, status: 'running', autoResume: true }, now)
}

export function pendingAssessmentGenerationItemIds(checkpoint: AssessmentGenerationCheckpoint) {
  const generated = new Set(Object.keys(checkpoint.generatedItems))
  const failed = new Set(Object.keys(checkpoint.failures))
  return checkpoint.itemIds.filter((itemId) => !generated.has(itemId) && !failed.has(itemId))
}

export function checkpointFailures(checkpoint: AssessmentGenerationCheckpoint): AssessmentGenerationFailure[] {
  return Object.entries(checkpoint.failures).map(([itemId, message]) => ({ itemId, message }))
}

export function recoverAssessmentGenerationItems(
  record: AssessmentRecord,
  checkpoint: AssessmentGenerationCheckpoint,
) {
  let recovered = 0
  const items = record.items.map((item) => {
    const generated = checkpoint.generatedItems[item.id]
    if (!generated) return item
    if (item.locked || item.qaState === 'locked' || item.prompt.trim() || item.authorshipState !== 'empty') return item
    recovered += 1
    return generated
  })
  return { record: recovered ? { ...record, items } : record, recovered }
}
