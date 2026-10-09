import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const read = (p) => fs.readFile(p, 'utf8')

const [app, onboarding, settings, panel] = await Promise.all([
  read('src/App.tsx'),
  read('src/pages/OnboardingPage.tsx'),
  read('src/pages/SettingsPage.tsx'),
  read('src/components/AiSetupPanel.tsx'),
])

// AI setup is deliberately feature-local. A teacher must be able to enter the
// workspace and use classes, curriculum, and manual document workflows before
// deciding whether to connect a Gemini key. Keep this regression guard close to
// the old phase validator so a future auth/router change cannot reintroduce the
// application-wide gate.
assert.doesNotMatch(app, /loadAiCredentialStatus/, 'App must not load Gemini setup as an application gate')
assert.doesNotMatch(app, /AiSetupRequiredPage/, 'App must not route every signed-in teacher through an AI setup page')
assert.doesNotMatch(app, /aiGate\s*===\s*['"]required['"]/, 'App must not block the workspace on AI setup')
assert.doesNotMatch(app, /Checking Gemini setup|Connect Gemini before opening your workspace/, 'global AI gate copy must not be reachable from App')

for (const required of [
  '<Route path="create" element={<CreateHubPage />} />',
  '<Route path="documents" element={<Navigate to="/files" replace />} />',
]) {
  assert.match(app, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `task-oriented route missing: ${required}`)
}

// Onboarding offers five explicit progressive steps. Gemini is an optional decision in its
// own step; choosing “Set up later” allows advancing without configuring Gemini.
for (const required of [
  'Setup {step} of 5',
  'About you',
  'What you teach',
  'AI setup',
  'Ready',
  'Optional AI setup',
  'Connect now',
  'Set up later',
  'You’re ready to go',
]) {
  assert.match(onboarding, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `optional AI onboarding marker missing: ${required}`)
}
assert.match(onboarding, /<details[^>]*><summary>Connect now<\/summary><AiSetupPanel/, 'Connect now must offer the real optional key panel without blocking onboarding')
assert.match(onboarding, /setStep\(3\)|setStep\(4\)|setStep\(5\)/, 'Set up later must reach the ready step without configuring Gemini')

// Settings is the normal feature-local home for AI setup and explicitly keeps
// non-AI workflows available when no key is configured.
for (const required of ['Optional Gemini help', 'GuroDesk still works when AI is unavailable', 'AiSetupPanel isDemo={isDemo}', '#ai-assistance']) {
  assert.match(settings, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Settings AI-local marker missing: ${required}`)
}

// Keep the mobile BYOK safeguards from phase 3.5.2: clipboard paste support,
// a text-friendly key field, explicit reveal/hide controls, and the feature
// local requiredMode used by guarded AI actions.
for (const required of [
  'Paste from clipboard',
  'navigator.clipboard?.readText',
  'onPaste=',
  'autoCapitalize="none"',
  'inputMode="text"',
  'EyeOff',
  'requiredMode',
  'saveTeacherAiCredential',
]) {
  assert.match(panel, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `AI setup mobile/BYOK safeguard missing: ${required}`)
}

console.log('Phase 3.5.2 optional AI setup and mobile paste/BYOK checks passed: workspace entry remains non-AI-gated, onboarding and Settings keep AI local, and teacher-owned key safeguards remain intact.')
