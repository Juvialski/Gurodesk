import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

async function load(file) {
  const source = read(file)
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const analysisEngine = await load('src/lib/itemAnalysis.ts')
const remediationEngine = await load('src/lib/remediation.ts')

const competency = (id, text, period = 'period-1') => ({
  id,
  code: id.toUpperCase(),
  text,
  sourcePage: 1,
  academicPeriodId: period,
  curriculumPeriodId: period,
  curriculumPeriodLabel: period === 'period-1' ? 'Unang Markahan' : 'Ikalawang Markahan',
})
const category = (id, label) => ({ id, label, shortLabel: label.slice(0, 1) })
const mapping = (number, competencyId, cognitiveCategoryId) => ({
  rowId: `row-${competencyId}`,
  competencyId,
  cognitiveCategoryId,
  allocationItemStart: number,
  allocationItemEnd: number,
  allocationIndex: 0,
})
const items = [
  { id: 'item-1', itemNumber: 1, prompt: 'Choose one.', questionType: 'multiple_choice', answer: { type: 'multiple_choice', choices: [{ id: 'A', text: 'Alpha' }, { id: 'B', text: 'Beta' }, { id: 'C', text: 'Gamma' }], choiceId: 'A' }, competencySnapshot: competency('comp-1', 'Recognize a pattern'), cognitiveCategorySnapshot: category('remember', 'Remembering'), mapping: mapping(1, 'comp-1', 'remember'), points: 1 },
  { id: 'item-2', itemNumber: 2, prompt: 'True or false.', questionType: 'true_false', answer: { type: 'true_false', value: true }, competencySnapshot: competency('comp-1', 'Recognize a pattern'), cognitiveCategorySnapshot: category('understand', 'Understanding'), mapping: mapping(2, 'comp-1', 'understand'), points: 1 },
  { id: 'item-3', itemNumber: 3, prompt: 'Write the short answer.', questionType: 'short_answer', answer: { type: 'short_answer', acceptedAnswers: ['yes'], caseSensitive: false }, competencySnapshot: competency('comp-2', 'Explain the relationship'), cognitiveCategorySnapshot: category('apply', 'Applying'), mapping: mapping(3, 'comp-2', 'apply'), points: 2 },
  { id: 'item-4', itemNumber: 4, prompt: 'Construct a response.', questionType: 'constructed_response', answer: { type: 'constructed_response', expectedResponse: 'A response', sampleResponse: 'A response' }, competencySnapshot: competency('comp-2', 'Explain the relationship'), cognitiveCategorySnapshot: category('analyze', 'Analyzing'), mapping: mapping(4, 'comp-2', 'analyze'), points: 3 },
  { id: 'item-5', itemNumber: 5, prompt: 'Choose from four options.', questionType: 'multiple_choice', answer: { type: 'multiple_choice', choices: [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }, { id: 'C', text: 'Three' }, { id: 'D', text: 'Four' }], choiceId: 'D' }, competencySnapshot: competency('comp-3', 'Classify examples', 'period-2'), cognitiveCategorySnapshot: category('evaluate', 'Evaluating'), mapping: mapping(5, 'comp-3', 'evaluate'), points: 1 },
]

const learners = Array.from({ length: 12 }, (_, index) => ({
  participantId: `participant-${index + 1}`,
  learnerId: `learner-${index + 1}`,
  displayName: `Learner ${index + 1}`,
  localReference: null,
  learnerWasActive: true,
}))

const outcome = (participant, item, answer, isCorrect, earnedPoints) => ({
  id: `outcome-${participant.participantId}-${item.id}`,
  resultSessionId: 'session-1',
  participantId: participant.participantId,
  learnerId: participant.learnerId,
  itemId: item.id,
  itemNumber: item.itemNumber,
  answer,
  isCorrect,
  earnedPoints,
  possiblePoints: item.points,
  teacherFeedback: null,
  scoringSource: isCorrect === null ? 'teacher' : 'deterministic',
  updatedAt: '2026-08-09T00:00:00.000Z',
})

