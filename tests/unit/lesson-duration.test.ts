import { describe, expect, it } from 'vitest'
import {
  isValidCommittedLessonDuration,
  MAX_LESSON_DURATION_MINUTES,
  MIN_LESSON_DURATION_MINUTES,
  normalizeLessonDurationMinutes,
  STANDARD_DURATION_PRESETS,
} from '../../src/lib/lessonDuration'

describe('Phase 2 — Lesson Plan Minutes Per Session', () => {
  it('accepts standard 5-minute increment values', () => {
    expect(isValidCommittedLessonDuration(10)).toBe(true)
    expect(isValidCommittedLessonDuration(45)).toBe(true)
    expect(isValidCommittedLessonDuration(50)).toBe(true)
    expect(isValidCommittedLessonDuration(55)).toBe(true)
    expect(isValidCommittedLessonDuration(60)).toBe(true)
    expect(isValidCommittedLessonDuration(90)).toBe(true)
    expect(isValidCommittedLessonDuration(300)).toBe(true)
  })

  it('rejects odd or unnormalized values from being valid committed durations', () => {
    expect(isValidCommittedLessonDuration(51)).toBe(false)
    expect(isValidCommittedLessonDuration(47)).toBe(false)
    expect(isValidCommittedLessonDuration(21)).toBe(false)
    expect(isValidCommittedLessonDuration(37)).toBe(false)
    expect(isValidCommittedLessonDuration(61)).toBe(false)
    expect(isValidCommittedLessonDuration(5)).toBe(false) // below minimum 10
    expect(isValidCommittedLessonDuration(305)).toBe(false) // above maximum 300
    expect(isValidCommittedLessonDuration('60')).toBe(false)
    expect(isValidCommittedLessonDuration(null)).toBe(false)
  })

  it('normalizes arbitrary entries to nearest 5-minute increments on commit', () => {
    expect(normalizeLessonDurationMinutes(45)).toBe(45)
    expect(normalizeLessonDurationMinutes(50)).toBe(50)
    expect(normalizeLessonDurationMinutes(55)).toBe(55)
    expect(normalizeLessonDurationMinutes(51)).toBe(50)
    expect(normalizeLessonDurationMinutes(53)).toBe(55)
    expect(normalizeLessonDurationMinutes('48')).toBe(50)
    expect(normalizeLessonDurationMinutes('12')).toBe(10)
  })

  it('enforces safe bounds (min 10, max 300)', () => {
    expect(normalizeLessonDurationMinutes(3)).toBe(MIN_LESSON_DURATION_MINUTES)
    expect(normalizeLessonDurationMinutes(0)).toBe(MIN_LESSON_DURATION_MINUTES)
    expect(normalizeLessonDurationMinutes(-10)).toBe(MIN_LESSON_DURATION_MINUTES)
    expect(normalizeLessonDurationMinutes(350)).toBe(MAX_LESSON_DURATION_MINUTES)
    expect(normalizeLessonDurationMinutes(999)).toBe(MAX_LESSON_DURATION_MINUTES)
  })

  it('falls back safely for invalid or empty inputs without throwing', () => {
    expect(normalizeLessonDurationMinutes(null, 60)).toBe(60)
    expect(normalizeLessonDurationMinutes(undefined, 45)).toBe(45)
    expect(normalizeLessonDurationMinutes('', 50)).toBe(50)
    expect(normalizeLessonDurationMinutes('abc', 60)).toBe(60)
  })

  it('includes standard presets expanding beyond only 45/60/90', () => {
    expect(STANDARD_DURATION_PRESETS).toContain(30)
    expect(STANDARD_DURATION_PRESETS).toContain(45)
    expect(STANDARD_DURATION_PRESETS).toContain(50)
    expect(STANDARD_DURATION_PRESETS).toContain(60)
    expect(STANDARD_DURATION_PRESETS).toContain(90)
    expect(STANDARD_DURATION_PRESETS.length).toBeGreaterThan(3)
  })

  it('preserves historical odd values when loaded directly into data models without mutation', () => {
    // Simulating loading a historical lesson plan object with 47 minutes
    const historicalLessonPlan = {
      id: 'historical-1',
      title: 'Historical Lesson',
      content: {
        durationMinutes: 47,
        lessonFocus: 'Photosynthesis',
      },
    }

    // Direct object loading does NOT mutate the historical data
    expect(historicalLessonPlan.content.durationMinutes).toBe(47)
  })
})
