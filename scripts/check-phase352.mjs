import fs from 'node:fs/promises'

const read = (p) => fs.readFile(p, 'utf8')
const fail = (m) => { console.error(`FAIL: ${m}`); process.exitCode = 1 }

const app = await read('src/App.tsx')
for (const required of ['loadAiCredentialStatus', 'AiSetupRequiredPage', "aiGate === 'required'", 'Checking Gemini setup']) {
  if (!app.includes(required)) fail(`App missing mandatory AI setup gate: ${required}`)
}

const requiredPage = await read('src/pages/AiSetupRequiredPage.tsx')
for (const required of ['Connect Gemini before opening your workspace', 'AiSetupPanel', 'requiredMode', 'onStatusChange']) {
  if (!requiredPage.includes(required)) fail(`Required AI setup page missing: ${required}`)
}

const panel = await read('src/components/AiSetupPanel.tsx')
for (const required of ['Paste from clipboard', 'navigator.clipboard?.readText', 'onPaste=', 'autoCapitalize="none"', 'inputMode="text"', 'EyeOff', 'requiredMode']) {
  if (!panel.includes(required)) fail(`AI setup mobile-paste guard missing: ${required}`)
}

if (!process.exitCode) console.log('Phase 3.5.2 first-run AI setup and mobile paste checks passed.')
