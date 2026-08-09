import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const load = (file) => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`)
const scoring = await load('src/lib/resultsScoring.ts')
const importer = await load('src/lib/resultsImport.ts')
const validationOutput = ts.transpileModule(read('src/lib/resultsValidation.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const scoringUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(read('src/lib/resultsScoring.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`
const validation = await import(`data:text/javascript;base64,${Buffer.from(validationOutput.replace(/from ['"]\.\/resultsScoring['"]/u, `from '${scoringUrl}'`)).toString('base64')}`)

const base = {
  competencySnapshot: { id: 'c1', code: 'C1', text: 'Competency', sourcePage: null, academicPeriodId: null, curriculumPeriodId: 'p1', curriculumPeriodLabel: 'Period' },
  cognitiveCategorySnapshot: { id: 'remember', label: 'Remembering', shortLabel: 'R' },
  mapping: { rowId: 'row-1', competencyId: 'c1', cognitiveCategoryId: 'remember', allocationItemStart: 1, allocationItemEnd: 1, allocationIndex: 0 },
}
const makeItem = (number, type = 'multiple_choice', points = 1) => type === 'multiple_choice'
  ? { ...base, id: `item-${number}`, itemNumber: number, prompt: `Question ${number}`, questionType: type, answer: { type, choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' }], choiceId: number % 2 ? 'a' : 'b' }, points }
  : type === 'true_false'
    ? { ...base, id: `item-${number}`, itemNumber: number, prompt: `Question ${number}`, questionType: type, answer: { type, value: number % 2 === 0 }, points }
    : type === 'short_answer'
      ? { ...base, id: `item-${number}`, itemNumber: number, prompt: `Question ${number}`, questionType: type, answer: { type, acceptedAnswers: ['Alpha'], caseSensitive: false }, points }
      : { ...base, id: `item-${number}`, itemNumber: number, prompt: `Question ${number}`, questionType: type, answer: { type, expectedResponse: 'Expected', sampleResponse: 'Sample' }, points }

const one = makeItem(1)
const oneOutcome = scoring.scoreResultItem({ resultSessionId: 'session', participantId: 'participant', learnerId: 'learner', item: one, answer: { type: 'multiple_choice', choiceId: 'a' }, now: '' })
const oneTotals = scoring.calculateResultTotals([oneOutcome])
assert.equal(oneTotals.rawScore, 1)
assert.equal(oneTotals.possiblePoints, 1)
assert.equal(oneTotals.percentage, 100)

const fortyItems = Array.from({ length: 40 }, (_, index) => makeItem(index + 1))
const answerMap = new Map(fortyItems.map((item) => [item.id, { type: 'multiple_choice', choiceId: item.answer.choiceId }]))
answerMap.set(fortyItems[4].id, { type: 'multiple_choice', choiceId: 'z' })
answerMap.set(fortyItems[9].id, null)
const fortyOutcomes = scoring.scoreAnswerSheet({ id: 'session', shortAnswerScoring: { defaultMode: 'manual', itemModes: {} } }, { participantId: 'participant', learnerId: 'learner' }, answerMap, fortyItems, {}, '')
assert.equal(fortyOutcomes.length, 40)
const fortyTotals = scoring.calculateResultTotals(fortyOutcomes)
assert.equal(fortyTotals.rawScore, 38)
assert.equal(fortyTotals.possiblePoints, 40)
assert.equal(fortyTotals.percentage, 95)
assert.equal(fortyTotals.omittedItems, 1)
assert.equal(fortyTotals.incorrectItems, 1)

const fiftyFiveItems = Array.from({ length: 55 }, (_, index) => makeItem(index + 1, index === 10 ? 'true_false' : 'multiple_choice', index === 20 ? 2.5 : 1))
const fiftyFiveAnswers = new Map(fiftyFiveItems.map((item) => [item.id, item.questionType === 'true_false' ? { type: 'true_false', value: item.answer.value } : { type: 'multiple_choice', choiceId: item.answer.choiceId }]))
const fiftyFiveOutcomes = scoring.scoreAnswerSheet({ id: 'session-55', shortAnswerScoring: { defaultMode: 'manual', itemModes: {} } }, { participantId: 'participant', learnerId: 'learner' }, fiftyFiveAnswers, fiftyFiveItems, {}, '')
assert.equal(fiftyFiveOutcomes.length, 55, '50+ item answer sheets are supported in one local batch')
assert.equal(scoring.calculateResultTotals(fiftyFiveOutcomes).percentage, 100)

const shortItem = makeItem(1, 'short_answer', 2)
const shortManual = scoring.scoreResultItem({ resultSessionId: 'session', participantId: 'participant', learnerId: 'learner', item: shortItem, answer: { type: 'short_answer', text: 'Alpha' }, now: '' })
assert.equal(shortManual.isCorrect, null)
const shortExact = scoring.scoreResultItem({ resultSessionId: 'session', participantId: 'participant', learnerId: 'learner', item: shortItem, answer: { type: 'short_answer', text: ' alpha ' }, shortAnswerMode: 'normalized_exact', now: '' })
assert.equal(shortExact.isCorrect, true)
const constructed = makeItem(2, 'constructed_response', 4)
const partial = scoring.scoreResultItem({ resultSessionId: 'session', participantId: 'participant', learnerId: 'learner', item: constructed, answer: { type: 'constructed_response', text: 'Partial' }, awardedPoints: 1.5, now: '' })
assert.equal(partial.earnedPoints, 1.5)
assert.equal(partial.isCorrect, null)
const partialTotals = scoring.calculateResultTotals([shortExact, partial])
assert.equal(partialTotals.rawScore, 3.5)
assert.equal(partialTotals.possiblePoints, 6)
assert.equal(partialTotals.percentage, 58.33)
const omitted = scoring.scoreResultItem({ resultSessionId: 'session', participantId: 'participant', learnerId: 'learner', item: constructed, answer: null, awardedPoints: null, now: '' })
assert.equal(omitted.earnedPoints, 0)

const scoreOnly = scoring.calculateScoreOnlyTotals(12.345, 20)
assert.equal(scoreOnly.rawScore, 12.345)
assert.equal(scoreOnly.percentage, 61.73)
assert.equal(scoring.formatScore(0.1 + 0.2), '0.3')
assert.equal(scoring.canProduceItemAnalysis('score_only'), false)
assert.equal(scoring.canProduceItemAnalysis('answer_sheet'), true)
assert.equal(validation.resultSessionCanProduceItemAnalysis({ entryMode: 'score_only' }), false)

const importPreview = importer.previewResultsCsv('Learner,1,2,3\nAna,A,B,\nBen,B,A,C', { sectionName: '7-A', mode: 'answer_sheet', itemCount: 3 })
assert.equal(importPreview.ready, true)
assert.equal(importPreview.rows[0].answers[3], null)
const scoreImport = importer.previewResultsCsv('Learner,Score\nAna,12.5', { sectionName: '7-A', mode: 'score_only' })
assert.equal(scoreImport.ready, true)
const ambiguousImport = importer.previewResultsCsv('Learner,Name,1\nAna,Ana,A', { sectionName: '7-A', mode: 'answer_sheet', itemCount: 1 })
assert.equal(ambiguousImport.ready, false)
const wrongModeImport = importer.previewResultsCsv('Learner,1\nAna,A', { sectionName: '7-A', mode: 'score_only' })
assert.equal(wrongModeImport.ready, false)

const scoringSource = read('src/lib/resultsScoring.ts')
const validationSource = read('src/lib/resultsValidation.ts')
const resultSessionUi = read('src/pages/ResultSessionPage.tsx')
const resultsCss = read('src/results.css')
assert.doesNotMatch(scoringSource, /supabase|fetch\(/u)
assert.match(scoringSource, /scoreAnswerSheet/u)
assert.match(validationSource, /MAX_BULK_OUTCOMES/u)
assert.match(validationSource, /bulk/i)
assert.match(resultSessionUi, /mappedItemNumbers/u, 'result imports must preserve unmapped item outcomes')
assert.match(resultSessionUi, /Import not applied/u, 'result imports must reject partial learner resolution')
assert.match(resultSessionUi, /pendingSaveRef/u, 'result autosave must serialize complete-array saves')
assert.match(resultsCss, /@media \(max-width: 520px\)/u, 'results workflow needs a phone-width layout')
assert.match(resultsCss, /\.results-class-response-row \{ grid-template-columns: 1fr; \}/u, 'item-mode class rows must stack on phones')
assert.match(resultsCss, /\.answer-choice-button \{ min-height: 46px; \}/u, 'phone answer choices need large tap targets')
assert.match(resultsCss, /\.results-next-actions \.icon-button \{ width: 44px; height: 44px; \}/u, 'phone learner navigation must retain 44px tap targets')
const repositoryPath = path.join(root, 'src/lib/resultsRepository.ts')
if (fs.existsSync(repositoryPath)) {
  const repositorySource = fs.readFileSync(repositoryPath, 'utf8')
  assert.match(repositorySource, /bulk|upsert|batch/i, 'persistence must expose a bounded bulk-save path')
  assert.doesNotMatch(repositorySource, /for[^(]*\([^)]*\)[^{]*\{[\s\S]{0,240}await\s+supabase/u, 'persistence must not write one network request per response')
}
console.log('Phase 5.1 validation passed: 1/40/55-item answer sheets, partial/omitted responses, all structured question types, exact totals/percentages, score-only limits, CSV preview mapping, and bulk-save architecture markers.')
