import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

async function loadTypeScriptModule(file) {
  const source = read(file)
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, removeComments: false },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const blueprint = await loadTypeScriptModule('src/lib/assessmentBlueprint.ts')
const validation = await loadTypeScriptModule('src/lib/assessmentValidation.ts')

const category = (id, sortOrder) => ({ id, label: id === 'remember' ? 'Remembering' : id === 'apply' ? 'Applying' : 'Analyzing', shortLabel: id.slice(0, 2).toUpperCase(), weight: '1', sortOrder })
function makeTos(total, rowCount = 1, categoryCount = 1, status = 'final') {
  const categories = Array.from({ length: categoryCount }, (_, index) => category(['remember', 'apply', 'analyze'][index] ?? `cat-${index + 1}`, index + 1))
  const rows = []
  let cursor = 1
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const remainingRows = rowCount - rowIndex
    const rowTotal = Math.floor((total - (cursor - 1)) / remainingRows)
    const allocations = []
    let allocationCursor = cursor
    for (let categoryIndex = 0; categoryIndex < categoryCount; categoryIndex += 1) {
      const remainingCategories = categoryCount - categoryIndex
      const count = categoryIndex === categoryCount - 1 ? rowTotal - allocations.reduce((sum, item) => sum + item.itemCount, 0) : Math.floor(rowTotal / remainingCategories)
      const start = count > 0 ? allocationCursor : null
      const end = count > 0 ? allocationCursor + count - 1 : null
      allocations.push({ categoryId: categories[categoryIndex].id, label: categories[categoryIndex].label, shortLabel: categories[categoryIndex].shortLabel, itemCount: count, itemStart: start, itemEnd: end, rangeLabel: start === null ? '' : start === end ? String(start) : `${start}–${end}` })
      if (end !== null) allocationCursor = end + 1
    }
    const rowEnd = allocationCursor - 1
    rows.push({
      id: `row-${rowIndex + 1}`,
      sortOrder: rowIndex + 1,
      competency: { id: `comp-${rowIndex + 1}`, code: `C-${rowIndex + 1}`, text: `Competency ${rowIndex + 1}`, sourcePage: rowIndex + 2, sourceTitle: 'Verified source', sourceUrl: 'https://example.invalid/source', academicPeriodId: `period-${rowIndex + 1}`, curriculumPeriodLabel: `Quarter ${rowIndex + 1}`, verificationStatus: 'verified' },
      instructionalMinutes: '60', manualWeight: '', itemCountOverride: '', cognitiveWeights: Object.fromEntries(categories.map((item) => [item.id, '1'])), notes: '', computedWeightPercent: '100.00', itemCount: rowTotal, itemStart: rowTotal ? cursor : null, itemEnd: rowTotal ? rowEnd : null, itemRangeLabel: rowTotal ? `${cursor}–${rowEnd}` : '', cognitiveAllocations: allocations,
    })
    cursor = rowEnd + 1
  }
  const content = {
    schemaVersion: 1, title: 'Verified TOS', assessmentTitle: 'Quarter Assessment', gradeLevel: '7', learningArea: 'Mathematics', sections: ['A'], schoolYear: '2026–2027', gradingTermId: 'term-1', gradingTermLabel: 'Quarter 1', curriculumVersionId: 'version-1', curriculumVersionCode: 'MATATAG-7', curriculumVersionName: 'MATATAG', curriculumSubjectId: 'subject-1', curriculumPeriodIds: rows.map((row) => row.competency.academicPeriodId), curriculumPeriodLabels: rows.map((row) => row.competency.curriculumPeriodLabel), sourceTitle: 'Verified source', sourceUrl: 'https://example.invalid/source', totalItems: total, weightingMethod: 'equal', cognitiveCategories: categories, rows, notes: '', calculation: { engine: 'hamilton-largest-remainder-v1', valid: true, totalAllocated: total, calculatedAt: '2026-08-08T00:00:00.000Z', warnings: [] },
  }
  return { id: 'tos-final-1', userId: 'teacher-1', assignmentId: 'assignment-1', title: 'Verified TOS', schoolYear: content.schoolYear, academicPeriodLabel: 'Quarter 1', status, content, versionNumber: 3, createdAt: '2026-08-08T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z' }
}

