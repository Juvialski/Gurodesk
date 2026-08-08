import { getDemoCurriculumBundle } from '../data/demoCurriculum'
import type { Profile, TeacherAssignment } from '../types/app'
import type { AiCredentialSaveResult, AiCredentialStatus, AiSettingsUpdate } from '../types/ai'
import type { LessonAiSupportRequest, LessonAiSupportResponse, LessonPlanRecord } from '../types/lessonPlan'
import type { TeacherLessonPreferences } from '../types/teachingSetup'
import type { TeacherExportPreferences } from '../types/export'
import { createDefaultTeacherExportPreferences } from '../types/export'
import { createDefaultTeacherLessonPreferences } from '../types/teachingSetup'
import { normalizeLessonContent } from './lessonPlanFactory'
import type {
  CurriculumCompetency,
  CurriculumDomain,
  CurriculumNavigatorBundle,
  CurriculumPeriod,
  CurriculumStandard,
  CurriculumSubject,
  CurriculumVersionSummary,
  SourceDocument,
  SchoolYearCalendar,
} from '../types/curriculum'
import { demoStore } from './demoStore'
import { supabase } from './supabase'

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: row.email ? String(row.email) : null,
    fullName: String(row.full_name ?? ''),
    schoolName: String(row.school_name ?? ''),
    region: String(row.region ?? ''),
    division: String(row.division ?? ''),
    positionTitle: String(row.position_title ?? 'Teacher I'),
    schoolYear: String(row.school_year ?? '2026-2027'),
    onboardingCompleted: Boolean(row.onboarding_completed),
  }
}

function mapAssignment(row: Record<string, unknown>): TeacherAssignment {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    schoolYear: String(row.school_year),
    gradeLevel: String(row.grade_level),
    learningArea: String(row.learning_area),
    sections: Array.isArray(row.section_names) ? row.section_names.map(String) : [],
    isActive: Boolean(row.is_active),
  }
}

