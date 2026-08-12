import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const inputDir = resolve(process.argv[2] ?? 'data/curriculum/official')
const output = resolve(process.argv[3] ?? 'supabase/seeds/official-curriculum-complete.sql')
const temporaryDir = await mkdtemp(join(tmpdir(), 'gurodesk-curriculum-sql-'))

const q = (value) => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`

try {
  const generation = spawnSync(process.execPath, ['scripts/generate-all-curriculum-sql.mjs', inputDir, temporaryDir], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (generation.status !== 0) throw new Error(`Curriculum SQL fragment generation failed with status ${generation.status ?? 'unknown'}`)

  const names = (await readdir(temporaryDir)).filter((name) => name.endsWith('.sql')).sort((left, right) => left.localeCompare(right, 'en'))
  if (names.length !== 196) throw new Error(`Expected 196 generated SQL fragments, got ${names.length}`)

  const manifestNames = (await readdir(inputDir)).filter((name) => name.endsWith('.json')).sort((left, right) => left.localeCompare(right, 'en'))
  const manifests = await Promise.all(manifestNames.map(async (name) => JSON.parse(await readFile(resolve(inputDir, name), 'utf8'))))
  if (manifests.length !== 196) throw new Error(`Expected 196 manifests, got ${manifests.length}`)

  const bundleHash = createHash('sha256')
    .update(manifests.map((manifest) => manifest.integrity.competencyPayloadSha256).sort().join('\n'))
    .digest('hex')
  const grade7Math = manifests.find((manifest) => manifest.slug === 'revised-k10-grade-7-mathematics')
  if (!grade7Math) throw new Error('Grade 7 Mathematics manifest is required for legacy seed compatibility')

  const lines = [
    '-- GuroDesk complete official curriculum seed.',
    '-- Generated from 196 source-pinned manifests; do not hand-edit.',
    `-- Aggregate manifest SHA-256: ${bundleHash}`,
    '-- Apply after all Supabase migrations and before teachers begin referencing official competencies.',
    'begin;',
    '',
    '-- Preserve the original Grade 7 Mathematics source row and its competency IDs from migration 003.',
    `update public.source_documents\nset source_url = ${q(grade7Math.source.sourceUrl)}\nwhere source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'\n  and not exists (select 1 from public.source_documents where source_url = ${q(grade7Math.source.sourceUrl)});`,
    '',
  ]

  for (const [oldName, newName, code, order] of [
    ['Measurement and Geometry', 'Measurement and Geometry (MG)', 'D01', 1],
    ['Number and Algebra', 'Number and Algebra (NA)', 'D02', 2],
    ['Data and Probability', 'Data and Probability (DP)', 'D03', 3],
  ]) {
    lines.push(`update public.curriculum_domains cd\nset name = ${q(newName)}, code = ${q(code)}, sort_order = ${order}\nfrom public.curriculum_subjects cs\njoin public.curriculum_versions cv on cv.id = cs.curriculum_version_id\nwhere cd.subject_id = cs.id\n  and cv.code = 'REVISED-K10-MATATAG'\n  and cs.grade_level = 'Grade 7'\n  and cs.name = 'Mathematics'\n  and cd.name = ${q(oldName)}\n  and not exists (select 1 from public.curriculum_domains existing where existing.subject_id = cs.id and existing.name = ${q(newName)});`)
    lines.push('')
  }

  for (const name of names) {
    const fragment = await readFile(resolve(temporaryDir, name), 'utf8')
    const body = fragment
      .replace(/^-- Generated[^\n]*\n+begin;\n+/u, '')
      .replace(/\ncommit;\s*$/u, '')
    if (/\b(?:begin|commit);/iu.test(body)) throw new Error(`${name} contains an unexpected nested transaction`)
    lines.push(`-- ${name}`)
    lines.push(body.trim())
    lines.push('')
  }

  const expectedDomains = new Map()
  for (const manifest of manifests) {
    const key = JSON.stringify([manifest.curriculumVersion.code, manifest.subject.gradeLevel, manifest.subject.name])
    const current = expectedDomains.get(key) ?? { manifest, names: new Set() }
    for (const domain of manifest.domains) current.names.add(domain.name)
    expectedDomains.set(key, current)
  }
  lines.push('-- Remove obsolete domains only after every source component for a subject has been imported.')
  for (const { manifest, names: domainNames } of [...expectedDomains.values()].sort((left, right) => left.manifest.slug.localeCompare(right.manifest.slug, 'en'))) {
    const namesSql = [...domainNames].sort((left, right) => left.localeCompare(right, 'en')).map(q).join(', ')
    lines.push(`delete from public.curriculum_domains cd\nusing public.curriculum_subjects cs, public.curriculum_versions cv\nwhere cd.subject_id = cs.id\n  and cs.curriculum_version_id = cv.id\n  and cv.code = ${q(manifest.curriculumVersion.code)}\n  and cs.grade_level = ${q(manifest.subject.gradeLevel)}\n  and cs.name = ${q(manifest.subject.name)}\n  and cd.name not in (${namesSql});`)
    lines.push('')
  }

  lines.push('commit;')
  lines.push('')

  const bundleSql = lines.join('\n')
  const danglingJoinPattern = /\bjoin\s+[^\n]+\s+on\s+[A-Za-z_][A-Za-z0-9_.]*\s*$/gimu
  const danglingJoins = bundleSql.match(danglingJoinPattern) ?? []
  if (danglingJoins.length) {
    throw new Error(`Refusing to write malformed curriculum SQL: found ${danglingJoins.length} JOIN clause(s) with a non-boolean ON expression. First: ${danglingJoins[0]}`)
  }
  if (/join public\.curriculum_versions cv on cv\.id\s*(?:\r?\n|$)/iu.test(bundleSql)) {
    throw new Error('Refusing to write malformed curriculum SQL: curriculum_versions JOIN is missing = cs.curriculum_version_id.')
  }

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, bundleSql, 'utf8')
  console.log(`Generated ${output} from ${manifests.length} manifests (${bundleHash}).`)
} finally {
  await rm(temporaryDir, { recursive: true, force: true })
}
