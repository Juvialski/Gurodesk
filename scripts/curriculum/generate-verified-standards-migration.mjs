import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const manifestDirectory = resolve(process.argv[2] ?? 'data/curriculum/official')
const outputPath = resolve(process.argv[3] ?? 'supabase/migrations/202608130038_verified_curriculum_standards_expansion.sql')

// Migration 038 is intentionally frozen to the source-complete manifests available
// on 2026-08-13. Additional source packs belong in a later additive migration.
const EXPECTED = Object.freeze({
  manifests: 175,
  standards: 2_838,
  content: 1_635,
  performance: 1_203,
})

const quote = (value) => value === null || value === undefined
  ? 'null'
  : `'${String(value).replaceAll("'", "''")}'`

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

const contentCount = rows.filter((row) => row.standardType === 'content').length
const performanceCount = rows.filter((row) => row.standardType === 'performance').length
for (const [label, actual, expected] of [
  ['source-complete manifests', manifests.length, EXPECTED.manifests],
  ['standards', rows.length, EXPECTED.standards],
  ['content standards', contentCount, EXPECTED.content],
  ['performance standards', performanceCount, EXPECTED.performance],
]) {
  if (actual !== expected) throw new Error(`Expected ${expected} ${label}, got ${actual}`)
}

const recordIds = new Set()
for (const row of rows) {
  if (!row.recordId || recordIds.has(row.recordId)) throw new Error(`Missing or duplicate standard record ID: ${row.recordId ?? '(missing)'}`)
  recordIds.add(row.recordId)
  if (!Number.isInteger(row.periodSequence) || row.periodSequence < 1) throw new Error(`${row.recordId}: invalid period sequence`)
  if (!['content', 'performance'].includes(row.standardType)) throw new Error(`${row.recordId}: unsupported standard type ${row.standardType}`)
  if (!row.standardText?.trim()) throw new Error(`${row.recordId}: standard text cannot be empty`)
  if (!Number.isInteger(row.sortOrder) || row.sortOrder < 1) throw new Error(`${row.recordId}: invalid sort order`)
  if (!Number.isInteger(row.sourcePage) || row.sourcePage < 1) throw new Error(`${row.recordId}: invalid source page`)
}

for (const manifest of manifests) {
  if (manifest.verification?.status !== 'verified') throw new Error(`${manifest.slug}: manifest is not verified`)
  if (manifest.verification?.standardsCoverage?.status !== 'verified' || manifest.verification?.standardsCoverage?.sourcePinned !== true) {
    throw new Error(`${manifest.slug}: standards are not source-pinned and verified`)
  }
  const domainCodes = new Set(manifest.domains.map((domain) => domain.code))
  const periodSequences = new Set(manifest.periods.map((period) => period.sequence))
  for (const standard of manifest.standards) {
    if (!periodSequences.has(standard.quarter)) throw new Error(`${standard.recordId}: period is absent from its manifest`)
    if (standard.domain !== null && standard.domain !== undefined && !domainCodes.has(standard.domain)) {
      throw new Error(`${standard.recordId}: domain is absent from its manifest`)
    }
  }
}

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

const lines = [
  '-- Exact, source-pinned curriculum standards expansion.',
  '-- Generated from verified official manifests; do not hand-edit.',
  `-- Payload SHA-256: ${payloadHash}`,
  `-- Scope: ${EXPECTED.manifests} manifests, ${EXPECTED.standards} standards (${EXPECTED.content} content, ${EXPECTED.performance} performance).`,
  '-- This migration inserts standards only. Competencies and historical curriculum snapshots remain untouched.',
  'begin;',
  '',
  'create temporary table _verified_standard_manifests (',
  '  manifest_slug text primary key,',
  '  curriculum_code text not null,',
  '  grade_level text not null,',
  '  subject_name text not null,',
  '  source_url text not null',
  ') on commit drop;',
  '',
  'insert into _verified_standard_manifests (manifest_slug, curriculum_code, grade_level, subject_name, source_url)',
  'values',
]

manifests.forEach((manifest, index) => {
  const suffix = index === manifests.length - 1 ? ';' : ','
  lines.push(`  (${quote(manifest.slug)}, ${quote(manifest.curriculumVersion.code)}, ${quote(manifest.subject.gradeLevel)}, ${quote(manifest.subject.name)}, ${quote(manifest.source.sourceUrl)})${suffix}`)
})

lines.push(
  '',
  'create temporary table _verified_curriculum_standards (',
  '  record_id text primary key,',
  '  manifest_slug text not null references _verified_standard_manifests(manifest_slug),',
  '  academic_period_sequence integer not null,',
  '  domain_code text,',
  "  standard_type text not null check (standard_type in ('content', 'performance')),",
  '  standard_text text not null,',
  '  sort_order integer not null,',
  '  source_page integer not null',
  ') on commit drop;',
  '',
  'insert into _verified_curriculum_standards (record_id, manifest_slug, academic_period_sequence, domain_code, standard_type, standard_text, sort_order, source_page)',
  'values',
)

rows.forEach((row, index) => {
  const suffix = index === rows.length - 1 ? ';' : ','
  lines.push(`  (${quote(row.recordId)}, ${quote(row.manifestSlug)}, ${row.periodSequence}, ${quote(row.domainCode)}, ${quote(row.standardType)}, ${quote(row.standardText)}, ${row.sortOrder}, ${row.sourcePage})${suffix}`)
})