for (const total of [1, 37, 40, 43]) {
  const record = makeTos(total)
  const assessment = blueprint.createAssessmentBlueprint(record, { now: '2026-08-08T01:00:00.000Z' })
  assert.equal(assessment.totalItems, total)
  assert.deepEqual(assessment.items.map((item) => item.itemNumber), Array.from({ length: total }, (_, index) => index + 1))
  assert.equal(assessment.items.length, total)
  assert.ok(assessment.items.every((item) => item.mapping.rowId === 'row-1' && item.mapping.competencyId === 'comp-1'))
  assert.ok(assessment.items.every((item) => !('sourceTos' in item)), 'full source snapshot belongs once on assessment')
  assert.equal(assessment.sourceTos.content.totalItems, total)
  assert.equal(assessment.sourceTos.versionNumber, 3)
}

const multi = blueprint.createAssessmentBlueprint(makeTos(43, 3, 3), { now: '2026-08-08T01:00:00.000Z' })
assert.equal(new Set(multi.items.map((item) => item.mapping.rowId)).size, 3)
assert.equal(new Set(multi.items.map((item) => item.mapping.cognitiveCategoryId)).size, 3)
assert.deepEqual(multi.items.map((item) => item.itemNumber), Array.from({ length: 43 }, (_, index) => index + 1))
const sourceCopy = JSON.stringify(multi.sourceTos)
multi.sourceTos.content.rows[0].notes = 'changed after creation'
assert.equal(JSON.stringify(multi.items[0].competencySnapshot.text), '"Competency 1"')
assert.notEqual(JSON.stringify(multi.sourceTos), sourceCopy)

assert.throws(() => blueprint.createAssessmentBlueprint(makeTos(1, 1, 1, 'draft'), {}), /finalized TOS/)
assert.throws(() => blueprint.createAssessmentBlueprint(makeTos(0), {}), /at least one item/)
const duplicate = blueprint.duplicateAssessmentBlueprint(multi, { now: '2026-08-08T02:00:00.000Z' })
assert.equal(duplicate.status, 'draft')
assert.equal(duplicate.items.length, multi.items.length)
assert.notDeepEqual(duplicate.items.map((item) => item.id), multi.items.map((item) => item.id))
assert.deepEqual(duplicate.items.map((item) => item.mapping), multi.items.map((item) => item.mapping))
assert.deepEqual(duplicate.sourceTos, multi.sourceTos)

const emptyDraft = blueprint.createAssessmentBlueprint(makeTos(2), {})
const draftResult = validation.validateAssessmentDraft(emptyDraft)
assert.equal(draftResult.ready, false)
assert.ok(draftResult.warnings.some((item) => item.key === 'prompt'))

