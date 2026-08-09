import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { build } from 'esbuild'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const transpile = (file) => ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
// Bundle pure modules before loading them from a data URL.  This keeps the
// validator isolated from browser path resolution while still exercising the
// canonical question-type registry imported by assessmentQa.ts.
const loadPure = async (file) => {
  if (file === 'src/lib/assessmentRequestScheduler.ts') return import(`data:text/javascript;base64,${Buffer.from(transpile(file)).toString('base64')}`)
  const bundled = await build({ entryPoints: [path.join(root, file)], bundle: true, format: 'esm', platform: 'browser', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
}

const qa = await loadPure('src/lib/assessmentQa.ts')
const schedulerModule = await loadPure('src/lib/assessmentRequestScheduler.ts')
const exportModels = await loadPure('src/lib/assessmentExportModel.ts')
const finalReviewModule = await loadPure('src/lib/assessmentFinalReview.ts')

const base = (questionType, answer, extra = {}) => ({
  id: `item-${questionType}`, itemNumber: 1, prompt: `A self-contained ${questionType} question`, questionType,
  answer, pointsPossible: 2, points: 2, competencySnapshot: { id: 'comp-1' }, cognitiveCategorySnapshot: { id: 'apply' }, mapping: { competencyId: 'comp-1', cognitiveCategoryId: 'apply' }, ...extra,
})

const typedItems = [
  base('multiple_choice', { type: 'multiple_choice', choices: [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }], choiceId: 'A' }),
  base('true_false', { type: 'true_false', value: true }),
  base('short_answer', { type: 'short_answer', acceptedAnswers: ['answer'] }),
  base('constructed_response', { type: 'constructed_response', expectedResponse: 'expected', sampleResponse: 'sample' }, { pointsPossible: 5 }),
  base('identification', { type: 'identification', acceptedAnswers: ['term'] }),
  base('fill_in_the_blank', { type: 'fill_in_the_blank', blanks: [{ id: 'a', acceptedAnswers: ['nucleus'] }, { id: 'b', acceptedAnswers: ['DNA'] }] }),
  base('numerical_answer', { type: 'numerical_answer', value: 24, tolerance: 0.1, unit: 'cm²' }),
  base('problem_solving', { type: 'problem_solving', finalAnswer: '7', solutionOutline: 'isolate x', subparts: [{ id: 'a', prompt: 'Find x', pointsPossible: 2 }] }, { pointsPossible: 2 }),
  base('matching', { type: 'matching', prompts: [{ id: 'p1', text: 'One' }], choices: [{ id: 'A', text: 'First' }, { id: 'B', text: 'Distractor' }], mappings: [{ promptId: 'p1', choiceId: 'A', pointsPossible: 2 }] }),
  base('multiple_select', { type: 'multiple_select', choices: [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }], choiceIds: ['A'], scoringPolicy: 'all_or_nothing' }),
  base('essay', { type: 'essay', keyPoints: ['evidence'], rubric: [{ id: 'r', label: 'Content', pointsPossible: 2 }] }),
]
for (const item of typedItems) {
  const result = qa.validateAssessmentItemDeterministic(item)
  assert.equal(result.valid, true, `${item.questionType} should pass deterministic QA: ${JSON.stringify(result.errors)}`)
}

