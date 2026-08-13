import { describe, expect, it } from 'vitest'
import grade8 from '../../data/curriculum/official/revised-k10-grade-8-mathematics.json'
import grade9 from '../../data/curriculum/official/revised-k10-grade-9-mathematics.json'
import grade10 from '../../data/curriculum/official/revised-k10-grade-10-mathematics.json'

const cases = [
  { label: 'Grade 8', slug: 'revised-k10-grade-8-mathematics', manifest: grade8, counts: [13, 12, 15, 11], contentCount: 19, performanceCount: 20, firstPage: 56, lastPage: 59 },
  { label: 'Grade 9', slug: 'revised-k10-grade-9-mathematics', manifest: grade9, counts: [11, 13, 16, 11], contentCount: 17, performanceCount: 21, firstPage: 60, lastPage: 64 },
  { label: 'Grade 10', slug: 'revised-k10-grade-10-mathematics', manifest: grade10, counts: [12, 13, 9, 12], contentCount: 16, performanceCount: 17, firstPage: 65, lastPage: 68 },

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

    it('loads source-pinned Content and Performance Standards with provenance', () => {
      const content = item.manifest.standards.filter((standard) => standard.type === 'content')
      const performance = item.manifest.standards.filter((standard) => standard.type === 'performance')
      expect(content).toHaveLength(item.contentCount)
      expect(performance).toHaveLength(item.performanceCount)
      expect(item.manifest.contentStandards).toEqual(content)
      expect(item.manifest.performanceStandards).toEqual(performance)
      expect(item.manifest.verification.standardsCoverage).toEqual({ status: 'verified', contentCount: item.contentCount, performanceCount: item.performanceCount, sourcePinned: true })
      expect(item.manifest.standards.every((standard) => standard.verificationStatus === 'verified')).toBe(true)
      expect(item.manifest.standards.every((standard) => standard.sourcePage >= item.firstPage && standard.sourcePage <= item.lastPage)).toBe(true)
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
