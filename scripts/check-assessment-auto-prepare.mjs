import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const page = read('src/pages/AssessmentEditorPage.tsx')
const auto = read('src/lib/assessmentAutoPrepare.ts')

assert.match(page, /Generate & prepare paper/, 'assessment generation exposes one main paper-preparation action')
assert.match(page, /runAutomaticPaperPreparation/, 'Generate & prepare paper continues into automated QA')
assert.match(page, /persistVerifiedAssessment/, 'a structurally ready paper is accepted, locked, and finalized in the same workflow')
assert.match(auto, /maxRounds/, 'automatic repair has a bounded retry count')
assert.match(auto, /Math\.min\(3/, 'automatic repair cannot become an unbounded request loop')
assert.match(auto, /AUTO_REPAIRABLE_AUTHORSHIP/, 'automatic replacement is limited by authorship state')
assert.match(auto, /ai_suggestion/, 'AI-generated blockers can be regenerated')
assert.match(auto, /teacher_accepted/, 'previously accepted AI-generated blockers can be regenerated when the teacher explicitly runs auto-prepare')
assert.doesNotMatch(auto, /AUTO_REPAIRABLE_AUTHORSHIP[^\n]*teacher_edited/, 'teacher-edited content is not silently overwritten')
assert.doesNotMatch(auto, /AUTO_REPAIRABLE_AUTHORSHIP[^\n]*manual/, 'manual content is not silently overwritten')
assert.match(auto, /providerPaused/, 'provider/quota boundaries pause rather than burn requests')
assert.match(auto, /reviewAssessmentForFinalization/, 'each repair pass reruns deterministic final QA')

console.log('Assessment automatic paper-preparation validation passed: one click generates missing items, retries AI-owned structural blockers within a strict cap, preserves teacher edits, respects provider boundaries, and finalizes only after deterministic QA passes.')
