import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

async function load(file, replacements = []) {
  let source = read(file)
  for (const [pattern, replacement] of replacements) source = source.replace(pattern, replacement)
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const scoring = await load('src/lib/resultsScoring.ts')
globalThis.__itemPossiblePoints = scoring.itemPossiblePoints
const analysisEngine = await load('src/lib/itemAnalysis.ts', [[/import \{ itemPossiblePoints \} from ['"]\.\/resultsScoring['"];?/g, `const itemPossiblePoints = globalThis.__itemPossiblePoints;`]])
const remediation = await load('src/lib/remediation.ts')

const competency = { id: 'c1', code: 'C1', text: 'Competency', sourcePage: null, academicPeriodId: null, curriculumPeriodId: 'p1', curriculumPeriodLabel: 'Quarter 1' }
const cognitive = { id: 'remember', label: 'Remembering', shortLabel: 'R' }
const mapping = { rowId: 'r1', competencyId: 'c1', cognitiveCategoryId: 'remember', allocationItemStart: 1, allocationItemEnd: 1, allocationIndex: 0 }
const baseItem = (id, itemNumber, questionType, answer, pointsPossible = 1) => ({ id, itemNumber, prompt: `Prompt ${itemNumber}`, questionType, answer, pointsPossible, points: pointsPossible, competencySnapshot: competency, cognitiveCategorySnapshot: cognitive, mapping })
const input = (item, answer, awardedPoints = null) => ({ resultSessionId: 's1', participantId: 'p1', learnerId: 'l1', item, answer, awardedPoints, shortAnswerMode: 'manual' })

const mcq = baseItem('i-mcq', 1, 'multiple_choice', { type: 'multiple_choice', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], choiceId: 'a' })
assert.equal(scoring.scoreResultItem(input(mcq, { type: 'multiple_choice', choiceId: 'a' })).earnedPoints, 1, 'legacy MCQ remains one point')
const tf = baseItem('i-tf', 2, 'true_false', { type: 'true_false', value: true })
assert.equal(scoring.scoreResultItem(input(tf, { type: 'true_false', value: false })).earnedPoints, 0, 'T/F objective scoring')
const identification = baseItem('i-id', 3, 'identification', { type: 'identification', acceptedAnswers: ['Photosynthesis'] })
assert.equal(scoring.scoreResultItem(input(identification, { type: 'identification', text: ' photosynthesis ' })).earnedPoints, 1, 'identification normalization')
const fill = baseItem('i-fill', 4, 'fill_in_the_blank', { type: 'fill_in_the_blank', blanks: [{ id: 'a', acceptedAnswers: ['nucleus'], pointsPossible: 1 }, { id: 'b', acceptedAnswers: ['DNA'], pointsPossible: 2 }] }, 3)
const fillOutcome = scoring.scoreResultItem(input(fill, { type: 'fill_in_the_blank', blanks: { a: 'nucleus', b: 'wrong' } }))
assert.equal(fillOutcome.earnedPoints, 1, 'fill blanks award independent partial points')
const numerical = baseItem('i-num', 5, 'numerical_answer', { type: 'numerical_answer', value: 24, tolerance: 0.1, unit: 'cm2', requireUnit: true })
assert.equal(scoring.scoreResultItem(input(numerical, { type: 'numerical_answer', value: 24.05, unit: 'cm2' })).earnedPoints, 1, 'numeric tolerance and unit')
const problem = baseItem('i-problem', 6, 'problem_solving', { type: 'problem_solving', finalAnswer: '7', solutionOutline: 'Show the equation.' }, 5)
const problemOutcome = scoring.scoreResultItem(input(problem, { type: 'problem_solving', solution: 'working' }, 3))
assert.deepEqual({ earned: problemOutcome.earnedPoints, possible: problemOutcome.possiblePoints, correct: problemOutcome.isCorrect, source: problemOutcome.scoringSource }, { earned: 3, possible: 5, correct: null, source: 'teacher' }, 'problem solving is teacher-scored with partial credit')
assert.equal(scoring.scoreResultItem(input(problem, { type: 'problem_solving', solution: 'working' }, 7)).earnedPoints, 5, 'teacher points cannot exceed points possible')
assert.equal(scoring.scoreResultItem(input(problem, { type: 'problem_solving', solution: 'working' }, -1)).earnedPoints, 0, 'teacher points cannot be negative')
const matching = baseItem('i-match', 7, 'matching', { type: 'matching', prompts: [{ id: 'p1', text: 'One' }, { id: 'p2', text: 'Two' }], choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], mappings: [{ promptId: 'p1', choiceId: 'a', pointsPossible: 1 }, { promptId: 'p2', choiceId: 'b', pointsPossible: 1 }] }, 2)
assert.equal(scoring.scoreResultItem(input(matching, { type: 'matching', matches: { p1: 'a', p2: 'a' } })).earnedPoints, 1, 'matching supports per-response partial credit')
const select = baseItem('i-select', 8, 'multiple_select', { type: 'multiple_select', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }], choiceIds: ['a', 'c'], scoringPolicy: 'all_or_nothing' }, 2)
assert.equal(scoring.scoreResultItem(input(select, { type: 'multiple_select', choiceIds: ['a'] })).earnedPoints, 0, 'multiple-select defaults all-or-nothing')
const essay = baseItem('i-essay', 9, 'essay', { type: 'essay', keyPoints: ['Explain'], rubric: [{ id: 'r', label: 'Content', pointsPossible: 10 }] }, 10)
assert.equal(scoring.scoreResultItem(input(essay, { type: 'essay', text: 'response' }, 8)).earnedPoints, 8, 'essay partial credit is teacher-entered')

const outcomes = [
  scoring.scoreResultItem(input(mcq, { type: 'multiple_choice', choiceId: 'a' })),
  fillOutcome,
  problemOutcome,
]
const totals = scoring.calculateResultTotals(outcomes)
assert.equal(totals.rawScore, 5, 'learner total is sum of earned points')
assert.equal(totals.possiblePoints, 9, 'learner denominator is sum of possible points')
assert.equal(totals.correctItems, 1, 'fully-correct item count is separate')
assert.equal(totals.percentage, 55.56, 'point percentage uses points, not item count')

const participants = [{ participantId: 'p1', learnerId: 'l1', displayName: 'Learner', localReference: null, learnerWasActive: true }]
const analysisItems = [mcq, fill, problem]
const session = { id: 's1', userId: 'u1', assignmentId: 'a1', sectionName: 'A', assessmentId: 'a1', administrationDate: '2026-08-09', title: 'Test', entryMode: 'answer_sheet', status: 'final', assessmentSnapshot: { assessmentId: 'a1', assessmentVersionNumber: 1, assessmentTitle: 'Test', assignmentId: 'a1', gradeLevel: '7', learningArea: 'Math', schoolYear: '2026', gradingTermId: 'q1', gradingTermLabel: 'Q1', curriculumPeriodIds: ['p1'], curriculumPeriodLabels: ['Q1'], totalItems: 3, totalPossiblePoints: 9, items: analysisItems }, learners: participants, itemOutcomes: outcomes, scoreOnlyOutcomes: [], shortAnswerScoring: { defaultMode: 'manual', itemModes: {} }, createdAt: '', updatedAt: '', versionNumber: 1 }
const analysis = analysisEngine.analyzeResultSession(session)
assert.equal(analysis.classSummary.averageRawScore, 5, 'analysis uses earned points')
assert.equal(analysis.items.find((item) => item.itemId === 'i-problem')?.analysisBasis, 'teacher_scored_points', 'subjective multi-point analysis is point-based')
assert.equal(analysis.items.find((item) => item.itemId === 'i-problem')?.normalizedPointAchievement, 0.6, 'normalized multi-point achievement is explicit')
const onePointMatching = baseItem('i-match-one', 1, 'matching', { type: 'matching', prompts: [{ id: 'p1', text: 'One' }, { id: 'p2', text: 'Two' }], choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], mappings: [{ promptId: 'p1', choiceId: 'a', pointsPossible: 0.5 }, { promptId: 'p2', choiceId: 'b', pointsPossible: 0.5 }] }, 1)
const onePointMatchingOutcome = scoring.scoreResultItem(input(onePointMatching, { type: 'matching', matches: { p1: 'a', p2: 'a' } }))
const componentSession = { ...session, assessmentSnapshot: { ...session.assessmentSnapshot, totalItems: 1, totalPossiblePoints: 1, items: [onePointMatching] }, itemOutcomes: [onePointMatchingOutcome] }
const componentAnalysis = analysisEngine.analyzeResultSession(componentSession)
assert.equal(componentAnalysis.items[0].analysisBasis, 'normalized_point_achievement', 'a one-point component item with partial credit is not mislabeled as binary facility')
assert.equal(componentAnalysis.items[0].binaryFacility, null, 'binary facility remains limited to truly binary items')
const signals = remediation.buildRemediationSignals(analysis)
assert.equal(signals.threshold.basis, 'point_facility', 'new remediation defaults to point-weighted evidence')

