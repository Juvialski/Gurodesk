import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const manifestDirectory = resolve('data/curriculum/official')
const migrationPath = resolve('supabase/migrations/202608130038_verified_curriculum_standards_expansion.sql')
const manifestNames = (await readdir(manifestDirectory))
  .filter((name) => name.endsWith('.json'))
  .sort((left, right) => left.localeCompare(right, 'en'))
const manifests = (await Promise.all(
  manifestNames.map(async (name) => JSON.parse(await readFile(resolve(manifestDirectory, name), 'utf8'))),
))
  .filter((manifest) => Array.isArray(manifest.standards) && manifest.standards.length > 0)
  .sort((left, right) => left.slug.localeCompare(right.slug, 'en'))

const rows = manifests.flatMap((manifest) => manifest.standards.map((standard) => ({
  recordId: standard.recordId,
  manifestSlug: manifest.slug,
  periodSequence: standard.quarter,
  domainCode: standard.domain ?? null,
  standardType: standard.type,
  standardText: standard.text,
  sortOrder: standard.sortOrder,
  sourcePage: standard.sourcePage,
})))
const payloadHash = createHash('sha256').update(JSON.stringify({
  manifests: manifests.map((manifest) => ({
    slug: manifest.slug,
    curriculumCode: manifest.curriculumVersion.code,
    gradeLevel: manifest.subject.gradeLevel,
    subjectName: manifest.subject.name,
    sourceUrl: manifest.source.sourceUrl,
  })),
  rows,
})).digest('hex')
const sql = await readFile(migrationPath, 'utf8')
const failures = []
const count = (pattern) => sql.match(pattern)?.length ?? 0

if (manifests.length !== 175) failures.push(`expected 175 source-complete manifests, got ${manifests.length}`)
if (rows.length !== 2_838) failures.push(`expected 2838 verified standards, got ${rows.length}`)
if (!sql.includes(`-- Payload SHA-256: ${payloadHash}`)) failures.push('migration payload hash is stale; regenerate migration 038')
if (count(/^begin;$/gmu) !== 1 || count(/^commit;$/gmu) !== 1) failures.push('migration must contain exactly one transaction')
if (count(/^insert into public\.curriculum_standards \($/gmu) !== 1) failures.push('migration must contain exactly one public standards insert')
if (/\b(?:insert into|update|delete from)\s+public\.curriculum_competencies\b/iu.test(sql)) failures.push('migration must not mutate competencies')
if (/\b(?:update|delete from)\s+public\.curriculum_standards\b/iu.test(sql)) failures.push('migration must not rewrite or delete existing standards')
if (/\b(?:insert into|update|delete from)\s+public\.(?:tos_documents|tos_rows|assessment_documents|assessment_items)\b/iu.test(sql)) failures.push('migration must not mutate TOS or assessment history')
if (/\b(?:enable|disable|force|no force)\s+row level security\b/iu.test(sql) || /\b(?:create|alter|drop)\s+policy\b/iu.test(sql)) failures.push('migration must not change RLS or policies')

for (const row of rows) {
  const escapedRecordId = row.recordId.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  if (count(new RegExp(`'${escapedRecordId}'`, 'gu')) !== 1) failures.push(`${row.recordId}: expected exactly one staged migration record`)
}

if (failures.length) {
  console.error('Verified standards migration validation failed:')
  for (const failure of failures.slice(0, 25)) console.error(`- ${failure}`)
  if (failures.length > 25) console.error(`- …and ${failures.length - 25} more`)
  process.exit(1)
}

console.log(`✓ verified standards migration: ${manifests.length} manifests → ${rows.length} additive source-pinned standards (${payloadHash})`)
