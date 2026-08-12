import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('Usage: node scripts/generate-curriculum-sql.mjs <manifest.json> <output.sql>')
  process.exit(2)
}

const manifest = JSON.parse(await readFile(resolve(input), 'utf8'))
if (manifest.verification?.status !== 'verified') {
  throw new Error('Refusing to generate SQL from a manifest that is not verified.')
}

const q = (value) => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const n = (value) => Number(value)
const sourceUrl = q(manifest.source.sourceUrl)
const versionCode = q(manifest.curriculumVersion.code)
const gradeLevel = q(manifest.subject.gradeLevel)
const subjectName = q(manifest.subject.name)
const standards = Array.isArray(manifest.standards)
  ? manifest.standards
  : (manifest.performanceStandards ?? []).map((standard) => ({ ...standard, type: 'performance', domain: null, sortOrder: standard.sortOrder ?? standard.quarter }))

const lines = []
lines.push(`-- Generated from ${basename(input)}. Do not hand-edit; update the verified manifest and regenerate.`)
lines.push('begin;')
lines.push('')
lines.push(`insert into public.source_documents (source_type, title, issuance_code, source_url, published_on, publisher, retrieved_on, content_hash, verification_status)\nvalues (${q(manifest.source.sourceType)}, ${q(manifest.source.title)}, ${q(manifest.source.issuanceCode)}, ${sourceUrl}, ${q(manifest.source.publishedOn)}, ${q(manifest.source.publisher)}, ${q(manifest.verification.verifiedOn)}, ${q(manifest.source.sha256)}, 'verified')\non conflict (source_url) where source_url is not null do update set\n  title = excluded.title,\n  issuance_code = excluded.issuance_code,\n  published_on = excluded.published_on,\n  publisher = excluded.publisher,\n  retrieved_on = excluded.retrieved_on,\n  content_hash = excluded.content_hash,\n  verification_status = 'verified',\n  updated_at = timezone('utc', now());`)
lines.push('')
lines.push(`insert into public.curriculum_versions (code, name, framework, effective_from_school_year, effective_to_school_year, status, implementation_notes)\nvalues (${versionCode}, ${q(manifest.curriculumVersion.name)}, ${q(manifest.curriculumVersion.framework)}, ${q(manifest.curriculumVersion.effectiveFromSchoolYear)}, ${q(manifest.curriculumVersion.effectiveToSchoolYear)}, ${q(manifest.curriculumVersion.status)}, ${q(manifest.curriculumVersion.implementationNotes)})\non conflict (code) do update set\n  name = excluded.name,\n  framework = excluded.framework,\n  effective_from_school_year = excluded.effective_from_school_year,\n  effective_to_school_year = excluded.effective_to_school_year,\n  status = excluded.status,\n  implementation_notes = excluded.implementation_notes,\n  updated_at = timezone('utc', now());`)
lines.push('')

for (const item of manifest.applicability) {
  lines.push(`insert into public.curriculum_applicability (curriculum_version_id, school_year, grade_level, implementation_status, priority, notes)\nselect cv.id, ${q(item.schoolYear)}, ${q(item.gradeLevel)}, ${q(item.implementationStatus)}, ${n(item.priority ?? 100)}, ${q(item.notes)}\nfrom public.curriculum_versions cv where cv.code = ${versionCode}\non conflict (curriculum_version_id, school_year, grade_level, implementation_status) do update set\n  priority = excluded.priority,\n  notes = excluded.notes;`)
  lines.push('')
}

lines.push(`insert into public.curriculum_subjects (curriculum_version_id, grade_level, code, name, description, source_document_id)\nselect cv.id, ${gradeLevel}, ${q(manifest.subject.code)}, ${subjectName}, ${q(manifest.subject.description)}, sd.id\nfrom public.curriculum_versions cv\njoin public.source_documents sd on sd.source_url = ${sourceUrl}\nwhere cv.code = ${versionCode}\non conflict (curriculum_version_id, grade_level, name) do update set\n  code = excluded.code,\n  description = excluded.description,\n  source_document_id = excluded.source_document_id,\n  updated_at = timezone('utc', now());`)
lines.push('')

for (const period of manifest.periods) {
  lines.push(`insert into public.academic_periods (curriculum_version_id, subject_id, label, sequence, period_type, grade_min, grade_max)\nselect cv.id, cs.id, ${q(period.label)}, ${n(period.sequence)}, ${q(period.periodType)}, ${Number(String(manifest.subject.gradeLevel).replace(/\D/g, '')) || 'null'}, ${Number(String(manifest.subject.gradeLevel).replace(/\D/g, '')) || 'null'}\nfrom public.curriculum_versions cv\njoin public.curriculum_subjects cs on cs.curriculum_version_id = cv.id and cs.grade_level = ${gradeLevel} and cs.name = ${subjectName}\nwhere cv.code = ${versionCode}\non conflict (subject_id, label) where subject_id is not null do update set\n  sequence = excluded.sequence,\n  period_type = excluded.period_type,\n  grade_min = excluded.grade_min,\n  grade_max = excluded.grade_max;`)
  lines.push('')
}