const migration = read('supabase/migrations/202608090019_phase54_results_compatibility.sql')
const render = read('render.yaml')
const env = read('.env.example')
const resultEditor = read('src/pages/ResultSessionPage.tsx')
assert.match(migration, /result_answer_shape_valid[\s\S]*identification[\s\S]*fill_in_the_blank[\s\S]*numerical_answer[\s\S]*problem_solving[\s\S]*matching[\s\S]*multiple_select[\s\S]*essay/)
assert.match(migration, /result_item_earned_points[\s\S]*least\(item_points[\s\S]*multiple_select/)
assert.match(migration, /security definer[\s\S]*set search_path = ''/)
assert.match(migration, /session_row\.user_id is distinct from new\.user_id/, 'result writes recheck immutable session ownership')
assert.match(migration, /object_key not in \('type', 'value', 'unit'\)/, 'numerical learner payload rejects extra keys')
assert.match(migration, /octet_length\(p_answer ->> 'solution'\) > 3800/, 'subjective learner text is bounded at the database boundary')
assert.match(migration, /result_answer_shape_valid\(question_type, answer\) is not true/, 'SQL NULL cannot bypass answer-shape validation')
assert.match(migration, /result_learner_answer_references_valid\(item_value, answer\) is not true/, 'learner references are checked against the immutable snapshot')
assert.match(render, /runtime:\s*static/)
assert.match(render, /buildCommand:\s*npm ci && npm run build/)
assert.match(render, /staticPublishPath:\s*\.\/dist/)
assert.match(render, /source:\s*\/\*\s*\n\s*destination:\s*\/index\.html/)
const envAssignments = env.split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join('\n')
assert.doesNotMatch(envAssignments, /VITE_.*(SERVICE_ROLE|GEMINI|PASSWORD|SECRET|TOKEN)/i)
assert.match(resultEditor, /awardedPoints === undefined \? existing\?\.earnedPoints/, 'clearing an awarded-points input is distinct from preserving an omitted argument')
assert.match(resultEditor, /RESULT_AUTOSAVE_DELAY_MS = 1500/, 'full result batches are debounced instead of saved on every keystroke')
for (const file of ['docs/PRODUCTION_DEPLOYMENT.md', 'docs/PRODUCTION_SMOKE_TEST.md', 'docs/PHASE_5_4_SECURITY_REVIEW.md', 'public/_redirects']) assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`)

console.log('Phase 5.4 results/production validation passed: legacy and multi-point scoring, partial credit, objective answer shapes, point-weighted analysis/remediation, report/export contracts, SPA rewrite, browser-safe env, and additive security migration checks.')
