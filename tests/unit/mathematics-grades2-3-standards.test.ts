import { describe, expect, it } from 'vitest'
import grade2 from '../../data/curriculum/official/revised-k10-grade-2-mathematics.json'
import grade3 from '../../data/curriculum/official/revised-k10-grade-3-mathematics.json'

const cases = [
  { label: 'Grade 2', slug: 'revised-k10-grade-2-mathematics', manifest: grade2, counts: [14, 14, 12, 13], contentCount: 16, performanceCount: 19, domains: ['D01', 'D02', 'D03', 'D04'] },
  { label: 'Grade 3', slug: 'revised-k10-grade-3-mathematics', manifest: grade3, counts: [14, 14, 12, 11], contentCount: 21, performanceCount: 18, domains: ['D01', 'D02', 'D03', 'D04', 'D05'] },
] as const

for (const item of cases) {
  describe(`${item.label} Mathematics verified standards`, () => {
    it('preserves existing competency identities and quarter sequence', () => {
      const expectedIds = item.counts.flatMap((count, quarterIndex) =>
        Array.from({ length: count }, (_, itemIndex) => `${item.slug}:period-${quarterIndex + 1}:item-${itemIndex + 1}`),
      )
      expect(item.manifest.competencies.map((competency) => competency.recordId)).toEqual(expectedIds)
      expect(item.manifest.competencies.every((competency) => competency.competencyCode === null)).toBe(true)
    })

    it('loads verified Content and Performance Standards with source provenance', () => {
      const content = item.manifest.standards.filter((standard) => standard.type === 'content')
      const performance = item.manifest.standards.filter((standard) => standard.type === 'performance')
      expect(content).toHaveLength(item.contentCount)
      expect(performance).toHaveLength(item.performanceCount)
      expect(item.manifest.contentStandards).toEqual(content)
      expect(item.manifest.performanceStandards).toEqual(performance)
      expect(item.manifest.verification.standardsCoverage).toEqual({ status: 'verified', contentCount: item.contentCount, performanceCount: item.performanceCount, sourcePinned: true })
      expect(item.manifest.standards.every((standard) => standard.verificationStatus === 'verified')).toBe(true)
      expect(item.manifest.standards.every((standard) => standard.sourcePage >= (item.label === 'Grade 2' ? 29 : 34))).toBe(true)
      const expectedDomains = new Set<string>(item.domains)
      expect(item.manifest.standards.every((standard) => expectedDomains.has(standard.domain))).toBe(true)
    })

    it('resolves applicable standards deterministically for every competency', () => {
      for (const competency of item.manifest.competencies) {
        const applicable = item.manifest.standards.filter((standard) => standard.quarter === competency.quarter && standard.domain === competency.domain)
        expect(applicable.some((standard) => standard.type === 'content')).toBe(true)
        expect(applicable.some((standard) => standard.type === 'performance')).toBe(true)
      }
    })
  })
}
