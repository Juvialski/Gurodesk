import { readFile } from 'node:fs/promises'

const editor = await readFile('src/pages/LessonPlanEditorPage.tsx', 'utf8')
const css = `${await readFile('src/styles.css', 'utf8')}\n${await readFile('src/workflows.css', 'utf8')}`

function fail(message) {
  console.error(`Phase 3.5.3 validation failed: ${message}`)
  process.exit(1)
}

if (editor.includes('Verified competency<select')) fail('Verified competency still uses the native select control.')
for (const required of ['competencyPickerOpen', 'competencySearch', 'workflow-picker-trigger', 'workflow-picker-panel', 'filteredCompetencies', 'role="listbox"']) {
  if (!editor.includes(required)) fail(`Missing mobile picker feature: ${required}`)
}
for (const required of ['.workflow-picker-trigger', '.workflow-picker-panel', '.workflow-competency-list', '.workflow-competency-option']) {
  if (!css.includes(required)) fail(`Missing picker style: ${required}`)
}
if (!editor.includes('visibleCompetencies')) fail('Phase 3.5.1 verified competency fallback was removed.')

console.log('Phase 3.5.3 validation passed.')
