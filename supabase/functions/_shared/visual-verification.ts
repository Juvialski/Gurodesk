export type FinishedVisualVerifier = {
  status: 'pass' | 'needs_repair'
  shapeCountCorrect: boolean
  labelsCorrect: boolean
  valuesCorrect: boolean
  relationshipsCorrect: boolean
  graphCorrect: boolean
  essentialGivenPresent: boolean
  answerLeakDetected: boolean
  issues: string[]
  repairGuidance: string[]
}

const EXACT_KEYS = new Set([
  'status', 'shapeCountCorrect', 'labelsCorrect', 'valuesCorrect', 'relationshipsCorrect',
  'graphCorrect', 'essentialGivenPresent', 'answerLeakDetected', 'issues', 'repairGuidance',
])

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function list(value: unknown, max: number, limit: number) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().slice(0, limit)).filter(Boolean).slice(0, max)
    : []
}

/** Strictly normalize the independent finished-diagram verifier response. */
export function normalizeFinishedVisualVerifier(value: unknown): FinishedVisualVerifier {
  const verifier = object(value)
  const keys = Object.keys(verifier)
  if (keys.length !== EXACT_KEYS.size || keys.some((key) => !EXACT_KEYS.has(key))) throw new Error('The finished visual verification response did not match the required structured contract.')
  if (
    !['pass', 'needs_repair'].includes(String(verifier.status))
    || typeof verifier.shapeCountCorrect !== 'boolean'
    || typeof verifier.labelsCorrect !== 'boolean'
    || typeof verifier.valuesCorrect !== 'boolean'
    || typeof verifier.relationshipsCorrect !== 'boolean'
    || typeof verifier.graphCorrect !== 'boolean'
    || typeof verifier.essentialGivenPresent !== 'boolean'
    || typeof verifier.answerLeakDetected !== 'boolean'
    || !Array.isArray(verifier.issues)
    || !Array.isArray(verifier.repairGuidance)
  ) throw new Error('The finished visual verification response did not match the required structured contract.')

  const normalized: FinishedVisualVerifier = {
    status: String(verifier.status) as FinishedVisualVerifier['status'],
    shapeCountCorrect: verifier.shapeCountCorrect,
    labelsCorrect: verifier.labelsCorrect,
    valuesCorrect: verifier.valuesCorrect,
    relationshipsCorrect: verifier.relationshipsCorrect,
    graphCorrect: verifier.graphCorrect,
    essentialGivenPresent: verifier.essentialGivenPresent,
    answerLeakDetected: verifier.answerLeakDetected,
    issues: list(verifier.issues, 12, 500),
    repairGuidance: list(verifier.repairGuidance, 12, 700),
  }
  const allChecksPass = normalized.shapeCountCorrect
    && normalized.labelsCorrect
    && normalized.valuesCorrect
    && normalized.relationshipsCorrect
    && normalized.graphCorrect
    && normalized.essentialGivenPresent
    && !normalized.answerLeakDetected
  if (normalized.status === 'pass' && !allChecksPass) normalized.status = 'needs_repair'
  return normalized
}
