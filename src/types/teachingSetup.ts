export type TeacherLessonPreferences = {
  userId: string
  defaultDurationMinutes: number
  languagePreference: string
  typicalClassProfile: string
  availableTechnology: string[]
  preferredApproaches: string[]
  actualResources: string[]
  resourceNotes: string
  createdAt: string | null
  updatedAt: string | null
}

export const TECHNOLOGY_OPTIONS = [
  'Projector / TV',
  'Reliable internet',
  'Teacher laptop / tablet',
  'Student devices',
  'Printer / photocopier',
] as const

export const APPROACH_OPTIONS = [
  'Direct instruction',
  'Guided practice',
  'Problem-based learning',
  'Collaborative learning',
  'Inquiry / discovery',
  'Independent practice',
] as const

export function createDefaultTeacherLessonPreferences(userId: string): TeacherLessonPreferences {
  return {
    userId,
    defaultDurationMinutes: 60,
    languagePreference: 'English',
    typicalClassProfile: '',
    availableTechnology: [],
    preferredApproaches: [],
    actualResources: [],
    resourceNotes: '',
    createdAt: null,
    updatedAt: null,
  }
}
