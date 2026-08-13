import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

const componentSource = readSource('src/components/AiAssistTextarea.tsx')
const edgeSource = readSource('supabase/functions/lesson-ai-support/index.ts')

describe('topic-first lesson AI context contract', () => {
  it('enables planning suggestions from a topic or a verified primary/legacy competency', () => {
    expect(componentSource).toContain('const hasLessonFocus = Boolean(context.lessonFocus?.trim())')
    expect(componentSource).toContain('context.primaryCompetency?.text.trim() || context.competencyText?.trim()')
    expect(componentSource).toContain('const hasPlanningAnchor = hasLessonFocus || hasVerifiedCompetency')
    expect(componentSource).toContain('disabled={!hasPlanningAnchor || Boolean(loading)}')

    expect(edgeSource).toMatch(
      /suggestionSupport\.has\([\s\S]*?&& !lessonFocus && !primaryCompetency && !historicalCompetencyText/u,
    )
    expect(edgeSource).toContain('Enter a lesson topic or choose a verified competency before requesting planning suggestions.')
    expect(edgeSource).not.toContain('Choose a verified competency before requesting planning suggestions.')
    expect(componentSource).not.toContain('Choose a verified competency first so suggestions stay curriculum-grounded.')
  })

  it('labels teacher topics separately from verified curriculum grounding', () => {
    expect(edgeSource).toContain('TEACHER-PROVIDED LESSON TOPIC:')
    expect(edgeSource).toContain('VERIFIED PRIMARY COMPETENCY:')
    expect(edgeSource).toContain('OTHER VERIFIED ALIGNMENTS:')
    expect(componentSource).toContain('Topic-grounded suggestions use your teacher-provided lesson focus.')
  })

  it('bounds the new context and retains the legacy alias', () => {
    expect(edgeSource).toContain('lessonFocus?: string')
    expect(edgeSource).toContain('primaryCompetency?: VerifiedCompetencyContext | null')
    expect(edgeSource).toContain('additionalCompetencies?: VerifiedCompetencyContext[]')
    expect(edgeSource).toContain('competencyText?: string')
    expect(edgeSource).toContain('boundedText(ctx.lessonFocus, 500)')
    expect(edgeSource).toContain('value.slice(0, 30)')
    expect(edgeSource).toContain('boundedText(candidate.text, 3000)')
  })

  it('server-checks every current alignment before labeling it verified', () => {
    expect(edgeSource).toContain('async function verifyCurriculumContext(')
    expect(edgeSource).toContain('async function resolveAssignmentScope(')
    expect(edgeSource).toContain(".from('teacher_assignments')")
    expect(edgeSource).toContain(".from('curriculum_subjects')")
    expect(edgeSource).toContain(".from('curriculum_versions')")
    expect(edgeSource).toContain(".from('curriculum_applicability')")
    expect(edgeSource).toContain(".eq('verification_status', 'verified')")
    expect(edgeSource).toContain('snapshotMatchesVerifiedRow(snapshot, verified)')
    expect(edgeSource).toContain('curriculumRowMatchesScope(row, subjects, versions, applicableVersionIds, scope, userId)')
    expect(edgeSource).toContain('server-checked grounding context')
    expect(edgeSource).toContain('TEACHER-PROVIDED HISTORICAL COMPETENCY SNAPSHOT (not independently verified)')
    expect(edgeSource).toContain('TEACHER-PROVIDED PERFORMANCE-STANDARD SNAPSHOT (not independently verified)')
    expect(edgeSource).not.toMatch(/verifiedLegacy\s*=/u)
  })

  it('degrades an unconfirmed local snapshot to topic-only context with a visible warning', () => {
    expect(edgeSource).toContain('curriculumContextWarning')
    expect(edgeSource).toContain('Gemini used the teacher-provided topic without those snapshots')
    expect(componentSource).toContain('setWarning(result.curriculumContextWarning ?? null)')
    expect(componentSource).toContain('{warning && <small className="ai-guardrail">{warning}</small>}')
  })

  it('treats the topic as pedagogical focus and forbids invented official alignment', () => {
    expect(edgeSource).toContain('is the pedagogical focus')
    expect(edgeSource).toContain('must never be presented as official curriculum wording')
    expect(edgeSource).toContain('are server-checked grounding context only when supplied')
    expect(edgeSource).toContain('Never invent, add, remove, rewrite, replace, or change official curriculum alignments.')
  })
})
