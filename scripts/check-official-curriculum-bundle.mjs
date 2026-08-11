import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const bundlePath = resolve('supabase/seeds/official-curriculum-complete.sql')
const manifestDir = resolve('data/curriculum/official')
const [sql, names] = await Promise.all([
  readFile(bundlePath, 'utf8'),
  readdir(manifestDir),
])
const manifests = await Promise.all(
  names.filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(resolve(manifestDir, name), 'utf8'))),
)
const competencyCount = manifests.reduce((sum, manifest) => sum + manifest.competencies.length, 0)
const aggregateHash = createHash('sha256')
  .update(manifests.map((manifest) => manifest.integrity.competencyPayloadSha256).sort().join('\n'))
  .digest('hex')
const failures = []
const count = (pattern) => sql.match(pattern)?.length ?? 0

if (!sql.includes(`-- Aggregate manifest SHA-256: ${aggregateHash}`)) failures.push('aggregate manifest hash is stale')
if (count(/^begin;$/gmu) !== 1 || count(/^commit;$/gmu) !== 1) failures.push('bundle must contain exactly one transaction')
if (count(/^insert into public\.curriculum_competencies /gmu) !== competencyCount) failures.push(`expected ${competencyCount} competency inserts`)
if (count(/^update public\.curriculum_competencies cc$/gmu) !== competencyCount) failures.push(`expected ${competencyCount} stable competency updates`)
if (count(/^insert into public\.source_documents /gmu) !== manifests.length) failures.push(`expected ${manifests.length} source upserts`)
if (!sql.includes('content_hash, verification_status')) failures.push('source content hashes are not imported')
if (!sql.includes('MATATAG-Mathematics-CG-Grades1-4-and-7.pdf')) failures.push('legacy Grade 7 Mathematics seed compatibility is missing')
if (/delete from public\.(?:curriculum_subjects|curriculum_versions|source_documents)/iu.test(sql)) failures.push('bundle must not delete version, subject, or source identities')
if (/\b(?:quarter|term)\s*(?:->|to)\s*(?:quarter|term)\b/iu.test(sql)) failures.push('bundle contains an inferred period mapping marker')

if (failures.length) {
  console.error('Official curriculum SQL bundle validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`✓ official curriculum SQL bundle: ${manifests.length} manifests and ${competencyCount} stable upserts in one transaction`)