for (const domain of manifest.domains) {
  lines.push(`insert into public.curriculum_domains (subject_id, code, name, sort_order)\nselect cs.id, ${q(domain.code)}, ${q(domain.name)}, ${n(domain.sortOrder)}\nfrom public.curriculum_subjects cs\njoin public.curriculum_versions cv on cv.id = cs.curriculum_version_id\nwhere cv.code = ${versionCode} and cs.grade_level = ${gradeLevel} and cs.name = ${subjectName}\non conflict (subject_id, name) do update set\n  code = excluded.code,\n  sort_order = excluded.sort_order;`)
  lines.push('')
}

lines.push(`delete from public.curriculum_standards\nwhere subject_id = (select cs.id from public.curriculum_subjects cs join public.curriculum_versions cv on cv.id = cs.curriculum_version_id where cv.code = ${versionCode} and cs.grade_level = ${gradeLevel} and cs.name = ${subjectName})\n  and source_document_id = (select id from public.source_documents where source_url = ${sourceUrl});`)
lines.push('')
for (const standard of standards) {
  const domainJoin = standard.domain
    ? `join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = ${q(standard.domain)}\n`
    : ''
  const domainValue = standard.domain ? 'cd.id' : 'null'
  lines.push(`insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)\nselect cs.id, ${domainValue}, ap.id, ${q(standard.type)}, ${q(standard.text)}, ${n(standard.sortOrder ?? standard.quarter)}, sd.id, ${n(standard.sourcePage)}\nfrom public.curriculum_subjects cs\njoin public.curriculum_versions cv on cv.id = cs.curriculum_version_id\n${domainJoin}join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = ${n(standard.quarter)}\njoin public.source_documents sd on sd.source_url = ${sourceUrl}\nwhere cv.code = ${versionCode} and cs.grade_level = ${gradeLevel} and cs.name = ${subjectName};`)
  lines.push('')
}

for (const competency of manifest.competencies) {
  lines.push(`update public.curriculum_competencies cc\nset domain_id = cd.id,\n  competency_code = ${q(competency.competencyCode)},\n  competency_text = ${q(competency.text)},\n  source_page = ${n(competency.sourcePage)},\n  verification_status = 'verified',\n  updated_at = timezone('utc', now())\nfrom public.curriculum_subjects cs\njoin public.curriculum_versions cv on cv.id = cs.curriculum_version_id\njoin public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = ${q(competency.domain)}\njoin public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = ${n(competency.quarter)}\njoin public.source_documents sd on sd.source_url = ${sourceUrl}\nwhere cv.code = ${versionCode}\n  and cs.grade_level = ${gradeLevel}\n  and cs.name = ${subjectName}\n  and cc.subject_id = cs.id\n  and cc.academic_period_id = ap.id\n  and cc.source_document_id = sd.id\n  and cc.sort_order = ${n(competency.sortOrder)};`)
  lines.push('')
  lines.push(`insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)\nselect cs.id, cd.id, ap.id, ${q(competency.competencyCode)}, ${q(competency.text)}, ${n(competency.sortOrder)}, sd.id, ${n(competency.sourcePage)}, 'verified'\nfrom public.curriculum_subjects cs\njoin public.curriculum_versions cv on cv.id = cs.curriculum_version_id\njoin public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = ${q(competency.domain)}\njoin public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = ${n(competency.quarter)}\njoin public.source_documents sd on sd.source_url = ${sourceUrl}\nwhere cv.code = ${versionCode} and cs.grade_level = ${gradeLevel} and cs.name = ${subjectName}\n  and not exists (\n    select 1 from public.curriculum_competencies cc\n    where cc.subject_id = cs.id\n      and cc.academic_period_id = ap.id\n      and cc.source_document_id = sd.id\n      and cc.sort_order = ${n(competency.sortOrder)}\n  );`)
  lines.push('')
}

const competencyOrdersByPeriod = new Map()
for (const competency of manifest.competencies) {
  const orders = competencyOrdersByPeriod.get(competency.quarter) ?? []
  orders.push(competency.sortOrder)
  competencyOrdersByPeriod.set(competency.quarter, orders)
}
const expectedCompetencyRows = [...competencyOrdersByPeriod.entries()]
  .map(([period, orders]) => `(ap.sequence = ${n(period)} and cc.sort_order in (${orders.map(n).join(', ')}))`)
  .join(' or ')
lines.push(`delete from public.curriculum_competencies cc\nusing public.curriculum_subjects cs, public.curriculum_versions cv, public.academic_periods ap, public.source_documents sd\nwhere cs.curriculum_version_id = cv.id\n  and ap.subject_id = cs.id\n  and sd.source_url = ${sourceUrl}\n  and cv.code = ${versionCode}\n  and cs.grade_level = ${gradeLevel}\n  and cs.name = ${subjectName}\n  and cc.subject_id = cs.id\n  and cc.academic_period_id = ap.id\n  and cc.source_document_id = sd.id\n  and not (${expectedCompetencyRows});`)
lines.push('')

lines.push('commit;')
lines.push('')
await writeFile(resolve(output), lines.join('\n'), 'utf8')
console.log(`Generated ${output} with ${manifest.competencies.length} competencies and ${standards.length} standards.`)
