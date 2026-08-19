export const MIN_LESSON_DURATION_MINUTES = 10
export const MAX_LESSON_DURATION_MINUTES = 300
export const LESSON_DURATION_STEP_MINUTES = 5

export const STANDARD_DURATION_PRESETS = [30, 45, 50, 60, 90] as const

/**
 * Normalizes a newly entered or edited lesson duration to a 5-minute increment between 10 and 300 minutes.
 * Does not mutate historical data unless explicitly passed through this commit normalizer.
 */
export function normalizeLessonDurationMinutes(
  value: number | string | null | undefined,
  fallback = 60,
): number {
  if (value === null || value === undefined || value === '') return fallback
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  const clamped = Math.max(MIN_LESSON_DURATION_MINUTES, Math.min(MAX_LESSON_DURATION_MINUTES, num))
  return Math.round(clamped / LESSON_DURATION_STEP_MINUTES) * LESSON_DURATION_STEP_MINUTES
}

/**
 * Checks if a value satisfies the standard duration rule for new/edited durations.
 */
export function isValidCommittedLessonDuration(value: unknown): boolean {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return false
  return (
    value >= MIN_LESSON_DURATION_MINUTES &&
    value <= MAX_LESSON_DURATION_MINUTES &&
    value % LESSON_DURATION_STEP_MINUTES === 0
  )
}
