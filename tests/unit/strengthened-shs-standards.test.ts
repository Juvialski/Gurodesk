import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Standard = {
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
  verification: { standardsCoverage: unknown }
  source: { fileName: string; sha256: string; pageCount: number }
  curriculumVersion: { code: string }
  periods: Array<{ sequence: number }>
  domains: Array<{ code: string }>
  standards: Standard[]
  contentStandards: Standard[]
  performanceStandards: Standard[]
  competencies: unknown[]
}

const manifestDirectory = resolve('data/curriculum/official')
const sidecarDirectory = resolve('data/curriculum/sources/verified-standards')
const manifests = readdirSync(manifestDirectory)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(resolve(manifestDirectory, name), 'utf8')) as Manifest)
  .filter((manifest) => manifest.curriculumVersion.code === 'STRENGTHENED-SHS-2026')
  .sort((left, right) => left.slug.localeCompare(right.slug, 'en'))

describe('Strengthened SHS verified standards', () => {
  it('preserves every existing competency byte-for-byte', () => {
    const competencyPayload = manifests.map(({ slug, competencies }) => ({ slug, competencies }))
    const checksum = createHash('sha256').update(JSON.stringify(competencyPayload)).digest('hex')

    expect(manifests).toHaveLength(116)
    expect(manifests.reduce((total, manifest) => total + manifest.competencies.length, 0)).toBe(1_904)
    expect(checksum).toBe('aa6e803aace6179918cad6ec3b3d7d83880a7367e2bd06ab58b9fecb3ebb7f05')
  })

  it('loads exact-source content and performance standards for every official period', () => {
    const standards = manifests.flatMap((manifest) => manifest.standards)
    expect(standards.filter((standard) => standard.type === 'content')).toHaveLength(527)
    expect(standards.filter((standard) => standard.type === 'performance')).toHaveLength(361)

    for (const manifest of manifests) {
      const content = manifest.standards.filter((standard) => standard.type === 'content')
      const performance = manifest.standards.filter((standard) => standard.type === 'performance')
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
      for (const standard of manifest.standards) {
        expect(standard.verificationStatus).toBe('verified')
        expect(standard.sourcePage).toBeGreaterThanOrEqual(1)
        expect(standard.sourcePage).toBeLessThanOrEqual(manifest.source.pageCount)
        expect(standard.domain === null || domainCodes.has(standard.domain)).toBe(true)
      }
    }
  })

  it('matches source-hash-pinned review sidecars', () => {
    for (const manifest of manifests) {
      const sidecar = JSON.parse(
        readFileSync(resolve(sidecarDirectory, `${manifest.slug}.json`), 'utf8'),
      )
      expect(sidecar.slug).toBe(manifest.slug)
      expect(sidecar.sourceFileName).toBe(manifest.source.fileName)
      expect(sidecar.sourceSha256).toBe(manifest.source.sha256)
      expect(sidecar.verificationStatus).toBe('verified')
      expect(sidecar.standards).toEqual(manifest.standards)
    }
  })

  it('retains known cross-page source text without truncation or row merging', () => {
    const swine = manifests.find((manifest) => manifest.slug === 'sshs-grade-11-swine-production')
    const earth = manifests.find((manifest) => manifest.slug === 'sshs-grade-11-earth-and-space-science-2')
    if (!swine || !earth) throw new Error('expected SHS regression manifests')

    expect(swine.standards.some((standard) => standard.text.endsWith('stages of swine production.'))).toBe(true)
    expect(earth.standards.some((standard) => standard.text === 'geologic phenomena due to plate tectonics cause sudden movement of rock materials below the Earth’s surface;')).toBe(true)
    expect(earth.standards.every((standard) => !/surface;\s*4\.\s*geologic/iu.test(standard.text))).toBe(true)
  })
})