lines.push(
  '',
  '-- Fail closed if migration 030 did not create every pinned relational target exactly once.',
  'do $$',
  'declare',
  '  resolved_rows integer;',
  'begin',
  '  select count(*) into resolved_rows',
  '  from _verified_curriculum_standards staged',
  '  join _verified_standard_manifests manifest on manifest.manifest_slug = staged.manifest_slug',
  '  join public.curriculum_versions cv on cv.code = manifest.curriculum_code',
  '  join public.curriculum_subjects cs',
  '    on cs.curriculum_version_id = cv.id',
  '   and cs.grade_level = manifest.grade_level',
  '   and cs.name = manifest.subject_name',
  '  join public.source_documents sd on sd.source_url = manifest.source_url',
  '  join public.academic_periods ap',
  '    on ap.subject_id = cs.id',
  '   and ap.sequence = staged.academic_period_sequence',
  '  left join public.curriculum_domains cd',
  '    on staged.domain_code is not null',
  '   and cd.subject_id = cs.id',
  '   and cd.code = staged.domain_code',
  '  where staged.domain_code is null or cd.id is not null;',
  '',
  `  if resolved_rows <> ${EXPECTED.standards} then`,
  `    raise exception 'Verified curriculum standards resolved % of ${EXPECTED.standards} relational targets', resolved_rows;`,
  '  end if;',
  'end;',
  '$$;',
  '',
  'insert into public.curriculum_standards (',
  '  subject_id,',
  '  domain_id,',
  '  academic_period_id,',
  '  standard_type,',
  '  standard_text,',
  '  sort_order,',
  '  source_document_id,',
  '  source_page',
  ')',
  'select',
  '  cs.id,',
  '  cd.id,',
  '  ap.id,',
  '  staged.standard_type,',
  '  staged.standard_text,',
  '  staged.sort_order,',
  '  sd.id,',
  '  staged.source_page',
  'from _verified_curriculum_standards staged',
  'join _verified_standard_manifests manifest on manifest.manifest_slug = staged.manifest_slug',
  'join public.curriculum_versions cv on cv.code = manifest.curriculum_code',
  'join public.curriculum_subjects cs',
  '  on cs.curriculum_version_id = cv.id',
  ' and cs.grade_level = manifest.grade_level',
  ' and cs.name = manifest.subject_name',
  'join public.source_documents sd on sd.source_url = manifest.source_url',
  'join public.academic_periods ap',
  '  on ap.subject_id = cs.id',
  ' and ap.sequence = staged.academic_period_sequence',
  'left join public.curriculum_domains cd',
  '  on staged.domain_code is not null',
  ' and cd.subject_id = cs.id',
  ' and cd.code = staged.domain_code',
  'where not exists (',
  '  select 1',
  '  from public.curriculum_standards existing',
  '  where existing.subject_id = cs.id',
  '    and existing.domain_id is not distinct from cd.id',
  '    and existing.academic_period_id = ap.id',
  '    and existing.standard_type = staged.standard_type',
  '    and existing.standard_text = staged.standard_text',
  '    and existing.sort_order = staged.sort_order',
  '    and existing.source_document_id = sd.id',
  '    and existing.source_page = staged.source_page',
  ');',
  '',
  '-- Prove that every staged source record now has one exact relational representation.',
  'do $$',
  'declare',
  '  resolved_rows integer;',
  'begin',
  '  select count(*) into resolved_rows',
  '  from _verified_curriculum_standards staged',
  '  join _verified_standard_manifests manifest on manifest.manifest_slug = staged.manifest_slug',
  '  join public.curriculum_versions cv on cv.code = manifest.curriculum_code',
  '  join public.curriculum_subjects cs',
  '    on cs.curriculum_version_id = cv.id',
  '   and cs.grade_level = manifest.grade_level',
  '   and cs.name = manifest.subject_name',
  '  join public.source_documents sd on sd.source_url = manifest.source_url',
  '  join public.academic_periods ap',
  '    on ap.subject_id = cs.id',
  '   and ap.sequence = staged.academic_period_sequence',
  '  left join public.curriculum_domains cd',
  '    on staged.domain_code is not null',
  '   and cd.subject_id = cs.id',
  '   and cd.code = staged.domain_code',
  '  join public.curriculum_standards stored',
  '    on stored.subject_id = cs.id',
  '   and stored.domain_id is not distinct from cd.id',
  '   and stored.academic_period_id = ap.id',
  '   and stored.standard_type = staged.standard_type',
  '   and stored.standard_text = staged.standard_text',
  '   and stored.sort_order = staged.sort_order',
  '   and stored.source_document_id = sd.id',
  '   and stored.source_page = staged.source_page;',
  '',
  `  if resolved_rows <> ${EXPECTED.standards} then`,
  `    raise exception 'Verified curriculum standards persisted % of ${EXPECTED.standards} exact records', resolved_rows;`,
  '  end if;',
  'end;',
  '$$;',
  '',
  'commit;',
  '',
)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, lines.join('\n'), 'utf8')
console.log(`Generated ${outputPath} from ${EXPECTED.manifests} manifests and ${EXPECTED.standards} verified standards (${payloadHash}).`)
