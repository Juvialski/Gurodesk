import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { signedInEntryState } from '../../src/lib/workspaceEntry'
import type { Profile } from '../../src/types/app'

const completeProfile: Profile = {
  id: 'teacher-one',
  email: null,
  fullName: 'Teacher One',
  schoolName: 'Test School',
  region: '',
  division: '',
  positionTitle: 'Teacher I',
  schoolYear: '2026-2027',
  onboardingCompleted: true,
}

describe('first-time workspace entry', () => {
  it('never mistakes a workspace-load failure for an incomplete onboarding profile', () => {
    expect(signedInEntryState(null, 'network unavailable')).toBe('workspace-error')
    expect(signedInEntryState({ ...completeProfile, onboardingCompleted: false }, null)).toBe('onboarding')
    expect(signedInEntryState(completeProfile, null)).toBe('workspace')
  })

  it('keeps onboarding choices styled and stacks narrow-phone footer actions', () => {
    const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8')
    for (const selector of [
      '.workflow-onboarding-choice-grid',
      '.workflow-onboarding-choice',
      '.workflow-ready-actions',
      '.workflow-ready-card',
      '.onboarding-card .form-footer',
    ]) expect(styles).toContain(selector)
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.onboarding-card \.form-footer[\s\S]*?flex-direction: column-reverse/u)
  })
})