const makeSession = (customOutcomes, customLearners = learners, entryMode = 'answer_sheet') => ({
  id: 'session-1',
  userId: 'teacher-1',
  assignmentId: 'assignment-1',
  assessmentId: 'assessment-1',
  administrationDate: '2026-08-09',
  title: 'Analysis fixture',
  entryMode,
  status: 'draft',
  assessmentSnapshot: {
    assessmentId: 'assessment-1',
    assessmentVersionNumber: 3,
    assessmentTitle: 'Analysis fixture',
    assignmentId: 'assignment-1',
    gradeLevel: '7',
    learningArea: 'Mathematics',
    schoolYear: '2026–2027',
    gradingTermId: 'term-1',
    gradingTermLabel: 'Unang Markahan',
    curriculumPeriodIds: ['period-1', 'period-2'],
    curriculumPeriodLabels: ['Unang Markahan', 'Ikalawang Markahan'],
    totalItems: items.length,
    totalPossiblePoints: 8,
    items,
  },
  learners: customLearners,
  itemOutcomes: customOutcomes,
  scoreOnlyOutcomes: [],
  shortAnswerScoring: { defaultMode: 'manual', itemModes: {} },
  createdAt: '2026-08-09T00:00:00.000Z',
  updatedAt: '2026-08-09T00:00:00.000Z',
  versionNumber: 1,
})

const allCorrectOutcomes = learners.flatMap((learner) => [
  outcome(learner, items[0], { type: 'multiple_choice', choiceId: 'A' }, true, 1),
  outcome(learner, items[1], { type: 'true_false', value: true }, true, 1),
  outcome(learner, items[2], { type: 'short_answer', text: 'yes' }, true, 2),
  outcome(learner, items[3], { type: 'constructed_response', text: 'A response' }, null, 3),
  outcome(learner, items[4], { type: 'multiple_choice', choiceId: 'D' }, true, 1),
])
const allCorrect = analysisEngine.analyzeResultSession(makeSession(allCorrectOutcomes))
assert.equal(allCorrect.available, true)
assert.equal(allCorrect.items.length, 5)
assert.equal(allCorrect.items[0].attempted, 12)
assert.equal(allCorrect.items[0].correct, 12)
assert.equal(allCorrect.items[0].incorrect, 0)
assert.equal(allCorrect.items[0].omitted, 0)
assert.equal(allCorrect.items[0].facility, 1)
assert.equal(allCorrect.items[0].options.length, 3)
assert.equal(allCorrect.items[0].options[0].count, 12)
assert.equal(allCorrect.items[0].options[1].distractorSignal, 'unselected', 'an unselected incorrect option is an advisory distractor signal')
assert.equal(allCorrect.items[0].options[0].distractorSignal, null, 'the correct option is never labelled as a distractor')
assert.match(allCorrect.formulas.distractorSignal, /advisory.*no DepEd-mandated cutoff/i)
assert.equal(allCorrect.items[4].options.length, 4, 'varying MCQ choice counts are preserved')
assert.equal(allCorrect.items[3].percentageCorrect, null, 'constructed response correctness remains nullable when teacher does not enter a boolean')
assert.equal(allCorrect.items[0].discrimination.status, 'undefined', 'all-correct item has zero item-score variance')
assert.equal(allCorrect.competencies.length, 3)
assert.equal(allCorrect.cognitiveCategories.length, 5)
assert.equal(allCorrect.curriculumPeriods.length, 2)
assert.equal(allCorrect.curriculumPeriods[0].mappedItems + allCorrect.curriculumPeriods[1].mappedItems, 5)
assert.deepEqual(allCorrect.items[0].traceability, {
  assessmentItemId: 'item-1',
  originalItemNumber: 1,
  mappingRowId: 'row-comp-1',
  competencyId: 'comp-1',
  cognitiveCategoryId: 'remember',
  allocationItemStart: 1,
  allocationItemEnd: 1,
  allocationIndex: 0,
  curriculumPeriodId: 'period-1',
  curriculumPeriodLabel: 'Unang Markahan',
})

