import type { AssessmentItem, AssessmentRecord } from '../types/assessment'

export type AssessmentGenerationFailure = {
  itemId: string
  message: string
}

export type AssessmentGenerationCheckpoint = {
  schemaVersion: 2
  assessmentId: string
  userId: string
  itemIds: string[]
  generatedItems: Record<string, AssessmentItem>
  failures: Record<string, string>
  phase: 'questions' | 'visuals' | 'complete'
  visualItemIds: string[]
  visualItems: Record<string, AssessmentItem>
  visualFailures: Record<string, string>
  status: 'running' | 'paused'
  autoResume: boolean
  startedAt: string
  updatedAt: string
}

type LegacyAssessmentGenerationCheckpoint = Omit<AssessmentGenerationCheckpoint, 'schemaVersion' | 'phase' | 'visualItemIds' | 'visualItems' | 'visualFailures'> & { schemaVersion: 1 }
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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringRecord(value: unknown) {
  const source = record(value)
  if (!source) return null
  return Object.fromEntries(Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

function itemRecord(value: unknown) {
  const source = record(value)
  if (!source) return null
  return source as unknown as AssessmentItem
}

function itemMap(value: unknown) {
  const source = record(value)
  if (!source) return null
  const entries: Array<[string, AssessmentItem]> = []
  for (const [key, entry] of Object.entries(source)) {
    const item = itemRecord(entry)
    if (!item || item.id !== key || typeof item.prompt !== 'string') return null
    entries.push([key, item])
  }
  return Object.fromEntries(entries)
}

function normalizeCheckpoint(value: unknown): AssessmentGenerationCheckpoint | null {
  const candidate = record(value)
  if (!candidate || (candidate.schemaVersion !== 1 && candidate.schemaVersion !== 2)) return null
  if (typeof candidate.assessmentId !== 'string' || typeof candidate.userId !== 'string' || !Array.isArray(candidate.itemIds)) return null
  const generatedItems = itemMap(candidate.generatedItems)
  const failures = stringRecord(candidate.failures)
  if (!generatedItems || !failures || (candidate.status !== 'running' && candidate.status !== 'paused') || typeof candidate.autoResume !== 'boolean' || typeof candidate.startedAt !== 'string' || typeof candidate.updatedAt !== 'string') return null
  if (candidate.schemaVersion === 1) {
    const legacy = candidate as unknown as LegacyAssessmentGenerationCheckpoint
    return {
      ...legacy,
      schemaVersion: 2,
      phase: 'questions',
      visualItemIds: [],
      visualItems: {},
      visualFailures: {},
      itemIds: uniqueIds(legacy.itemIds),
      generatedItems,
      failures,
    }
  }
  const phase = candidate.phase
  const visualItems = itemMap(candidate.visualItems)
  const visualFailures = stringRecord(candidate.visualFailures)
  if ((phase !== 'questions' && phase !== 'visuals' && phase !== 'complete') || !Array.isArray(candidate.visualItemIds) || !visualItems || !visualFailures) return null
  return {
    ...(candidate as unknown as AssessmentGenerationCheckpoint),
    schemaVersion: 2,
    phase,
    itemIds: uniqueIds(candidate.itemIds.map(String)),
    generatedItems,
    failures,
    visualItemIds: uniqueIds(candidate.visualItemIds.map(String)),
    visualItems,
    visualFailures,
  }
}

export function createAssessmentGenerationCheckpoint(args: {
  assessmentId: string
  userId: string
  itemIds: string[]
  now?: Date
}): AssessmentGenerationCheckpoint {
  const timestamp = (args.now ?? new Date()).toISOString()
  return {
    schemaVersion: 2,
    assessmentId: args.assessmentId,
    userId: args.userId,
    itemIds: uniqueIds(args.itemIds),
    generatedItems: {},
    failures: {},
    phase: 'questions',
    visualItemIds: [],
    visualItems: {},
    visualFailures: {},
    status: 'running',
    autoResume: true,
    startedAt: timestamp,
    updatedAt: timestamp,
  }
}

export function saveAssessmentGenerationCheckpoint(checkpoint: AssessmentGenerationCheckpoint, storage: StorageLike | null = browserStorage()) {
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
    const parsed = normalizeCheckpoint(JSON.parse(raw) as unknown)
    if (!parsed || parsed.assessmentId !== assessmentId || parsed.userId !== userId) {
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

export function clearAssessmentGenerationCheckpoint(assessmentId: string, storage: StorageLike | null = browserStorage()) {
  if (!storage) return
  try { storage.removeItem(keyFor(assessmentId)) } catch { /* optional checkpoint */ }
}

function updated(checkpoint: AssessmentGenerationCheckpoint, now = new Date()) {
  return { ...checkpoint, updatedAt: now.toISOString() }
}

export function checkpointAssessmentGenerationSuccess(checkpoint: AssessmentGenerationCheckpoint, item: AssessmentItem, now = new Date()): AssessmentGenerationCheckpoint {
  const failures = { ...checkpoint.failures }
  delete failures[item.id]
  return updated({ ...checkpoint, generatedItems: { ...checkpoint.generatedItems, [item.id]: item }, failures }, now)
}

export function checkpointAssessmentGenerationFailure(checkpoint: AssessmentGenerationCheckpoint, itemId: string, message: string, now = new Date()): AssessmentGenerationCheckpoint {
  // A question exposed through onQuestionReady is still valuable even when a
  // later verifier fails. Never erase that paid-for checkpoint here.
  return updated({ ...checkpoint, failures: { ...checkpoint.failures, [itemId]: message.slice(0, 600) } }, now)
}

export function beginAssessmentVisualGeneration(checkpoint: AssessmentGenerationCheckpoint, itemIds: string[], now = new Date()): AssessmentGenerationCheckpoint {
  return updated({ ...checkpoint, phase: 'visuals', visualItemIds: uniqueIds(itemIds), status: 'running', autoResume: true }, now)
}

export function checkpointAssessmentVisualSuccess(checkpoint: AssessmentGenerationCheckpoint, item: AssessmentItem, now = new Date()): AssessmentGenerationCheckpoint {
  const visualFailures = { ...checkpoint.visualFailures }
  delete visualFailures[item.id]
  return updated({ ...checkpoint, visualItems: { ...checkpoint.visualItems, [item.id]: item }, visualFailures }, now)
}

export function checkpointAssessmentVisualFailure(checkpoint: AssessmentGenerationCheckpoint, item: AssessmentItem, message: string, now = new Date()): AssessmentGenerationCheckpoint {
  return updated({ ...checkpoint, visualItems: { ...checkpoint.visualItems, [item.id]: item }, visualFailures: { ...checkpoint.visualFailures, [item.id]: message.slice(0, 600) } }, now)
}

export function completeAssessmentGenerationCheckpoint(checkpoint: AssessmentGenerationCheckpoint, now = new Date()): AssessmentGenerationCheckpoint {
  return updated({ ...checkpoint, phase: 'complete', status: 'paused', autoResume: false }, now)
}

export function pauseAssessmentGenerationCheckpoint(checkpoint: AssessmentGenerationCheckpoint, now = new Date()): AssessmentGenerationCheckpoint {
  return updated({ ...checkpoint, status: 'paused', autoResume: false }, now)
}

export function resumeAssessmentGenerationCheckpoint(checkpoint: AssessmentGenerationCheckpoint, now = new Date()): AssessmentGenerationCheckpoint {
  return updated({ ...checkpoint, status: 'running', autoResume: true }, now)
}

export function pendingAssessmentGenerationItemIds(checkpoint: AssessmentGenerationCheckpoint) {
  const generated = new Set(Object.keys(checkpoint.generatedItems))
  const failed = new Set(Object.keys(checkpoint.failures))
  return checkpoint.itemIds.filter((itemId) => !generated.has(itemId) && !failed.has(itemId))
}

export function pendingAssessmentVisualItemIds(checkpoint: AssessmentGenerationCheckpoint, maxAttempts = 2) {
  return checkpoint.visualItemIds.filter((itemId) => {
    const item = checkpoint.visualItems[itemId]
    if (!item) return true
    if (item.visualStatus === 'succeeded' && item.visual) return false
    return Math.max(0, Number(item.visualAttempts) || 0) < maxAttempts
  })
}

export function checkpointFailures(checkpoint: AssessmentGenerationCheckpoint): AssessmentGenerationFailure[] {
  return Object.entries(checkpoint.failures).map(([itemId, message]) => ({ itemId, message }))
}

export function checkpointVisualFailures(checkpoint: AssessmentGenerationCheckpoint): AssessmentGenerationFailure[] {
  return Object.entries(checkpoint.visualFailures).map(([itemId, message]) => ({ itemId, message }))
}

function sameQuestion(left: AssessmentItem, right: AssessmentItem) {
  return left.id === right.id
    && left.itemNumber === right.itemNumber
    && left.questionType === right.questionType
    && left.prompt === right.prompt
    && JSON.stringify(left.answer) === JSON.stringify(right.answer)
    && left.mapping.rowId === right.mapping.rowId
    && left.mapping.competencyId === right.mapping.competencyId
    && left.mapping.cognitiveCategoryId === right.mapping.cognitiveCategoryId
}

function mergeVisualCheckpoint(item: AssessmentItem, visualItem: AssessmentItem) {
  return {
    ...item,
    visual: visualItem.visual,
    visualRequirement: visualItem.visualRequirement,
    visualIntent: visualItem.visualIntent,
    visualStatus: visualItem.visualStatus,
    visualAttempts: visualItem.visualAttempts,
    visualError: visualItem.visualError,
    visualSourceHash: visualItem.visualSourceHash,
    visualUpdatedAt: visualItem.visualUpdatedAt,
  }
}

export function recoverAssessmentGenerationItems(record: AssessmentRecord, checkpoint: AssessmentGenerationCheckpoint) {
  let recovered = 0
  let visualRecovered = 0
  const items = record.items.map((item) => {
    let next = item
    const generated = checkpoint.generatedItems[item.id]
    if (generated && !item.locked && item.qaState !== 'locked' && !item.prompt.trim() && item.authorshipState === 'empty') {
      next = generated
      recovered += 1
    }
    const visualItem = checkpoint.visualItems[item.id]
    if (visualItem && !next.locked && next.qaState !== 'locked' && sameQuestion(next, visualItem)) {
      next = mergeVisualCheckpoint(next, visualItem)
      visualRecovered += 1
    }
    return next
  })
  return { record: recovered || visualRecovered ? { ...record, items } : record, recovered, visualRecovered }
}
