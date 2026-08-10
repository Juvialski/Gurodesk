import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

async function loadModel() {
  const source = read('src/lib/assessmentExportModel.ts')
  let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  output = output.replace(/import \{ normalizeAssessmentMathText \} from '\.\/assessmentMathText';/, 'const normalizeAssessmentMathText = (value) => String(value ?? "");')
  output = output.replace(/import \{ recommendedAssessmentResponseLines \} from '\.\/assessmentExportPresentation';/, 'const recommendedAssessmentResponseLines = () => 1;')
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

async function loadExportRuntime() {
  const source = read('src/lib/assessmentExport.ts')
  let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  output = output.replace(/import \{[\s\S]*?\} from 'docx';/, 'const AlignmentType = { CENTER: "center" }; class Document {}; class Packer { static async toBlob() { return new Blob(); } }; class Paragraph {}; class TextRun {};')
  output = output.replace(/import \{ jsPDF \} from 'jspdf';/, 'const jsPDF = class {};')
  output = output.replace(/import \{ downloadBlob \} from '\.\/docxTemplate';/, 'const downloadBlob = () => {};')
  output = output.replace(/import \{ assessmentVisualSvgMarkup, drawAssessmentVisualPdf \} from '\.\/assessmentVisualExport';/, 'const assessmentVisualSvgMarkup = () => ""; const drawAssessmentVisualPdf = () => {};')
  output = output.replace(/import \{ normalizeAssessmentMathText \} from '\.\/assessmentMathText';/, 'const normalizeAssessmentMathText = (value) => String(value ?? "");')
  output = output.replace(/import \{[\s\S]*?\} from '\.\/assessmentExportPresentation';/, 'const assessmentQuestionKeepTogether = () => true; const assessmentQuestionTypeLabel = (type) => String(type); const assessmentResponseKind = () => "lines"; const assessmentSectionTitle = (type) => String(type); const assessmentUsesContiguousTypeSections = () => false; const assessmentVisualScale = () => 1; const recommendedAssessmentResponseLines = () => 1;')
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const modelEngine = await loadModel()
const exportEngine = await loadExportRuntime()

const items = [
  { id: 'item-1', itemNumber: 1, prompt: 'Piliin ang tamang sagot.', questionType: 'multiple_choice', answer: { type: 'multiple_choice', choices: [{ id: 'choice-alpha', text: 'Una' }, { id: 'choice-beta', text: 'Ikalawa' }], choiceId: 'choice-beta' }, competencySnapshot: { id: 'comp-1', code: 'C1', text: 'Competency text', sourcePage: 2, academicPeriodId: 'period-1', curriculumPeriodId: 'period-1', curriculumPeriodLabel: 'Unang Markahan' }, cognitiveCategorySnapshot: { id: 'remember', label: 'Remembering', shortLabel: 'R' }, mapping: { rowId: 'row-1', competencyId: 'comp-1', cognitiveCategoryId: 'remember', allocationItemStart: 1, allocationItemEnd: 1, allocationIndex: 0 }, promptLanguage: 'filipino', authorshipState: 'manual', rationale: 'Teacher rationale', teacherNotes: 'Internal note', points: 1 },
  { id: 'item-2', itemNumber: 2, prompt: 'Isulat ang iyong sagot.', questionType: 'short_answer', answer: { type: 'short_answer', acceptedAnswers: ['Sagot'], caseSensitive: false }, competencySnapshot: { id: 'comp-1', code: 'C1', text: 'Competency text', sourcePage: 2, academicPeriodId: 'period-1', curriculumPeriodId: 'period-1', curriculumPeriodLabel: 'Unang Markahan' }, cognitiveCategorySnapshot: { id: 'remember', label: 'Remembering', shortLabel: 'R' }, mapping: { rowId: 'row-1', competencyId: 'comp-1', cognitiveCategoryId: 'remember', allocationItemStart: 2, allocationItemEnd: 2, allocationIndex: 0 }, authorshipState: 'teacher_accepted', rationale: '', teacherNotes: '', points: 2 },
]
const assessment = { id: 'assessment-1', userId: 'teacher-1', assignmentId: 'assignment-1', title: 'Pagtataya sa Matematika', instructions: 'Basahin ang bawat tanong at piliin ang sagot.', gradeLevel: '7', learningArea: 'Mathematics', schoolYear: '2026–2027', gradingTermId: 'term-1', gradingTermLabel: 'Unang Markahan', curriculumPeriodIds: ['period-1'], curriculumPeriodLabels: ['Unang Markahan'], totalItems: 2, versionNumber: 1, status: 'draft', sourceTos: { id: 'tos-1', versionNumber: 1, title: 'TOS', status: 'final', assignmentId: 'assignment-1', schoolYear: '2026–2027', academicPeriodLabel: 'Unang Markahan', content: {} }, items, createdAt: '', updatedAt: '' }

const sharedOptions = { documentLanguage: 'filipino', teacherName: 'Guro', schoolName: 'Paaralan', learnerName: '', section: '' }
const student = modelEngine.buildAssessmentStudentExportModel(assessment, sharedOptions)
const studentJson = JSON.stringify(student)
assert.equal(student.mode, 'student')
assert.equal(student.language, 'filipino')
assert.equal(student.labels.documentTitle, 'PAGTATAYA')
assert.equal(student.questions[0].choices[0], 'Una')
assert.doesNotMatch(studentJson, /choice-alpha|choice-beta|comp-1|row-1|ai_suggestion|teacher_accepted|teacher rationale|Internal note|sourceTos|GuroDesk/)
assert.equal('curriculumPeriods' in student.metadata, false)
assert.equal(student.questions[0].prompt, items[0].prompt, 'authored prompt language must be preserved')

const teacher = modelEngine.buildAssessmentTeacherExportModel(assessment, { ...sharedOptions, includeAnswer: true, includeCompetency: true, includeCognitiveCategory: true, includeRationale: true })
assert.equal(teacher.mode, 'teacher')
assert.equal('answer' in teacher.questions[0], true)
assert.equal('competency' in teacher.questions[0], true)
assert.equal('cognitiveCategory' in teacher.questions[0], true)
assert.equal('rationale' in teacher.questions[0], true)
assert.match(JSON.stringify(teacher), /curriculumPeriods|Unang Markahan/)
assert.doesNotMatch(JSON.stringify(teacher), /authorshipState|teacherNotes|Internal note/)

const answerKey = modelEngine.buildAssessmentAnswerKeyExportModel(assessment, sharedOptions)
assert.equal(answerKey.mode, 'answer_key')
assert.equal(answerKey.questions[0].answer.type, 'multiple_choice')
assert.equal('prompt' in answerKey.questions[0], false, 'answer key should be compact item-number to structured answer')
assert.equal('choices' in answerKey.questions[0], false)
assert.equal(answerKey.questions[1].answer.type, 'short_answer')
assert.equal(answerKey.questions[1].answer.acceptedAnswers[0], 'Sagot')
assert.equal('learnerName' in answerKey.metadata, false)
assert.equal('section' in answerKey.metadata, false)
assert.equal(answerKey.instructions, '')
const answerKeyPrint = exportEngine.assessmentPrintHtml(answerKey)
assert.doesNotMatch(answerKeyPrint, /choice-alpha|choice-beta|Basahin ang bawat tanong|Panuto/)

const longLines = Array.from({ length: 137 }, (_, index) => `authored line ${index + 1}`)
const pages = exportEngine.paginateAssessmentLines(longLines, 17)
assert.deepEqual(pages.flatMap((page) => page.lines), longLines, 'long-flow pagination must preserve every line exactly once')
assert.throws(() => exportEngine.paginateAssessmentLines(longLines, 0), /positive whole number/)

for (const sourceFile of ['src/lib/assessmentExportModel.ts', 'src/lib/assessmentExport.ts']) {
  const source = read(sourceFile)
  assert.doesNotMatch(source, /Gemini|gemini|fetch\(/)
  assert.doesNotMatch(source, /GuroDesk/)
}
const typeSource = read('src/types/assessmentExport.ts')
assert.doesNotMatch(typeSource, /authorshipState|teacherNotes/)
const exportSource = read('src/lib/assessmentExport.ts')
for (const required of ['downloadAssessmentPdf', 'downloadAssessmentDocx', 'printAssessment', 'keepNext', 'keepLines', 'Phase 3.7 custom assessment DOCX']) assert.match(exportSource, new RegExp(required))
assert.match(read('src/lib/assessmentExportModel.ts'), /buildAssessmentStudentExportModel/)
assert.match(read('src/lib/assessmentExportModel.ts'), /choices: base\.choices\.map/)
assert.match(exportSource, /question-flow/)

console.log('Phase 4.3 validation passed: student-safe model, optional teacher context, compact structured answer key, authored-language preservation, no AI/branding, and lossless long-flow pagination with PDF/DOCX/print functions.')