const allIncorrectOutcomes = learners.flatMap((learner) => [
  outcome(learner, items[0], { type: 'multiple_choice', choiceId: 'B' }, false, 0),
  outcome(learner, items[1], { type: 'true_false', value: false }, false, 0),
  outcome(learner, items[2], { type: 'short_answer', text: 'no' }, false, 0),
  outcome(learner, items[3], { type: 'constructed_response', text: 'A response' }, null, 0),
  outcome(learner, items[4], { type: 'multiple_choice', choiceId: 'A' }, false, 0),
])
const allIncorrect = analysisEngine.analyzeResultSession(makeSession(allIncorrectOutcomes))
assert.equal(allIncorrect.items[0].correct, 0)
assert.equal(allIncorrect.items[0].incorrect, 12)
assert.equal(allIncorrect.items[0].facility, 0)
assert.equal(allIncorrect.items[0].options[1].count, 12)
assert.equal(allIncorrect.classSummary.highestRawScore, 0)

const allOmittedOutcomes = learners.flatMap((learner) => items.map((item) => outcome(learner, item, null, null, 0)))
const allOmitted = analysisEngine.analyzeResultSession(makeSession(allOmittedOutcomes))
assert.equal(allOmitted.available, true, 'explicitly encoded omissions remain analyzable')
assert.equal(allOmitted.items[0].attempted, 0)
assert.equal(allOmitted.items[0].omitted, learners.length)
assert.equal(allOmitted.items[0].facility, null, 'all-omitted items never fabricate a facility value')
assert.equal(allOmitted.items[0].pointFacility, null, 'all-omitted items have no attempted-point denominator')

const mixedOutcomes = learners.flatMap((learner, index) => {
  const omit = index % 4 === 0
  return [
    ...(omit ? [] : [outcome(learner, items[0], { type: 'multiple_choice', choiceId: index % 2 === 0 ? 'A' : 'B' }, index % 2 === 0, index % 2 === 0 ? 1 : 0)]),
    outcome(learner, items[1], { type: 'true_false', value: index % 2 === 0 }, index % 2 === 0, index % 2 === 0 ? 1 : 0),
    outcome(learner, items[2], { type: 'short_answer', text: index % 2 === 0 ? 'yes' : 'no' }, index % 2 === 0, index % 2 === 0 ? 2 : 0),
    outcome(learner, items[3], { type: 'constructed_response', text: 'A response' }, null, index % 3 === 0 ? 3 : 1),
    outcome(learner, items[4], { type: 'multiple_choice', choiceId: index % 2 === 0 ? 'D' : 'A' }, index % 2 === 0, index % 2 === 0 ? 1 : 0),
  ]
})
const mixed = analysisEngine.analyzeResultSession(makeSession(mixedOutcomes))
assert.equal(mixed.items[0].attempted, 9)
assert.equal(mixed.items[0].omitted, 3)
assert.equal(mixed.items[0].correct, 3)
assert.equal(mixed.items[0].incorrect, 6)
assert.equal(mixed.items[0].facility, 3 / 9)
assert.equal(mixed.items[0].options[0].count, 3)
assert.equal(mixed.items[0].options[1].count, 6)
assert.equal(mixed.classSummary.learnerCount, 12)
assert.equal(mixed.classSummary.scoredLearnerCount, 12)
assert.equal(mixed.learners[0].missedItemNumbers.includes(1), true, 'omitted item remains visible in learner summary')
assert.match(mixed.formulas.discrimination, /rest-of-test.*excluding the item/i)

const smallLearners = learners.slice(0, 2)
const small = analysisEngine.analyzeResultSession(makeSession(mixedOutcomes.filter((item) => smallLearners.some((learner) => learner.participantId === item.participantId)), smallLearners))
assert.equal(small.items[0].discrimination.status, 'insufficient_data')
assert.match(small.items[0].discrimination.reason, /10 encoded learners/)

