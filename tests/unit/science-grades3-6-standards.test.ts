import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const expected = {
  "3": {
    "competencies": 34,
    "content": 14,
    "performance": 4
  },
  "4": {
    "competencies": 33,
    "content": 17,
    "performance": 4
  },
  "5": {
    "competencies": 40,
    "content": 21,
    "performance": 4
  },
  "6": {
    "competencies": 37,
    "content": 18,
    "performance": 4
  }
} as const

for (const [grade, counts] of Object.entries(expected)) {
  describe(`Science Grade ${grade} verified standards`, () => {
    const manifest = JSON.parse(readFileSync(resolve(`data/curriculum/official/revised-k10-grade-${grade}-science.json`), 'utf8'))
    it('retains competencies and exposes verified standards with provenance', () => {
      expect(manifest.competencies).toHaveLength(counts.competencies)
      expect(manifest.contentStandards).toHaveLength(counts.content)
      expect(manifest.performanceStandards).toHaveLength(counts.performance)
      expect(manifest.standards).toHaveLength(counts.content + counts.performance)
      for (const standard of manifest.standards) {
        expect(['content', 'performance']).toContain(standard.type)
        expect(standard.verificationStatus).toBe('verified')
        expect(Number.isInteger(standard.sourcePage)).toBe(true)
        expect(manifest.periods.some((period: any) => period.sequence === standard.quarter)).toBe(true)
        expect(manifest.domains.some((domain: any) => domain.code === standard.domain)).toBe(true)
      }
    })
  })
}
