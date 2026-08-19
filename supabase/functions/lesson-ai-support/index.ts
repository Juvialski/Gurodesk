import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptCredential, type EncryptionKeySource } from '../_shared/credentialCrypto.ts'
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_MODEL,
  fallbackAllowed,
  isAiModelId,
  isLiteModel,
  type AiModelId,
  type LiteAiModelId,
} from '../_shared/ai-models.ts'
import { callGemini, GeminiHttpError, isFallbackEligibleStatus } from '../_shared/gemini.ts'

type RevisionSupportType = 'refine_clarity' | 'organize_text' | 'grammar_spelling' | 'format_text' | 'translate'
type SuggestionSupportType =
  | 'suggest_learning_objectives'
  | 'suggest_home_alternative'
  | 'suggest_pre_lesson'
  | 'suggest_lesson_flow'
  | 'suggest_contextualization'
  | 'suggest_inclusion'
  | 'suggest_formative_assessment'
  | 'suggest_evidence_of_learning'
  | 'suggest_next_steps'
  | 'suggest_extended_learning'
  | 'quick_draft'
type SupportType = RevisionSupportType | SuggestionSupportType

type VerifiedCompetencyContext = {
  id?: string
  code?: string | null
  text?: string
  sourcePage?: number | null
  sourceTitle?: string | null
}

type RequestBody = {
  supportType?: SupportType
  sectionKey?: string
  text?: string
  targetLanguage?: string
  documentId?: string
  lessonContext?: {
    assignmentId?: string | null
    gradeLevel?: string
    learningArea?: string
    lessonFocus?: string
    primaryCompetency?: VerifiedCompetencyContext | null
    additionalCompetencies?: VerifiedCompetencyContext[]
    /** Legacy single-competency snapshot retained for older lesson records. */
    competencyText?: string
    performanceStandard?: string
    teacherIntent?: string
    curriculumPeriodLabel?: string
    gradingTermLabel?: string
    durationMinutes?: number
    numberOfSessions?: number
    lessonPlanFormat?: 'ilaw' | 'daily_lesson_log'
    learnerContext?: string
    currentFormativeAssessment?: string
    teachingSetup?: {
      languagePreference?: string
      localLanguageName?: string
      typicalClassProfile?: string
      availableTechnology?: string[]
      preferredApproaches?: string[]
      actualResources?: string[]
      resourceNotes?: string
    }
  }
}

type CredentialRow = {
  api_key_ciphertext: string
  api_key_iv: string
  encryption_key_source: EncryptionKeySource
}

type SettingsRow = {
  preferred_model?: string
  fallback_model?: string
  fallback_enabled?: boolean
}

type VerifiedCompetencyRow = {
  id?: unknown
  competency_code?: unknown
  competency_text?: unknown
  source_page?: unknown
  subject_id?: unknown
}

type AssignmentScope = {
  id: string
  schoolYear: string
  gradeLevel: string
  learningArea: string
  curriculumSourceKind: 'official' | 'custom' | 'hybrid'
  curriculumVersionId: string | null
}

type CurriculumSubjectRow = {
  id?: unknown
  curriculum_version_id?: unknown
  grade_level?: unknown
  name?: unknown
}

type CurriculumVersionRow = {
  id?: unknown
  owner_user_id?: unknown
  origin_kind?: unknown
  status?: unknown
  approval_status?: unknown
}

const revisionSupport = new Set<RevisionSupportType>(['refine_clarity', 'organize_text', 'grammar_spelling', 'format_text', 'translate'])
const suggestionSupport = new Set<SuggestionSupportType>([
  'suggest_learning_objectives',
  'suggest_home_alternative',
  'suggest_pre_lesson',
  'suggest_lesson_flow',
  'suggest_contextualization',
  'suggest_inclusion',
  'suggest_formative_assessment',
  'suggest_evidence_of_learning',
  'suggest_next_steps',
  'suggest_extended_learning',
  'quick_draft',
])
const allowedSupport = new Set<SupportType>([...revisionSupport, ...suggestionSupport])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function instructionForRevision(type: RevisionSupportType, targetLanguage?: string) {
  switch (type) {
    case 'refine_clarity': return 'Improve clarity and concision without adding new instructional ideas, objectives, activities, assessments, strategies, resources, or judgments.'
    case 'organize_text': return 'Organize the teacher-authored text for readability. Preserve every instructional decision and do not add new instructional content.'
    case 'grammar_spelling': return 'Correct grammar, spelling, punctuation, and awkward wording only. Preserve meaning and instructional decisions.'
    case 'format_text': return 'Format the teacher-authored text into clear paragraphs or bullets without adding, deleting, or changing instructional decisions.'
    case 'translate': return `Translate the teacher-authored text into ${targetLanguage || 'the requested target language'} while preserving its meaning. Do not add instructional content.`
  }
}