function complete(item) {
  return { ...item, prompt: `Question ${item.itemNumber}`, authorshipState: 'manual', points: 1, answer: { type: 'multiple_choice', choices: [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Beta' }], choiceId: 'a' } }
}
const validFinal = { ...emptyDraft, status: 'final', items: emptyDraft.items.map(complete) }
assert.equal(validation.validateAssessmentFinal(validFinal).ready, true)
assert.equal(validation.validateAssessmentFinal({ ...validFinal, items: validFinal.items.map((item) => ({ ...item, authorshipState: 'ai_suggestion' })) }).ready, false)
assert.ok(validation.validateAssessmentFinal({ ...validFinal, items: validFinal.items.map((item) => ({ ...item, answer: { type: 'multiple_choice', choices: [{ id: 'a', text: 'Same' }, { id: 'b', text: 'same' }], choiceId: 'a' } })) }).errors.some((item) => item.key === 'structured-answer'))
assert.ok(validation.validateAssessmentFinal({ ...validFinal, items: validFinal.items.map((item, index) => index === 0 ? { ...item, answer: { type: 'multiple_choice', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], choiceId: '' } } : item) }).errors.some((item) => item.key === 'structured-answer'))
assert.ok(validation.validateAssessmentFinal({ ...validFinal, items: [{ ...validFinal.items[0], itemNumber: 2 }, validFinal.items[1]] }).errors.some((item) => item.key === 'item-number-gap' || item.key === 'duplicate-item-number'))
assert.ok(validation.validateAssessmentFinal({ ...validFinal, items: validFinal.items.map((item, index) => index === 0 ? { ...item, mapping: { ...item.mapping, cognitiveCategoryId: 'tampered' } } : item) }).errors.some((item) => item.key === 'mapping-mismatch'))
assert.ok(validation.validateAssessmentFinal({ ...validFinal, items: validFinal.items.map((item, index) => index === 0 ? { ...item, competencySnapshot: { ...item.competencySnapshot, text: 'Tampered competency' } } : item) }).errors.some((item) => item.key === 'competency-snapshot'))
assert.ok(validation.validateAssessmentFinal({ ...validFinal, items: validFinal.items.map((item, index) => index === 0 ? { ...item, cognitiveCategorySnapshot: { ...item.cognitiveCategorySnapshot, label: 'Tampered category' } } : item) }).errors.some((item) => item.key === 'cognitive-snapshot'))
const shortBase = blueprint.createAssessmentBlueprint(makeTos(1), {})
const shortFinal = { ...shortBase, status: 'final', items: [{ ...shortBase.items[0], prompt: 'Short answer', authorshipState: 'manual', points: 1, questionType: 'short_answer', answer: { type: 'short_answer', acceptedAnswers: ['one', 'Two'], caseSensitive: true } }] }
assert.equal(validation.validateAssessmentFinal(shortFinal).ready, true)
assert.ok(validation.validateAssessmentFinal({ ...shortFinal, items: [{ ...shortFinal.items[0], answer: { type: 'short_answer', acceptedAnswers: ['same', 'SAME'], caseSensitive: false } }] }).errors.some((item) => item.key === 'structured-answer'))
const trueFalseBase = blueprint.createAssessmentBlueprint(makeTos(1), {})
const trueFalseFinal = { ...trueFalseBase, status: 'final', items: [{ ...trueFalseBase.items[0], prompt: 'True or false', authorshipState: 'manual', points: 1, questionType: 'true_false', answer: { type: 'true_false', value: true } }] }
assert.equal(validation.validateAssessmentFinal(trueFalseFinal).ready, true)
assert.ok(validation.validateAssessmentFinal({ ...trueFalseFinal, items: [{ ...trueFalseFinal.items[0], answer: { type: 'true_false', value: 'true' } }] }).errors.some((item) => item.key === 'structured-answer'))
const constructedBase = blueprint.createAssessmentBlueprint(makeTos(1), {})
const constructedFinal = { ...constructedBase, status: 'final', items: [{ ...constructedBase.items[0], prompt: 'Explain', authorshipState: 'manual', points: 1, questionType: 'constructed_response', answer: { type: 'constructed_response', expectedResponse: 'A valid expected response', sampleResponse: 'A valid sample response', rubricGuidance: 'Award points for reasoning.' } }] }
assert.equal(validation.validateAssessmentFinal(constructedFinal).ready, true)
assert.ok(validation.validateAssessmentFinal({ ...constructedFinal, items: [{ ...constructedFinal.items[0], answer: { type: 'constructed_response', expectedResponse: '', sampleResponse: '' } }] }).errors.some((item) => item.key === 'structured-answer'))

const assessmentSources = [read('src/types/assessment.ts'), read('src/lib/assessmentBlueprint.ts'), read('src/lib/assessmentValidation.ts')].join('\n')
assert.doesNotMatch(assessmentSources, /Gemini|fetch\(|Math\.random\(/)
const optionalMigration = fs.readdirSync(path.join(root, 'supabase/migrations')).find((file) => /assessment/i.test(file))
if (optionalMigration) {
  const migrationSource = read(`supabase/migrations/${optionalMigration}`)
  assert.match(migrationSource, /assessment_documents/)
  assert.match(migrationSource, /assessment_items/)
  assert.match(migrationSource, /source_tos_content_snapshot/)
  assert.match(migrationSource, /authorship_state/)
  assert.match(migrationSource, /save_assessment_document/)
  assert.match(migrationSource, /item numbers must be exactly contiguous/i)
}

console.log('Phase 4.1 validation passed: deterministic 1/37/40/43 expansion, immutable single TOS snapshot, mapping preservation, duplication, structured-answer checks, and teacher-review gating.')