const exportAssessment = {
  title: 'Mixed assessment', instructions: 'Answer carefully.', status: 'final', gradeLevel: '7', learningArea: 'Mathematics', schoolYear: '2026–2027', gradingTermLabel: 'Quarter 1', curriculumPeriodLabels: ['Quarter 1'],
  items: typedItems.map((item, index) => ({ ...item, itemNumber: index + 1, competencySnapshot: { id: 'comp-1', code: 'C-1', text: 'Verified competency' }, cognitiveCategorySnapshot: { id: 'apply', label: 'Applying', shortLabel: 'AP' } })),
}
const studentExport = exportModels.buildAssessmentStudentExportModel(exportAssessment)
const teacherExport = exportModels.buildAssessmentTeacherExportModel(exportAssessment, { includeAnswer: true })
const answerKeyExport = exportModels.buildAssessmentAnswerKeyExportModel(exportAssessment)
assert.ok(studentExport.questions.every((question) => !('answer' in question) && !('scoringGuide' in question)), 'student export omits structured answers and scoring guides by construction')
assert.equal(studentExport.metadata.totalItems, 11)
assert.equal(studentExport.metadata.totalPoints, typedItems.reduce((sum, item) => sum + item.pointsPossible, 0), 'export keeps item count and point total separate')
const studentProblem = studentExport.questions.find((question) => question.questionType === 'problem_solving')
assert.deepEqual(studentProblem?.subparts, [{ label: 'a', prompt: 'Find x', pointsPossible: 2 }], 'student copy shows learner-facing problem subparts and points')
assert.doesNotMatch(JSON.stringify(studentProblem?.subparts), /expectedAnswer|isolate x/, 'student subparts omit expected answers and solution guidance')
assert.match(teacherExport.questions.find((question) => question.questionType === 'essay')?.scoringGuide ?? '', /Content.*2 pts/, 'teacher/answer-key model includes explicit rubric points')
assert.match(answerKeyExport.questions.find((question) => question.questionType === 'matching')?.scoringGuide ?? '', /Match 1: 2 pts/, 'matching scoring guide retains per-response points')
const reviewItem = {
  ...typedItems[0], itemNumber: 1, authorshipState: 'manual', qaState: 'answer_needs_recheck',
  competencySnapshot: { id: 'comp-1', code: 'C-1', text: 'Verified competency' },
  cognitiveCategorySnapshot: { id: 'apply', label: 'Applying', shortLabel: 'AP' },
  mapping: { rowId: 'row-1', competencyId: 'comp-1', cognitiveCategoryId: 'apply', allocationItemStart: 1, allocationItemEnd: 1, allocationIndex: 0 },
}
const reviewAssessment = {
  totalItems: 1, totalPoints: 2, items: [reviewItem], settings: { allowedTypes: ['multiple_choice'] },
  sourceTos: { content: { rows: [{ competency: { id: 'comp-1' }, cognitiveAllocations: [{ itemStart: 1, itemEnd: 1, categoryId: 'apply' }] }] } },
}
const pendingTeacherReview = finalReviewModule.reviewAssessmentForFinalization(reviewAssessment)
assert.equal(pendingTeacherReview.hardErrors.length, 0, 'a structurally valid answer-recheck state is not made dependent on optional AI availability')
assert.ok(pendingTeacherReview.warnings.some((entry) => entry.code === 'unresolved-review-state'))
assert.equal(pendingTeacherReview.canFinalize, true)
assert.equal(pendingTeacherReview.ready, false)
assert.equal(finalReviewModule.reviewAssessmentForFinalization(reviewAssessment, { acknowledgedWarningCodes: ['unresolved-review-state'] }).ready, true, 'teacher can consciously acknowledge a remaining quality warning')
assert.equal(qa.validateAssessmentItemDeterministic({ ...typedItems[0], answer: { ...typedItems[0].answer, choiceId: 'missing' } }).valid, false)
assert.equal(qa.validateAssessmentItemDeterministic({ ...typedItems[0], pointsPossible: 'not-a-number' }).valid, false, 'explicit invalid points never receive the legacy one-point fallback')
assert.equal(qa.validateAssessmentItemDeterministic({ ...typedItems[5], answer: { ...typedItems[5].answer, blanks: [{ id: 'a', acceptedAnswers: ['x'], pointsPossible: 1 }, { id: 'b', acceptedAnswers: ['y'], pointsPossible: 1 }] }, pointsPossible: 3 }).valid, false, 'blank point mismatch is a hard deterministic error when per-blank scoring is enabled')
assert.equal(qa.validateAssessmentItemDeterministic({ ...typedItems[8], answer: { ...typedItems[8].answer, mappings: [{ promptId: 'p1', choiceId: 'A' }, { promptId: 'p1', choiceId: 'A' }] } }).valid, false, 'matching cannot reuse a choice by default')
assert.equal(qa.validateAssessmentItemDeterministic({ ...typedItems[7], answer: { ...typedItems[7].answer, finalAnswer: 0 } }).valid, true, 'zero is a valid finite numerical final answer')
assert.equal(qa.classifyAssessmentRisk(typedItems[0]).verifyRecommended, false)
assert.equal(qa.classifyAssessmentRisk(typedItems[6]).verifyRecommended, true)
assert.equal(qa.parseAssessmentVerifierResult({ status: 'pass', answerValid: true, competencyAligned: true, cognitiveAlignment: 'good', ambiguityDetected: false, factualOrMathIssue: false, issues: [], repairGuidance: [] }).status, 'pass')
assert.equal(qa.parseAssessmentVerifierResult({ status: 'pass', answerValid: false, competencyAligned: true, cognitiveAlignment: 'good', ambiguityDetected: false, factualOrMathIssue: false, issues: ['wrong answer'], repairGuidance: ['recalculate'] }).status, 'pass', 'explicit verifier status is retained for audit; caller still uses verifierRequiresRepair')
assert.equal(qa.verifierRequiresRepair(qa.parseAssessmentVerifierResult({ status: 'pass', answerValid: false, competencyAligned: true, cognitiveAlignment: 'good', ambiguityDetected: false, factualOrMathIssue: false, issues: [], repairGuidance: [] })), true)
assert.equal(qa.verifierRequiresRepair(qa.parseAssessmentVerifierResult({ status: 'pass', answerValid: true, competencyAligned: true, cognitiveAlignment: 'questionable', ambiguityDetected: true, factualOrMathIssue: false, issues: [], repairGuidance: [] })), true, 'questionable alignment or ambiguity cannot silently pass')
assert.throws(() => qa.parseAssessmentVerifierResult({ status: 'pass', answerValid: true }), /strict structured contract/, 'malformed verifier JSON is rejected')

