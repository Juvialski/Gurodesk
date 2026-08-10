import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import ts from 'typescript'

const root = process.cwd()
const read = (file) => readFile(resolve(root, file), 'utf8')
const fail = (message) => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }

const migration = await read('supabase/migrations/202608080013_phase41_assessment_engine.sql')
const auditMigration = await read('supabase/migrations/202608080014_phase42_assessment_ai_audit.sql')
const edge = await read('supabase/functions/assessment-question-generator/index.ts')
const edgeContract = await read('supabase/functions/_shared/assessment-contract.ts')
const generation = await read('src/lib/assessmentGeneration.ts')
const repository = await read('src/lib/assessmentRepository.ts')
const config = await read('supabase/config.toml')

const edgeCompile = ts.transpileModule(edge, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  reportDiagnostics: true,
})
assert((edgeCompile.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error).length === 0, 'Assessment generator Edge Function must be syntactically valid TypeScript.')

for (const required of [
  'assessment_documents', 'assessment_items', 'source_tos_content_snapshot', 'source_tos_raw_content_snapshot',
  'assessment_question_type', 'assessment_authorship_state', 'save_assessment_document',
  'assessment_canonical_tos_snapshot', 'guard_assessment_item_mapping', 'Final assessment requires every item',
  'Assessment JSON and relational item projections do not match', 'document_type not in (\'tos\', \'assessment\')',
  'Assessment version history is immutable',
]) assert(migration.includes(required), `Phase 4.1 migration missing ${required}`)
for (const required of [
  'assessment_ai_audit_events', 'assessment_document_id', 'assessment_item_id', 'fallback_used',
  'outcome', 'assessment_ai_audit_select_own', 'assessment_ai_audit_owner_guard',
]) assert(auditMigration.includes(required), `Phase 4.2 audit migration missing ${required}`)
assert(!auditMigration.includes('assessment_item_id uuid not null references'), 'Audit item UUID must survive draft projection replacement.')
assert(config.includes('[functions.assessment-question-generator]') && config.includes('verify_jwt = true'), 'Assessment generator JWT config is missing.')
for (const required of ['assessmentId', 'itemId', 'teacherContext', 'getUser()', 'assessment_items', 'teacher_lesson_preferences', 'teacher_ai_credentials', 'decryptCredential', 'callWithLiteFallback', 'source_tos_content_snapshot', 'questionType', 'referencedResources', 'approvedResources', 'DO_s2026_015r.pdf']) assert(edge.includes(required), `Generator Edge Function missing ${required}`)
assert(!edge.includes('callGeminiWithDiscoveredFallback'), 'Abandoned Gemini model-discovery fallback must not be reintroduced.')
for (const forbidden of ['GEMINI_API_KEY', 'api_key_ciphertext.*return', 'learner_data']) assert(!edge.includes(forbidden), `Generator contains forbidden ${forbidden}`)
for (const required of ['validateAssessmentCandidate', 'parseAndValidateAssessmentCandidate', 'validateAssessmentFinal', 'generateAssessmentItemSuggestion', 'generateMissingAssessmentItems', 'concurrency ?? 2', 'Math.min(3', 'attempt <= 3', 'applyAssessmentItemCandidate', 'demo-local-preview']) assert(generation.includes(required), `Generation client missing ${required}`)
for (const required of ['canonicalizeFinalTosForProduction', 'tos_competencies', 'curriculum_competencies', 'createAssessmentBlueprint']) assert(repository.includes(required), `Repository canonical-source guard missing ${required}`)

