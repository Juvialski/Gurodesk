import { readFile } from 'node:fs/promises'

const app = await readFile('src/App.tsx', 'utf8')
const navigation = await readFile('src/components/navigation/ResponsiveNavigation.tsx', 'utf8')

function fail(message) {
  console.error(`Navigation reachability validation failed: ${message}`)
  process.exit(1)
}

for (const route of [
  'lesson-plans',
  'assessments',
  'classes',
  'results',
  'files',
  'curriculum',
  'tos',
  'settings',
  'help',
]) {
  if (!app.includes(`<Route path="${route}"`)) fail(`top-level route /${route} is missing`)
}

const count = (needle) => navigation.split(needle).length - 1

if (count("to: '/lesson-plans'") < 2) {
  fail('Lesson Plans must be reachable from desktop navigation and the mobile More menu.')
}
if (count("to: '/help'") < 2) {
  fail('Help must be reachable from both desktop and mobile navigation.')
}

console.log('✓ Core workspace indexes are reachable from responsive navigation')