const { AssessmentRequestScheduler } = schedulerModule
let now = 0
let calls = 0
const scheduler = new AssessmentRequestScheduler({ requestsPerMinute: 10, maxConcurrencyPerModel: 1, maxRetries: 1, now: () => now, sleep: async () => { now += 1000 } , usageStorageKey: `gurodesk-phase44-test-${Date.now()}` })
const retryResult = await scheduler.enqueue('gemini-3.5-flash-lite', async () => { calls += 1; if (calls === 1) throw Object.assign(new Error('rate limit'), { status: 429, retryAfterMs: 1 }); return 'ok' })
assert.equal(retryResult, 'ok')
assert.equal(calls, 2, '429 is retried only within the conservative ceiling')
assert.ok(now >= scheduler.intervalMs, 'a retry reserves another per-model RPM slot instead of bypassing pacing')
assert.equal(scheduler.getUsageEstimate('gemini-3.5-flash-lite').requestCount, 2, 'provider attempts are counted as approximate local usage')
assert.equal(scheduler.intervalMs, 6000, 'default safety margin is 10 requests/minute/model')
assert.equal(new AssessmentRequestScheduler({ requestsPerMinute: 15 }).intervalMs, 5000, 'configuration remains capped at the 12 RPM safety margin')
const abortController = new AbortController(); abortController.abort()
await assert.rejects(() => scheduler.enqueue('gemini-3.1-flash-lite', async () => 'never', { signal: abortController.signal }), /cancel/i)
assert.match(read('src/lib/assessmentGeneration.ts'), /validateAssessmentItemDeterministic/)
assert.match(read('src/lib/assessmentGeneration.ts'), /requestAssessmentVerification/)
assert.match(read('src/lib/assessmentGeneration.ts'), /repairAssessmentItemSuggestion/)
assert.match(read('src/lib/assessmentGeneration.ts'), /hasExistingAssessmentContent/)
assert.match(read('src/lib/assessmentGeneration.ts'), /locked|qaState/)
assert.match(read('src/pages/AssessmentEditorPage.tsx'), /Check accuracy|Check Accuracy/)
assert.match(read('src/pages/AssessmentEditorPage.tsx'), /Previous versions|Restore/)
assert.match(read('src/pages/AssessmentEditorPage.tsx'), /Generate missing/)
assert.match(read('src/pages/AssessmentEditorPage.tsx'), /fixed_counts/)
assert.match(read('src/pages/AssessmentEditorPage.tsx'), /percentages/)
assert.match(read('src/pages/AssessmentEditorPage.tsx'), /defaultPoints/)
assert.match(read('src/pages/AssessmentEditorPage.tsx'), /Apply distribution to empty slots/)
const assessmentEditorSource = read('src/pages/AssessmentEditorPage.tsx')
assert.match(assessmentEditorSource, /checkpointAssessmentGenerationSuccess/, 'batch generation checkpoints each successful item for refresh recovery')
assert.match(assessmentEditorSource, /saveAssessmentDocument\(latest/, 'batch generation persists the latest checkpoint-merged draft after the run')
assert.match(read('src/pages/AssessmentEditorPage.tsx'), /qaState: unlocking/)
assert.match(read('src/lib/assessmentGeneration.ts'), /total: eligible\.length/)
assert.match(read('src/lib/assessmentFinalReview.ts'), /suspiciousItemIds/)
assert.match(read('src/lib/assessmentFinalReview.ts'), /canFinalize/)
assert.match(read('src/lib/assessmentFinalReview.ts'), /duplicate-prompt/)

const exportModelSource = read('src/lib/assessmentExportModel.ts')
const exportSource = read('src/lib/assessmentExport.ts')
const exportViewSource = read('src/components/AssessmentDocumentView.tsx')
for (const required of ['identification', 'fill_in_the_blank', 'numerical_answer', 'problem_solving', 'matching', 'multiple_select', 'essay', 'buildAssessmentAnswerKeyExportModel']) assert.match(exportModelSource, new RegExp(required))
for (const required of ['fill_in_the_blank', 'numerical_answer', 'problem_solving', 'matching', 'multiple_select', 'essay', 'See rubric', 'question-flow']) assert.match(exportSource + exportViewSource, new RegExp(required))
assert.match(exportModelSource, /mode === 'student'/)
assert.match(exportSource, /answerText/)
assert.doesNotMatch(exportModelSource, /Gemini|gemini|fetch\(|GuroDesk/)
assert.doesNotMatch(exportSource, /Gemini|gemini|fetch\(|GuroDesk/)
assert.doesNotMatch(read('src/components/AssessmentDocumentView.tsx'), /qaState|authorshipState|teacherNotes|internal/i)

const edge = read('supabase/functions/assessment-question-generator/index.ts')
for (const required of ['operation', "'verify'", "'repair'", 'oppositeLiteModel', 'pointsPossible', 'questionType', 'assessment_ai_audit_events', 'fallbackAllowed', 'isLiteModel']) assert.match(edge, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
assert.match(edge, /responseMimeType:\s*'application\/json'/, 'raw Gemini generateContent requests use the supported JSON MIME configuration')
assert.doesNotMatch(edge, /responseFormat\s*:/, 'raw v1beta generateContent must not receive the incompatible responseFormat object')
assert.match(edge, /validateCandidate\(/, 'server-side per-type validation remains authoritative after JSON parsing')
assert.doesNotMatch(edge, /assessment_ai_audit_events[\s\S]{0,500}(?:prompt|answer)/i)

console.log('Phase 4.4 AI/editor validation passed: typed deterministic QA, adaptive verifier/repair contracts, lock/missing protections, conservative per-model scheduler/retry/cancel behavior, final review hard-error/warning split, student-safe structured exports, and server-owned Lite model/mapping boundaries.')
