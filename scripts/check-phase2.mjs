import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const root = process.cwd()
const read = (file) => readFile(resolve(root, file), 'utf8')
const fail = (message) => { throw new Error(message) }

const manifest = JSON.parse(await read('data/curriculum/official/revised-k10-grade-7-mathematics.json'))
if (manifest.verification?.status !== 'verified') fail('Grade 7 Mathematics manifest is not verified.')
if (manifest.competencies?.length !== 52) fail(`Expected 52 Grade 7 Mathematics competencies; found ${manifest.competencies?.length ?? 0}.`)
if (manifest.periods?.length !== 4 || manifest.periods.some((item) => item.periodType !== 'quarter')) {
  fail('Grade 7 Mathematics must preserve four quarter-based curriculum-guide periods.')
}
if (!manifest.source?.landingPageUrl?.includes('.deped.gov.ph/')) fail('Curriculum source must retain an official DepEd landing page.')
if (!['depedph-my.sharepoint.com', 'drive.google.com', 'deped.gov.ph'].some((host) => new URL(manifest.source.sourceUrl).hostname.endsWith(host))) {
  fail('Curriculum source file URL must use a trusted official/institutional host.')
}

const phase2 = await read('supabase/migrations/202608080002_phase2_curriculum_engine.sql')
for (const required of ['curriculum_applicability', 'school_year_calendars', 'grading_periods', 'subject_id']) {
  if (!phase2.includes(required)) fail(`Phase 2 migration is missing ${required}.`)
}
if (!phase2.includes('drop constraint if exists academic_periods_curriculum_version_id_label_grade_min_grade_max_key')) {
  fail('Phase 2 migration does not replace the Phase 1 academic-period uniqueness rule.')
}

const pacing = await read('supabase/migrations/202608080004_phase2_pacing_foundation.sql')
for (const required of ['instructional_pacing_plans', 'instructional_pacing_entries', 'grading_period_id', 'competency_id']) {
  if (!pacing.includes(required)) fail(`Pacing migration is missing ${required}.`)
}

const seedMigration = await read('supabase/migrations/202608080003_seed_g7_mathematics.sql')
if ((seedMigration.match(/insert into public\.curriculum_competencies/g) ?? []).length !== 52) fail('Legacy Grade 7 seed migration must retain its 52 competency inserts.')
const completeSeed = await read('supabase/seeds/official-curriculum-complete.sql')
if ((completeSeed.match(/^insert into public\.curriculum_competencies /gmu) ?? []).length !== 6181) fail('Complete official seed must contain 6,181 competency inserts.')
if (!completeSeed.includes('MATATAG-Mathematics-CG-Grades1-4-and-7.pdf') || !completeSeed.includes(manifest.source.sourceUrl)) {
  fail('Complete official seed is missing legacy Grade 7 source compatibility.')
}

const packageJson = JSON.parse(await read('package.json'))
if (!['0.2.0', '0.3.0', '0.3.1', '0.3.5', '0.3.6', '0.3.7', '0.3.8', '0.3.9', '0.3.10', '0.3.11', '0.4.0', '0.5.0'].includes(packageJson.version)) fail(`Expected Phase 2+ package version; found ${packageJson.version}.`)

async function sourceFiles(dir) {
  const out = []
  for (const entry of await readdir(resolve(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...await sourceFiles(rel))
    else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) out.push(rel)
  }
  return out
}

for (const file of await sourceFiles('src')) {
  const text = await read(file)
  if (text.includes('GEMINI_API_KEY')) fail(`Browser source ${file} references GEMINI_API_KEY.`)
  if (text.includes('service_role')) fail(`Browser source ${file} references a Supabase service-role credential.`)
}

console.log('✓ Phase 2 architecture checks passed')
console.log('✓ 52 verified Grade 7 Mathematics competencies')
console.log('✓ curriculum quarters, grading terms, and instructional pacing remain separate')
console.log('✓ legacy Grade 7 identities are preserved by the complete official seed')
console.log('✓ browser source contains no Gemini/service-role secret reference')
