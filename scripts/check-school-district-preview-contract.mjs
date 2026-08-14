#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

const [lessonView, tosView, tosExport] = await Promise.all([
  readFile('src/components/LessonPlanDocumentView.tsx', 'utf8'),
  readFile('src/components/TosDocumentView.tsx', 'utf8'),
  readFile('src/lib/tosExport.ts', 'utf8'),
])
const failures = []
if (!lessonView.includes('model.identity.district')) failures.push('Lesson Plan preview does not render District.')
if (!lessonView.includes('<th>District</th>')) failures.push('Lesson Plan metadata does not expose District.')
if (!tosView.includes('model.identity.district')) failures.push('TOS preview does not render District.')
if (!tosView.includes('<th>District</th>')) failures.push('TOS metadata does not expose District.')
if (!tosExport.includes('(7 * 13) + 7 + 30')) failures.push('TOS PDF first-page budget is not seven metadata rows.')
if (failures.length) {
  console.error('School district preview regression validation failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}
console.log('✓ District preview/export pagination contract passed.')
