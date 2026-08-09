import type {
  RemediationAiRequest,
  RemediationAiSuggestions,
  RemediationAiTeacherConstraints,
} from '../types/remediationAi'
import { supabase } from './supabase'

function boundedText(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function boundedList(value: unknown, limit = 10, itemLimit = 200) {
  if (!Array.isArray(value)) return []
  return value.map((item) => boundedText(item, itemLimit)).filter(Boolean).slice(0, limit)
}

function boundedOptionalNumber(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(minimum, Math.min(maximum, numberValue)) : null
}

/**
 * Build a fresh allow-listed request.  Callers pass only aggregate target
 * identifiers and teacher constraints; this function intentionally does not
 * accept or spread an AssessmentResultSession, ItemAnalysisResult, or signal.
 */
export function buildRemediationAiRequest(input: RemediationAiRequest): RemediationAiRequest {
  const source = input.teacherConstraints ?? {}
  const teacherConstraints: RemediationAiTeacherConstraints = {
    languagePreference: boundedText(source.languagePreference, 80) || undefined,
    localLanguageName: boundedText(source.localLanguageName, 80) || undefined,
    preferredApproaches: boundedList(source.preferredApproaches),
    actualResources: boundedList(source.actualResources),
    resourceNotes: boundedText(source.resourceNotes, 1000) || undefined,
    durationMinutes: boundedOptionalNumber(source.durationMinutes, 1, 600),
    numberOfSessions: boundedOptionalNumber(source.numberOfSessions, 1, 30),
  }
  return {
    resultSessionId: boundedText(input.resultSessionId, 80),
    competencyId: boundedText(input.competencyId, 120),
    teacherConstraints,
  }
}

function cleanSuggestion(value: unknown) {
  return boundedText(value, 2400)
}

function parseSuggestions(value: unknown): RemediationAiSuggestions {
  const body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const suggestions: RemediationAiSuggestions = {
    reteachingApproach: cleanSuggestion(body.reteachingApproach),
    practiceActivity: cleanSuggestion(body.practiceActivity),
    formativeRecheck: cleanSuggestion(body.formativeRecheck),
    enrichmentAlternative: cleanSuggestion(body.enrichmentAlternative),
  }
  if (Object.values(suggestions).some((item) => item.length < 4)) {
    throw new Error('The optional remediation assistant returned incomplete suggestions.')
  }
  return suggestions
}

export async function requestRemediationSuggestions(input: RemediationAiRequest): Promise<RemediationAiSuggestions> {
  if (!supabase) throw new Error('Optional remediation suggestions require Supabase mode.')
  const request = buildRemediationAiRequest(input)
  const { data, error } = await supabase.functions.invoke('remediation-suggester', { body: request })
  if (error) throw error
  return parseSuggestions(data)
}
