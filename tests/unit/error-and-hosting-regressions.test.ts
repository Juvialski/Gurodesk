import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from '../../src/pages/assessmentUi'

describe('assessment error extraction regression', () => {
  it('preserves ordinary Error messages', () => {
    expect(extractErrorMessage(new Error('A'), 'fallback')).toBe('A')
  })

  it('surfaces a useful PostgREST relationship error from a plain object', () => {
    const error = {
      code: 'PGRST201',
      message: 'Relationship is ambiguous',
      details: 'Two foreign keys connect documents and assessment_documents.',
      hint: 'Specify the intended relationship.',
    }

    expect(extractErrorMessage(error, 'Unable to load assessments.')).toBe('Relationship is ambiguous')
  })

  it('uses the supplied safe fallback for unknown values', () => {
    expect(extractErrorMessage({ code: 'UNKNOWN' }, 'Unable to load assessments.')).toBe('Unable to load assessments.')
  })
})

describe('Render SPA routing regression', () => {
  it('keeps the catch-all rewrite to index.html', () => {
    const renderConfig = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8')
    expect(renderConfig).toMatch(/source:\s*\/\*/u)
    expect(renderConfig).toMatch(/destination:\s*\/index\.html/u)
  })
})
