/**
 * The only context allowed to cross the optional remediation-assistant
 * boundary.  It is deliberately aggregate-only: no session object, learner
 * identity, participant ID, answer, score history, or feedback is representable.
 */
export type RemediationAiTeacherConstraints = {
  languagePreference?: string
  localLanguageName?: string
  preferredApproaches?: string[]
  actualResources?: string[]
  resourceNotes?: string
  durationMinutes?: number | null
  numberOfSessions?: number | null
}

export type RemediationAiRequest = {
  /** Used only for server-side ownership recheck; never copied into a prompt. */
  resultSessionId: string
  /** Verified competency identifier used only to select an immutable snapshot. */
  competencyId: string
  teacherConstraints?: RemediationAiTeacherConstraints
}

export type RemediationAiSuggestions = {
  reteachingApproach: string
  practiceActivity: string
  formativeRecheck: string
  enrichmentAlternative: string
}
