export type AiModelId =
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.6-flash'
  | 'gemini-3.5-flash'

export type LiteAiModelId = 'gemini-3.5-flash-lite' | 'gemini-3.1-flash-lite'

export type AiCredentialStatus = {
  sponsored?: { day: string; limit: number; remaining: number; resetsAt: string; available: boolean }
  configured: boolean
  keyLast4: string | null
  verifiedAt: string | null
  preferredModel: AiModelId
  fallbackModel: LiteAiModelId
  fallbackEnabled: boolean
}

export type AiCredentialSaveResult = AiCredentialStatus & {
  testedModel: AiModelId
  message: string
}

export type AiSettingsUpdate = {
  preferredModel: AiModelId
  fallbackModel: LiteAiModelId
  fallbackEnabled: boolean
}
