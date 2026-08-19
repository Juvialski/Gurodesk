import { supabase } from '../supabase'
import type { OmrImageBuffer } from '../../types/omr'

export type CropRectangle = {
  x: number
  y: number
  width: number
  height: number
}

export type HandwritingTranscriptionResult = {
  transcript: string
  success: boolean
  error?: string
}

/**
 * Crops a subjective question writing area from a rectified grayscale image buffer.
 * Returns a base64 JPEG string.
 */
export function cropWritingArea(
  image: OmrImageBuffer,
  box: CropRectangle,
): string {
  const clampX = Math.max(0, Math.min(image.width - 1, Math.round(box.x)))
  const clampY = Math.max(0, Math.min(image.height - 1, Math.round(box.y)))
  const clampW = Math.max(1, Math.min(image.width - clampX, Math.round(box.width)))
  const clampH = Math.max(1, Math.min(image.height - clampY, Math.round(box.height)))

  if (typeof document === 'undefined') {
    // Node environment fallback for testing
    return 'data:image/jpeg;base64,/9j/mock-crop-data'
  }

  const canvas = document.createElement('canvas')
  canvas.width = clampW
  canvas.height = clampH

  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const imgData = ctx.createImageData(clampW, clampH)
  const data = imgData.data

  for (let row = 0; row < clampH; row++) {
    const srcRowOffset = (clampY + row) * image.width + clampX
    const dstRowOffset = row * clampW

    for (let col = 0; col < clampW; col++) {
      const gray = image.data[srcRowOffset + col]
      const dstIdx = (dstRowOffset + col) * 4
      data[dstIdx] = gray
      data[dstIdx + 1] = gray
      data[dstIdx + 2] = gray
      data[dstIdx + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.85)
}

/**
 * Calls the optional Gemini BYOK handwriting OCR service.
 * Purely assistive: failure never stops pure OMR bubble scoring.
 */
export async function transcribeHandwrittenResponse(
  cropBase64: string,
  promptHint?: string,
  questionType?: string,
): Promise<HandwritingTranscriptionResult> {
  if (!cropBase64) {
    return { transcript: '', success: false, error: 'No image provided.' }
  }

  if (!supabase) {
    return {
      transcript: '',
      success: false,
      error: 'Supabase client unavailable. Handwriting transcription is offline.',
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('handwriting-transcriber', {
      body: {
        imageBase64: cropBase64,
        promptHint,
        questionType,
      },
    })

    if (error) {
      return {
        transcript: '',
        success: false,
        error: error.message || 'Transcription service error.',
      }
    }

    if (data && typeof data.transcript === 'string') {
      return {
        transcript: data.transcript,
        success: true,
      }
    }

    return {
      transcript: '',
      success: false,
      error: data?.message || 'Unable to transcribe handwritten text.',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription request failed.'
    return {
      transcript: '',
      success: false,
      error: message,
    }
  }
}
