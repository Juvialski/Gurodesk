#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(path, 'utf8')
}

function fail(message) {
  console.error(`School directory contract validation failed: ${message}`)
  process.exit(1)
}

const [types, repository, onboarding, settings, migration, picker, importer] = await Promise.all([
  read('src/types/app.ts'),
  read('src/lib/repository.ts'),
  read('src/pages/OnboardingPage.tsx'),
  read('src/pages/SettingsPage.tsx'),
  read('supabase/migrations/202608130039_philippine_school_identity.sql'),
  read('src/components/SchoolPicker.tsx'),
  read('scripts/schools/import-deped-nid.mjs'),
])

for (const required of ['schoolDirectoryId?:', 'schoolId?:', 'schoolSource?:', 'schoolIsCustom?:']) {
  if (!types.includes(required)) fail(`Profile is missing ${required}`)
}
for (const required of ['school_directory_id', 'school_id', 'school_source', 'school_is_custom']) {
  if (!repository.includes(required)) fail(`Profile repository mapping is missing ${required}`)
}
if (!onboarding.includes('<SchoolPicker') || !onboarding.includes('isDemo={isDemo}')) fail('Onboarding is not using SchoolPicker.')
if (!settings.includes('<SchoolPicker') || !settings.includes('isDemo={isDemo}')) fail('Settings is not using SchoolPicker.')
for (const required of ['create table if not exists public.philippine_schools', 'search_philippine_schools', 'school_identity_snapshot', 'guard_profile_school_identity', 'capture_school_identity_snapshot']) {
  if (!migration.includes(required)) fail(`Migration is missing ${required}`)
}
for (const required of ['Search the DepEd directory', 'Enter manually', 'Official directory source']) {
  if (!picker.includes(required)) fail(`SchoolPicker is missing UX contract: ${required}`)
}
for (const required of ['nid.deped.gov.ph/public-dashboard', '40_000', 'SUPABASE_SERVICE_ROLE_KEY', 'on_conflict=school_id']) {
  if (!importer.includes(required)) fail(`NID importer safety contract is missing ${required}`)
}
await access('data/schools/philippine-schools.sample.json')
console.log('✓ Philippine school directory contract is wired into profile, onboarding, settings, migration, and importer')
