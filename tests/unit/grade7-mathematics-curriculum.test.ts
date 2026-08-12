import { describe, expect, it } from 'vitest'
import manifest from '../../data/curriculum/official/revised-k10-grade-7-mathematics.json'
import { getDemoCurriculumBundle } from '../../src/data/demoCurriculum'

const originalCompetencyIds = Array.from({ length: 4 }, (_, quarterIndex) => {
  const quarter = quarterIndex + 1
  const count = [14, 12, 12, 14][quarterIndex]
  return Array.from({ length: count }, (_, itemIndex) =>
    `revised-k10-grade-7-mathematics:period-${quarter}:item-${itemIndex + 1}`,
  )
}).flat()

describe('verified Grade 7 Mathematics curriculum data', () => {
  it('preserves periods, domains, competency count, and stable competency identities', () => {
    expect(manifest.periods.map((period) => period.label)).toEqual(['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'])
    expect(manifest.domains.map((domain) => domain.name)).toEqual([
      'Measurement and Geometry (MG)',
      'Number and Algebra (NA)',
      'Data and Probability (DP)',
    ])
    expect(manifest.competencies).toHaveLength(52)
    expect(manifest.competencies.map((item) => item.recordId)).toEqual(originalCompetencyIds)
    expect(manifest.competencies.every((item) => item.competencyCode === null)).toBe(true)
  })

  it('loads verified content and performance standards with provenance and deterministic scope', () => {
    const content = manifest.standards.filter((standard) => standard.type === 'content')
    const performance = manifest.standards.filter((standard) => standard.type === 'performance')
    expect(content).toHaveLength(21)
    expect(performance).toHaveLength(21)
    expect(manifest.contentStandards).toEqual(content)
    expect(manifest.performanceStandards).toEqual(performance)
    expect(manifest.standards.every((standard) => standard.verificationStatus === 'verified')).toBe(true)
    expect(manifest.standards.every((standard) => [52, 53, 54, 55].includes(standard.sourcePage))).toBe(true)
    expect(manifest.standards.every((standard) => ['D01', 'D02', 'D03'].includes(standard.domain))).toBe(true)
  })

  it('retains representative official wording without whitespace-sensitive assertions', () => {
    const normalized = manifest.standards.map((standard) => standard.text.replace(/\s+/g, ' ').trim())
    expect(normalized).toContain('regular and irregular polygons and their features/properties.')
    expect(normalized).toContain('draw, and describe the features/properties of, regular and irregular polygons. (MG)')
    expect(normalized).toContain('illustrates sets and subsets, and union and intersection of sets, using Venn diagrams. (NA)')
  })

  it('exposes standards through the navigator and resolves the standards applicable to a competency by period and domain', () => {
    const bundle = getDemoCurriculumBundle('2026-2027', 'Grade 7', 'Mathematics')
    expect(bundle.available).toBe(true)
    expect(bundle.standards).toHaveLength(42)

    const competency = bundle.competencies[0]
    const applicable = bundle.standards.filter((standard) =>
      standard.academicPeriodId === competency.academicPeriodId
      && (standard.domainId === null || standard.domainId === competency.domainId),
    )
    expect(applicable.some((standard) => standard.standardType === 'content')).toBe(true)
    expect(applicable.some((standard) => standard.standardType === 'performance')).toBe(true)
    expect(applicable.every((standard) => standard.sourcePage === 52)).toBe(true)
  })
})
