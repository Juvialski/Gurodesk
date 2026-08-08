import type { AiModelId } from './ai-models.ts'
import { generationConfigFor } from './ai-models.ts'

export class GeminiHttpError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(`Gemini request failed with status ${status}.`)
    this.status = status
    this.detail = detail
  }
}

export async function callGemini(
  apiKey: string,
  model: AiModelId,
  prompt: string,
  configOverrides: Record<string, unknown> = {},
) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: generationConfigFor(model, configOverrides),
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new GeminiHttpError(response.status, detail.slice(0, 1200))
  }

  const result = await response.json()
  const output = result?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim()

  if (!output) throw new GeminiHttpError(502, 'Gemini returned an empty response.')
  return output
}

export function isFallbackEligibleStatus(status: number) {
  return status === 404 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}
