import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const dataUrl = (output) => `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText

const scoringUrl = dataUrl(transpile(read('src/lib/resultsScoring.ts')))
let validationOutput = transpile(read('src/lib/resultsValidation.ts'))
validationOutput = validationOutput.replace(/from ['"]\.\/resultsScoring['"]/u, `from '${scoringUrl}'`)
const scoring = await import(scoringUrl)
const validation = await import(dataUrl(validationOutput))
const importer = await import(dataUrl(transpile(read('src/lib/resultsImport.ts'))))

const learner = (id, displayName, sectionName = '7-A', status = 'active') => ({
  id, userId: 'teacher-a', assignmentId: 'assignment-a', sectionName, displayName,
  localReference: null, status, createdAt: '', updatedAt: '',
})

assert.equal(validation.validateClassLearners([], 'assignment-a').ready, true, 'empty roster is valid')
assert.equal(validation.validateClassLearners([learner('l1', 'Ana')], 'assignment-a').ready, true, 'one learner is valid')
const forty = Array.from({ length: 40 }, (_, index) => learner(`l${index}`, `Learner ${index}`, '7-A'))
assert.equal(validation.validateClassLearners(forty, 'assignment-a').ready, true, '40-learner roster is valid')
const duplicate = validation.validateClassLearners([learner('l1', 'Same'), learner('l2', ' same ')], 'assignment-a')
assert.equal(duplicate.ready, true, 'duplicate display names are a teacher-review warning, not a hidden merge')
assert.ok(duplicate.warnings.some((issue) => issue.key === 'duplicate-display-name'))
assert.equal(validation.validateClassLearners([learner('l1', 'Inactive', '7-A', 'inactive')], 'assignment-a').ready, true, 'inactive learners remain valid and archivable')
assert.equal(validation.validateClassLearners([learner('l1', 'Wrong class', '7-A')], 'assignment-b').ready, false, 'assignment ownership is checked')

const roster = importer.previewRosterCsv('Name,Reference\n"Ana, Cruz",A-1\nBen,B-2', { sectionName: '7-A' })
assert.equal(roster.ready, true, 'roster CSV supports quoted names and preview')
assert.equal(roster.rows[0].displayName, 'Ana, Cruz')
assert.equal(roster.rows[0].sectionName, '7-A')
const emptyRoster = importer.previewRosterCsv('Name,Reference\n\nAna,A-1', { sectionName: '7-A' })
assert.equal(emptyRoster.ready, false, 'empty roster rows are rejected')
const duplicateRoster = importer.previewRosterCsv('Name\nAna\n ana ', { sectionName: '7-A' })
assert.equal(duplicateRoster.ready, false, 'obvious duplicate roster rows require correction')
const ambiguousRoster = importer.previewRosterCsv('Name,Learner\nAna,Other', { sectionName: '7-A' })
assert.equal(ambiguousRoster.ready, false, 'ambiguous name mappings are never silently selected')
const missingSection = importer.previewRosterCsv('Name\nAna', { sectionName: '' })
assert.equal(missingSection.ready, false, 'roster imports are section-scoped')

const base = {
  competencySnapshot: { id: 'c1', code: 'C1', text: 'Competency', sourcePage: null, academicPeriodId: null, curriculumPeriodId: 'p1', curriculumPeriodLabel: 'Period' },
  cognitiveCategorySnapshot: { id: 'remember', label: 'Remembering', shortLabel: 'R' },
  mapping: { rowId: 'row-1', competencyId: 'c1', cognitiveCategoryId: 'remember', allocationItemStart: 1, allocationItemEnd: 1, allocationIndex: 0 },
}
const mcq = { ...base, id: 'i1', itemNumber: 1, prompt: 'Choose', questionType: 'multiple_choice', answer: { type: 'multiple_choice', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], choiceId: 'b' }, points: 1 }
const tf = { ...base, id: 'i2', itemNumber: 2, prompt: 'True?', questionType: 'true_false', answer: { type: 'true_false', value: true }, points: 1 }
const short = { ...base, id: 'i3', itemNumber: 3, prompt: 'Short', questionType: 'short_answer', answer: { type: 'short_answer', acceptedAnswers: ['Café test'], caseSensitive: false }, points: 2 }
const constructed = { ...base, id: 'i4', itemNumber: 4, prompt: 'Explain', questionType: 'constructed_response', answer: { type: 'constructed_response', expectedResponse: 'x', sampleResponse: 'x' }, points: 3 }
assert.equal(scoring.scoreResultItem({ resultSessionId: 's', participantId: 'p', learnerId: 'l', item: mcq, answer: { type: 'multiple_choice', choiceId: 'b' }, now: '' }).isCorrect, true)
assert.equal(scoring.scoreResultItem({ resultSessionId: 's', participantId: 'p', learnerId: 'l', item: tf, answer: { type: 'true_false', value: false }, now: '' }).isCorrect, false)
assert.equal(scoring.scoreResultItem({ resultSessionId: 's', participantId: 'p', learnerId: 'l', item: short, answer: { type: 'short_answer', text: '  CAFÉ   test ' }, shortAnswerMode: 'normalized_exact', now: '' }).isCorrect, true)
assert.equal(scoring.scoreResultItem({ resultSessionId: 's', participantId: 'p', learnerId: 'l', item: short, answer: { type: 'short_answer', text: 'Café test' }, now: '' }).isCorrect, null, 'short answer is manual unless normalized_exact is explicitly enabled')
const constructedOutcome = scoring.scoreResultItem({ resultSessionId: 's', participantId: 'p', learnerId: 'l', item: constructed, answer: { type: 'constructed_response', text: 'response' }, awardedPoints: 1.25, now: '' })
assert.equal(constructedOutcome.isCorrect, null)
assert.equal(constructedOutcome.earnedPoints, 1.25)
assert.equal(constructedOutcome.scoringSource, 'teacher')
const omitted = scoring.scoreResultItem({ resultSessionId: 's', participantId: 'p', learnerId: 'l', item: mcq, answer: null, now: '' })
assert.equal(omitted.isCorrect, null)
assert.equal(omitted.earnedPoints, 0)

for (const file of ['src/lib/resultsScoring.ts', 'src/lib/resultsValidation.ts', 'src/lib/resultsImport.ts']) {
  const source = read(file)
  assert.doesNotMatch(source, /fetch\(|supabase/u, `${file} must remain a pure local results domain module`)
}
assert.match(read('src/types/results.ts'), /sectionName/u, 'learner/result data must remain section-scoped')
console.log('Phase 5.0 validation passed: section-scoped privacy-minimized roster, safe CSV preview/mapping, deterministic MCQ/TF scoring, explicit short-answer mode, teacher-only constructed scoring, and omission handling.')
