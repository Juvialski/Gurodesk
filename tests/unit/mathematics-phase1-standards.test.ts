import { describe, expect, it } from 'vitest'
import grade1 from '../../data/curriculum/official/revised-k10-grade-1-mathematics.json'
import grade4 from '../../data/curriculum/official/revised-k10-grade-4-mathematics.json'

const cases = [
  {
    label: 'Grade 1',
    manifest: grade1,
    counts: [13, 10, 12, 12],
    contentCount: 15,
    performanceCount: 15,
    pages: [25, 26, 27, 28],
  },
  {
    label: 'Grade 4',
    manifest: grade4,
    counts: [13, 10, 14, 13],
    contentCount: 17,
    performanceCount: 19,
    pages: [39, 40, 41, 42, 43],
  },
] as const

for (const item of cases) {
  describe(`${item.label} Mathematics verified standards`, () => {
    it('preserves all existing competency identities and quarter sequence', () => {
      const expectedIds = item.counts.flatMap((count, quarterIndex) =>
        Array.from({ length: count }, (_, itemIndex) =>
          `revised-k10-grade-${item.label === 'Grade 1' ? 1 : 4}-mathematics:period-${quarterIndex + 1}:item-${itemIndex + 1}`,
        ),
      )
      expect(item.manifest.competencies.map((competency) => competency.recordId)).toEqual(expectedIds)
      expect(item.manifest.competencies.every((competency) => competency.competencyCode === null)).toBe(true)
    })

    it('loads source-pinned Content and Performance Standards with deterministic scope', () => {
      const content = item.manifest.standards.filter((standard) => standard.type === 'content')
      const performance = item.manifest.standards.filter((standard) => standard.type === 'performance')
      expect(content).toHaveLength(item.contentCount)
      expect(performance).toHaveLength(item.performanceCount)
      expect(item.manifest.contentStandards).toEqual(content)
      expect(item.manifest.performanceStandards).toEqual(performance)
      expect(item.manifest.verification.standardsCoverage).toEqual({
        status: 'verified',
        contentCount: item.contentCount,
        performanceCount: item.performanceCount,
        sourcePinned: true,
      })
      expect(item.manifest.standards.every((standard) => standard.verificationStatus === 'verified')).toBe(true)
      const expectedPages = new Set<number>(item.pages)
      expect(item.manifest.standards.every((standard) => expectedPages.has(standard.sourcePage))).toBe(true)
      expect(item.manifest.standards.every((standard) => ['D01', 'D02', 'D03'].includes(standard.domain))).toBe(true)
    })

    it('allows deterministic competency-to-standard resolution by quarter and domain', () => {
      for (const competency of item.manifest.competencies) {
        const applicable = item.manifest.standards.filter((standard) =>
          standard.quarter === competency.quarter && standard.domain === competency.domain,
        )
        expect(applicable.some((standard) => standard.type === 'content')).toBe(true)
        expect(applicable.some((standard) => standard.type === 'performance')).toBe(true)
      }
    })
  })
}
