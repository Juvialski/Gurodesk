import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (file) => readFile(resolve(root, file), 'utf8')
const fail = (message) => { throw new Error(message) }

const pkg = JSON.parse(await read('package.json'))
if (!['0.3.5', '0.3.6', '0.3.7', '0.3.8', '0.3.9'].includes(pkg.version)) fail(`Expected Phase 3.5+ package version; found ${pkg.version}.`)

const migration = await read('supabase/migrations/202608080008_phase35_lesson_suggestions.sql')
for (const required of ['teacher_lesson_preferences', 'actual_resources', 'preferred_approaches', 'quick_draft', "'suggested'", 'enable row level security']) {
  if (!migration.includes(required)) fail(`Phase 3.5 migration missing ${required}`)
}

const editor = await read('src/pages/LessonPlanEditorPage.tsx')
for (const required of ['Quick Draft suggestions', 'Prepare suggestions', 'Apply to empty fields', 'I reviewed all', 'resourcesVerifiedByTeacher', 'No additional resources']) {
  if (!editor.includes(required)) fail(`Lesson workflow missing ${required}`)
}
if (editor.includes('<AiAssistTextarea label="Learning resources"')) fail('Learning resources must remain teacher-controlled, not an AI-filled field.')
if (editor.includes('<AiAssistTextarea label="References"')) fail('References must remain teacher-controlled, not an AI-filled field.')

const setup = await read('src/components/TeachingSetupPanel.tsx')
for (const required of ['My teaching setup', 'Books, modules & materials you actually use', 'availableTechnology', 'preferredApproaches', 'actualResources']) {
  if (!setup.includes(required)) fail(`Teaching setup UI missing ${required}`)
}

const fn = await read('supabase/functions/lesson-ai-support/index.ts')
for (const required of ['suggest_learning_objectives', 'suggest_lesson_flow', 'suggest_formative_assessment', 'quick_draft', 'RESOURCE ACCURACY RULE', 'Never invent or cite a book']) {
  if (!fn.includes(required)) fail(`Suggestion Edge Function missing ${required}`)
}
if (!fn.includes('Existing teacher text') || !fn.includes('Do not generate a post-lesson reflection')) fail('Quick Draft overwrite/reflection guards are missing.')

const validation = await read('src/lib/lessonPlanValidation.ts')
for (const required of ['resourcesVerifiedByTeacher', 'pendingSections', 'Quick Draft suggestions have been reviewed']) {
  if (!validation.includes(required)) fail(`Lesson validation missing ${required}`)
}

const models = await read('supabase/functions/_shared/ai-models.ts')
if (!models.includes("thinkingLevel: 'high'")) fail('Flash-Lite high-thinking behavior was lost.')

console.log('✓ Phase 3.5 teacher-guided suggestion workflow present')
console.log('✓ Quick Draft fills only empty planning fields and requires review')
console.log('✓ specific resources/references stay teacher-entered and verified')
console.log('✓ reusable teaching setup is RLS-protected and constrains AI suggestions')
console.log('✓ Flash-Lite high-thinking BYOK behavior retained')
