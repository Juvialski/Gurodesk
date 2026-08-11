import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

async function load(file, replacements = []) {
  let source = read(file)
  let output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, removeComments: false },
  }).outputText
  if (output.includes("from './assessmentVisualPlanning'")) {
    const mathOutput = ts.transpileModule(read('src/lib/assessmentMathText.ts'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, removeComments: false },
    }).outputText
    const mathUrl = `data:text/javascript;base64,${Buffer.from(mathOutput).toString('base64')}`
    let planningOutput = ts.transpileModule(read('src/lib/assessmentVisualPlanning.ts'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, removeComments: false },
    }).outputText
    planningOutput = planningOutput.replace("from './assessmentMathText'", `from '${mathUrl}'`)
    const planningUrl = `data:text/javascript;base64,${Buffer.from(planningOutput).toString('base64')}`
    output = output.replace("from './assessmentVisualPlanning'", `from '${planningUrl}'`)
  }
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement)
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const blueprint = await load('src/lib/assessmentBlueprint.ts')
const validation = await load('src/lib/assessmentValidation.ts')
const scoring = await load('src/lib/assessmentScoring.ts')
const distribution = await load('src/lib/assessmentDistribution.ts')
globalThis.__phase44Scoring = scoring
const lifecycle = await load('src/lib/assessmentItemLifecycle.ts', [
  [/import \{ normalizeItemPoints \} from ['"]\.\/assessmentScoring['"];?/g, `const { normalizeItemPoints } = globalThis.__phase44Scoring;`],
])

function category(id = 'remember') {
  return { id, label: id === 'remember' ? 'Remembering' : 'Applying', shortLabel: id.slice(0, 2).toUpperCase(), weight: '1', sortOrder: 1 }
}

function makeTos(total) {
  const rows = [{
    id: 'row-1', sortOrder: 1,
    competency: { id: 'comp-1', code: 'C-1', text: 'Use verified evidence', sourcePage: 2, sourceTitle: 'Verified source', sourceUrl: '', academicPeriodId: 'period-1', curriculumPeriodLabel: 'Quarter 1', verificationStatus: 'verified' },
    instructionalMinutes: '60', manualWeight: '', itemCountOverride: '', cognitiveWeights: { remember: '1' }, notes: '', computedWeightPercent: '100.00', itemCount: total, itemStart: 1, itemEnd: total, itemRangeLabel: `1–${total}`,
    cognitiveAllocations: [{ categoryId: 'remember', label: 'Remembering', shortLabel: 'RE', itemCount: total, itemStart: 1, itemEnd: total, rangeLabel: `1–${total}` }],
  }]
  const content = {
    schemaVersion: 1, title: 'Verified TOS', assessmentTitle: 'Quarter Assessment', gradeLevel: '7', learningArea: 'Mathematics', sections: ['A'], schoolYear: '2026–2027', gradingTermId: 'term-1', gradingTermLabel: 'Quarter 1', curriculumVersionId: 'version-1', curriculumVersionCode: 'MATATAG-7', curriculumVersionName: 'MATATAG', curriculumSubjectId: 'subject-1', curriculumPeriodIds: ['period-1'], curriculumPeriodLabels: ['Quarter 1'], sourceTitle: 'Verified source', sourceUrl: '', totalItems: total, weightingMethod: 'equal', cognitiveCategories: [category()], rows, notes: '', calculation: { engine: 'hamilton-largest-remainder-v1', valid: true, totalAllocated: total, calculatedAt: '2026-08-09T00:00:00.000Z', warnings: [] },
  }
  return { id: 'tos-1', userId: 'teacher-1', assignmentId: 'assignment-1', title: 'Verified TOS', schoolYear: content.schoolYear, academicPeriodLabel: 'Quarter 1', status: 'final', content, versionNumber: 1, createdAt: '', updatedAt: '' }
}

const allTypes = ['multiple_choice', 'true_false', 'short_answer', 'constructed_response', 'identification', 'fill_in_the_blank', 'numerical_answer', 'problem_solving', 'matching', 'multiple_select', 'essay']
const answers = {
  multiple_choice: { type: 'multiple_choice', choices: [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Beta' }], choiceId: 'a' },
  true_false: { type: 'true_false', value: true },
  short_answer: { type: 'short_answer', acceptedAnswers: ['verified response'], caseSensitive: false },
  constructed_response: { type: 'constructed_response', expectedResponse: 'A valid expected response', sampleResponse: 'A valid sample response' },
  identification: { type: 'identification', acceptedAnswers: ['nucleus'], caseSensitive: false },
  fill_in_the_blank: { type: 'fill_in_the_blank', blanks: [{ id: 'a', acceptedAnswers: ['nucleus'], pointsPossible: 1 }, { id: 'b', acceptedAnswers: ['DNA'], pointsPossible: 1 }] },
  numerical_answer: { type: 'numerical_answer', value: 24, tolerance: 0.1, unit: 'cm²', requireUnit: true },
  problem_solving: { type: 'problem_solving', finalAnswer: 'x = 7', solutionOutline: 'Substitute and solve.', subparts: [{ id: 'a', prompt: 'Find x.', expectedAnswer: '7', pointsPossible: 2 }, { id: 'b', prompt: 'Explain.', expectedAnswer: 'Show the substitution.', pointsPossible: 3 }] },
  matching: { type: 'matching', prompts: [{ id: 'p1', text: 'One' }, { id: 'p2', text: 'Two' }, { id: 'p3', text: 'Three' }, { id: 'p4', text: 'Four' }, { id: 'p5', text: 'Five' }], choices: [{ id: 'c1', text: 'A' }, { id: 'c2', text: 'B' }, { id: 'c3', text: 'C' }, { id: 'c4', text: 'D' }, { id: 'c5', text: 'E' }, { id: 'c6', text: 'Extra' }], mappings: [{ promptId: 'p1', choiceId: 'c1', pointsPossible: 1 }, { promptId: 'p2', choiceId: 'c2', pointsPossible: 1 }, { promptId: 'p3', choiceId: 'c3', pointsPossible: 1 }, { promptId: 'p4', choiceId: 'c4', pointsPossible: 1 }, { promptId: 'p5', choiceId: 'c5', pointsPossible: 1 }], reusableChoices: false },
  multiple_select: { type: 'multiple_select', choices: [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Beta' }, { id: 'c', text: 'Gamma' }], choiceIds: ['a', 'c'], scoringPolicy: 'all_or_nothing' },
  essay: { type: 'essay', keyPoints: ['evidence', 'reasoning'], rubric: [{ id: 'content', label: 'Content', pointsPossible: 5 }, { id: 'reasoning', label: 'Reasoning', pointsPossible: 5 }, { id: 'clarity', label: 'Clarity', pointsPossible: 5 }] },
}
const points = { multiple_choice: 1, true_false: 1, short_answer: 1, constructed_response: 5, identification: 1, fill_in_the_blank: 2, numerical_answer: 1, problem_solving: 5, matching: 5, multiple_select: 2, essay: 15 }

const base = blueprint.createAssessmentBlueprint(makeTos(32), { now: '2026-08-09T00:00:00.000Z' })
const settings = { mode: 'manual_per_item', allowedTypes: allTypes, defaultPoints: points, targetTotalPoints: 50 }
const mixed = {
  ...base,
  status: 'final',
  totalPoints: 60,
  settings,
  items: base.items.map((item, index) => {
    const type = allTypes[index < allTypes.length ? index : 0]
    const itemPoints = index < allTypes.length ? points[type] : 1
    return { ...item, prompt: `Question ${index + 1}`, questionType: type, answer: answers[type], authorshipState: 'manual', pointsPossible: itemPoints, points: itemPoints, qaState: 'verified' }
  }),
}
assert.deepEqual(new Set(mixed.items.slice(0, 11).map((item) => item.questionType)).size, 11)
assert.equal(scoring.assessmentTotalPoints(mixed), 60, '32 item slots can derive 60 points')
assert.equal(validation.validateAssessmentFinal(mixed).ready, true)
assert.equal(scoring.assessmentPointDelta(mixed, 50), -10)

const fixed = distribution.allocateQuestionTypes(40, { mode: 'fixed_counts', allowedTypes: ['multiple_choice', 'essay'], counts: { multiple_choice: 20, essay: 2 }, defaultPoints: {}, targetTotalPoints: null })
assert.equal(fixed.types.length, 40)
assert.equal((fixed.counts.multiple_choice ?? 0) + (fixed.counts.essay ?? 0), 40)
assert.equal(fixed.reconciled, true)
const percentages = distribution.allocateQuestionTypes(40, { mode: 'percentages', allowedTypes: ['multiple_choice', 'essay'], percentages: { multiple_choice: 75, essay: 25 }, defaultPoints: {}, targetTotalPoints: null })
assert.deepEqual(percentages.counts, { multiple_choice: 30, essay: 10 })
const manual = distribution.applyQuestionTypeDistribution(mixed.items.slice(0, 2), { mode: 'manual_per_item', allowedTypes: ['essay'], defaultPoints: {}, targetTotalPoints: null })
assert.deepEqual(manual.map((item) => item.questionType), mixed.items.slice(0, 2).map((item) => item.questionType))

assert.ok(validation.validateAssessmentFinal({ ...mixed, items: mixed.items.map((item, index) => index === 10 ? { ...item, answer: { ...item.answer, rubric: [{ id: 'wrong', label: 'Wrong', pointsPossible: 1 }] } } : item) }).errors.some((entry) => entry.key === 'structured-answer'))
assert.ok(validation.validateAssessmentFinal({ ...mixed, items: mixed.items.map((item, index) => index === 7 ? { ...item, answer: { ...item.answer, subparts: [{ id: 'a', prompt: 'Find x.', pointsPossible: 4 }] } } : item) }).errors.some((entry) => entry.key === 'structured-answer'))
assert.ok(validation.validateAssessmentFinal({ ...mixed, items: mixed.items.map((item, index) => index === 5 ? { ...item, answer: { ...item.answer, blanks: [{ id: 'a', acceptedAnswers: ['x'], pointsPossible: 1 }] } } : item) }).errors.some((entry) => entry.key === 'structured-answer'))
assert.ok(validation.validateAssessmentFinal({ ...mixed, items: mixed.items.map((item, index) => index === 5 ? { ...item, answer: { ...item.answer, blanks: [{ id: 'a', acceptedAnswers: ['x'], pointsPossible: 2 }, { id: 'b', acceptedAnswers: ['y'] }] } } : item) }).errors.some((entry) => entry.message.includes('every blank')))
assert.ok(validation.validateAssessmentFinal({ ...mixed, items: mixed.items.map((item, index) => index === 8 ? { ...item, answer: { ...item.answer, mappings: [...item.answer.mappings.slice(0, 4), { promptId: 'p5', choiceId: 'c1', pointsPossible: 1 }] } } : item) }).errors.some((entry) => entry.key === 'structured-answer'))
assert.ok(validation.validateAssessmentFinal({ ...mixed, items: mixed.items.map((item, index) => index === 8 ? { ...item, answer: { ...item.answer, mappings: item.answer.mappings.map((mapping, mappingIndex) => mappingIndex === 4 ? { promptId: mapping.promptId, choiceId: mapping.choiceId } : mapping) } } : item) }).errors.some((entry) => entry.message.includes('every scored match')))

const locked = lifecycle.lockAssessmentItem(mixed.items[0])
assert.equal(locked.locked, true)
assert.throws(() => lifecycle.editAssessmentItem(locked, { prompt: 'Blocked' }), /unlocked/)
let historyItem = mixed.items[0]
for (let i = 0; i < 8; i += 1) historyItem = lifecycle.editAssessmentItem(historyItem, { teacherNotes: `note ${i}` })
assert.equal(historyItem.history.length, 5)
const restored = lifecycle.restoreAssessmentItemVersion(historyItem, historyItem.history[0].id)
assert.equal(restored.qaState, 'answer_needs_recheck')

const legacy = structuredClone(mixed)
delete legacy.totalPoints
legacy.items = legacy.items.map((item) => { const copy = { ...item, points: 3 }; delete copy.pointsPossible; return copy })
const normalized = blueprint.normalizeAssessmentBlueprint(legacy)
assert.equal(normalized.items[0].pointsPossible, 3)
assert.equal(normalized.totalPoints, 96)

const migration = read('supabase/migrations/202608090018_phase44_assessment_scoring_qa.sql')
const migration020 = read('supabase/migrations/202608090020_fix_assessment_save_alias_ambiguity.sql')
assert.match(migration, /item_number integer;/, 'the save RPC declares its TOS-loop item number')
assert.match(migration, /security definer\s+set search_path = ''[\s\S]*auth\.uid\(\)/, 'the authoritative save RPC is owner-scoped with a fixed search path')
assert.match(migration, /if has_explicit and \(missing_explicit > 0/, 'server point validation rejects partially specified component scoring')
assert.match(migration, /finalAnswer'[\s\S]{0,500}char_length\(btrim\(p_answer ->> 'finalAnswer'\)\)/, 'server finalization rejects a blank problem-solving final answer')
assert.match(migration, /Assessment save payload is too large/, 'assessment save payloads are bounded server-side')
assert.match(migration, /Assessment item content exceeds the supported save limit/, 'per-item answer and bounded-history payloads are limited server-side')
assert.doesNotMatch(migration, /Final assessment has unresolved question review states/, 'optional AI or teacher-review quality states do not become server-side structural blockers')

assert.match(migration020, /create or replace function public\.save_assessment_document/, 'migration 020 replaces save_assessment_document')
assert.match(migration020, /from public\.assessment_items existing_ai/, 'migration 020 uses disambiguated existing_ai table alias')
assert.match(migration020, /from jsonb_array_elements\(p_items\) incoming_value/, 'migration 020 uses disambiguated incoming_value table alias')
assert.doesNotMatch(migration020, /from public\.assessment_items existing_item/, 'migration 020 prevents reuse of declared variable existing_item as a table alias')
assert.doesNotMatch(migration020, /from jsonb_array_elements\(p_items\) incoming_item/, 'migration 020 prevents reuse of declared variable incoming_item as a table alias')
assert.match(migration020, /security definer[\s\S]*set search_path = ''[\s\S]*auth\.uid\(\)/, 'migration 020 preserves security definer, search_path, and auth.uid()')

console.log('Phase 4.4 domain validation passed: all 11 typed payloads, 32 items/60 points, deterministic distribution reconciliation, structured scoring totals, target delta, invalid component totals, lock/history protection, legacy point normalization, and migration 020 alias ambiguity fix.')