function instructionForSuggestion(type: Exclude<SuggestionSupportType, 'quick_draft'>) {
  switch (type) {
    case 'suggest_learning_objectives': return 'Create three alternative objective sets centered on the supplied lesson focus or, when no topic is supplied, the verified primary competency. Ground them in any supplied verified curriculum alignments. Write direct observable learner objectives. Do not include meta-language or prefixes like "Optional starting point".'
    case 'suggest_home_alternative': return 'Create three alternative home-based or continuity options. Do not require or name any resource, platform, device, module, book, or material unless the teacher explicitly listed it as available. Write direct instructional descriptions.'
    case 'suggest_pre_lesson': return 'Create three brief pre-lesson or prior-knowledge activation options that directly prepare learners for the supplied lesson focus, or for the verified primary competency when no topic is supplied, and any other supplied verified alignments. Write direct activities.'
    case 'suggest_lesson_flow': return 'Create three alternative lesson-flow options with realistic time allocations. Center each on the supplied lesson focus, or on the verified primary competency when no topic is supplied, and ground it in any other supplied verified alignments and teacher-selected objectives. Respect the teacher\'s preferred approaches when provided. Write the direct flow sequence without "Optional" prefixes.'
    case 'suggest_contextualization': return 'Create three contextualization or integration ideas. Keep them generic enough for teacher verification and do not invent local facts, community details, books, websites, or materials. Write direct classroom connections.'
    case 'suggest_inclusion': return 'Create three universal classroom-support options. Do not infer, diagnose, or claim any learner disability, condition, identity, or sensitive need. Use only class-level context supplied by the teacher. Write direct accommodation strategies.'
    case 'suggest_formative_assessment': return 'Create three formative-assessment options centered on the supplied lesson focus, or on the verified primary competency when no topic is supplied, and grounded in any other supplied verified alignments and teacher-selected objectives. Write direct assessment checks and cues.'
    case 'suggest_evidence_of_learning': return 'Create three concise descriptions of observable evidence showing learner mastery. Describe direct student actions and demonstrations.'
    case 'suggest_next_steps': return 'Create three conditional ways-forward options based on possible assessment evidence, including targeted reteaching/remediation and appropriate enrichment.'
    case 'suggest_extended_learning': return 'Create three direct extension, reinforcement, or remediation ideas tightly connected to the supplied lesson focus, or to the verified primary competency when no topic is supplied, and any other supplied verified alignments. Do not require unlisted resources and do not prefix with "Optional".'
  }
}

function resolveSettings(row: SettingsRow | null) {
  const preferredModel: AiModelId = isAiModelId(row?.preferred_model) ? row!.preferred_model as AiModelId : DEFAULT_MODEL
  const fallbackModel: LiteAiModelId = isLiteModel(row?.fallback_model) ? row!.fallback_model as LiteAiModelId : DEFAULT_FALLBACK_MODEL
  return {
    preferredModel,
    fallbackModel,
    fallbackEnabled: row?.fallback_enabled ?? true,
  }
}

function quotaMessage(model: string) {
  return `Gemini quota is currently unavailable for ${model}. Your lesson remains saved. Try the other Flash-Lite model or try again later.`
}

function compactList(items?: string[]) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 30)
}

function boundedText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function boundedVerifiedCompetency(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as VerifiedCompetencyContext
  const id = boundedText(candidate.id, 200)
  const text = boundedText(candidate.text, 3000)
  if (!id || !text) return null
  const sourcePage = Number.isSafeInteger(candidate.sourcePage) && Number(candidate.sourcePage) > 0 && Number(candidate.sourcePage) <= 100000
    ? Number(candidate.sourcePage)
    : null
  return {
    id,
    code: boundedText(candidate.code, 120) || null,
    text,
    sourcePage,
    sourceTitle: boundedText(candidate.sourceTitle, 500) || null,
  }
}

function boundedAdditionalCompetencies(value: unknown) {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0, 30).flatMap((candidate) => {
    const competency = boundedVerifiedCompetency(candidate)
    if (!competency || seen.has(competency.id)) return []
    seen.add(competency.id)
    return [competency]
  })
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function competencyIdentity(value: string) {
  return looksLikeUuid(value) ? value.toLowerCase() : value
}

function verifiedContextFromRow(row: VerifiedCompetencyRow) {
  const id = boundedText(row.id, 200)
  const text = boundedText(row.competency_text, 3000)
  if (!id || !text) return null
  const sourcePage = Number.isSafeInteger(row.source_page) && Number(row.source_page) > 0 && Number(row.source_page) <= 100000
    ? Number(row.source_page)
    : null
  return {
    id,
    code: boundedText(row.competency_code, 120) || null,
    text,
    sourcePage,
    // Source titles are not accepted from the browser as verified metadata.
    // The authoritative source page still comes from the curriculum row.
    sourceTitle: null,
  }
}

function snapshotMatchesVerifiedRow(
  snapshot: NonNullable<ReturnType<typeof boundedVerifiedCompetency>>,
  verified: NonNullable<ReturnType<typeof verifiedContextFromRow>>,
) {
  return snapshot.text === verified.text
    && (!snapshot.code || snapshot.code === verified.code)
    && (snapshot.sourcePage === null || snapshot.sourcePage === verified.sourcePage)
}

