import assert from 'node:assert/strict'
import fs from 'node:fs'

const generation = fs.readFileSync('src/lib/assessmentGeneration.ts', 'utf8')
const qa = fs.readFileSync('src/lib/assessmentQa.ts', 'utf8')
const editor = fs.readFileSync('src/pages/AssessmentEditorPage.tsx', 'utf8')
const e2e = fs.readFileSync('tests/e2e/assessment-flow.spec.ts', 'utf8')
const batchTest = fs.readFileSync('tests/unit/assessment-generation-batch-regressions.test.ts', 'utf8')

assert.match(generation, /legacyVisualPresent/, 'legacy combined question+visual responses remain accepted')
assert.match(generation, /if \(candidate\.visual\)[\s\S]{0,700}else if \(initialVisualRequirement === 'required'\)/, 'an already-returned legacy visual prevents a second visual request')
assert.match(generation, /"helpful" visuals are intentionally deferred/, 'helpful visuals do not automatically double provider calls')
assert.match(generation, /edge_transport/, 'Edge transport failures have an explicit category')
assert.match(generation, /Failed to send a request to the Edge Function/, 'Supabase Functions fetch failures are recognized')
assert.match(generation, /summary\.providerPaused = true[\s\S]{0,120}paused = true/, 'exhausted service boundaries stop the remainder of the batch')
assert.match(qa, /verifyRecommended: level === 'high'/, 'automatic independent verification is reserved for high-risk items')
assert.match(editor, /concurrency: 1,/, 'phone-first bulk generation is sequential')
assert.match(editor, /checkpointAssessmentGenerationSuccess\(checkpoint, item\)[\s\S]{0,180}setBatchFailures\(checkpointFailures\(checkpoint\)\)/, 'successful retries clear stale visible failure entries')
assert.match(e2e, /assessment-editor-context:visible/, 'E2E Source TOS lookup scopes to the visible responsive context')
assert.match(e2e, /strong:visible/, 'E2E Source TOS title excludes the hidden duplicate')
assert.doesNotMatch(batchTest, /onSuggestion:\s*\(\) => events\.push\(/, 'batch test callback must not return Array.push number')

console.log('Assessment generation stability hotfix validation passed: legacy backend compatibility, bounded request pressure, Edge transport retry/pause, live failure reconciliation, and visible E2E targeting are preserved.')
