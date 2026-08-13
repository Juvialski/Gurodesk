#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

const EXPECTED_BASE_HEAD = '955b8651ec1f7981b5aeb4fed1a4ca58a30c2164'

async function read(path) {
  return readFile(path, 'utf8')
}

async function write(path, content) {
  await writeFile(path, content, 'utf8')
  console.log(`✓ ${path}`)
}

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source
  if (!source.includes(search)) throw new Error(`${label}: expected source text was not found. This overlay targets GuroDesk main ${EXPECTED_BASE_HEAD}; inspect newer changes before applying manually.`)
  const first = source.indexOf(search)
  if (source.indexOf(search, first + search.length) !== -1) throw new Error(`${label}: source text appeared more than once; refusing an ambiguous edit.`)
  return source.slice(0, first) + replacement + source.slice(first + search.length)
}

function replaceRegexOnce(source, regex, replacement, label, alreadyAppliedNeedle) {
  if (alreadyAppliedNeedle && source.includes(alreadyAppliedNeedle)) return source
  const matches = [...source.matchAll(regex)]
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one source match, found ${matches.length}. This overlay targets GuroDesk main ${EXPECTED_BASE_HEAD}.`)
  return source.replace(regex, replacement)
}

async function patchProfileTypes() {
  const path = 'src/types/app.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `  division: string\n  positionTitle: string`,
    `  division: string\n  schoolDirectoryId?: string | null\n  schoolId?: string | null\n  schoolSource?: 'deped_nid' | 'custom'\n  schoolIsCustom?: boolean\n  positionTitle: string`,
    'Profile type',
  )
  await write(path, source)
}

async function patchRepository() {
  const path = 'src/lib/repository.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `    division: String(row.division ?? ''),\n    positionTitle: String(row.position_title ?? 'Teacher I'),`,
    `    division: String(row.division ?? ''),\n    schoolDirectoryId: row.school_directory_id ? String(row.school_directory_id) : null,\n    schoolId: row.school_id ? String(row.school_id) : null,\n    schoolSource: row.school_source === 'deped_nid' ? 'deped_nid' : 'custom',\n    schoolIsCustom: row.school_is_custom === undefined ? !row.school_directory_id : Boolean(row.school_is_custom),\n    positionTitle: String(row.position_title ?? 'Teacher I'),`,
    'Profile database mapping',
  )
  source = replaceOnce(
    source,
    `    division: profile.division,\n    position_title: profile.positionTitle,`,
    `    division: profile.division,\n    school_directory_id: profile.schoolDirectoryId ?? null,\n    school_id: profile.schoolId ?? null,\n    school_source: profile.schoolSource ?? 'custom',\n    school_is_custom: profile.schoolIsCustom ?? true,\n    position_title: profile.positionTitle,`,
    'Profile database save',
  )
  await write(path, source)
}

async function patchOnboarding() {
  const path = 'src/pages/OnboardingPage.tsx'
  let source = await read(path)
  source = replaceOnce(
    source,
    `import { Brand } from '../components/Brand'\n`,
    `import { Brand } from '../components/Brand'\nimport { SchoolPicker } from '../components/SchoolPicker'\n`,
    'Onboarding SchoolPicker import',
  )
  source = replaceOnce(
    source,
    `  const { user, profile, assignments, updateProfile, createAssignment, removeAssignment } = useApp()`,
    `  const { user, profile, assignments, updateProfile, createAssignment, removeAssignment, isDemo } = useApp()`,
    'Onboarding demo mode',
  )
  source = replaceRegexOnce(
    source,
    /<label className="span-two">School name<input[\s\S]*?<\/label>\s*<label>Region<input[\s\S]*?<\/label>\s*<label>Schools Division<input[\s\S]*?<\/label>/g,
    `<div className="span-two"><SchoolPicker value={form} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} isDemo={isDemo} required /></div>`,
    'Onboarding school identity controls',
    '<SchoolPicker value={form}',
  )
  await write(path, source)
}

async function patchSettings() {
  const path = 'src/pages/SettingsPage.tsx'
  let source = await read(path)
  source = replaceOnce(
    source,
    `import { PageHeader } from '../components/PageHeader'\n`,
    `import { PageHeader } from '../components/PageHeader'\nimport { SchoolPicker } from '../components/SchoolPicker'\n`,
    'Settings SchoolPicker import',
  )
  source = replaceRegexOnce(
    source,
    /<label className="span-two">School<input[\s\S]*?<\/label><label>Region <small>\(optional\)<\/small><input[\s\S]*?<\/label><label>Schools Division <small>\(optional\)<\/small><input[\s\S]*?<\/label>/g,
    `<div className="span-two"><SchoolPicker value={form} onChange={(patch) => setForm((current) => current ? ({ ...current, ...patch }) : current)} isDemo={isDemo} /></div>`,
    'Settings school identity controls',
    '<SchoolPicker value={form}',
  )
  await write(path, source)
}

async function patchPackageJson() {
  const path = 'package.json'
  const parsed = JSON.parse(await read(path))
  parsed.scripts ??= {}
  parsed.scripts['validate:schools'] = 'node scripts/check-school-directory-contract.mjs && node scripts/schools/validate-school-directory.mjs data/schools/philippine-schools.sample.json'
  parsed.scripts['schools:import:nid'] = 'node scripts/schools/import-deped-nid.mjs'
  parsed.scripts['schools:sync:nid'] = 'node scripts/schools/import-deped-nid.mjs --sync'
  if (typeof parsed.scripts['test:ci'] === 'string' && !parsed.scripts['test:ci'].includes('validate:schools')) {
    parsed.scripts['test:ci'] = `npm run validate:schools && ${parsed.scripts['test:ci']}`
  }
  await write(path, `${JSON.stringify(parsed, null, 2)}\n`)
}

async function main() {
  console.log(`Applying Philippine School Directory overlay for GuroDesk base ${EXPECTED_BASE_HEAD}`)
  await patchProfileTypes()
  await patchRepository()
  await patchOnboarding()
  await patchSettings()
  await patchPackageJson()
  console.log('✓ Overlay applied. Next: run npm run validate:schools, unit tests, build, and database migration validation.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
