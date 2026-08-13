import fs from 'node:fs/promises'

const read = (p) => fs.readFile(p, 'utf8')
const fail = (m) => { console.error(`FAIL: ${m}`); process.exitCode = 1 }

const repository = await read('src/lib/repository.ts')
for (const required of [
  'Verified local manifest fallback is active',
  'Supabase returned zero verified competency rows',
  'resolveProductionCompetencyId',
  'never written into the',
]) {
  if (!repository.includes(required)) fail(`repository missing Phase 3.5.1 guard: ${required}`)
}

const editor = await read('src/pages/LessonPlanEditorPage.tsx')
for (const required of [
  'periodMappingFallback',
  'No verified curriculum row matches this topic and search',
  'Verified manifest fallback active',
  'Period mapping needs review',
]) {
  if (!editor.includes(required)) fail(`lesson editor missing Phase 3.5.1 UX guard: ${required}`)
}

if (!process.exitCode) console.log('Phase 3.5.1 curriculum selector regression checks passed.')
