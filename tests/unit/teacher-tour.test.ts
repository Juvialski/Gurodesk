import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getTeacherTourStorageKey,
  hasCompletedTeacherTour,
  markTeacherTourCompleted,
  nextTeacherTourStep,
  previousTeacherTourStep,
  shouldAutoOpenTeacherTour,
} from '../../src/lib/teacherTour'
import { TEACHER_TOUR_STEPS } from '../../src/components/TeacherTour'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear() { values.clear() },
    getItem(key) { return values.get(key) ?? null },
    key(index) { return [...values.keys()][index] ?? null },
    removeItem(key) { values.delete(key) },
    setItem(key, value) { values.set(key, value) },
  }
}

describe('teacher tour persistence', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  let storage: Storage

  beforeEach(() => {
    storage = createMemoryStorage()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: storage },
    })
  })

  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  it('scopes the non-sensitive completion marker to the authenticated user', () => {
    const firstKey = getTeacherTourStorageKey('teacher-one')
    const secondKey = getTeacherTourStorageKey('teacher-two')
    expect(firstKey).not.toBe(secondKey)
    expect(firstKey).toContain('teacher-one')
    expect(shouldAutoOpenTeacherTour('teacher-one')).toBe(true)

    markTeacherTourCompleted('teacher-one')

    expect(storage.getItem(firstKey)).toBe('completed')
    expect(hasCompletedTeacherTour('teacher-one')).toBe(true)
    expect(hasCompletedTeacherTour('teacher-two')).toBe(false)
    expect(shouldAutoOpenTeacherTour('teacher-one')).toBe(false)
    expect(shouldAutoOpenTeacherTour(null)).toBe(false)
  })

  it('does not throw when browser storage is unavailable', () => {
    const blockedWindow = {}
    Object.defineProperty(blockedWindow, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage blocked')
      },
    })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: blockedWindow })

    expect(() => hasCompletedTeacherTour('teacher-one')).not.toThrow()
    expect(() => markTeacherTourCompleted('teacher-one')).not.toThrow()
    expect(shouldAutoOpenTeacherTour('teacher-one')).toBe(true)
  })
})

describe('teacher tour steps', () => {
  it('covers the required workflow destinations in a clear seven-step flow', () => {
    expect(TEACHER_TOUR_STEPS).toHaveLength(7)
    expect(TEACHER_TOUR_STEPS.map((step) => step.destination)).toEqual([
      'Home',
      'Classes · Curriculum',
      'Lesson Plans · Templates & TOS',
      'Assessments',
      'Results',
      'Settings → AI assistance',
      'More → Replay Tour',
    ])
    expect(TEACHER_TOUR_STEPS.map((step) => step.route).some((route) => route.includes('/tos'))).toBe(true)
    expect(TEACHER_TOUR_STEPS.map((step) => step.route)).toContain('/assessments')
    expect(TEACHER_TOUR_STEPS[0].description).toContain('TOS, assessments, learner results, and reports')
    expect(TEACHER_TOUR_STEPS[5].description).not.toMatch(/localStorage|browser storage|stored locally/i)
  })

  it('keeps Next and Back within the available steps', () => {
    expect(previousTeacherTourStep(0)).toBe(0)
    expect(previousTeacherTourStep(3)).toBe(2)
    expect(nextTeacherTourStep(0, TEACHER_TOUR_STEPS.length)).toBe(1)
    expect(nextTeacherTourStep(TEACHER_TOUR_STEPS.length - 1, TEACHER_TOUR_STEPS.length)).toBe(TEACHER_TOUR_STEPS.length - 1)
  })

  it('keeps the accessible actions and replay entry wired into the authenticated shell', () => {
    const tour = readFileSync(new URL('../../src/components/TeacherTour.tsx', import.meta.url), 'utf8')
    const shell = readFileSync(new URL('../../src/components/AppShell.tsx', import.meta.url), 'utf8')
    const navigation = readFileSync(new URL('../../src/components/navigation/ResponsiveNavigation.tsx', import.meta.url), 'utf8')

    expect(tour).toContain('aria-modal="true"')
    expect(tour).toContain('role="progressbar"')
    for (const action of ['Skip tour', 'Back', 'Next', 'Finish']) expect(tour).toContain(action)
    expect(shell).toContain('shouldAutoOpenTeacherTour(user?.id)')
    expect(navigation.match(/Replay Tour/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