const scoreOnly = makeSession([], learners, 'score_only')
scoreOnly.scoreOnlyOutcomes = learners.map((learner) => ({ participantId: learner.participantId, learnerId: learner.learnerId, rawScore: 4, possiblePoints: 8, teacherFeedback: null, updatedAt: '2026-08-09T00:00:00.000Z' }))
const scoreOnlyAnalysis = analysisEngine.analyzeResultSession(scoreOnly)
assert.equal(scoreOnlyAnalysis.available, false)
assert.equal(scoreOnlyAnalysis.reason, 'score_only_mode')
assert.equal(scoreOnlyAnalysis.items.length, 0)
assert.equal(scoreOnlyAnalysis.classSummary.averageRawScore, 4)

const remediation = remediationEngine.buildRemediationSignals(mixed, { threshold: { percentageThreshold: 75 }, scope: 'whole_class' })
assert.equal(remediation.available, true)
assert.equal(remediation.threshold.percentageThreshold, 0.75)
assert.ok(remediation.classSignals.length > 0, 'a below-threshold competency produces a signal')
assert.match(remediation.classSignals[0].instructionalMessage, /additional evidence\/practice/i)
assert.doesNotMatch(JSON.stringify(remediation), /weak|slow|deficient|disabled|incapable/i)
const selected = remediationEngine.buildRemediationSignals(mixed, { threshold: { percentageThreshold: 0.75 }, scope: 'selected_learners', participantIds: ['participant-1', 'participant-2'] })
assert.equal(selected.selectedParticipantIds.length, 2)
assert.ok(selected.classSignals.every((signal) => signal.scope === 'selected_learners'))
if (remediation.classSignals.length > 0) {
  const excluded = remediationEngine.buildRemediationSignals(mixed, { threshold: { percentageThreshold: 75 }, overrides: { [remediation.classSignals[0].key]: 'exclude' } })
  assert.equal(excluded.classSignals.some((signal) => signal.key === remediation.classSignals[0].key), false)
}
const aboveThresholdAggregate = mixed.competencies.find((aggregate) => aggregate.percentageCorrect !== null && aggregate.percentageCorrect >= 0.25)
if (aboveThresholdAggregate) {
  const key = `${mixed.resultSessionId}::${aboveThresholdAggregate.competencyId ?? ''}::${aboveThresholdAggregate.curriculumPeriodId ?? ''}`
  const teacherIncluded = remediationEngine.buildRemediationSignals(mixed, { threshold: { percentageThreshold: 0.25 }, overrides: { [key]: 'include' } })
  assert.equal(teacherIncluded.classSignals.some((signal) => signal.key === key && signal.override === 'include'), true, 'teacher override may explicitly include an above-threshold mapped competency')
}
const scoreOnlyRemediation = remediationEngine.buildRemediationSignals(scoreOnlyAnalysis)
assert.equal(scoreOnlyRemediation.available, false)
assert.equal(scoreOnlyRemediation.reason, 'score_only_mode')

for (const sourceFile of ['src/lib/itemAnalysis.ts', 'src/lib/remediation.ts']) {
  const source = read(sourceFile)
  assert.doesNotMatch(source, /Gemini|gemini|fetch\(/, `${sourceFile} must remain deterministic and offline`)
  assert.doesNotMatch(source, /GuroDesk branding/i, `${sourceFile} must not embed report branding`)
}
assert.match(read('src/types/itemAnalysis.ts'), /traceability/)
assert.match(read('src/types/remediation.ts'), /teacher-selected analytical setting/)

console.log('Phase 5.2 validation passed: deterministic item statistics, option/distractor counts, omissions, point statistics, explicit item-rest discrimination insufficiency, immutable competency/cognitive traceability, score-only guard, class/learner summaries, and neutral configurable remediation signals.')
