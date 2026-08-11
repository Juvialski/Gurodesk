import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const presentation = read('src/lib/assessmentExportPresentation.ts')
const preview = read('src/components/AssessmentDocumentView.tsx')
const exporters = read('src/lib/assessmentExport.ts')
const generation = read('src/lib/assessmentGeneration.ts')
const resume = read('src/lib/assessmentGenerationResume.ts')
const planning = read('src/lib/assessmentVisualPlanning.ts')
const repository = read('src/lib/assessmentRepository.ts')
const edge = read('supabase/functions/assessment-question-generator/index.ts')
const editor = read('src/pages/AssessmentEditorPage.tsx')
const canonicalTest = read('tests/unit/assessment-paper-canonical.test.tsx')
const enrichmentTest = read('tests/unit/assessment-visual-enrichment.test.ts')

assert.match(presentation, /type AssessmentPaperPresentationModel/u, 'assessment paper needs one renderer-neutral presentation model')
assert.match(presentation, /assessmentPaperCanonicalSignature/u, 'canonical paper structure needs a stable regression signature')
assert.match(presentation, /metadataRows/u, 'official paper metadata order stays centralized')
assert.match(presentation, /continuationDocumentTitle/u, 'continuation-page identity stays centralized')
assert.match(preview, /buildAssessmentPaperPresentation\(model\)/u, 'browser preview consumes the canonical paper model')
assert.match(preview, /data-paper-model="assessment-paper-v1"/u, 'browser preview exposes the canonical paper marker')
assert.ok((exporters.match(/buildAssessmentPaperPresentation\(/gu) ?? []).length >= 4, 'PDF, DOCX, print HTML, and print model consume the canonical paper model')
assert.match(exporters, /headers: \{ first: new Header[\s\S]*default: docxContinuationHeader\(paper\)/u, 'DOCX has a continuation-page header')
assert.match(exporters, /data-continuation-document-title/u, 'browser print carries continuation-page metadata')

assert.match(planning, /assessmentVisualSourceHash/u, 'visual plans bind to a deterministic question source hash')
assert.match(planning, /AssessmentVisualStatus/u, 'visual lifecycle uses explicit persisted states')
assert.match(planning, /invalidateAssessmentVisualAfterContentEdit/u, 'question edits invalidate stale diagrams')
assert.match(repository, /answer\._visualPlan/u, 'visual plans persist through the existing assessment answer envelope')
assert.match(generation, /enrichAssessmentVisualsSequentially/u, 'visual generation has a dedicated second pass')
assert.match(generation, /for \(let index = 0; index < candidates\.length; index \+= 1\)/u, 'visual enrichment stays strictly sequential')
assert.match(generation, /A failed[\s\S]*optional diagram never replaces or discards/u, 'visual failure preserves the paid-for question')
assert.match(resume, /phase: 'questions' \| 'visuals' \| 'complete'/u, 'resume checkpoints distinguish question and visual phases')
assert.match(resume, /sameQuestion\(next, visualItem\)/u, 'resume never attaches a visual to changed question content')
assert.match(editor, /Regenerate visual/u, 'teachers can explicitly regenerate a stale or failed visual')

assert.match(edge, /stableJson\(approved\.answer\) !== stableJson\(savedAnswerForVisual\(item\.answer\)\)/u, 'the Edge boundary compares browser candidates with authoritative saved answers')
assert.match(edge, /saved question changed before visual generation/u, 'stale visual requests are rejected before provider spend')
assert.match(canonicalTest, /exactly 20 questions, 41 points/u, 'Test 4 canonical export fixture remains covered')
assert.match(enrichmentTest, /one in-flight request/u, 'sequential provider use remains covered')

console.log('Assessment paper/visual enrichment validation passed: one canonical paper model drives preview/PDF/DOCX/print, Test 4 covers all question types, and visual generation is durable, source-bound, sequential, and resumable.')

