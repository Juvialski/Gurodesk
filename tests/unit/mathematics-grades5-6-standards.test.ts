import { describe, expect, it } from 'vitest'
import grade5 from '../../data/curriculum/official/revised-k10-grade-5-mathematics.json'
import grade6 from '../../data/curriculum/official/revised-k10-grade-6-mathematics.json'

const cases = [
  { label: 'Grade 5', slug: 'revised-k10-grade-5-mathematics', manifest: grade5, counts: [12, 12, 13, 12], contentCount: 17, performanceCount: 19, firstPage: 44 },
  { label: 'Grade 6', slug: 'revised-k10-grade-6-mathematics', manifest: grade6, counts: [14, 12, 13, 13], contentCount: 15, performanceCount: 15, firstPage: 48 },
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
      expect(item.manifest.standards.every((standard) => standard.sourcePage >= item.firstPage && standard.sourcePage <= item.firstPage + 3)).toBe(true)
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