async function resolveAssignmentScope(
  admin: ReturnType<typeof createClient>,
  userId: string,
  assignmentValue: unknown,
  documentValue: unknown,
): Promise<AssignmentScope | null> {
  let assignmentId = boundedText(assignmentValue, 200)
  const documentId = boundedText(documentValue, 200)

  if (documentId) {
    const { data, error } = await admin
      .from('documents')
      .select('assignment_id')
      .eq('id', documentId)
      .eq('user_id', userId)
      .eq('document_type', 'lesson_plan')
      .maybeSingle()
    if (error) throw error
    const documentAssignmentId = boundedText(data?.assignment_id, 200)
    if (assignmentId && documentAssignmentId && assignmentId !== documentAssignmentId) return null
    assignmentId = documentAssignmentId || assignmentId
  }

  if (!assignmentId) return null
  const { data, error } = await admin
    .from('teacher_assignments')
    .select('id, school_year, grade_level, learning_area, curriculum_source_kind, curriculum_version_id')
    .eq('id', assignmentId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const sourceKind = boundedText(data.curriculum_source_kind, 20)
  if (sourceKind !== 'official' && sourceKind !== 'custom' && sourceKind !== 'hybrid') return null
  return {
    id: boundedText(data.id, 200),
    schoolYear: boundedText(data.school_year, 40),
    gradeLevel: boundedText(data.grade_level, 120),
    learningArea: boundedText(data.learning_area, 200),
    curriculumSourceKind: sourceKind,
    curriculumVersionId: boundedText(data.curriculum_version_id, 200) || null,
  }
}

function curriculumRowMatchesScope(
  row: VerifiedCompetencyRow,
  subjects: Map<string, CurriculumSubjectRow>,
  versions: Map<string, CurriculumVersionRow>,
  applicableVersionIds: Set<string>,
  scope: AssignmentScope,
  userId: string,
) {
  const subject = subjects.get(boundedText(row.subject_id, 200))
  if (!subject) return false
  const versionId = boundedText(subject.curriculum_version_id, 200)
  const version = versions.get(versionId)
  if (!version) return false
  if (boundedText(subject.grade_level, 120) !== scope.gradeLevel) return false
  if (boundedText(subject.name, 200).toLocaleLowerCase('en') !== scope.learningArea.toLocaleLowerCase('en')) return false
  if (!['active', 'superseded'].includes(boundedText(version.status, 30))) return false
  if (!['approved', 'archived'].includes(boundedText(version.approval_status, 30))) return false
  if (!applicableVersionIds.has(versionId)) return false

  const origin = boundedText(version.origin_kind, 30)
  const ownerId = boundedText(version.owner_user_id, 200) || null
  if (scope.curriculumSourceKind === 'official') return origin === 'official' && ownerId === null
  return scope.curriculumVersionId === versionId
    && origin === scope.curriculumSourceKind
    && ownerId === userId
}

async function verifyCurriculumContext(
  admin: ReturnType<typeof createClient>,
  userId: string,
  scope: AssignmentScope | null,
  primaryValue: unknown,
  additionalValue: unknown,
) {
  const primary = boundedVerifiedCompetency(primaryValue)
  const additional = boundedAdditionalCompetencies(additionalValue)
    .filter((competency) => competency.id !== primary?.id)
  const supplied = primary ? [primary, ...additional] : additional
  const candidatesBySuppliedId = new Map<string, VerifiedCompetencyRow[]>()

  if (!scope || !supplied.length) {
    return {
      verifiedPrimary: null,
      verifiedAdditional: [],
      rejectedIds: supplied.map((snapshot) => snapshot.id),
    }
  }

  const uuidCandidates = supplied.filter((competency) => looksLikeUuid(competency.id))
  if (uuidCandidates.length) {
    const { data, error } = await admin
      .from('curriculum_competencies')
      .select('id, competency_code, competency_text, source_page, subject_id')
      .eq('verification_status', 'verified')
      .in('id', uuidCandidates.map((competency) => competency.id))
    if (error) throw error
    for (const rawRow of data ?? []) {
      const row = rawRow as VerifiedCompetencyRow
      candidatesBySuppliedId.set(competencyIdentity(boundedText(row.id, 200)), [row])
    }
  }

  const fallbackCandidates = supplied.filter((competency) => !looksLikeUuid(competency.id))
  await Promise.all(fallbackCandidates.map(async (snapshot) => {
    let query = admin
      .from('curriculum_competencies')
      .select('id, competency_code, competency_text, source_page, subject_id')
      .eq('verification_status', 'verified')
      .eq('competency_text', snapshot.text)
    if (snapshot.code) query = query.eq('competency_code', snapshot.code)
    if (snapshot.sourcePage !== null) query = query.eq('source_page', snapshot.sourcePage)
    const { data, error } = await query.limit(20)
    if (error) throw error
    candidatesBySuppliedId.set(snapshot.id, (data ?? []) as VerifiedCompetencyRow[])
  }))

  const allRows = [...candidatesBySuppliedId.values()].flat()
  const subjectIds = [...new Set(allRows.map((row) => boundedText(row.subject_id, 200)).filter(Boolean))]
  if (!subjectIds.length) {
    return {
      verifiedPrimary: null,
      verifiedAdditional: [],
      rejectedIds: supplied.map((snapshot) => snapshot.id),
    }
  }

  const { data: subjectRows, error: subjectError } = await admin
    .from('curriculum_subjects')
    .select('id, curriculum_version_id, grade_level, name')
    .in('id', subjectIds)
  if (subjectError) throw subjectError
  const subjects = new Map((subjectRows ?? []).map((raw) => {
    const row = raw as CurriculumSubjectRow
    return [boundedText(row.id, 200), row]
  }))
  const versionIds = [...new Set([...subjects.values()].map((row) => boundedText(row.curriculum_version_id, 200)).filter(Boolean))]
  if (!versionIds.length) {
    return {
      verifiedPrimary: null,
      verifiedAdditional: [],
      rejectedIds: supplied.map((snapshot) => snapshot.id),
    }
  }

  const [versionsResult, applicabilityResult] = await Promise.all([
    admin.from('curriculum_versions')
      .select('id, owner_user_id, origin_kind, status, approval_status')
      .in('id', versionIds),
    admin.from('curriculum_applicability')
      .select('curriculum_version_id')
      .in('curriculum_version_id', versionIds)
      .eq('school_year', scope.schoolYear)
      .eq('grade_level', scope.gradeLevel)
      .in('implementation_status', ['full', 'pilot', 'transitional', 'legacy']),
  ])
  if (versionsResult.error) throw versionsResult.error
  if (applicabilityResult.error) throw applicabilityResult.error
  const versions = new Map((versionsResult.data ?? []).map((raw) => {
    const row = raw as CurriculumVersionRow
    return [boundedText(row.id, 200), row]
  }))
  const applicableVersionIds = new Set((applicabilityResult.data ?? [])
    .map((raw) => boundedText(raw.curriculum_version_id, 200))
    .filter(Boolean))
  const verifiedBySuppliedId = new Map<string, NonNullable<ReturnType<typeof verifiedContextFromRow>>>()

  for (const snapshot of supplied) {
    const key = looksLikeUuid(snapshot.id) ? competencyIdentity(snapshot.id) : snapshot.id
    const matches = (candidatesBySuppliedId.get(key) ?? []).filter((row) => {
      const verified = verifiedContextFromRow(row)
      if (!verified) return false
      return snapshotMatchesVerifiedRow(snapshot, verified)
        && curriculumRowMatchesScope(row, subjects, versions, applicableVersionIds, scope, userId)
    })
    if (matches.length === 1) {
      const verified = verifiedContextFromRow(matches[0])
      if (verified) verifiedBySuppliedId.set(snapshot.id, verified)
    }
  }

  return {
    verifiedPrimary: primary ? verifiedBySuppliedId.get(primary.id) ?? null : null,
    verifiedAdditional: additional
      .map((snapshot) => verifiedBySuppliedId.get(snapshot.id) ?? null)
      .filter((competency): competency is NonNullable<typeof competency> => Boolean(competency)),
    rejectedIds: supplied
      .filter((snapshot) => !verifiedBySuppliedId.has(snapshot.id))
      .map((snapshot) => snapshot.id),
  }
}

function verifiedCompetencyText(competency: NonNullable<ReturnType<typeof boundedVerifiedCompetency>>) {
  const identity = competency.code ? `${competency.code}: ${competency.text}` : competency.text
  const source = [competency.sourceTitle, competency.sourcePage ? `p. ${competency.sourcePage}` : ''].filter(Boolean).join(', ')
  return source ? `${identity} [verified source: ${source}]` : identity
}

function contextText(body: RequestBody) {
  const ctx = body.lessonContext ?? {}
  const setup = ctx.teachingSetup ?? {}
  const resources = compactList(setup.actualResources)
  const technology = compactList(setup.availableTechnology)
  const approaches = compactList(setup.preferredApproaches)
  const lessonFocus = boundedText(ctx.lessonFocus, 500)
  const primaryCompetency = boundedVerifiedCompetency(ctx.primaryCompetency)
  const legacyCompetencyText = boundedText(ctx.competencyText, 3000)
  const additionalCompetencies = boundedAdditionalCompetencies(ctx.additionalCompetencies)
    .filter((competency) => competency.id !== primaryCompetency?.id && competency.text !== legacyCompetencyText)
  return [
    ctx.gradeLevel ? `Grade: ${ctx.gradeLevel}` : '',
    ctx.learningArea ? `Learning area: ${ctx.learningArea}` : '',
    ctx.curriculumPeriodLabel ? `Curriculum-guide period: ${ctx.curriculumPeriodLabel}` : '',
    ctx.gradingTermLabel ? `School grading term: ${ctx.gradingTermLabel}` : '',
    lessonFocus ? `TEACHER-PROVIDED LESSON TOPIC: ${lessonFocus}` : '',
    primaryCompetency ? `VERIFIED PRIMARY COMPETENCY: ${verifiedCompetencyText(primaryCompetency)}` : '',
    !primaryCompetency && legacyCompetencyText ? `TEACHER-PROVIDED HISTORICAL COMPETENCY SNAPSHOT (not independently verified): ${legacyCompetencyText}` : '',
    additionalCompetencies.length ? `OTHER VERIFIED ALIGNMENTS:\n${additionalCompetencies.map((competency) => `- ${verifiedCompetencyText(competency)}`).join('\n')}` : '',
    ctx.performanceStandard
      ? `TEACHER-PROVIDED PERFORMANCE-STANDARD SNAPSHOT (not independently verified): ${ctx.performanceStandard}`
      : '',
    ctx.teacherIntent ? `Current teacher-selected objectives/intention: ${ctx.teacherIntent}` : '',
    ctx.durationMinutes ? `Minutes per session: ${ctx.durationMinutes}` : '',
    ctx.numberOfSessions ? `Number of sessions: ${ctx.numberOfSessions}` : '',
    ctx.lessonPlanFormat === 'daily_lesson_log' ? 'Lesson-plan format: Daily Lesson Log (four-session grid). Use explicit Session 1, Session 2, Session 3, and Session 4 markers when organizing session-specific suggestions.' : '',
    ctx.learnerContext ? `Teacher-provided class-level context: ${ctx.learnerContext}` : '',
    setup.languagePreference ? `Teacher language preference: ${setup.languagePreference}` : '',
    setup.localLanguageName ? `Teacher-specified local language: ${setup.localLanguageName}` : '',
    setup.typicalClassProfile ? `Reusable teacher-provided class profile: ${setup.typicalClassProfile}` : '',
    approaches.length ? `Teacher-preferred approaches: ${approaches.join('; ')}` : '',
    technology.length ? `TECHNOLOGY AVAILABILITY FOR FEASIBILITY ONLY: ${technology.join('; ')}` : 'TECHNOLOGY AVAILABILITY FOR FEASIBILITY ONLY: none listed',
    resources.length ? `ACTUAL TEACHER-LISTED RESOURCES: ${resources.join('; ')}` : 'ACTUAL TEACHER-LISTED RESOURCES: none listed',
    setup.resourceNotes ? `Teacher resource constraints: ${setup.resourceNotes}` : '',
    ctx.currentFormativeAssessment ? `Current formative-assessment plan: ${ctx.currentFormativeAssessment}` : '',
  ].filter(Boolean).join('\n')
}

function looksFilipino(text: string) {
  const normalized = ` ${text.toLowerCase().replace(/[^a-záéíóúñ\s-]/g, ' ')} `
  const markers = [' ang ', ' mga ', ' ng ', ' sa ', ' ay ', ' upang ', ' mag-aaral', ' aralin', ' gawain', ' pagkatuto', ' natutukoy', ' naipapaliwanag', ' nakagagawa']
  return markers.reduce((score, marker) => score + (normalized.includes(marker) ? 1 : 0), 0) >= 3
}

function outputLanguageInstruction(body: RequestBody, teacherText = '') {
  const ctx = body.lessonContext ?? {}
  const setup = ctx.teachingSetup ?? {}
  const preference = (setup.languagePreference ?? 'Auto').trim().toLowerCase()
  const localLanguage = setup.localLanguageName?.trim()

  if (preference === 'filipino') {
    return 'Write all generated planning suggestions in natural Filipino suitable for a Philippine classroom. Keep all supplied verified curriculum wording exactly as supplied when quoting it.'
  }
  if (preference === 'english + filipino') {
    return 'Write in natural Filipino-English bilingual classroom language. Do not force code-switching into every sentence; keep technical terms clear and teacher-editable.'
  }
  if (preference === 'mother tongue / local language') {
    if (localLanguage) return `Write the generated suggestions in ${localLanguage}. Keep official curriculum terms exactly as supplied when a confident local-language equivalent is uncertain; do not invent translations.`
    return 'Follow the dominant language already used in the lesson text. If there is not enough text to determine it, use Filipino and keep official curriculum terms as supplied.'
  }
  if (preference === 'english') {
    return 'Write all generated planning suggestions in clear natural English.'
  }

  const sample = [teacherText, ctx.teacherIntent, ctx.learnerContext, ctx.learningArea].filter(Boolean).join('\n')
  const subjectIsFilipino = (ctx.learningArea ?? '').toLowerCase().includes('filipino')
  if (subjectIsFilipino || looksFilipino(sample)) {
    return 'Automatically match this lesson in Filipino. Write all generated planning suggestions in natural Filipino and preserve all supplied verified curriculum wording when quoted.'
  }
  return 'Automatically match the lesson language. Use clear natural English unless the supplied lesson text is predominantly Filipino.'
}

const sharedSuggestionGuardrail = `You are GuroDesk, an instructional planning assistant for a Philippine DepEd teacher. Write direct, teacher-ready draft lesson plan prose for teacher review. The output is a draft lesson plan, NOT meta-advice, tips, or suggestions on how to plan.
DIRECT PROSE RULE: Every generated sentence must be written as direct classroom instruction, teacher action, learner action, or observable evidence. NEVER begin any field or sentence with meta-phrases such as "Optional...", "Suggested...", "Consider...", "Possible...", "You may...", "Teacher may...", "An optional...", "Sample...", or "Optional Starting Point:".
When supplied, the TEACHER-PROVIDED LESSON TOPIC is the pedagogical focus and must never be presented as official curriculum wording. If it is absent, the VERIFIED PRIMARY COMPETENCY may act as the planning anchor; never invent a missing lesson topic. VERIFIED PRIMARY COMPETENCY and OTHER VERIFIED ALIGNMENTS are server-checked grounding context only when supplied; they are not the lesson's only identity. A TEACHER-PROVIDED HISTORICAL COMPETENCY SNAPSHOT or TEACHER-PROVIDED PERFORMANCE-STANDARD SNAPSHOT is historical/teacher context and must not be claimed as independently verified or current official wording. Never invent, add, remove, rewrite, replace, or change official curriculum alignments. The teacher will select, edit, validate, and approve the final plan.

RESOURCE ACCURACY RULE — CRITICAL: Never invent or cite a book, module, title, author, page number, worksheet, website, platform, app, device, equipment, manipulative, laboratory material, or other resource. A specific resource or technology may appear in a suggestion only if it is explicitly listed under ACTUAL TEACHER-LISTED RESOURCES for THIS LESSON. TECHNOLOGY AVAILABILITY is feasibility context only and is not permission to name or require a device. If no lesson resource is listed, design suggestions that require no named or special resource.

LEARNER PRIVACY/JUDGMENT RULE: Never infer diagnoses, disabilities, identities, personal circumstances, or sensitive learner needs. Use only class-level context supplied by the teacher. Inclusion suggestions must be universal options rather than claims about particular learners.

SOURCE RULE: Do not invent curriculum codes, standards, DepEd policy quotations, citations, local facts, or official requirements. Do not claim that an AI-generated suggestion is officially approved.`

function stripCodeFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseJsonObject(text: string): Record<string, unknown> {
  const clean = stripCodeFence(text)
  try {
    const parsed = JSON.parse(clean)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {}
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(clean.slice(start, end + 1))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  }
  throw new Error('Gemini did not return valid structured JSON.')
}

function sanitizeLessonTitle(title: string): string {
  let cleaned = title.trim()
  cleaned = cleaned.replace(/^(?:(?:Optional|Suggested|Possible|Sample)\s+(?:Starting\s+Point|Lesson|Topic|Title)\s*[:—–-]\s*)/iu, '')
  cleaned = cleaned.replace(/^(?:(?:Optional|Suggested|Possible|Sample)\s*[:—–-]\s*)/iu, '')
  cleaned = cleaned.replace(/^(?:An?\s+)?(?:optional|suggested|possible|sample)\s+/iu, '')
  cleaned = cleaned.trim()
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  return cleaned || title.trim()
}

function sanitizeFieldProse(text: string): string {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^(?:(?:Optional|Suggested|Possible|Sample)\s+(?:Starting\s+Point|Session\s+Flow|Assessment\s+Checks|Support\s+Options|Indicators|Activity|Extension)\s*[:—–-]\s*)/iu, '')
  cleaned = cleaned.replace(/^(?:(?:An?\s+)?(?:optional|suggested|possible)\s+(?:home-based\s+reflection|session\s+flow|assessment\s+checks?|universal\s+support\s+options?|indicators?|extension|activity|check)\s*(?:utilizing|such\s+as|including|focused\s+on)?\s*[:—–-]?\s*)/iu, '')
  cleaned = cleaned.replace(/^(?:(?:An?\s+)?(?:optional|suggested|possible)\s*[:—–-]\s*)/iu, '')
  cleaned = cleaned.replace(/^(?:(?:Consider|You\s+may|Teacher\s+may)\s+(?:using|utilizing|providing|conducting|beginning\s+with)\s+)/iu, 'Use ')
  cleaned = cleaned.replace(/^(?:(?:Consider|You\s+may|Teacher\s+may)\s+)/iu, '')
  cleaned = cleaned.trim()
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  return cleaned || text.trim()
}

