import { describe, expect, it } from 'vitest'
import {
  CURRICULUM_CATALOG,
  CURRICULUM_CATALOG_STATS,
  curriculumCatalogGroups,
  curriculumEntriesForGrade,
  findCurriculumCatalogEntry,
  learningAreasForGrade,
} from '../../src/data/curriculumCatalog'

describe('national curriculum catalog', () => {
  it('has current source-grounded coverage across Kindergarten to Grade 12', () => {
    const grades = ['Kindergarten', ...Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`)]
    for (const grade of grades) expect(curriculumEntriesForGrade(grade, '2026-2027').length).toBeGreaterThan(0)
    expect(CURRICULUM_CATALOG_STATS.verifiedCompetencyPacks).toBe(189)
  })

  it('marks every current official pack verified while keeping transition entries separate', () => {
    const current = CURRICULUM_CATALOG.filter((entry) => !entry.track.startsWith('legacy'))
    const transitional = CURRICULUM_CATALOG.filter((entry) => entry.track.startsWith('legacy'))
    expect(current).toHaveLength(189)
    expect(current.every((entry) => entry.status === 'verified_competencies')).toBe(true)
    expect(transitional.every((entry) => entry.status === 'transitional')).toBe(true)
  })

  it('models phased rollout by school year', () => {
    expect(findCurriculumCatalogEntry('Grade 8', 'Mathematics', '2024-2025')?.track).toBe('legacy_k12')
    expect(findCurriculumCatalogEntry('Grade 8', 'Mathematics', '2025-2026')?.track).toBe('revised_k10')
    expect(findCurriculumCatalogEntry('Grade 9', 'Mathematics', '2025-2026')?.track).toBe('legacy_k12')
    expect(findCurriculumCatalogEntry('Grade 9', 'Mathematics', '2026-2027')?.track).toBe('revised_k10')
  })

  it('supports aliases without introducing fuzzy curriculum guessing', () => {
    expect(findCurriculumCatalogEntry('Grade 7', 'Technology and Livelihood Education', '2026-2027')?.learningArea).toBe('TLE')
    expect(findCurriculumCatalogEntry('Grade 7', 'Totally Invented Subject', '2026-2027')).toBeNull()
  })

  it('exposes grade-aware choices and grouped SSHS offerings', () => {
    expect(learningAreasForGrade('Grade 1', '2026-2027')).toContain('Reading and Literacy')
    const grade11Groups = curriculumCatalogGroups('Grade 11', '2026-2027')
    expect(grade11Groups.some((group) => group.group === 'Core Subjects')).toBe(true)
    expect(grade11Groups.some((group) => group.group.startsWith('TechPro'))).toBe(true)
    expect(CURRICULUM_CATALOG.some((entry) => entry.gradeLevel === 'Grade 12' && entry.learningArea === 'Advanced Mathematics')).toBe(true)
  })
})
