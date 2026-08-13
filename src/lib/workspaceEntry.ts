import type { Profile } from '../types/app'

export type SignedInEntryState = 'workspace' | 'onboarding' | 'workspace-error'

export function signedInEntryState(profile: Profile | null, workspaceError: string | null): SignedInEntryState {
  if (profile) return profile.onboardingCompleted ? 'workspace' : 'onboarding'
  return workspaceError ? 'workspace-error' : 'onboarding'
}
