export type AiModelId =
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.6-flash'
  | 'gemini-3.5-flash'

export type LiteAiModelId = 'gemini-3.5-flash-lite' | 'gemini-3.1-flash-lite'

export const DEFAULT_MODEL: AiModelId = 'gemini-3.5-flash-lite'
export const DEFAULT_FALLBACK_MODEL: LiteAiModelId = 'gemini-3.1-flash-lite'

export const ALLOWED_MODELS = new Set<AiModelId>([
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
])

export function isAiModelId(value: unknown): value is AiModelId {
  return typeof value === 'string' && ALLOWED_MODELS.has(value as AiModelId)
}

export function isLiteModel(value: unknown): value is LiteAiModelId {
  return value === 'gemini-3.5-flash-lite' || value === 'gemini-3.1-flash-lite'
}

/**
 * Gemini 3.x models are optimized for their default sampling behavior. Newer
 * releases (notably 3.5 Flash-Lite / 3.6 Flash) reject deprecated sampling
 * fields with HTTP 400, so callers are not allowed to re-introduce them.
 */
export function generationConfigFor(model: AiModelId, overrides: Record<string, unknown> = {}) {
  const {
    temperature: _temperature,
    topP: _topP,
    topK: _topK,
    top_p: _topPSnake,
    top_k: _topKSnake,
    candidateCount: _candidateCount,
    candidate_count: _candidateCountSnake,
    thinkingConfig: requestedThinking,
    ...safeOverrides
  } = overrides

  const base: Record<string, unknown> = {
    maxOutputTokens: 2500,
    ...safeOverrides,
  }

  if (isLiteModel(model)) {
    // GuroDesk deliberately uses high thinking for teacher-selected Lite models.
    // Preserve that product contract even when callers supply other overrides.
    base.thinkingConfig = { thinkingLevel: 'high' }
  } else if (requestedThinking && typeof requestedThinking === 'object') {
    base.thinkingConfig = requestedThinking
  }

  return base
}

export function fallbackAllowed(preferred: AiModelId, fallback: AiModelId, enabled: boolean) {
  return enabled && isLiteModel(preferred) && isLiteModel(fallback) && preferred !== fallback
}
