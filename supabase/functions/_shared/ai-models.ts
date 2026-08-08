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

export function generationConfigFor(model: AiModelId, overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: 2500,
    ...overrides,
  }
  if (isLiteModel(model)) {
    base.thinkingConfig = { thinkingLevel: 'high' }
  }
  return base
}

export function fallbackAllowed(preferred: AiModelId, fallback: AiModelId, enabled: boolean) {
  return enabled && isLiteModel(preferred) && isLiteModel(fallback) && preferred !== fallback
}
