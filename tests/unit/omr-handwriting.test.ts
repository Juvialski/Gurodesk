import { describe, expect, it, vi } from 'vitest'
import { cropWritingArea, transcribeHandwrittenResponse } from '../../src/lib/omr/handwritingTranscription'
import type { OmrImageBuffer } from '../../src/types/omr'

// Mock supabase client
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockImplementation((name, options) => {
        if (options?.body?.imageBase64 === 'error-test') {
          return Promise.resolve({
            data: null,
            error: { message: 'No Gemini API key configured in Settings.' },
          })
        }
        return Promise.resolve({
          data: { transcript: 'Photosynthesis is how green plants make food using sunlight.', success: true },
          error: null,
        })
      }),
    },
  },
}))

describe('Optional Handwriting OCR Transcription (Gemini BYOK)', () => {
  it('crops writing box region safely with boundary clamping', () => {
    const buffer: OmrImageBuffer = {
      width: 100,
      height: 100,
      data: new Uint8Array(100 * 100).fill(255),
    }

    // Normal box
    const crop = cropWritingArea(buffer, { x: 10, y: 10, width: 40, height: 30 })
    expect(typeof crop).toBe('string')
    expect(crop.length).toBeGreaterThan(0)

    // Out-of-bounds box should clamp safely without throwing
    const clampedCrop = cropWritingArea(buffer, { x: 90, y: 90, width: 50, height: 50 })
    expect(typeof clampedCrop).toBe('string')
    expect(clampedCrop.length).toBeGreaterThan(0)
  })

  it('transcribes handwritten text successfully via Gemini BYOK endpoint', async () => {
    const result = await transcribeHandwrittenResponse(
      'data:image/jpeg;base64,validCropData',
      'Explain photosynthesis',
      'short_answer',
    )

    expect(result.success).toBe(true)
    expect(result.transcript).toBe('Photosynthesis is how green plants make food using sunlight.')
  })

  it('handles absent BYOK API key or service error gracefully without crashing OMR', async () => {
    const result = await transcribeHandwrittenResponse(
      'error-test',
      'Explain photosynthesis',
      'short_answer',
    )

    expect(result.success).toBe(false)
    expect(result.transcript).toBe('')
    expect(result.error).toContain('No Gemini API key configured')
  })
})
