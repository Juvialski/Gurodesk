import type { AiModelId, LiteAiModelId } from '../types/ai'

export type AiModelOption = {
  id: AiModelId
  label: string
  family: 'lite' | 'flash'
  recommended: boolean
  thinkingLabel: string
  freeTierDailyGuide: number
  description: string
}

export const AI_STUDIO_API_KEY_URL = 'https://aistudio.google.com/app/apikey'

// Quota numbers are UI guidance requested for GuroDesk's current free-tier workflow.
// The app never enforces these values: Google/API 429 responses remain authoritative.
export const AI_MODELS: AiModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    family: 'lite',
    recommended: true,
    thinkingLabel: 'High thinking',
    freeTierDailyGuide: 500,
    description: 'Primary GuroDesk model. High-thinking configuration with the larger daily-call guide.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    family: 'lite',
    recommended: true,
    thinkingLabel: 'High thinking',
    freeTierDailyGuide: 500,
    description: 'Recommended Lite fallback. High-thinking configuration.',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    family: 'flash',
    recommended: false,
    thinkingLabel: 'Model default',
    freeTierDailyGuide: 20,
    description: 'Optional advanced model. GuroDesk will not auto-fallback into this limited-call model.',
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    family: 'flash',
    recommended: false,
    thinkingLabel: 'Model default',
    freeTierDailyGuide: 20,
    description: 'Optional advanced model. GuroDesk will not auto-fallback into this limited-call model.',
  },
]

export const DEFAULT_AI_MODEL: AiModelId = 'gemini-3.5-flash-lite'
export const DEFAULT_FALLBACK_MODEL: LiteAiModelId = 'gemini-3.1-flash-lite'

export const LITE_AI_MODELS = AI_MODELS.filter((model) => model.family === 'lite') as Array<
  AiModelOption & { id: LiteAiModelId }
>

export function getAiModel(id: AiModelId) {
  return AI_MODELS.find((model) => model.id === id) ?? AI_MODELS[0]
}

export function isLiteAiModel(id: AiModelId): id is LiteAiModelId {
  return id === 'gemini-3.5-flash-lite' || id === 'gemini-3.1-flash-lite'
}
