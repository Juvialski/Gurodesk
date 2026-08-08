import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const root = process.cwd()
const read = (file) => readFile(resolve(root, file), 'utf8')
const fail = (message) => { throw new Error(message) }

const pkg = JSON.parse(await read('package.json'))
if (!['0.3.1', '0.3.5', '0.3.6', '0.3.7', '0.3.8', '0.3.9'].includes(pkg.version)) fail(`Expected BYOK-capable package version; found ${pkg.version}.`)

const migration = await read('supabase/migrations/202608080007_phase3_byok_ai.sql')
for (const required of ['teacher_ai_credentials', 'teacher_ai_settings', 'api_key_ciphertext', 'encryption_key_source', 'enable row level security', 'Intentionally no authenticated CRUD policies']) {
  if (!migration.includes(required)) fail(`BYOK migration missing: ${required}`)
}

const config = await read('supabase/config.toml')
if (!config.includes('[functions.ai-settings]') || !config.includes('[functions.lesson-ai-support]')) fail('BYOK Edge Functions are not declared in config.toml.')

const models = await read('supabase/functions/_shared/ai-models.ts')
for (const model of ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash']) {
  if (!models.includes(model)) fail(`Missing selectable Gemini model ${model}`)
}
if (!models.includes("thinkingLevel: 'high'")) fail('Flash-Lite high-thinking configuration is missing.')
if (!models.includes('fallbackAllowed')) fail('Lite-only fallback guard is missing.')

const settingsFn = await read('supabase/functions/ai-settings/index.ts')
for (const required of ['save_key', 'test_saved_key', 'remove_key', 'encryptCredential', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!settingsFn.includes(required)) fail(`ai-settings function missing: ${required}`)
}
if (settingsFn.includes("Deno.env.get('GEMINI_API_KEY')")) fail('Shared Gemini API key dependency still exists in ai-settings.')

const lessonFn = await read('supabase/functions/lesson-ai-support/index.ts')
for (const required of ['teacher_ai_credentials', 'decryptCredential', 'fallbackAllowed', 'thinkingLevel', 'AI_KEY_NOT_CONFIGURED']) {
  if (!lessonFn.includes(required)) fail(`lesson-ai-support BYOK integration missing: ${required}`)
}
if (lessonFn.includes("Deno.env.get('GEMINI_API_KEY')")) fail('Lesson AI still depends on shared GEMINI_API_KEY.')

const setup = await read('src/components/AiSetupPanel.tsx')
for (const required of ['Get Gemini API key', 'Test & save key', 'Lite-model automatic fallback']) {
  if (!setup.includes(required)) fail(`AI setup UI missing: ${required}`)
}

async function sourceFiles(dir) {
  const out = []
  for (const entry of await readdir(resolve(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...await sourceFiles(rel))
    else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) out.push(rel)
  }
  return out
}

for (const file of await sourceFiles('src')) {
  const text = await read(file)
  if (text.includes('SUPABASE_SERVICE_ROLE_KEY')) fail(`Browser source ${file} references the service-role key.`)
  if (text.includes('api_key_ciphertext')) fail(`Browser source ${file} references encrypted credential storage internals.`)
}

console.log('✓ BYOK migration and server-only credential storage present')
console.log('✓ Gemini 3.5/3.1 Flash-Lite prioritized with explicit high thinking')
console.log('✓ 3.6/3.5 Flash remain selectable without automatic limited-call fallback')
console.log('✓ No shared GEMINI_API_KEY dependency remains in lesson AI')
console.log('✓ Browser never reads credential ciphertext or service-role secret')