// Bundle the pure client validator so these checks exercise the shipped parser,
// rather than a second test-only implementation.
const bundled = await build({
  entryPoints: [resolve(root, 'src/lib/assessmentGeneration.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': 'undefined',
  },
})
const tempUrl = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
const generationModule = await import(tempUrl)

const valid = {
  questionType: 'multiple_choice',
  prompt: 'Which option demonstrates the target competency?',
  answer: { type: 'multiple_choice', choices: [{ id: 'A', text: 'First option' }, { id: 'B', text: 'Second option' }], choiceId: 'A' },
  rationale: 'The teacher can review this alignment.',
  referencedResources: ['Teacher handout'],
}
assert(generationModule.validateAssessmentCandidate(valid, 'multiple_choice', ['Teacher handout']).answer.choiceId === 'A', 'Valid structured candidate was rejected.')
for (const [candidate, label] of [
  ['{', 'malformed JSON'],
  [{ ...valid, answer: { type: 'multiple_choice', choices: [], choiceId: '' } }, 'missing choices'],
  [{ ...valid, answer: { type: 'multiple_choice', choices: valid.answer.choices, choiceId: 'Z' } }, 'invalid answer'],
  [{ ...valid, referencedResources: ['Unlisted book'] }, 'unlisted resource'],
  [{ ...valid, prompt: 'Use the invented textbook to answer this question.', referencedResources: [] }, 'invented named resource'],
  [{ ...valid, answer: { ...valid.answer, choices: [{ id: 'A', text: 'See Teacher handout page 99' }, { id: 'B', text: 'Second option' }] } }, 'invented page in answer content'],
]) {
  let rejected = false
  try { generationModule.validateAssessmentCandidate(candidate, 'multiple_choice', ['Teacher handout']) } catch { rejected = true }
  assert(rejected, `${label} was not rejected.`)
}
const languagePrompt = await read('supabase/functions/assessment-question-generator/index.ts')
assert(languagePrompt.includes('language_preference') && languagePrompt.includes('English-Filipino') && languagePrompt.includes('Do not translate existing teacher content'), 'Language preference was not transmitted/guarded in the generator prompt.')

const item = {
  id: 'item-1', itemNumber: 1,
  competencySnapshot: { id: 'comp', code: null, text: 'Target', sourcePage: null, academicPeriodId: null, curriculumPeriodId: null, curriculumPeriodLabel: '' },
  cognitiveCategorySnapshot: { id: 'remembering', label: 'Remembering', shortLabel: 'R' },
  mapping: { rowId: 'row-1', competencyId: 'comp', cognitiveCategoryId: 'remembering', allocationItemStart: 1, allocationItemEnd: 1, allocationIndex: 0 },
  prompt: '', questionType: 'multiple_choice', answer: { type: 'multiple_choice', choices: [], choiceId: '' }, authorshipState: 'empty', rationale: '', teacherNotes: '', points: 1,
}
const applied = generationModule.applyAssessmentItemCandidate(item, valid, { teacherResources: ['Teacher handout'] })
assert(applied.itemNumber === 1 && applied.mapping.rowId === 'row-1' && applied.competencySnapshot.id === 'comp' && applied.cognitiveCategorySnapshot.id === 'remembering', 'Candidate application changed immutable mapping fields.')
assert(applied.authorshipState === 'ai_suggestion', 'Candidate application did not mark an AI suggestion.')
let overwriteRejected = false
try { generationModule.applyAssessmentItemCandidate({ ...applied, authorshipState: 'manual' }, valid) } catch { overwriteRejected = true }
assert(overwriteRejected, 'Manual/accepted content overwrite was not refused without alternative.')

// Batch architecture is intentionally static-checked for bounded workers,
// finite retries, cancellation, and callback preservation.  Demo mode is then
// exercised for a successful item so the deterministic path remains testable.
const item2 = { ...item, id: 'item-2', itemNumber: 2, mapping: { ...item.mapping, allocationItemStart: 2, allocationItemEnd: 2 } }
const assessment = { id: 'assessment-1', userId: 'teacher-1', assignmentId: null, title: 'Test', instructions: '', gradeLevel: '7', learningArea: 'Mathematics', schoolYear: '2026-2027', gradingTermId: '', gradingTermLabel: '', curriculumPeriodIds: [], curriculumPeriodLabels: [], totalItems: 2, versionNumber: 1, status: 'draft', sourceTos: { id: 'tos-1', versionNumber: 1, title: 'TOS', status: 'final', assignmentId: null, schoolYear: '2026-2027', academicPeriodLabel: null, content: {} }, items: [item, item2], createdAt: '', updatedAt: '' }
const successes = []
const summary = await generationModule.generateMissingAssessmentItems({ assessment, demo: true, onItem: (value) => successes.push(value), concurrency: 9, generate: async ({ item: current }) => {
  if (current.id === 'item-2') throw new Error('deterministic item failure')
  return { assessmentId: assessment.id, itemId: current.id, questionType: current.questionType, candidate: valid, approvedResources: ['Teacher handout'], model: 'test-hook', fallbackUsed: false, editable: true }
} })
assert(summary.succeeded === 1 && successes.length === 1 && summary.failed === 1 && summary.results.length === 1, 'Batch partial failure did not preserve the successful item.')
assert(generation.includes('Promise.all(Array.from({ length: concurrency }'))
assert(generation.includes('attempt <= 3') && generation.includes('signal?.aborted') && generation.includes('onItem?.(applied)'), 'Batch retry/cancel/success architecture is incomplete.')
assert(migration.includes("coalesce(current_setting('app.assessment_rpc', true), '') = '1'") && migration.includes("coalesce(current_setting('app.assessment_duplicate_rpc', true), '') <> '1'"), 'Assessment RPC guards must not be nullable auth bypasses.')
assert(migration.includes("jsonb_set(item_value, '{id}', to_jsonb(gen_random_uuid()::text), true)"), 'Assessment duplication must allocate fresh item UUIDs.')
assert(repository.includes('projectionError') && repository.includes('canonicalizeFinalTosForProduction') && repository.includes("academicPeriodId: period"), 'Production TOS canonicalization regression guard is missing.')
assert(migration.includes('Existing assessment item UUIDs are stable and cannot change on draft save'), 'Stable item-ID pre-delete guard is missing.')
assert(migration.includes("jsonb_typeof(p_answer -> 'caseSensitive') is distinct from 'boolean'"), 'SQL short-answer caseSensitive boolean guard is missing.')
assert(migration.includes("if new.status = 'archived'") && migration.includes("raise exception 'Archiving cannot modify assessment content or identity'") && migration.includes("if new.status not in ('draft', 'final')"), 'Draft/final archiving must be an unchanged-payload transition, separate from editable save states.')
assert(edge.includes('Grade level (server-verified)') && edge.includes('Learning area (server-verified)'), 'Generator prompt must include server-derived grade and learning area.')
assert(edge.includes('validateAssessmentCandidateContract') && edgeContract.includes('unverifiedResource') && generation.includes('namedResourceOrLocalFact'), 'Both server and client validators must reject unverified named resources, devices, and local facts.')

console.log('✓ Phase 4.1 assessment persistence, immutable snapshots, RPC/RLS/version guards present')
console.log('✓ Phase 4.2 candidate parser rejects malformed JSON, missing choices, invalid answers, and unlisted resources')
console.log('✓ Mapping snapshots remain immutable when candidates are applied')
console.log('✓ Batch generation is capped, finite-retry, cancellable, and callback-safe')
console.log('✓ Authenticated Edge Function, server-owned BYOK/preferences, language guardrails, audit/config checks present')