function cleanSuggestions(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => typeof item === 'string' ? sanitizeFieldProse(item) : '')
    .filter((item) => item.length >= 8)
    .slice(0, 4)
}

function cleanDraft(value: Record<string, unknown>) {
  const allowed = [
    'lessonTitle',
    'learningObjectives',
    'homeBasedAlternative',
    'preLessonActivity',
    'lessonFlow',
    'integrationContextualization',
    'inclusionAccommodations',
    'formativeAssessments',
    'evidenceOfLearning',
    'nextSteps',
    'extendedLearning',
  ]
  const draft: Record<string, string> = {}
  for (const key of allowed) {
    const raw = value[key]
    if (typeof raw === 'string' && raw.trim().length >= 4) {
      if (key === 'lessonTitle') {
        draft[key] = sanitizeLessonTitle(raw)
      } else {
        draft[key] = sanitizeFieldProse(raw)
      }
    }
  }
  return draft
}

async function callWithFallback(apiKey: string, settings: ReturnType<typeof resolveSettings>, prompt: string, maxOutputTokens: number) {
  let modelUsed: AiModelId = settings.preferredModel
  let fallbackUsed = false
  let output: string
  try {
    output = await callGemini(apiKey, settings.preferredModel, prompt, { maxOutputTokens, temperature: 0.35 })
  } catch (error) {
    if (
      error instanceof GeminiHttpError
      && isFallbackEligibleStatus(error.status)
      && fallbackAllowed(settings.preferredModel, settings.fallbackModel, settings.fallbackEnabled)
    ) {
      output = await callGemini(apiKey, settings.fallbackModel, prompt, { maxOutputTokens, temperature: 0.35 })
      modelUsed = settings.fallbackModel
      fallbackUsed = true
    } else {
      throw error
    }
  }
  return { output, modelUsed, fallbackUsed }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const body = await req.json() as RequestBody
    const supportType = body.supportType
    const text = body.text?.trim() ?? ''
    if (!supportType || !allowedSupport.has(supportType)) return json({ error: 'Unsupported AI support task.' }, 400)
    if (revisionSupport.has(supportType as RevisionSupportType) && text.length < 10) return json({ error: 'Enter the information first before requesting text polishing.' }, 400)
    if (text.length > 12000) return json({ error: 'Section is too long for one AI request.' }, 400)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Supabase function environment is incomplete.' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid authentication session.' }, 401)

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const userId = userData.user.id
    const isSuggestionRequest = suggestionSupport.has(supportType as SuggestionSupportType)
    const legacyCompetencyText = boundedText(body.lessonContext?.competencyText, 3000)
    const suppliedPrimary = boundedVerifiedCompetency(body.lessonContext?.primaryCompetency)
    const suppliedAdditional = boundedAdditionalCompetencies(body.lessonContext?.additionalCompetencies)
    const hasCurrentAlignmentPayload = Boolean(suppliedPrimary || suppliedAdditional.length)
    const assignmentScope = isSuggestionRequest
      ? await resolveAssignmentScope(admin, userId, body.lessonContext?.assignmentId, body.documentId)
      : null
    const verifiedContext = isSuggestionRequest
      ? await verifyCurriculumContext(
          admin,
          userId,
          assignmentScope,
          body.lessonContext?.primaryCompetency,
          body.lessonContext?.additionalCompetencies,
        )
      : { verifiedPrimary: null, verifiedAdditional: [], rejectedIds: [] }
    const curriculumContextWarning = verifiedContext.rejectedIds.length
      ? 'Some selected curriculum snapshots could not be confirmed for this teaching assignment, so Gemini used the teacher-provided topic without those snapshots. Reopen curriculum alignment before relying on them as current official context.'
      : undefined
    const effectiveBody: RequestBody = {
      ...body,
      lessonContext: {
        ...(body.lessonContext ?? {}),
        assignmentId: assignmentScope?.id ?? null,
        gradeLevel: assignmentScope?.gradeLevel ?? body.lessonContext?.gradeLevel,
        learningArea: assignmentScope?.learningArea ?? body.lessonContext?.learningArea,
        primaryCompetency: verifiedContext.verifiedPrimary,
        additionalCompetencies: verifiedContext.verifiedAdditional,
        competencyText: isSuggestionRequest && !hasCurrentAlignmentPayload ? legacyCompetencyText : undefined,
      },
    }
    const lessonFocus = boundedText(effectiveBody.lessonContext?.lessonFocus, 500)
    const primaryCompetency = boundedVerifiedCompetency(effectiveBody.lessonContext?.primaryCompetency)
    const historicalCompetencyText = boundedText(effectiveBody.lessonContext?.competencyText, 3000)
    if (isSuggestionRequest && !lessonFocus && !primaryCompetency && !historicalCompetencyText) {
      return json({ error: 'Enter a lesson topic or choose a verified competency before requesting planning suggestions.' }, 400)
    }
    const [credentialResult, settingsResult] = await Promise.all([
      admin.from('teacher_ai_credentials').select('api_key_ciphertext, api_key_iv, encryption_key_source').eq('user_id', userId).maybeSingle(),
      admin.from('teacher_ai_settings').select('preferred_model, fallback_model, fallback_enabled').eq('user_id', userId).maybeSingle(),
    ])
    if (credentialResult.error) throw credentialResult.error
    if (settingsResult.error) throw settingsResult.error
    if (!credentialResult.data) {
      return json({ error: 'Connect your Gemini API key in Settings → AI Assistant before using AI support.', code: 'AI_KEY_NOT_CONFIGURED' }, 409)
    }

    const credential = credentialResult.data as CredentialRow
    let apiKey: string
    try {
      apiKey = await decryptCredential(credential.api_key_ciphertext, credential.api_key_iv, credential.encryption_key_source)
    } catch (error) {
      console.error('Unable to decrypt teacher Gemini credential', error)
      return json({ error: 'Your saved Gemini key can no longer be decrypted. Replace it in Settings → AI Assistant.', code: 'AI_KEY_RECONNECT_REQUIRED' }, 409)
    }

    const settings = resolveSettings((settingsResult.data ?? null) as SettingsRow | null)
    const context = contextText(effectiveBody)
    const declarationCategory = suggestionSupport.has(supportType as SuggestionSupportType)
      ? 'suggested'
      : supportType === 'refine_clarity' || supportType === 'organize_text' ? 'limited' : 'guided'

    let prompt: string
    let maxOutputTokens = 4096
    if (revisionSupport.has(supportType as RevisionSupportType)) {
      const revisionLanguageRule = supportType === 'translate'
        ? `Translation target: ${body.targetLanguage || 'the requested language'}.`
        : 'LANGUAGE RULE: Preserve the language of the teacher-authored text. Do not translate it unless the selected task is Translate.'
      prompt = `You are a text-support assistant. The teacher supplied the content and remains responsible for its accuracy. Perform only the requested text operation. Do not add new facts, resources, citations, objectives, activities, assessments, strategies, learner judgments, or instructional decisions. Return only the revised text.\n\n${revisionLanguageRule}\nTask: ${instructionForRevision(supportType as RevisionSupportType, body.targetLanguage)}\n${context ? `\nContext for preserving meaning only:\n${context}\n` : ''}\nTeacher text:\n---\n${text}\n---`
    } else if (supportType === 'quick_draft') {
      maxOutputTokens = 7500
      prompt = `${sharedSuggestionGuardrail}\n\nOUTPUT LANGUAGE RULE: ${outputLanguageInstruction(effectiveBody, text)}\n\nPrepare ONE coherent quick-draft lesson plan written in direct, classroom-ready prose for teacher review.\nDIRECT INSTRUCTIONAL CONTENT RULES:\n- The output is a draft lesson plan ready for teacher review, NOT a list of suggestions or meta-instructions about how to write a lesson plan.\n- All fields must contain direct instructional actions, objectives, activities, checks, and criteria.\n- NEVER start fields or sentences with meta-language like "Optional...", "Suggested...", "Consider...", "Possible...", "You may...", "Teacher may...", "An optional...", or "Optional Starting Point:".\n- "lessonTitle" MUST be a real, descriptive lesson title (e.g. "Solving Problems Involving the Volume of Cylinders"), NOT "Optional Starting Point: ..." or "Suggested Lesson: ...".\n- "lessonFlow" MUST describe the actual sequence of instructional steps with realistic time allocations.\n- Do not include references or learning resources; those fields are teacher-controlled.\n- Do not generate a post-lesson reflection because teaching has not happened yet.\n- Existing teacher text, if any, must not be treated as something to overwrite automatically.\n\n${context}\n\nReturn ONLY valid JSON with exactly this shape and string values:\n{\n  "lessonTitle": "...",\n  "learningObjectives": "...",\n  "homeBasedAlternative": "...",\n  "preLessonActivity": "...",\n  "lessonFlow": "...",\n  "integrationContextualization": "...",\n  "inclusionAccommodations": "...",\n  "formativeAssessments": "...",\n  "evidenceOfLearning": "...",\n  "nextSteps": "...",\n  "extendedLearning": "..."\n}\n\nMake lessonFlow practical for the stated minutes/sessions. Use conditional wording for nextSteps. Never insert a specific resource unless teacher-listed in the context.`
    } else {
      prompt = `${sharedSuggestionGuardrail}\n\nOUTPUT LANGUAGE RULE: ${outputLanguageInstruction(effectiveBody, text)}\n\nTask: ${instructionForSuggestion(supportType as Exclude<SuggestionSupportType, 'quick_draft'>)}\n\n${context}\n${text ? `\nCurrent teacher text, if they want alternatives:\n---\n${text}\n---\n` : ''}\nReturn ONLY valid JSON in this shape: {"suggestions":["option 1","option 2","option 3"]}. Each option must be self-contained and editable. Do not include commentary outside the JSON.`
    }

    let result: Awaited<ReturnType<typeof callWithFallback>>
    try {
      result = await callWithFallback(apiKey, settings, prompt, maxOutputTokens)
    } catch (error) {
      console.error('Gemini support error', error)
      if (error instanceof GeminiHttpError && error.status === 429) {
        return json({ error: quotaMessage(settings.preferredModel), code: 'AI_QUOTA_EXHAUSTED' }, 429)
      }
      if (error instanceof GeminiHttpError && [400, 401, 403].includes(error.status)) {
        return json({ error: 'Google rejected your saved Gemini key or model access. Test or replace the key in Settings → AI Assistant.', code: 'AI_KEY_INVALID' }, 401)
      }
      return json({ error: 'Gemini support is temporarily unavailable. Your lesson has not been changed.', code: 'AI_PROVIDER_UNAVAILABLE' }, 502)
    }

    const responseBase = {
      model: result.modelUsed,
      preferredModel: settings.preferredModel,
      fallbackUsed: result.fallbackUsed,
      thinkingLevel: isLiteModel(result.modelUsed) ? 'high' : 'model_default',
      supportType,
      declarationCategory,
      ...(curriculumContextWarning ? { curriculumContextWarning } : {}),
    }

    let responseBody: Record<string, unknown>
    if (revisionSupport.has(supportType as RevisionSupportType)) {
      responseBody = { ...responseBase, output: result.output.trim() }
    } else if (supportType === 'quick_draft') {
      try {
        const draft = cleanDraft(parseJsonObject(result.output))
        if (Object.keys(draft).length < 6) throw new Error('Quick Draft did not contain enough usable sections.')
        responseBody = { ...responseBase, draft }
      } catch (error) {
        console.error('Quick Draft parse error', error, result.output.slice(0, 500))
        return json({ error: 'Gemini returned a malformed Quick Draft. Please try again.', code: 'AI_OUTPUT_INVALID' }, 502)
      }
    } else {
      try {
        const suggestions = cleanSuggestions(parseJsonObject(result.output).suggestions)
        if (suggestions.length < 2) throw new Error('Not enough suggestions returned.')
        responseBody = { ...responseBase, suggestions }
      } catch (error) {
        console.error('Suggestion parse error', error, result.output.slice(0, 500))
        return json({ error: 'Gemini returned malformed suggestions. Please try again.', code: 'AI_OUTPUT_INVALID' }, 502)
      }
    }

    const documentId = body.documentId?.trim()
    if (documentId) {
      const { error: auditError } = await userClient.from('lesson_plan_ai_events').insert({
        document_id: documentId,
        user_id: userId,
        support_type: supportType,
        section_key: body.sectionKey || 'unknown',
        declaration_category: declarationCategory,
        provider: 'google',
        model: result.modelUsed,
      })
      if (auditError) console.error('AI audit insert failed', auditError.message)
    }

    return json(responseBody)
  } catch (error) {
    console.error(error)
    return json({ error: 'Unable to process AI support request.' }, 500)
  }
})