export async function loadTeacherWorkspace(userId: string, demo: boolean) {
  if (demo || !supabase) {
    return {
      profile: demoStore.getProfile(),
      assignments: demoStore.getAssignments(),
    }
  }

  const [profileResult, assignmentsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase
      .from('teacher_assignments')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  if (profileResult.error) throw profileResult.error
  if (assignmentsResult.error) throw assignmentsResult.error

  return {
    profile: mapProfile(profileResult.data as Record<string, unknown>),
    assignments: (assignmentsResult.data ?? []).map((row) =>
      mapAssignment(row as Record<string, unknown>),
    ),
  }
}

export async function saveTeacherProfile(profile: Profile, demo: boolean) {
  if (demo || !supabase) {
    demoStore.saveProfile(profile)
    return profile
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: profile.fullName,
      school_name: profile.schoolName,
      region: profile.region,
      division: profile.division,
      position_title: profile.positionTitle,
      school_year: profile.schoolYear,
      onboarding_completed: profile.onboardingCompleted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .select('*')
    .single()

  if (error) throw error
  return mapProfile(data as Record<string, unknown>)
}

export async function addTeacherAssignment(
  assignment: Omit<TeacherAssignment, 'id'>,
  demo: boolean,
) {
  if (demo || !supabase) {
    const created: TeacherAssignment = { ...assignment, id: crypto.randomUUID() }
    demoStore.saveAssignments([...demoStore.getAssignments(), created])
    return created
  }

  const { data, error } = await supabase
    .from('teacher_assignments')
    .insert({
      user_id: assignment.userId,
      school_year: assignment.schoolYear,
      grade_level: assignment.gradeLevel,
      learning_area: assignment.learningArea,
      section_names: assignment.sections,
      is_active: assignment.isActive,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapAssignment(data as Record<string, unknown>)
}

export async function deleteTeacherAssignment(id: string, demo: boolean) {
  if (demo || !supabase) {
    demoStore.saveAssignments(demoStore.getAssignments().filter((item) => item.id !== id))
    return
  }

  const { error } = await supabase.from('teacher_assignments').delete().eq('id', id)
  if (error) throw error
}


function mapCurriculumVersion(row: Record<string, unknown>): CurriculumVersionSummary {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    framework: String(row.framework),
    effectiveFromSchoolYear: String(row.effective_from_school_year),
    effectiveToSchoolYear: row.effective_to_school_year ? String(row.effective_to_school_year) : null,
    status: String(row.status) as CurriculumVersionSummary['status'],
    implementationNotes: row.implementation_notes ? String(row.implementation_notes) : null,
  }
}

function mapSourceDocument(row: Record<string, unknown>): SourceDocument {
  return {
    id: String(row.id),
    sourceType: String(row.source_type) as SourceDocument['sourceType'],
    title: String(row.title),
    issuanceCode: row.issuance_code ? String(row.issuance_code) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    publishedOn: row.published_on ? String(row.published_on) : null,
    verificationStatus: String(row.verification_status) as SourceDocument['verificationStatus'],
  }
}

function mapCurriculumSubject(row: Record<string, unknown>): CurriculumSubject {
  return {
    id: String(row.id),
    gradeLevel: String(row.grade_level),
    code: row.code ? String(row.code) : null,
    name: String(row.name),
    description: row.description ? String(row.description) : null,
  }
}

function mapCurriculumPeriod(row: Record<string, unknown>): CurriculumPeriod {
  return {
    id: String(row.id),
    label: String(row.label),
    sequence: Number(row.sequence),
    periodType: String(row.period_type) as CurriculumPeriod['periodType'],
  }
}

function mapCurriculumDomain(row: Record<string, unknown>): CurriculumDomain {
  return {
    id: String(row.id),
    code: row.code ? String(row.code) : null,
    name: String(row.name),
    sortOrder: Number(row.sort_order ?? 0),
  }
}

function mapCurriculumStandard(row: Record<string, unknown>): CurriculumStandard {
  return {
    id: String(row.id),
    standardType: String(row.standard_type) as CurriculumStandard['standardType'],
    standardText: String(row.standard_text),
    domainId: row.domain_id ? String(row.domain_id) : null,
    academicPeriodId: row.academic_period_id ? String(row.academic_period_id) : null,
    sourcePage: row.source_page === null || row.source_page === undefined ? null : Number(row.source_page),
  }
}

function mapCurriculumCompetency(row: Record<string, unknown>): CurriculumCompetency {
  return {
    id: String(row.id),
    competencyCode: row.competency_code ? String(row.competency_code) : null,
    competencyText: String(row.competency_text),
    sortOrder: Number(row.sort_order ?? 0),
    domainId: row.domain_id ? String(row.domain_id) : null,
    academicPeriodId: row.academic_period_id ? String(row.academic_period_id) : null,
    sourcePage: row.source_page === null || row.source_page === undefined ? null : Number(row.source_page),
    verificationStatus: String(row.verification_status) as CurriculumCompetency['verificationStatus'],
  }
}

export async function loadCurriculumNavigator(
  schoolYear: string,
  gradeLevel: string,
  learningArea: string,
  demo: boolean,
): Promise<CurriculumNavigatorBundle> {
  if (demo || !supabase) return getDemoCurriculumBundle(schoolYear, gradeLevel, learningArea)

  // The canonical local manifest is the exact verified source used to generate the
  // production seed. It is a safe read-only fallback if the production knowledge
  // query temporarily returns no rows (for example while migrations/indexes settle).
  // We never invent curriculum content here.
  const localVerifiedFallback = getDemoCurriculumBundle(schoolYear, gradeLevel, learningArea)
  const fallback = (reason: string): CurriculumNavigatorBundle | null =>
    localVerifiedFallback.available
      ? {
          ...localVerifiedFallback,
          schoolYear,
          coverageNote:
            `Verified local manifest fallback is active because ${reason}. ` +
            'This is the same reviewed Grade 7 Mathematics manifest used to generate the Supabase seed; no competency was invented.',
        }
      : null

  const { data: applicabilityRows, error: applicabilityError } = await supabase
    .from('curriculum_applicability')
    .select('curriculum_version_id, implementation_status, notes')
    .eq('school_year', schoolYear)
    .eq('grade_level', gradeLevel)
    .in('implementation_status', ['full', 'transitional', 'pilot'])
    .order('priority', { ascending: true })
    .limit(1)

  if (applicabilityError) {
    const local = fallback('the Supabase applicability lookup failed')
    if (local) return local
    throw applicabilityError
  }
  const applicability = applicabilityRows?.[0] as Record<string, unknown> | undefined
  if (!applicability) {
    const local = fallback('Supabase returned no applicability row for this assignment')
    if (local) return local
    return {
      available: false,
      schoolYear,
      gradeLevel,
      learningArea,
      version: null,
      subject: null,
      periods: [],
      domains: [],
      standards: [],
      competencies: [],
      source: null,
      coverageNote: 'No verified curriculum applicability record is loaded for this teaching assignment and school year yet.',
    }
  }

  const versionId = String(applicability.curriculum_version_id)
  const [versionResult, subjectResult] = await Promise.all([
    supabase.from('curriculum_versions').select('*').eq('id', versionId).single(),
    supabase
      .from('curriculum_subjects')
      .select('*')
      .eq('curriculum_version_id', versionId)
      .eq('grade_level', gradeLevel)
      .ilike('name', learningArea)
      .limit(1),
  ])

  if (versionResult.error || subjectResult.error) {
    const local = fallback('the Supabase curriculum version/subject lookup failed')
    if (local) return local
    if (versionResult.error) throw versionResult.error
    throw subjectResult.error
  }
  const subjectRow = subjectResult.data?.[0] as Record<string, unknown> | undefined
  if (!subjectRow) {
    const local = fallback('Supabase returned no verified subject row for this assignment')
    if (local) return local
    return {
      available: false,
      schoolYear,
      gradeLevel,
      learningArea,
      version: mapCurriculumVersion(versionResult.data as Record<string, unknown>),
      subject: null,
      periods: [],
      domains: [],
      standards: [],
      competencies: [],
      source: null,
      coverageNote: 'The applicable curriculum version is known, but this learning area has not been imported and verified yet.',
    }
  }

  const subjectId = String(subjectRow.id)
  const [periodsResult, domainsResult, standardsResult, competenciesResult] = await Promise.all([
    supabase
      .from('academic_periods')
      .select('*')
      .eq('curriculum_version_id', versionId)
      .eq('subject_id', subjectId)
      .order('sequence', { ascending: true }),
    supabase.from('curriculum_domains').select('*').eq('subject_id', subjectId).order('sort_order'),
    supabase.from('curriculum_standards').select('*').eq('subject_id', subjectId).order('sort_order'),
    supabase
      .from('curriculum_competencies')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('verification_status', 'verified')
      .order('sort_order'),
  ])

  if (periodsResult.error || domainsResult.error || standardsResult.error || competenciesResult.error) {
    const local = fallback('one of the Supabase verified curriculum queries failed')
    if (local) return local
    if (periodsResult.error) throw periodsResult.error
    if (domainsResult.error) throw domainsResult.error
    if (standardsResult.error) throw standardsResult.error
    throw competenciesResult.error
  }

  // A bundle with periods but zero verified competencies makes the native select
  // appear to do nothing on mobile. For the one curriculum whose canonical manifest
  // is bundled and source-verified, fall back to that manifest instead of leaving a
  // silent empty dropdown.
  if ((competenciesResult.data ?? []).length === 0) {
    const local = fallback('Supabase returned zero verified competency rows')
    if (local) return local
  }

  const sourceId = subjectRow.source_document_id ? String(subjectRow.source_document_id) : null
  let source: SourceDocument | null = null
  if (sourceId) {
    const sourceResult = await supabase.from('source_documents').select('*').eq('id', sourceId).single()
    if (sourceResult.error) throw sourceResult.error
    source = mapSourceDocument(sourceResult.data as Record<string, unknown>)
  }

  return {
    available: true,
    schoolYear,
    gradeLevel,
    learningArea,
    version: mapCurriculumVersion(versionResult.data as Record<string, unknown>),
    subject: mapCurriculumSubject(subjectRow),
    periods: (periodsResult.data ?? []).map((row) => mapCurriculumPeriod(row as Record<string, unknown>)),
    domains: (domainsResult.data ?? []).map((row) => mapCurriculumDomain(row as Record<string, unknown>)),
    standards: (standardsResult.data ?? []).map((row) => mapCurriculumStandard(row as Record<string, unknown>)),
    competencies: (competenciesResult.data ?? []).map((row) => mapCurriculumCompetency(row as Record<string, unknown>)),
    source,
    coverageNote: applicability.notes ? String(applicability.notes) : null,
  }
}


export async function loadSchoolYearCalendar(
  schoolYear: string,
  demo: boolean,
): Promise<SchoolYearCalendar | null> {
  if (demo || !supabase) {
    if (schoolYear !== '2026-2027') return null
    return {
      id: 'calendar-2026-2027',
      schoolYear,
      calendarType: 'three_term',
      gradingPeriodCount: 3,
      status: 'active',
      notes: 'Three grading periods. Curriculum-guide sequence periods are modeled separately and may still be quarter-based.',
      periods: [1, 2, 3].map((sequence) => ({
        id: `grading-term-${sequence}`,
        label: `Term ${sequence}`,
        sequence,
        startsOn: null,
        endsOn: null,
      })),
      source: {
        id: 'src-do-009-2026',
        sourceType: 'deped_order',
        title: 'Guidelines on the Implementation of the Three-Term School Calendar in Basic Education',
        issuanceCode: 'DO 009, s. 2026',
        sourceUrl: null,
        publishedOn: '2026-04-16',
        verificationStatus: 'verified',
      },
    }
  }

  const { data: calendarRows, error: calendarError } = await supabase
    .from('school_year_calendars')
    .select('*')
    .eq('school_year', schoolYear)
    .in('status', ['active', 'superseded'])
    .limit(1)

  if (calendarError) throw calendarError
  const row = calendarRows?.[0] as Record<string, unknown> | undefined
  if (!row) return null

  const [periodResult, sourceResult] = await Promise.all([
    supabase
      .from('grading_periods')
      .select('*')
      .eq('school_year_calendar_id', String(row.id))
      .order('sequence', { ascending: true }),
    row.source_document_id
      ? supabase.from('source_documents').select('*').eq('id', String(row.source_document_id)).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (periodResult.error) throw periodResult.error
  if (sourceResult.error) throw sourceResult.error

  return {
    id: String(row.id),
    schoolYear: String(row.school_year),
    calendarType: String(row.calendar_type) as SchoolYearCalendar['calendarType'],
    gradingPeriodCount: Number(row.grading_period_count),
    status: String(row.status) as SchoolYearCalendar['status'],
    notes: row.notes ? String(row.notes) : null,
    periods: (periodResult.data ?? []).map((period) => {
      const item = period as Record<string, unknown>
      return {
        id: String(item.id),
        label: String(item.label),
        sequence: Number(item.sequence),
        startsOn: item.starts_on ? String(item.starts_on) : null,
        endsOn: item.ends_on ? String(item.ends_on) : null,
      }
    }),
    source: sourceResult.data ? mapSourceDocument(sourceResult.data as Record<string, unknown>) : null,
  }
}



function mapTeacherExportPreferences(row: Record<string, unknown>): TeacherExportPreferences {
  return {
    userId: String(row.user_id),
    defaultTemplateId: String(row.default_template_id ?? 'gurodesk_ilaw_standard') as TeacherExportPreferences['defaultTemplateId'],
    paperSize: String(row.paper_size ?? 'a4') as TeacherExportPreferences['paperSize'],
    documentLanguage: String(row.document_language ?? 'match') as TeacherExportPreferences['documentLanguage'],
    preparedByName: String(row.prepared_by_name ?? ''),
    preparedByTitle: String(row.prepared_by_title ?? ''),
    reviewedByName: String(row.reviewed_by_name ?? ''),
    reviewedByTitle: String(row.reviewed_by_title ?? ''),
    notedByName: String(row.noted_by_name ?? ''),
    notedByTitle: String(row.noted_by_title ?? ''),
    includeAiDeclaration: row.include_ai_declaration !== false,
    includeSourceProvenance: row.include_source_provenance !== false,
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }
}

export async function loadTeacherExportPreferences(userId: string, demo: boolean): Promise<TeacherExportPreferences> {
  if (demo || !supabase) return demoStore.getExportPreferences(userId)
  const { data, error } = await supabase
    .from('teacher_export_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? mapTeacherExportPreferences(data as Record<string, unknown>) : createDefaultTeacherExportPreferences(userId)
}

export async function saveTeacherExportPreferences(preferences: TeacherExportPreferences, demo: boolean): Promise<TeacherExportPreferences> {
  if (demo || !supabase) {
    demoStore.saveExportPreferences(preferences)
    return preferences
  }
  const { data, error } = await supabase
    .from('teacher_export_preferences')
    .upsert({
      user_id: preferences.userId,
      default_template_id: preferences.defaultTemplateId,
      paper_size: preferences.paperSize,
      document_language: preferences.documentLanguage,
      prepared_by_name: preferences.preparedByName,
      prepared_by_title: preferences.preparedByTitle,
      reviewed_by_name: preferences.reviewedByName,
      reviewed_by_title: preferences.reviewedByTitle,
      noted_by_name: preferences.notedByName,
      noted_by_title: preferences.notedByTitle,
      include_ai_declaration: preferences.includeAiDeclaration,
      include_source_provenance: preferences.includeSourceProvenance,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) throw error
  return mapTeacherExportPreferences(data as Record<string, unknown>)
}

function mapTeacherLessonPreferences(row: Record<string, unknown>): TeacherLessonPreferences {
  return {
    userId: String(row.user_id),
    defaultDurationMinutes: Number(row.default_duration_minutes ?? 60),
    languagePreference: String(row.language_preference ?? 'Auto'),
    localLanguageName: String(row.local_language_name ?? ''),
    typicalClassProfile: String(row.typical_class_profile ?? ''),
    availableTechnology: Array.isArray(row.available_technology) ? row.available_technology.map(String) : [],
    preferredApproaches: Array.isArray(row.preferred_approaches) ? row.preferred_approaches.map(String) : [],
    actualResources: Array.isArray(row.actual_resources) ? row.actual_resources.map(String) : [],
    resourceNotes: String(row.resource_notes ?? ''),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }
}

export async function loadTeacherLessonPreferences(userId: string, demo: boolean): Promise<TeacherLessonPreferences> {
  if (demo || !supabase) return demoStore.getLessonPreferences(userId)
  const { data, error } = await supabase
    .from('teacher_lesson_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? mapTeacherLessonPreferences(data as Record<string, unknown>) : createDefaultTeacherLessonPreferences(userId)
}

export async function saveTeacherLessonPreferences(preferences: TeacherLessonPreferences, demo: boolean): Promise<TeacherLessonPreferences> {
  if (demo || !supabase) {
    demoStore.saveLessonPreferences(preferences)
    return preferences
  }
  const { data, error } = await supabase
    .from('teacher_lesson_preferences')
    .upsert({
      user_id: preferences.userId,
      default_duration_minutes: preferences.defaultDurationMinutes,
      language_preference: preferences.languagePreference,
      local_language_name: preferences.localLanguageName,
      typical_class_profile: preferences.typicalClassProfile,
      available_technology: preferences.availableTechnology,
      preferred_approaches: preferences.preferredApproaches,
      actual_resources: preferences.actualResources,
      resource_notes: preferences.resourceNotes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) throw error
  return mapTeacherLessonPreferences(data as Record<string, unknown>)
}

function mapLessonPlan(row: Record<string, unknown>): LessonPlanRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    assignmentId: row.assignment_id ? String(row.assignment_id) : null,
    title: String(row.title),
    schoolYear: String(row.school_year),
    academicPeriodLabel: row.academic_period_label ? String(row.academic_period_label) : null,
    status: String(row.status) as LessonPlanRecord['status'],
    content: normalizeLessonContent(row.structured_content as LessonPlanRecord['content'], String(row.status) as LessonPlanRecord['status']),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function loadLessonPlans(userId: string, demo: boolean): Promise<LessonPlanRecord[]> {
  if (demo || !supabase) {
    return demoStore.getLessonPlans().filter((item) => item.userId === userId && item.status !== 'archived')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .eq('document_type', 'lesson_plan')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapLessonPlan(row as Record<string, unknown>))
}

export async function loadLessonPlan(id: string, userId: string, demo: boolean): Promise<LessonPlanRecord | null> {
  if (demo || !supabase) {
    return demoStore.getLessonPlans().find((item) => item.id === id && item.userId === userId) ?? null
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('document_type', 'lesson_plan')
    .maybeSingle()

  if (error) throw error
  return data ? mapLessonPlan(data as Record<string, unknown>) : null
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function resolveProductionCompetencyId(plan: LessonPlanRecord): Promise<string | null> {
  if (!supabase || !plan.content.competency.id) return null
  if (looksLikeUuid(plan.content.competency.id)) return plan.content.competency.id

  // Local-manifest fallback IDs are intentionally not written into the UUID FK.
  // Resolve the exact verified production row from its source-grounded snapshot.
  let query = supabase
    .from('curriculum_competencies')
    .select('id')
    .eq('verification_status', 'verified')
    .eq('competency_text', plan.content.competency.text)

  if (plan.content.competency.sourcePage !== null) {
    query = query.eq('source_page', plan.content.competency.sourcePage)
  }

  const { data, error } = await query.limit(1)
  if (error) return null
  return data?.[0]?.id ? String(data[0].id) : null
}

async function writeLessonPlanCompetencyLink(plan: LessonPlanRecord) {
  if (!supabase || !plan.content.competency.id) return
  const { error: deleteError } = await supabase.from('lesson_plan_competencies').delete().eq('document_id', plan.id)
  if (deleteError) throw deleteError

  const competencyId = await resolveProductionCompetencyId(plan)
  // The structured lesson document still keeps the verified source snapshot if the
  // production FK cannot be resolved yet. We never write a fabricated UUID.
  if (!competencyId) return

  const { error: insertError } = await supabase.from('lesson_plan_competencies').insert({
    document_id: plan.id,
    competency_id: competencyId,
    competency_text_snapshot: plan.content.competency.text,
    competency_code_snapshot: plan.content.competency.code,
    source_page_snapshot: plan.content.competency.sourcePage,
  })
  if (insertError) throw insertError
}

export async function saveLessonPlan(plan: LessonPlanRecord, demo: boolean): Promise<LessonPlanRecord> {
  const now = new Date().toISOString()
  if (demo || !supabase) {
    const records = demoStore.getLessonPlans()
    const existingIndex = records.findIndex((item) => item.id === plan.id)
    const saved: LessonPlanRecord = {
      ...plan,
      id: plan.id || crypto.randomUUID(),
      createdAt: plan.createdAt || now,
      updatedAt: now,
    }
    if (existingIndex >= 0) records[existingIndex] = saved
    else records.push(saved)
    demoStore.saveLessonPlans(records)
    return saved
  }

  if (!plan.id) {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: plan.userId,
        assignment_id: plan.assignmentId,
        document_type: 'lesson_plan',
        title: plan.title,
        school_year: plan.schoolYear,
        academic_period_label: plan.academicPeriodLabel,
        status: plan.status,
        structured_content: plan.content,
      })
      .select('*')
      .single()
    if (error) throw error
    const saved = mapLessonPlan(data as Record<string, unknown>)
    await writeLessonPlanCompetencyLink(saved)
    await supabase.from('document_versions').insert({
      document_id: saved.id,
      version_number: 1,
      structured_content: saved.content,
      change_note: 'Initial lesson plan draft',
    })
    return saved
  }

  const { data, error } = await supabase
    .from('documents')
    .update({
      assignment_id: plan.assignmentId,
      title: plan.title,
      school_year: plan.schoolYear,
      academic_period_label: plan.academicPeriodLabel,
      status: plan.status,
      structured_content: plan.content,
      updated_at: now,
    })
    .eq('id', plan.id)
    .eq('user_id', plan.userId)
    .select('*')
    .single()
  if (error) throw error

  const saved = mapLessonPlan(data as Record<string, unknown>)
  await writeLessonPlanCompetencyLink(saved)
  const { data: latestVersion } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', saved.id)
    .order('version_number', { ascending: false })
    .limit(1)
  const nextVersion = Number(latestVersion?.[0]?.version_number ?? 0) + 1
  await supabase.from('document_versions').insert({
    document_id: saved.id,
    version_number: nextVersion,
    structured_content: saved.content,
    change_note: 'Teacher saved lesson plan',
  })
  return saved
}

export async function archiveLessonPlan(id: string, userId: string, demo: boolean) {
  if (demo || !supabase) {
    const records = demoStore.getLessonPlans().map((item) => item.id === id && item.userId === userId ? { ...item, status: 'archived' as const, updatedAt: new Date().toISOString() } : item)
    demoStore.saveLessonPlans(records)
    return
  }
  const { error } = await supabase.from('documents').update({ status: 'archived' }).eq('id', id).eq('user_id', userId)
  if (error) throw error
}

function demoAiSupport(request: LessonAiSupportRequest): LessonAiSupportResponse {
  const type = request.supportType
  const competency = request.lessonContext.competencyText || 'the selected competency'
  const base = request.text?.trim().replace(/\s+/g, ' ') ?? ''
  const preference = request.lessonContext.teachingSetup?.languagePreference ?? 'Auto'
  const filipino = preference === 'Filipino' || (preference === 'Auto' && request.lessonContext.learningArea.toLowerCase().includes('filipino'))
  const suggested = type.startsWith('suggest_') || type === 'quick_draft'
  if (suggested) {
    const suggestions = filipino ? [
      `Opsyon 1 na nakabatay sa ${competency}. Suriin at iangkop ito sa aktuwal na klase.`,
      `Opsyon 2 na nakabatay sa ${competency}. Ayusin ang oras at detalye bago gamitin.`,
      `Opsyon 3 na nakabatay sa ${competency}. Tiyaking angkop ito sa mga mag-aaral at sa mga kagamitang talagang mayroon.`,
    ] : [
      `Option 1 grounded in ${competency}. Review and adapt this starting point for your actual class.`,
      `Option 2 grounded in ${competency}. Adjust the pacing and language before using it.`,
      `Option 3 grounded in ${competency}. Confirm that it matches your learners and available resources.`,
    ]
    if (type === 'quick_draft') {
      return {
        draft: filipino ? {
          lessonTitle: 'Banghay-araling susuriin ng guro',
          learningObjectives: `Maipakita ng mga mag-aaral ang kasanayang ito: ${competency}. Suriin at ayusin ang layunin ayon sa saklaw ng aralin.`,
          preLessonActivity: 'Magsagawa ng maikling pagbalik-aral sa dating kaalaman na hindi nangangailangan ng kagamitang hindi nakalista.',
          lessonFlow: 'Panimula: buhayin ang dating kaalaman. Paglinang: talakayin o imodelo ang pangunahing ideya. Gabay na pagsasanay: magsagawa ng mga halimbawa na may agarang puna. Malayang pagsasanay: ipakita ng mga mag-aaral ang target na kasanayan. Pagwawakas: ibuod ang katibayan ng pagkatuto. Iangkop ang oras sa aktuwal na klase.',
          integrationContextualization: 'Iugnay ang ideya sa pamilyar na sitwasyong angkop sa klase. Palitan ito ng tiyak na kontekstong napatunayan ng guro.',
          inclusionAccommodations: 'Magbigay ng malinaw na panuto, halimbawa, iba-ibang paraan ng pagsagot, at karagdagang gabay nang hindi nagpapalagay ng anumang diagnosis o kondisyon ng mag-aaral.',
          formativeAssessments: 'Gumamit ng maiikling pagtataya habang nagpapatuloy ang aralin at isang maikling gawain sa pagtatapos na nakaayon sa kasanayan.',
          evidenceOfLearning: 'Hanapin ang wastong pangangatwiran, tamang paggamit ng target na kasanayan, at mga paliwanag na nagpapakita ng pag-unawa.',
          nextSteps: 'Kung hindi pa sapat ang ebidensya, muling ituro ang partikular na maling pagkaunawa gamit ang ibang halimbawa; kung sapat na, magpatuloy sa mas masalimuot na aplikasyon.',
          extendedLearning: 'Magbigay ng opsyonal na karagdagang gawain na gumagamit ng parehong kasanayan sa bagong ngunit kaugnay na sitwasyon.',
        } : {
          lessonTitle: 'Teacher-reviewed lesson draft',
          learningObjectives: `Learners demonstrate the selected competency: ${competency}. Review and rewrite this objective to match the intended lesson scope.`,
          preLessonActivity: 'Use a short prior-knowledge check that requires no unlisted materials. Review the prompts before teaching.',
          lessonFlow: 'Opening: activate prior knowledge. Development: model or discuss the core idea. Guided practice: work through examples with feedback. Independent check: learners demonstrate the target skill. Closure: summarize evidence of learning. Adjust timing to the actual class.',
          integrationContextualization: 'Connect the idea to a familiar situation that is appropriate for the class. Replace this with a specific local context you have verified.',
          inclusionAccommodations: 'Offer clear instructions, worked examples, flexible response options, and additional guided practice without assuming any learner diagnosis or condition.',
          formativeAssessments: 'Use brief checks during the lesson and a short end-of-session task aligned to the selected competency.',
          evidenceOfLearning: 'Look for accurate reasoning, correct application of the targeted skill, and explanations that show understanding.',
          nextSteps: 'If evidence is incomplete, reteach the specific misconception with another example; if secure, proceed to a more complex application.',
          extendedLearning: 'Offer an optional extension that applies the same competency in a new but closely related situation.',
        },
        model: 'demo-local-preview', supportType: type, declarationCategory: 'suggested', suggestions: [],
      }
    }
    return { suggestions, model: 'demo-local-preview', supportType: type, declarationCategory: 'suggested' }
  }
  let output = base
  if (type === 'organize_text' || type === 'format_text') {
    const parts = output.split(/(?<=[.!?])\s+/).filter(Boolean)
    if (parts.length > 1) output = parts.map((item) => `• ${item.trim()}`).join('\n')
  }
  return {
    output,
    model: 'demo-local-preview',
    supportType: type,
    declarationCategory: type === 'refine_clarity' || type === 'organize_text' ? 'limited' : 'guided',
  }
}

export async function runLessonAiSupport(request: LessonAiSupportRequest, demo: boolean): Promise<LessonAiSupportResponse> {
  if (demo || !supabase) return demoAiSupport(request)
  const { data, error } = await supabase.functions.invoke('lesson-ai-support', { body: request })
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'AI support could not be completed.'))
  if (data?.error) throw new Error(String(data.error))
  if (!data?.output && !data?.suggestions?.length && !data?.draft) throw new Error('AI support returned no usable content.')
  return data as LessonAiSupportResponse
}



function defaultAiCredentialStatus(): AiCredentialStatus {
  return {
    configured: false,
    keyLast4: null,
    verifiedAt: null,
    preferredModel: 'gemini-3.5-flash-lite',
    fallbackModel: 'gemini-3.1-flash-lite',
    fallbackEnabled: true,
  }
}

async function edgeFunctionErrorMessage(error: unknown, fallback: string) {
  const maybe = error as { message?: string; context?: Response } | null
  try {
    if (maybe?.context) {
      const payload = await maybe.context.clone().json() as { error?: string }
      if (payload?.error) return payload.error
    }
  } catch {}
  return maybe?.message || fallback
}

async function invokeAiSettings(body: Record<string, unknown>) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { data, error } = await supabase.functions.invoke('ai-settings', { body })
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Unable to update AI settings.'))
  if (data?.error) throw new Error(String(data.error))
  return data as Record<string, unknown>
}

export async function loadAiCredentialStatus(demo: boolean): Promise<AiCredentialStatus> {
  if (demo || !supabase) return defaultAiCredentialStatus()
  const data = await invokeAiSettings({ action: 'status' })
  return data as unknown as AiCredentialStatus
}

export async function saveTeacherAiCredential(
  apiKey: string,
  settings: AiSettingsUpdate,
  demo: boolean,
): Promise<AiCredentialSaveResult> {
  if (demo || !supabase) {
    throw new Error('Sign in to your Supabase-backed GuroDesk account before connecting a Gemini API key.')
  }
  const data = await invokeAiSettings({ action: 'save_key', apiKey, ...settings })
  return data as unknown as AiCredentialSaveResult
}

export async function updateTeacherAiSettings(
  settings: AiSettingsUpdate,
  demo: boolean,
): Promise<AiCredentialStatus> {
  if (demo || !supabase) return { ...defaultAiCredentialStatus(), ...settings }
  const data = await invokeAiSettings({ action: 'update_settings', ...settings })
  return data as unknown as AiCredentialStatus
}

export async function testTeacherAiCredential(demo: boolean): Promise<{ ok: boolean; model: string; message: string }> {
  if (demo || !supabase) throw new Error('Gemini connection testing is available after signing in to Supabase mode.')
  const data = await invokeAiSettings({ action: 'test_saved_key' })
  return data as unknown as { ok: boolean; model: string; message: string }
}

export async function removeTeacherAiCredential(demo: boolean): Promise<AiCredentialStatus> {
  if (demo || !supabase) return defaultAiCredentialStatus()
  const data = await invokeAiSettings({ action: 'remove_key' })
  return data as unknown as AiCredentialStatus
}
