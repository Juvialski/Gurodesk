import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const cliArg = process.argv[2]
const manifestDir = resolve('data/curriculum/official')

let tempDir = null
let targetSqlPath = null
let exitCode = 0

try {
  if (cliArg) {
    targetSqlPath = resolve(cliArg)
  } else {
    tempDir = await mkdtemp(join(tmpdir(), 'gurodesk-check-bundle-'))
    targetSqlPath = join(tempDir, 'official-curriculum-complete.sql')
    const generate = spawnSync(
      process.execPath,
      ['scripts/generate-official-curriculum-bundle.mjs', manifestDir, targetSqlPath],
      { cwd: process.cwd(), stdio: 'inherit' },
    )
    if (generate.status !== 0) {
      throw new Error(`Curriculum SQL bundle generation failed with status ${generate.status ?? 'unknown'}`)
    }
  }

  const [sql, names] = await Promise.all([
    readFile(targetSqlPath, 'utf8'),
    readdir(manifestDir),
  ])
  const manifests = await Promise.all(
    names.filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(resolve(manifestDir, name), 'utf8'))),
  )
  const competencyCount = manifests.reduce((sum, manifest) => sum + manifest.competencies.length, 0)
  const standardCount = manifests.reduce((sum, manifest) => sum + (manifest.standards?.length ?? manifest.performanceStandards?.length ?? 0), 0)
  const aggregateHash = createHash('sha256')
    .update(manifests.map((manifest) => manifest.integrity.competencyPayloadSha256).sort().join('\n'))
    .digest('hex')
  const failures = []
  const count = (pattern) => sql.match(pattern)?.length ?? 0

  if (!sql.includes(`-- Aggregate manifest SHA-256: ${aggregateHash}`)) failures.push('aggregate manifest hash is stale')
  if (count(/^begin;$/gmu) !== 1 || count(/^commit;$/gmu) !== 1) failures.push('bundle must contain exactly one transaction')
  if (count(/^insert into public\.curriculum_competencies /gmu) !== competencyCount) failures.push(`expected ${competencyCount} competency inserts`)
  if (count(/^update public\.curriculum_competencies cc$/gmu) !== competencyCount) failures.push(`expected ${competencyCount} stable competency updates`)
  if (count(/^insert into public\.curriculum_standards /gmu) !== standardCount) failures.push(`expected ${standardCount} standard inserts`)
  if (count(/^insert into public\.source_documents /gmu) !== manifests.length) failures.push(`expected ${manifests.length} source upserts`)
  if (!sql.includes('content_hash, verification_status')) failures.push('source content hashes are not imported')
  if (!sql.includes('MATATAG-Mathematics-CG-Grades1-4-and-7.pdf')) failures.push('legacy Grade 7 Mathematics seed compatibility is missing')
  if (/delete from public\.(?:curriculum_subjects|curriculum_versions|source_documents)/iu.test(sql)) failures.push('bundle must not delete version, subject, or source identities')
  if (/\b(?:quarter|term)\s*(?:->|to)\s*(?:quarter|term)\b/iu.test(sql)) failures.push('bundle contains an inferred period mapping marker')

  if (failures.length) {
    console.error('Official curriculum SQL bundle validation failed:')
    for (const failure of failures) console.error(`- ${failure}`)
    exitCode = 1
  } else {
    console.log(`✓ official curriculum SQL bundle: ${manifests.length} manifests, ${competencyCount} stable competency upserts, and ${standardCount} standards in one transaction`)
  }
} catch (error) {
  console.error('Official curriculum SQL bundle validation error:', error instanceof Error ? error.message : error)
  exitCode = 1
} finally {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

if (exitCode !== 0) {
  process.exit(exitCode)
}

