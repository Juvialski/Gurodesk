import { describe, expect, it } from 'vitest'
import {
  CURRICULUM_CATALOG,
  CURRICULUM_CATALOG_STATS,
  curriculumCatalogGroups,
  curriculumEntriesForGrade,
  findCurriculumCatalogEntry,
  learningAreasForGrade,
} from '../../src/data/curriculumCatalog'
import { GRADE_LEVELS } from '../../src/data/constants'

describe('national curriculum catalog', () => {
  it('has unique stable IDs and source-grounded HTTPS records', () => {
    expect(new Set(CURRICULUM_CATALOG.map((entry) => entry.id)).size).toBe(CURRICULUM_CATALOG.length)
    for (const entry of CURRICULUM_CATALOG) {
      expect(entry.sourceAuthority).toBe('Department of Education')
      expect(entry.sourceUrl.startsWith('https://')).toBe(true)
      expect(new URL(entry.sourceUrl).hostname.endsWith('deped.gov.ph')).toBe(true)
      expect(entry.gradeLevel.length).toBeGreaterThan(0)
      expect(entry.learningArea.length).toBeGreaterThan(0)
      expect(entry.notes.length).toBeGreaterThan(20)
    }
  })

  it('catalogues at least one current offering for every K-12 grade level', () => {
    for (const gradeLevel of GRADE_LEVELS) {
      expect(curriculumEntriesForGrade(gradeLevel, '2026-2027').length, gradeLevel).toBeGreaterThan(0)
    }
  })

  it('preserves Grade 7 Mathematics as the only fully verified competency pack', () => {
    const grade7Math = findCurriculumCatalogEntry('Grade 7', 'Mathematics', '2026-2027')
    expect(grade7Math?.status).toBe('verified_competencies')
    expect(CURRICULUM_CATALOG_STATS.verifiedCompetencyPacks).toBe(1)
  })

  it('tracks the phased Revised K to 10 rollout by school year', () => {
    expect(findCurriculumCatalogEntry('Grade 2', 'Mathematics', '2024-2025')?.track).toBe('legacy_k12')
    expect(findCurriculumCatalogEntry('Grade 2', 'Mathematics', '2025-2026')).not.toBeNull()
    expect(findCurriculumCatalogEntry('Grade 6', 'Mathematics', '2025-2026')?.track).toBe('legacy_k12')
    expect(findCurriculumCatalogEntry('Grade 6', 'Mathematics', '2026-2027')?.status).toBe('official_family_catalogued')
    expect(findCurriculumCatalogEntry('Grade 9', 'Science', '2026-2027')?.status).toBe('official_family_catalogued')
  })

  it('resolves legacy assignment aliases without changing the canonical learning area', () => {
    expect(findCurriculumCatalogEntry('Grade 7', 'Technology and Livelihood Education', '2026-2027')?.learningArea).toBe('TLE')
    expect(findCurriculumCatalogEntry('Grade 7', 'Edukasyon sa Pagpapakatao', '2026-2027')?.learningArea).toBe('Values Education')
    expect(findCurriculumCatalogEntry('Grade 4', 'Good Manners and Right Conduct', '2026-2027')?.learningArea).toBe('GMRC')
  })

  it('catalogues Grade 11 Strengthened SHS core, academic, and TechPro offerings', () => {
    const grade11 = learningAreasForGrade('Grade 11', '2026-2027')
    expect(grade11).toContain('General Mathematics')
    expect(grade11).toContain('Biology 1')
    expect(grade11).toContain('Computer Systems Servicing')
    const groups = curriculumCatalogGroups('Grade 11', '2026-2027').map((group) => group.group)
    expect(groups).toContain('Core Subjects')
    expect(groups.some((group) => group.startsWith('Academic ·'))).toBe(true)
    expect(groups.some((group) => group.startsWith('TechPro ·'))).toBe(true)
  })

  it('keeps current Grade 12 pilot guides distinct from the non-pilot legacy transition', () => {
    const grade12 = learningAreasForGrade('Grade 12', '2026-2027')
    expect(grade12).toContain('Advanced Mathematics')
    expect(grade12).toContain('Creative Production and Presentation')
    expect(grade12).toContain('Legacy SHS subject (non-pilot school)')
    expect(findCurriculumCatalogEntry('Grade 12', 'Legacy SHS subject (non-pilot school)', '2026-2027')?.status).toBe('transitional')
  })
})
