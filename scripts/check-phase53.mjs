import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import PizZip from 'pizzip'
import { DOMParser } from '@xmldom/xmldom'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
globalThis.DOMParser = DOMParser
globalThis.__PizZip = PizZip

async function load(file, replacements = []) {
  const source = read(file)
  let output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement)
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const modelEngine = await load('src/lib/resultsExportModel.ts')
const workbookEngine = await load('src/lib/resultsWorkbook.ts', [
  [/import PizZip from ['"]pizzip['"];?/g, 'const PizZip = globalThis.__PizZip;'],
  [/import \{ downloadBlob \} from ['"]\.\/docxTemplate['"];?/g, 'const downloadBlob = () => {};'],
])
const exportEngine = await load('src/lib/resultsExport.ts', [
  [/import \{[\s\S]*?\} from ['"]docx['"];?/g, 'const AlignmentType = { CENTER: "center" }; const Document = class {}; const PageBreak = class {}; const Packer = class { static toBlob() { return new Blob(); } }; const Paragraph = class {}; const TextRun = class {};'],
  [/import \{ jsPDF \} from ['"]jspdf['"];?/g, 'const jsPDF = class {};'],
  [/import \{ downloadBlob \} from ['"]\.\/docxTemplate['"];?/g, 'const downloadBlob = () => {};'],
  [/import \{ buildResultsWorkbook, resultsWorkbookFilename \} from ['"]\.\/resultsWorkbook['"];?/g, 'const buildResultsWorkbook = () => new Blob(); const resultsWorkbookFilename = () => "results.xlsx";'],
])

const item = (number, competency, period = 'Quarter 1') => ({
  itemId: `item-${number}`,
  itemNumber: number,
  prompt: `Prompt ${number}`,
  questionType: number === 1 ? 'multiple_choice' : 'true_false',
  competencyId: competency,
  competencyCode: competency.toUpperCase(),
  competencyText: competency === 'comp-1' ? 'Use evidence' : 'Explain relationships',
  cognitiveCategoryId: number === 1 ? 'remember' : 'understand',
  cognitiveCategoryLabel: number === 1 ? 'Remembering' : 'Understanding',
  cognitiveCategoryShortLabel: number === 1 ? 'R' : 'U',
  curriculumPeriodId: period === 'Quarter 1' ? 'period-1' : 'period-2',
  curriculumPeriodLabel: period,
  questionType: number === 1 ? 'multiple_choice' : 'true_false',
  possiblePoints: 1,
  attempted: 2,
  correct: number === 1 ? 1 : 2,
  incorrect: number === 1 ? 1 : 0,
  omitted: 0,
  percentageCorrect: number === 1 ? 0.5 : 1,
  facility: number === 1 ? 0.5 : 1,
  earnedPoints: number === 1 ? 1 : 2,
  pointsPossibleForAttempted: 2,
  averageEarnedPoints: 0.5,
  pointFacility: number === 1 ? 0.5 : 1,
  options: number === 1 ? [{ label: 'A', count: 1, percentage: 0.5, correct: true, distractorSignal: null }, { label: 'B', count: 0, percentage: 0, correct: false, distractorSignal: 'unselected' }] : [],
  invalidOptionCount: 0,
  discrimination: { method: 'point_biserial', value: null, sampleSize: 2, status: 'insufficient_data', reason: 'small class' },
  traceability: { assessmentItemId: `item-${number}`, originalItemNumber: number, mappingRowId: `row-${number}`, competencyId: competency, cognitiveCategoryId: number === 1 ? 'remember' : 'understand', allocationItemStart: number, allocationItemEnd: number, allocationIndex: 0, curriculumPeriodId: period === 'Quarter 1' ? 'period-1' : 'period-2', curriculumPeriodLabel: period },
})

const aggregate = (key, competencyText, period, itemNumbers, correct, incorrect) => ({
  key,
  competencyId: key,
  competencyCode: key.toUpperCase(),
  competencyText,
  curriculumPeriodId: period === 'Quarter 1' ? 'period-1' : 'period-2',
  curriculumPeriodLabel: period,
  mappedItems: itemNumbers.length,
  itemNumbers,
  attempts: correct + incorrect,
  correct,
  incorrect,
  omitted: 0,
  percentageCorrect: correct + incorrect ? correct / (correct + incorrect) : null,
  facility: correct + incorrect ? correct / (correct + incorrect) : null,
  earnedPoints: correct,
  pointsPossibleForAttempted: correct + incorrect,
  averageEarnedPoints: 0.5,
  pointFacility: correct + incorrect ? correct / (correct + incorrect) : null,
})

const learner = {
  participantId: 'participant-1', learnerId: 'learner-1', displayName: 'Learner One', rawScore: 1, possiblePoints: 2, percentage: 0.5,
  attemptedItems: 2, omittedItems: 0, correctItems: 1, incorrectItems: 1, missedItemNumbers: [1], competencyPerformance: [], cognitivePerformance: [],
}
const analysis = {
  resultSessionId: 'session-1', available: true, reason: null, minimumDiscriminationSampleSize: 10,
  items: [item(1, 'comp-1'), item(2, 'comp-2', 'Quarter 2')],
  competencies: [aggregate('comp-1', 'Use evidence', 'Quarter 1', [1], 1, 1), aggregate('comp-2', 'Explain relationships', 'Quarter 2', [2], 2, 0)],
  cognitiveCategories: [aggregate('remember', 'Remembering', 'Quarter 1', [1], 1, 1), aggregate('understand', 'Understanding', 'Quarter 2', [2], 2, 0)],
  curriculumPeriods: [aggregate('period-1', '', 'Quarter 1', [1], 1, 1), aggregate('period-2', '', 'Quarter 2', [2], 2, 0)],
  classSummary: { learnerCount: 2, encodedLearnerCount: 2, scoredLearnerCount: 2, averageRawScore: 1.5, medianRawScore: 1.5, highestRawScore: 2, lowestRawScore: 1, averagePercentage: 0.75, medianPercentage: 0.75, highestPercentage: 1, lowestPercentage: 0.5, percentageDistribution: [{ label: '50–59', minimum: 50, maximum: 59.9, count: 1 }, { label: '70–79', minimum: 70, maximum: 79.9, count: 1 }] },
  learners: [learner, { ...learner, participantId: 'participant-2', learnerId: 'learner-2', displayName: 'Learner Two', rawScore: 2, percentage: 1, correctItems: 2, incorrectItems: 0, missedItemNumbers: [] }],
  formulas: { facility: 'correct / attempted', optionPercentage: 'option / attempted', distractorSignal: 'unselected incorrect option; advisory only', pointFacility: 'earned / available', discrimination: 'Pearson', smallClassRule: 'minimum 10' },
}
const session = {
  id: 'session-1', userId: 'teacher-1', assignmentId: 'assignment-1', sectionName: 'Rizal', assessmentId: 'assessment-1', administrationDate: '2026-08-09', title: 'Quarter Assessment', entryMode: 'answer_sheet', status: 'final',
  assessmentSnapshot: { assessmentId: 'assessment-1', assessmentVersionNumber: 2, assessmentTitle: 'Quarter Assessment', assignmentId: 'assignment-1', gradeLevel: 'Grade 7', learningArea: 'Mathematics', schoolYear: '2026–2027', gradingTermId: 'term-1', gradingTermLabel: 'Quarter 1', curriculumPeriodIds: ['period-1', 'period-2'], curriculumPeriodLabels: ['Quarter 1', 'Quarter 2'], totalItems: 2, totalPossiblePoints: 2, items: [] }, learners: [], itemOutcomes: [], scoreOnlyOutcomes: [], shortAnswerScoring: { defaultMode: 'manual', itemModes: {} }, createdAt: '', updatedAt: '', versionNumber: 1,
}
const remediation = { resultSessionId: 'session-1', threshold: { percentageThreshold: 0.75, basis: 'percentage_correct', comparison: 'below' }, scope: 'whole_class', selectedParticipantIds: ['participant-1', 'participant-2'], classSignals: [{ key: 'signal-1', resultSessionId: 'session-1', scope: 'whole_class', competencyId: 'comp-1', competencyCode: 'COMP-1', competencyText: 'Use evidence', curriculumPeriodId: 'period-1', curriculumPeriodLabel: 'Quarter 1', mappedItems: 1, itemNumbers: [1], evidenceValue: 0.5, evidenceLabel: 'percentage_correct', threshold: 0.75, comparison: 'below', participantIds: ['participant-1', 'participant-2'], numberOfLearners: 2, override: 'default', instructionalMessage: 'Needs additional evidence/practice for Use evidence. Teacher review is required before assigning an activity.' }], learnerSignals: [], sourceAggregates: [], available: true, reason: null }

const modes = ['summary', 'item_analysis', 'competency', 'remediation']
const models = Object.fromEntries(modes.map((mode) => [mode, modelEngine.buildResultsReportModel({ session, analysis }, { mode, documentLanguage: 'english', teacherName: 'Teacher', schoolName: 'School', remediation })]))
assert.equal(models.summary.documentTitle, 'Assessment Results Summary')
assert.equal(models.item_analysis.documentTitle, 'Item Analysis Report')
assert.equal(models.competency.documentTitle, 'Competency Performance Report')
assert.equal(models.remediation.documentTitle, 'Remediation Plan')
assert.match(JSON.stringify(models.summary), /Learner One/)
for (const mode of ['item_analysis', 'competency', 'remediation']) {
  const serialized = JSON.stringify(models[mode])
  assert.doesNotMatch(serialized, /Learner One|learner-1|participant-1|session-1|assessment-1/)
  assert.doesNotMatch(serialized, /GuroDesk|Gemini|prompt injection/i)
}
assert.equal(models.item_analysis.items[0].prompt, 'Prompt 1', 'authored prompts remain available only in teacher item analysis')
assert.equal(models.competency.curriculumPeriods.length, 2)

const longLines = Array.from({ length: 137 }, (_, index) => `row ${index + 1}`)
const pages = exportEngine.paginateResultsLines(longLines, 17)
assert.deepEqual(pages.flatMap((page) => page.lines), longLines)
assert.throws(() => exportEngine.paginateResultsLines(longLines, 0), /positive whole number/)
assert.match(exportEngine.resultsReportLines(models.summary).join('\n'), /Learner One/)
assert.doesNotMatch(exportEngine.resultsReportLines(models.item_analysis).join('\n'), /Learner One|session-1|learner-1/)
assert.doesNotMatch(exportEngine.resultsReportPrintHtml(models.item_analysis), /GuroDesk|Gemini|session-1|learner-1/)

const workbookBlob = workbookEngine.buildResultsWorkbook(models.summary)
const workbookBuffer = await workbookBlob.arrayBuffer()
const workbookZip = new PizZip(workbookBuffer)
const workbookXml = workbookZip.file('xl/workbook.xml').asText()
const sheetNames = ['Summary', 'Learner Scores', 'Item Analysis', 'Option Analysis', 'Competency Analysis', 'Cognitive Analysis', 'Remediation']
for (const name of sheetNames) assert.match(workbookXml, new RegExp(`name="${name}"`))
for (let index = 1; index <= sheetNames.length; index += 1) {
  const sheetXml = workbookZip.file(`xl/worksheets/sheet${index}.xml`).asText()
  assert.match(sheetXml, /<sheetData>/)
  assert.doesNotMatch(sheetXml, /<f>/, 'deterministic workbook values do not depend on formulas')
}
const inspection = workbookEngine.inspectResultsXlsx(workbookBuffer, 'Item Analysis')
assert.deepEqual(inspection.sheetNames, sheetNames)
assert.ok(inspection.selectedSheet.headers.includes('Prompt'))
assert.ok(inspection.selectedSheet.rows.length >= 2)
assert.equal(workbookEngine.resultsWorkbookSheetNames().join('|'), sheetNames.join('|'))

for (const sourceFile of ['src/lib/resultsExportModel.ts', 'src/lib/resultsExport.ts', 'src/lib/resultsWorkbook.ts', 'src/pages/RemediationPage.tsx']) {
  const source = read(sourceFile)
  assert.doesNotMatch(source, /fetch\(|Gemini|gemini/i, `${sourceFile} must not call AI`)
}
const remediationPageSource = read('src/pages/RemediationPage.tsx')
for (const required of ['useParams', 'loadResultSession', 'analyzeResultSession', 'loadRemediationPlans', 'saveRemediationPlan', 'archiveRemediationPlan', 'deleteDraftRemediationPlan', 'requestRemediationSuggestions', 'resultSessionId', 'competencyId', 'teacherConstraints', 'optionalAssistantSuggestion', 'No learner names']) assert.match(remediationPageSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Remediation route workflow missing ${required}`)
for (const required of ['Teacher-chosen additional competency', 'includeCandidateTarget', "'include'", 'window.confirm']) assert.match(remediationPageSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Remediation teacher-control workflow missing ${required}`)
assert.match(remediationPageSource, /session\.status === 'archived'[\s\S]*read-only[\s\S]*Open report/, 'archived remediation history must be read-only with a report path')
assert.doesNotMatch(remediationPageSource, /learnerId|participantId.*teacherConstraints|answer.*teacherConstraints/i)
const previewSource = read('src/pages/ResultsPrintPreviewPage.tsx')
for (const required of ['loadRemediationPlans', 'remediationPlan', 'includeLearnerNames: true']) assert.match(previewSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Results preview missing ${required}`)
assert.doesNotMatch(read('src/lib/resultsExport.ts'), /GuroDesk|resultSessionId|learnerId|participantId/)
assert.match(read('src/types/resultsTemplate.ts'), /architecture_only/)
assert.match(read('docs/PHASE5_RESULT_TEMPLATE_ARCHITECTURE.md'), /Upload existing XLSX.*inspect workbook.*teacher maps fields.*confirm/i)

console.log('Phase 5.3 validation passed: four report modes, teacher-only learner-name boundary, deterministic pagination, formula-free multi-sheet XLSX output/inspection, privacy/branding/AI metadata guards, and honest custom-template architecture.')
