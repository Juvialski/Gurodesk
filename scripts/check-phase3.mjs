import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const root = process.cwd()
const read = (file) => readFile(resolve(root, file), 'utf8')
const fail = (message) => { throw new Error(message) }

const pkg = JSON.parse(await read('package.json'))
if (!['0.3.0', '0.3.1', '0.3.5', '0.3.6', '0.3.7'].includes(pkg.version)) fail(`Expected Phase 3+ package version; found ${pkg.version}.`)

const migration = await read('supabase/migrations/202608080005_phase3_lesson_planning.sql')
for (const required of ['lesson_plan_competencies', 'lesson_plan_ai_events', 'verification_status = \'verified\'', 'document_type = \'lesson_plan\'']) {
  if (!migration.includes(required)) fail(`Phase 3 migration missing guard: ${required}`)
}

const fn = await read('supabase/functions/lesson-ai-support/index.ts')
for (const allowed of ['refine_clarity', 'organize_text', 'grammar_spelling', 'format_text', 'translate']) {
  if (!fn.includes(allowed)) fail(`AI text-support function missing task ${allowed}`)
}
if (!fn.includes('VERIFIED COMPETENCY')) fail('Lesson AI is not grounded in verified competency context.')
if (!fn.includes('RESOURCE ACCURACY RULE')) fail('Lesson AI resource hallucination guard is missing.')

const policy = await read('src/data/lessonPlanningPolicy.ts')
if (!policy.includes('DO 016, s. 2026')) fail('Lesson planning policy code is missing.')
if (!policy.toLowerCase().includes('teacher remains responsible')) fail('Teacher-responsibility policy copy is missing.')

const editor = await read('src/pages/LessonPlanEditorPage.tsx')
for (const required of ['Intentions', 'Learning Experience', 'Assessing Learning', 'Ways Forward', 'AI use declaration']) {
  if (!editor.includes(required)) fail(`Editor missing ${required}`)
}
if (!editor.includes('curriculumPeriodLabel') || !editor.includes('gradingTermLabel')) fail('Editor must keep curriculum period and grading term separate.')

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
  if (text.includes('GEMINI_API_KEY')) fail(`Browser source ${file} references GEMINI_API_KEY.`)
  if (text.toLowerCase().includes('service_role')) fail(`Browser source ${file} references a Supabase service-role credential.`)
}

console.log('✓ Phase 3 lesson-planning foundation checks passed')
console.log('✓ ILAW fields and curriculum/term separation present')
console.log('✓ AI remains competency-grounded with teacher-responsibility and resource-accuracy guards')
console.log('✓ verified-competency and lesson-document RLS guards present')
console.log('✓ browser source contains no Gemini/service-role secret reference')
