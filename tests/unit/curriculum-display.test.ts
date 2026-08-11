import { describe, expect, it } from 'vitest'
import { normalizeDomainHeading } from '../../src/lib/curriculumDisplay'

describe('normalizeDomainHeading', () => {
  it('cleans extraction bullets for display while preserving raw text', () => {
    const raw = 'o coffee o cold cuts · instant foods'
    const result = normalizeDomainHeading(raw)

    expect(result.raw).toBe(raw)
    expect(result.display).toBe('coffee cold cuts instant foods')
  })

  it('does not rewrite ordinary headings', () => {
    const raw = 'Numbers and Number Sense'
    expect(normalizeDomainHeading(raw)).toEqual({ raw, display: raw })
  })
})
