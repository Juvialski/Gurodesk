import type { AiModelId } from './ai-models.ts'
import { generationConfigFor } from './ai-models.ts'

export type GeminiFailureCategory =
  | 'HTTP_ERROR'
  | 'STOP'
  | 'MAX_TOKENS'
  | 'BLOCKED_SAFETY'
  | 'EMPTY_OR_MISSING_TEXT'
  | 'MALFORMED_JSON'
  | 'MALFORMED_PROVIDER_RESPONSE'
  | 'UNKNOWN_FINISH_REASON'

export type GeminiFinishReason =
  | 'STOP'
  | 'MAX_TOKENS'
  | 'SAFETY'
  | 'RECITATION'
  | 'LANGUAGE'
  | 'OTHER'
  | 'BLOCKLIST'
  | 'PROHIBITED_CONTENT'
  | 'SPII'
  | 'MALFORMED_FUNCTION_CALL'
  | 'MALFORMED_RESPONSE'
  | 'IMAGE_SAFETY'
  | 'UNKNOWN'

export class GeminiHttpError extends Error {
  readonly status: number
  /** Bounded provider detail for server logs/tests; never sent to teachers. */
  readonly detail: string
  readonly category: GeminiFailureCategory = 'HTTP_ERROR'
  providerRequestCount?: number

  constructor(status: number, detail: string) {
    super(`Gemini request failed with status ${status}.`)
    this.name = 'GeminiHttpError'
    this.status = status
    this.detail = sanitizeProviderDetail(detail)
  }
}

export class GeminiResponseError extends Error {
  readonly category: Exclude<GeminiFailureCategory, 'HTTP_ERROR' | 'STOP'>
  readonly finishReason?: string
  providerRequestCount?: number

  constructor(category: Exclude<GeminiFailureCategory, 'HTTP_ERROR' | 'STOP'>, message: string, finishReason?: string) {
    super(message)
    this.name = 'GeminiResponseError'
    this.category = category
    this.finishReason = finishReason
  }
}

function sanitizeProviderDetail(detail: unknown) {
  return String(detail ?? '')
    .replace(/([?&]key=)[^&\s]+/giu, '$1[redacted]')
    .replace(/("?(?:api[_-]?key|authorization|access[_-]?token)"?\s*[:=]\s*")([^"\s]+)(")/giu, '$1[redacted]$3')
    .slice(0, 1200)
}

function normalizedFinishReason(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined
}

function safetyReason(reason: string) {
  return new Set([
    'SAFETY',
    'RECITATION',
    'BLOCKLIST',
    'PROHIBITED_CONTENT',
    'SPII',
    'IMAGE_SAFETY',
  ]).has(reason)
}

export type GeminiTextResult = {
  text: string
  /** STOP is the only successful finish reason; absent reason is tolerated for test doubles. */
  finishReason: GeminiFinishReason | 'UNSPECIFIED'
}

/**
 * Inspect a raw generateContent result before any JSON parsing.  In
 * particular, MAX_TOKENS and safety blocks must not be mistaken for malformed
 * candidate JSON, and an empty content array must not become an empty draft.
 */
export function extractGeminiText(result: unknown): GeminiTextResult {
  const root = result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : null
  const candidates = root?.candidates
  if (!Array.isArray(candidates) || !candidates.length) {
    const promptFeedback = root?.promptFeedback
    const blockReason = promptFeedback && typeof promptFeedback === 'object' && !Array.isArray(promptFeedback)
      ? normalizedFinishReason((promptFeedback as Record<string, unknown>).blockReason)
      : undefined
    if (blockReason) throw new GeminiResponseError('BLOCKED_SAFETY', 'Gemini blocked the request for safety reasons.', blockReason)
    throw new GeminiResponseError('EMPTY_OR_MISSING_TEXT', 'Gemini returned no assessment text.')
  }

  const candidate = candidates[0] && typeof candidates[0] === 'object' && !Array.isArray(candidates[0])
    ? candidates[0] as Record<string, unknown>
    : null
  if (!candidate) throw new GeminiResponseError('EMPTY_OR_MISSING_TEXT', 'Gemini returned no assessment text.')

  const reason = normalizedFinishReason(candidate.finishReason)
  if (!reason) throw new GeminiResponseError('UNKNOWN_FINISH_REASON', 'Gemini returned a response without a finish reason.')
  if (reason === 'MAX_TOKENS') throw new GeminiResponseError('MAX_TOKENS', 'Gemini stopped before completing the assessment response.', reason)
  if (reason && safetyReason(reason)) throw new GeminiResponseError('BLOCKED_SAFETY', 'Gemini blocked the assessment response for safety reasons.', reason)
  if (reason && reason !== 'STOP') throw new GeminiResponseError('UNKNOWN_FINISH_REASON', 'Gemini stopped without a usable assessment response.', reason)

  const content = candidate.content
  const parts = content && typeof content === 'object' && !Array.isArray(content)
    ? (content as Record<string, unknown>).parts
    : undefined
  if (!Array.isArray(parts)) throw new GeminiResponseError('EMPTY_OR_MISSING_TEXT', 'Gemini returned no assessment text.')
  const text = parts
    .map((part) => {
      if (!part || typeof part !== 'object' || Array.isArray(part)) return ''
      const value = part as Record<string, unknown>
      // Gemini thinking responses can contain text parts marked `thought:true`.
      // Those summaries are not part of the final structured answer and must
      // never be concatenated with JSON before parsing.
      if (value.thought === true) return ''
      return typeof value.text === 'string' ? value.text : ''
    })
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('')
    .trim()
  if (!text) throw new GeminiResponseError('EMPTY_OR_MISSING_TEXT', 'Gemini returned empty assessment text.')

  return { text, finishReason: 'STOP' }
}

function stripCodeFence(value: string) {
  return value.trim().replace(/^```json\s*/iu, '').replace(/^```\s*/u, '').replace(/\s*```$/u, '').trim()
}

/** Parse only after extractGeminiText has accepted a successful finish. */
export function parseGeminiJson(value: string): Record<string, unknown> {
  let parsed: unknown
  try { parsed = JSON.parse(stripCodeFence(value)) } catch {
    throw new GeminiResponseError('MALFORMED_JSON', 'Gemini returned malformed structured assessment JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new GeminiResponseError('MALFORMED_JSON', 'Gemini returned a non-object structured assessment response.')
  }
  return parsed as Record<string, unknown>
}

export async function callGeminiDetailed(
  apiKey: string,
  model: AiModelId,
  prompt: string,
  configOverrides: Record<string, unknown> = {},
): Promise<GeminiTextResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: generationConfigFor(model, configOverrides),
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new GeminiHttpError(response.status, detail)
  }

  let result: unknown
  try { result = await response.json() } catch {
    throw new GeminiResponseError('MALFORMED_PROVIDER_RESPONSE', 'Gemini returned an unreadable response.')
  }
  return extractGeminiText(result)
}

/** Stable string-returning boundary retained for existing non-assessment callers. */
export async function callGemini(
  apiKey: string,
  model: AiModelId,
  prompt: string,
  configOverrides: Record<string, unknown> = {},
) {
  const result = await callGeminiDetailed(apiKey, model, prompt, configOverrides)
  return result.text
}

export function isFallbackEligibleStatus(status: number) {
  // 429 is a quota/rate boundary. Retrying it through another model silently
  // doubles provider traffic and is handled by the caller's explicit retry
  // policy instead.
  return status === 404 || status === 500 || status === 502 || status === 503 || status === 504
}
