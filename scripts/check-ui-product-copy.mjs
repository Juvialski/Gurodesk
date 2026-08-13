import { readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(path, 'utf8')
}

function fail(message) {
  console.error(`UI product-copy validation failed: ${message}`)
  process.exit(1)
}

const [
  app,
  pageHeader,
  documents,
  help,
  dashboard,
  createHub,
  teacherTour,
  auth,
  onboarding,
  placeholder,
] = await Promise.all([
  read('src/App.tsx'),
  read('src/components/PageHeader.tsx'),
  read('src/pages/DocumentsPage.tsx'),
  read('src/pages/HelpPage.tsx'),
  read('src/pages/DashboardPage.tsx'),
  read('src/pages/CreateHubPage.tsx'),
  read('src/components/TeacherTour.tsx'),
  read('src/pages/AuthPage.tsx'),
  read('src/pages/OnboardingPage.tsx'),
  read('src/pages/FeaturePlaceholderPage.tsx'),
])

for (const required of ['DocumentsPage', 'HelpPage', 'path="files"', 'path="help"']) {
  if (!app.includes(required)) fail(`App route contract is missing ${required}.`)
}
if (app.includes('phase=')) fail('App routes still expose implementation-phase metadata.')
if (/the next release|Phase\s+\d/iu.test(app)) fail('App route copy still exposes release-planning language.')

for (const required of ['normalizePageEyebrow', "split('·')", 'Assessment Generation V2']) {
  if (!pageHeader.includes(required)) fail(`PageHeader release-label normalization is missing ${required}.`)
}

if (/scheduled for|later phases|Phase\s+\d/iu.test(placeholder)) {
  fail('Placeholder UI still exposes internal release phases.')
}

if (!documents.includes('Workspace library') || !documents.includes('loadLessonPlans') || !documents.includes('loadTosDocuments') || !documents.includes('loadAssessmentDocuments') || !documents.includes('loadResultSessions')) {
  fail('Documents must be a real saved-work library, not a release placeholder.')
}
if (!help.includes('/lesson-plans') || !help.includes('/tos') || !help.includes('/assessments') || !help.includes('/results')) {
  fail('Help must link the current core teacher workflows.')
}

if (/competency you choose/iu.test(`${dashboard}\n${createHub}`)) {
  fail('Lesson-plan entry copy regressed to competency-first wording.')
}
if (!teacherTour.includes("route: '/lesson-plans · /tos'")) {
  fail('Teacher tour does not surface Lesson Plans alongside TOS.')
}
if (/DepEd teacher paperwork/iu.test(auth) || /lesson-plan formats, assessments, and paperwork/iu.test(onboarding)) {
  fail('Public-facing copy still overclaims unfinished paperwork functionality.')
}

console.log('✓ UI product copy is current: phase labels hidden, topic-first lesson planning reflected, Documents and Help are functional')
