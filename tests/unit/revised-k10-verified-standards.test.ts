import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Standard = {
  recordId: string
  type: 'content' | 'performance'
  quarter: number
  domain: string | null
  sortOrder: number
  text: string
  sourcePage: number
  verificationStatus: 'verified'
}

type Manifest = {
  slug: string
  verification: { standardsCoverage?: unknown }
  source: { fileName: string; sha256: string; pageCount: number }
  curriculumVersion: { code: string }
  periods: Array<{ sequence: number }>
  domains: Array<{ code: string }>
  standards?: Standard[]
  contentStandards?: Standard[]
  performanceStandards: Standard[]
  competencies: unknown[]
}

const exactSourceFiles = new Set([
  'FINAL MATATAG Kindergarten CG 2023.pdf',
  'FINAL MATATAG LANGUAGE CG 2023 Grade 1.pdf',
  'FINAL MATATAG Reading and Literacy CG 2023 G1.pdf',
  'FINAL MATATAG Makabansa CG 2023 Grades 1-3.pdf',
  'FINAL MATATAG Mathematics CG 2023 Grades 1-10.pdf',
  'FINAL MATATAG Science CG 2023 Grades 3-10.pdf',
  'FINAL MATATAG English CG 2023 Grades 2-10 (withAppendices).pdf',
  'FINAL MATATAG FILIPINO CG 2023 Grades 2-10.pdf',
  'FINAL MATATAG EPP_TLE CG 2023 Grades 4 - 10.pdf',
  'FINAL MATATAG GMRC and VE CG 2023 Grades 1-10.pdf',
])

const manifestDirectory = resolve('data/curriculum/official')
const sidecarDirectory = resolve('data/curriculum/sources/verified-standards')
const revisedK10 = readdirSync(manifestDirectory)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(resolve(manifestDirectory, name), 'utf8')) as Manifest)
  .filter((manifest) => manifest.curriculumVersion.code === 'REVISED-K10-MATATAG')
  .sort((left, right) => left.slug.localeCompare(right.slug, 'en'))
const sourceComplete = revisedK10.filter((manifest) => exactSourceFiles.has(manifest.source.fileName))

describe('Revised K–10 exact-source standards', () => {
  it('preserves all 4,277 existing competencies byte-for-byte', () => {
    const payload = revisedK10.map(({ slug, competencies }) => ({ slug, competencies }))
    const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex')

    expect(revisedK10).toHaveLength(80)
    expect(revisedK10.reduce((total, manifest) => total + manifest.competencies.length, 0)).toBe(4_277)
    expect(checksum).toBe('1c0da7f13cec75632e65ab855deb697d62e4ddc6755753fea602e88bda99513d')
  })

  it('covers every period in all 59 manifests backed by exact registered bytes', () => {
    const standards = sourceComplete.flatMap((manifest) => manifest.standards ?? [])
    expect(sourceComplete).toHaveLength(59)
    expect(standards.filter((standard) => standard.type === 'content')).toHaveLength(1_108)
    expect(standards.filter((standard) => standard.type === 'performance')).toHaveLength(842)

    for (const manifest of sourceComplete) {
      const canonical = manifest.standards ?? []
      const content = canonical.filter((standard) => standard.type === 'content')
      const performance = canonical.filter((standard) => standard.type === 'performance')
      const domainCodes = new Set(manifest.domains.map((domain) => domain.code))

      expect(manifest.contentStandards).toEqual(content)
      expect(manifest.performanceStandards).toEqual(performance)
      expect(manifest.verification.standardsCoverage).toEqual({
        status: 'verified',
        contentCount: content.length,
        performanceCount: performance.length,
        sourcePinned: true,
      })
      for (const period of manifest.periods) {
        expect(content.some((standard) => standard.quarter === period.sequence)).toBe(true)
        expect(performance.some((standard) => standard.quarter === period.sequence)).toBe(true)
      }
      for (const standard of canonical) {
        expect(standard.verificationStatus).toBe('verified')
        expect(standard.sourcePage).toBeGreaterThanOrEqual(1)
        expect(standard.sourcePage).toBeLessThanOrEqual(manifest.source.pageCount)
        expect(standard.domain === null || domainCodes.has(standard.domain)).toBe(true)
        expect(standard.text).not.toMatch(/\b(?:CONTENT|PERFORMANCE|LEARNING) STANDARDS?\b|KASANAYANG PAMPAGKATUTO/iu)
        expect(standard.text).not.toMatch(/\b(?:page|pahina)\s+\d+\s+(?:of|ng)\s+\d+\b/iu)
        expect(standard.text).not.toMatch(/https?:\/\/|\bREFERENCES?\b|\bGLOSARI\b/iu)
      }
    }
  })

  it('matches every exact-source review sidecar', () => {
    for (const manifest of sourceComplete) {
      const sidecar = JSON.parse(
        readFileSync(resolve(sidecarDirectory, `${manifest.slug}.json`), 'utf8'),
      )
      expect(sidecar.slug).toBe(manifest.slug)
      expect(sidecar.sourceFileName).toBe(manifest.source.fileName)
      expect(sidecar.sourceSha256).toBe(manifest.source.sha256)
      expect(sidecar.standards).toEqual(manifest.standards)
    }
  })

  it('retains grouped Grade 9/10 TLE quarter meaning', () => {
    const tle = sourceComplete.find((manifest) => manifest.slug === 'revised-k10-grade-9-tle')
    if (!tle?.standards) throw new Error('expected Grade 9 TLE standards')
    const website = tle.standards.filter(
      (standard) => standard.sourcePage === 94 && standard.text.includes('current trends, opportunities'),
    )
    expect(website.map((standard) => standard.quarter)).toEqual([1, 3])
  })
})
