import { describe, expect, it } from 'vitest'
import {
  computeQrChecksum,
  decodeAnswerSheetQrPayload,
  encodeAnswerSheetQrPayload,
  validateQrMatchesAssessment,
} from '../../src/lib/answerSheet/qrPayload'
import { generateQrMatrix, generateQrSvgPath } from '../../src/lib/answerSheet/qrEncoder'

describe('Answer Sheet QR Payload & Encoder', () => {
  it('encodes and decodes a valid generic answer sheet QR payload', () => {
    const raw = encodeAnswerSheetQrPayload({
      assessmentId: 'asm-test-uuid-001',
      assessmentVersion: 2,
      layoutVersion: 'v1',
      mode: 'generic',
    })

    expect(raw).toContain('GD:AS:v1')
    expect(raw).toContain('a:asm-test-uuid-001')
    expect(raw).toContain('v:2')
    expect(raw).toContain('m:G')
    expect(raw).toContain('|c:')

    const decoded = decodeAnswerSheetQrPayload(raw)
    expect(decoded.success).toBe(true)
    expect(decoded.payload).toEqual({
      format: 'GD:AS:v1',
      assessmentId: 'asm-test-uuid-001',
      assessmentVersion: 2,
      layoutVersion: 'v1',
      mode: 'generic',
      learnerId: undefined,
      checksum: expect.any(String),
    })
  })

  it('encodes and decodes a personalized roster answer sheet QR payload with opaque learnerId', () => {
    const raw = encodeAnswerSheetQrPayload({
      assessmentId: 'asm-test-uuid-001',
      assessmentVersion: 1,
      layoutVersion: 'v1',
      mode: 'personalized',
      learnerId: 'lrn-opaque-999',
    })

    expect(raw).toContain('m:P')
    expect(raw).toContain('s:lrn-opaque-999')

    const decoded = decodeAnswerSheetQrPayload(raw)
    expect(decoded.success).toBe(true)
    expect(decoded.payload?.mode).toBe('personalized')
    expect(decoded.payload?.learnerId).toBe('lrn-opaque-999')
  })

  it('rejects tampered or corrupt QR payloads with checksum mismatch', () => {
    const raw = encodeAnswerSheetQrPayload({
      assessmentId: 'asm-test-uuid-001',
      assessmentVersion: 1,
      mode: 'generic',
    })

    // Alter one character in assessment ID
    const tampered = raw.replace('asm-test', 'asm-hack')
    const result = decodeAnswerSheetQrPayload(tampered)
    expect(result.success).toBe(false)
    expect(result.error).toContain('checksum mismatch')
  })

  it('rejects invalid or non-GuroDesk QR codes', () => {
    expect(decodeAnswerSheetQrPayload('https://google.com').success).toBe(false)
    expect(decodeAnswerSheetQrPayload('').success).toBe(false)
    expect(decodeAnswerSheetQrPayload('GD:AS:v999|invalid').success).toBe(false)
  })

  it('accurately validates QR against active assessment and catches version mismatches', () => {
    const payload = decodeAnswerSheetQrPayload(
      encodeAnswerSheetQrPayload({
        assessmentId: 'asm-uuid-1',
        assessmentVersion: 2,
        mode: 'generic',
      }),
    ).payload!

    // Exact match
    const valid = validateQrMatchesAssessment(payload, 'asm-uuid-1', 2)
    expect(valid.valid).toBe(true)

    // Wrong assessment ID
    const wrongAsm = validateQrMatchesAssessment(payload, 'asm-uuid-2', 2)
    expect(wrongAsm.valid).toBe(false)
    expect(wrongAsm.reason).toContain('Wrong Assessment')

    // Version mismatch: printed for V2, active is V3
    const wrongVer = validateQrMatchesAssessment(payload, 'asm-uuid-1', 3)
    expect(wrongVer.valid).toBe(false)
    expect(wrongVer.reason).toContain('Assessment Version Mismatch')
  })

  it('generates a valid deterministic QR matrix and SVG path without external dependencies', () => {
    const text = 'GD:AS:v1|a:asm-123|v:1|l:v1|m:G|c:1234'
    const matrix = generateQrMatrix(text)
    expect(matrix.size).toBeGreaterThanOrEqual(21)
    expect(matrix.modules.length).toBe(matrix.size)
    expect(matrix.modules[0].length).toBe(matrix.size)

    // Top-left finder pattern check
    expect(matrix.modules[0][0]).toBe(true)
    expect(matrix.modules[0][6]).toBe(true)
    expect(matrix.modules[6][0]).toBe(true)

    const svg = generateQrSvgPath(text, 24)
    expect(svg.svgPath).toContain('M')
    expect(svg.matrixSize).toBe(matrix.size)
    expect(svg.moduleSizeMm).toBeCloseTo(24 / matrix.size, 3)
  })
})
