import type { AppUser, Profile } from '../types/app'

// Configurable admin email list via environment variable (comma-separated).
// e.g. VITE_ADMIN_EMAILS="teacher.admin@deped.gov.ph,al@gurodesk.ph"
const rawEnvEmails = import.meta.env.VITE_ADMIN_EMAILS ?? ''

function parseAdminEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
}

const PRIMARY_ADMIN_EMAIL = 'al.matubis17@gmail.com'

const DEFAULT_ADMIN_EMAILS = [
  PRIMARY_ADMIN_EMAIL,
  ...parseAdminEmails(rawEnvEmails),
]

const DEMO_ADMIN_STORAGE_KEY = 'gurodesk.admin.demo_access.v1'

/**
 * Returns the list of authorized admin emails.
 */
export function getAdminEmails(): string[] {
  return [...DEFAULT_ADMIN_EMAILS]
}

/**
 * Checks if the provided email matches any authorized admin email.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  const list = getAdminEmails()
  return list.includes(normalized)
}

/**
 * Determines whether the current logged-in user or active session has admin privileges.
 */
export function isAdminUser(user: AppUser | null, profile?: Profile | null, isDemo?: boolean): boolean {
  if (isDemo) {
    if (typeof localStorage !== 'undefined') {
      const demoOverride = localStorage.getItem(DEMO_ADMIN_STORAGE_KEY)
      if (demoOverride === 'false') return false
    }
    // By default in demo mode, allow access for testing/preview
    return true
  }
  if (!user && !profile) return false
  const userEmail = user?.email ?? profile?.email
  return isAdminEmail(userEmail)
}

/**
 * Allows toggling demo admin access for simulation/testing in demo mode.
 */
export function setDemoAdminAccess(enabled: boolean): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(DEMO_ADMIN_STORAGE_KEY, enabled ? 'true' : 'false')
    } catch {
      // Storage access is optional
    }
  }
}
