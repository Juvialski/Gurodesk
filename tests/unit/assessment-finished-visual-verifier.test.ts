import { describe, expect, it } from 'vitest'
import { normalizeFinishedVisualVerifier } from '../../supabase/functions/_shared/visual-verification'

function verifier(overrides: Partial<ReturnType<typeof normalizeFinishedVisualVerifier>> = {}) {
  return {
    status: 'pass',
    shapeCountCorrect: true,
    labelsCorrect: true,
    valuesCorrect: true,
    relationshipsCorrect: true,
    graphCorrect: true,
    essentialGivenPresent: true,
    answerLeakDetected: false,
    issues: [],
    repairGuidance: [],
    ...overrides,
  }
}

describe('finished TikZ semantic verification contract', () => {
  it.each([
    ['wrong polygon side count', { shapeCountCorrect: false, issues: ['Expected a pentagon but found four sides.'] }],
    ['incorrect angle value', { valuesCorrect: false, issues: ['The marked angle is 45°, not the required 60°.'] }],
    ['missing required label', { labelsCorrect: false, issues: ['Point C is missing.'] }],
    ['incorrect parallel/perpendicular marking', { relationshipsCorrect: false, issues: ['Lines required to be parallel are not marked parallel.'] }],
    ['incorrect graph point', { graphCorrect: false, issues: ['The plotted point is at (2, 4), not (2, 3).'] }],
    ['missing diagram-only given', { essentialGivenPresent: false, issues: ['The side length supplied only by the diagram is absent.'] }],
    ['diagram duplicates the final answer', { answerLeakDetected: true, issues: ['The diagram labels the final answer.'] }],
  ])('forces repair for %s', (_name, defect) => {
    const result = normalizeFinishedVisualVerifier(verifier(defect as never))
    expect(result.status).toBe('needs_repair')
  })

  it('passes a correct finished diagram fixture', () => {
    expect(normalizeFinishedVisualVerifier(verifier())).toMatchObject({ status: 'pass', answerLeakDetected: false })
  })

  it('rejects malformed or extra verifier fields', () => {
    expect(() => normalizeFinishedVisualVerifier({ ...verifier(), unexpected: true })).toThrow(/structured contract/i)
    expect(() => normalizeFinishedVisualVerifier({ ...verifier(), labelsCorrect: 'yes' })).toThrow(/structured contract/i)
  })
})
