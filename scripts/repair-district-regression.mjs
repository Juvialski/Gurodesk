#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

const REPO = 'Juvialski/Gurodesk'
const GOOD_PARENT = 'acdf7c3ac6ab0ed13ce865b020a81de18cd6a693'
const BROKEN_HEAD = '1d13db10b6601421010d32433a5a4c839a93fe92'
const SEED = 'supabase/seeds/official-curriculum-complete.sql'

async function read(path) {
  return readFile(path, 'utf8')
}

async function write(path, content) {
  await writeFile(path, content, 'utf8')
  console.log(`✓ ${path}`)
}

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source
  const first = source.indexOf(search)
  if (first < 0) {
    throw new Error(`${label}: expected source text was not found. Refusing an ambiguous edit.`)
  }
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`${label}: source text appears more than once. Refusing an ambiguous edit.`)
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length)
}

async function restoreCurriculumSeed() {
  let restored = null
  try {
    restored = execFileSync('git', ['show', `${GOOD_PARENT}:${SEED}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    console.log(`✓ restored ${SEED} from local git history ${GOOD_PARENT}`)
  } catch {
    const url = `https://raw.githubusercontent.com/${REPO}/${GOOD_PARENT}/${SEED}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Unable to restore ${SEED}: git history unavailable and ${url} returned HTTP ${response.status}.`)
    }
    restored = await response.text()
    console.log(`✓ restored ${SEED} from pinned GitHub parent ${GOOD_PARENT}`)
  }

  if (!restored.includes('-- Aggregate manifest SHA-256:')) {
    throw new Error('Restored curriculum seed does not look like the official generated bundle.')
  }
  if (restored.length < 10_000_000) {
    throw new Error(`Restored curriculum seed is unexpectedly small (${restored.length} bytes). Refusing to overwrite.`)
  }
  await writeFile(SEED, restored, 'utf8')
}

async function patchLessonPreview() {
  const path = 'src/components/LessonPlanDocumentView.tsx'
  let source = await read(path)

  source = replaceOnce(
    source,
    `        {model.identity.division && <p>{model.identity.division}</p>}
        {model.identity.schoolName && <p className="print-school-name">{model.identity.schoolName}</p>}`,
    `        {model.identity.division && <p>{model.identity.division}</p>}
        {model.identity.district && <p>{model.identity.district}</p>}
        {model.identity.schoolName && <p className="print-school-name">{model.identity.schoolName}</p>}`,
    'Lesson Plan browser header District',
  )

  source = replaceOnce(
    source,
    `          <tr><th>{model.labels.teacher}</th><td>{model.identity.teacherName}</td></tr>
          <tr><th>{model.labels.gradeSection}</th><td>{gradeAndSection}</td></tr>`,
    `          <tr><th>{model.labels.teacher}</th><td>{model.identity.teacherName}</td></tr>
          {model.identity.district && <tr><th>District</th><td>{model.identity.district}</td></tr>}
          <tr><th>{model.labels.gradeSection}</th><td>{gradeAndSection}</td></tr>`,
    'Lesson Plan browser metadata District',
  )

  await write(path, source)
}

async function patchTosPreview() {
  const path = 'src/components/TosDocumentView.tsx'
  let source = await read(path)

  source = replaceOnce(
    source,
    `{model.identity.region && <p>{model.identity.region}</p>}{model.identity.division && <p>{model.identity.division}</p>}{model.identity.schoolName && <p className="print-school-name">{model.identity.schoolName}</p>}`,
    `{model.identity.region && <p>{model.identity.region}</p>}{model.identity.division && <p>{model.identity.division}</p>}{model.identity.district && <p>{model.identity.district}</p>}{model.identity.schoolName && <p className="print-school-name">{model.identity.schoolName}</p>}`,
    'TOS browser header District',
  )

  source = replaceOnce(
    source,
    `<table className="print-meta-table"><tbody><tr><th>Teacher</th><td>{model.identity.teacherName}</td><th>School</th><td>{model.identity.schoolName}</td></tr><tr><th>Grade / Section</th>`,
    `<table className="print-meta-table"><tbody><tr><th>Teacher</th><td>{model.identity.teacherName}</td><th>School</th><td>{model.identity.schoolName}</td></tr><tr><th>Schools Division</th><td>{model.identity.division}</td><th>District</th><td>{model.identity.district}</td></tr><tr><th>Grade / Section</th>`,
    'TOS browser metadata District',
  )

  await write(path, source)
}

async function patchTosPdfPagination() {
  const path = 'src/lib/tosExport.ts'
  let source = await read(path)

  source = replaceOnce(
    source,
    `  const firstTableTop = margin + 22 + statusHeaderOffset + (5 * 13) + 7 + 30`,
    `  const firstTableTop = margin + 22 + statusHeaderOffset + (7 * 13) + 7 + 30`,
    'TOS first-page metadata height budget',
  )

  await write(path, source)
}

async function addRegressionValidator() {
  const path = 'scripts/check-school-district-preview-contract.mjs'
  const content = `#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

const [lessonView, tosView, tosExport] = await Promise.all([
  readFile('src/components/LessonPlanDocumentView.tsx', 'utf8'),
  readFile('src/components/TosDocumentView.tsx', 'utf8'),
  readFile('src/lib/tosExport.ts', 'utf8'),
])

const failures = []

if (!lessonView.includes('model.identity.district')) {
  failures.push('Lesson Plan browser/print preview does not render District.')
}
if (!tosView.includes('model.identity.district')) {
  failures.push('TOS browser/print preview does not render District.')
}
if (!tosView.includes('<th>District</th>')) {
  failures.push('TOS browser metadata table does not expose District.')
}
if (!tosExport.includes('(7 * 13) + 7 + 30')) {
  failures.push('TOS PDF first-page table budget was not expanded for the 13 metadata entries.')
}

if (failures.length) {
  console.error('School district preview regression validation failed:')
  for (const failure of failures) console.error('- ' + failure)
  process.exit(1)
}

console.log('✓ District appears in Lesson Plan/TOS browser previews and TOS PDF pagination budget includes the expanded metadata header.')
`
  await write(path, content)
}

async function assertSeedRestored() {
  const sql = await read(SEED)
  const counts = {
    competencyInserts: (sql.match(/^insert into public\.curriculum_competencies /gmu) ?? []).length,
    competencyUpdates: (sql.match(/^update public\.curriculum_competencies cc$/gmu) ?? []).length,
    standards: (sql.match(/^insert into public\.curriculum_standards /gmu) ?? []).length,
    sourceUpserts: (sql.match(/^insert into public\.source_documents /gmu) ?? []).length,
    begins: (sql.match(/^begin;$/gmu) ?? []).length,
    commits: (sql.match(/^commit;$/gmu) ?? []).length,
  }
  if (
    counts.competencyInserts !== 6181 ||
    counts.competencyUpdates !== 6181 ||
    counts.standards !== 2838 ||
    counts.sourceUpserts !== 196 ||
    counts.begins !== 1 ||
    counts.commits !== 1
  ) {
    throw new Error(`Restored curriculum seed contract is wrong: ${JSON.stringify(counts)}`)
  }
  console.log('✓ official curriculum seed restored: 6181 competencies, 2838 standards, 196 sources, one transaction')
}

async function main() {
  let head = ''
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {}
  if (head) console.log(`Current HEAD: ${head}`)
  if (head && head !== BROKEN_HEAD) {
    console.log(`Note: this repair was authored against ${BROKEN_HEAD}. Guarded text replacements will stop rather than overwrite incompatible newer work.`)
  }

  await restoreCurriculumSeed()
  await patchLessonPreview()
  await patchTosPreview()
  await patchTosPdfPagination()
  await addRegressionValidator()
  await assertSeedRestored()

  console.log('')
  console.log('✓ Gemini district regression repair applied.')
  console.log('Next: run npm run test:ci, npm run test:db:fresh, npm run test:db:upgrade, and npm run test:e2e before committing.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exit(1)
})
