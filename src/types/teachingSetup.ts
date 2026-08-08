export type TeacherLessonPreferences = {
  userId: string
  defaultDurationMinutes: number
  languagePreference: string
  localLanguageName: string
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

export const LESSON_LANGUAGE_OPTIONS = [
  { value: 'Auto', label: 'Auto — match subject / lesson text' },
  { value: 'English', label: 'English' },
  { value: 'Filipino', label: 'Filipino' },
  { value: 'English + Filipino', label: 'English + Filipino' },
  { value: 'Mother tongue / local language', label: 'Mother tongue / local language' },
] as const

export function createDefaultTeacherLessonPreferences(userId: string): TeacherLessonPreferences {
  return {
    userId,
    defaultDurationMinutes: 60,
    languagePreference: 'Auto',
    localLanguageName: '',
    typicalClassProfile: '',
    availableTechnology: [],
    preferredApproaches: [],
    actualResources: [],
    resourceNotes: '',
    createdAt: null,
    updatedAt: null,
  }
}
