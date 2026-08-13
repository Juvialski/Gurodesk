const TEACHER_TOUR_VERSION = 'v1'
const TEACHER_TOUR_STORAGE_PREFIX = 'gurodesk.teacher-tour'

/**
 * Keep the completion marker separate for every signed-in teacher. The value is
 * deliberately a non-sensitive status marker; no profile data or token is
 * persisted by the tour.
 */
export function getTeacherTourStorageKey(userId: string): string {
  return `${TEACHER_TOUR_STORAGE_PREFIX}.${TEACHER_TOUR_VERSION}.${encodeURIComponent(userId)}`
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

export function hasCompletedTeacherTour(userId: string): boolean {
  if (!userId) return false
  try {
    return getLocalStorage()?.getItem(getTeacherTourStorageKey(userId)) === 'completed'
  } catch {
    // Private browsing and blocked storage must never prevent the workspace
    // from opening.
    return false
  }
}

export function markTeacherTourCompleted(userId: string): void {
  if (!userId) return
  try {
    getLocalStorage()?.setItem(getTeacherTourStorageKey(userId), 'completed')
  } catch {
    // Completion is a convenience. A storage failure must not block a user
    // from dismissing or finishing the tour.
  }
}

export function shouldAutoOpenTeacherTour(userId: string | null | undefined): boolean {
  return Boolean(userId && !hasCompletedTeacherTour(userId))
}

export function previousTeacherTourStep(currentStep: number): number {
  return Math.max(0, currentStep - 1)
}

export function nextTeacherTourStep(currentStep: number, stepCount: number): number {
  return Math.min(Math.max(0, stepCount - 1), Math.max(0, currentStep) + 1)
}
