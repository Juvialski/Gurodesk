import { getDemoCurriculumBundle } from '../data/demoCurriculum'
import type { Profile, TeacherAssignment } from '../types/app'
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

  const { data: applicabilityRows, error: applicabilityError } = await supabase
    .from('curriculum_applicability')
    .select('curriculum_version_id, implementation_status, notes')
    .eq('school_year', schoolYear)
    .eq('grade_level', gradeLevel)
    .in('implementation_status', ['full', 'transitional', 'pilot'])
    .order('priority', { ascending: true })
    .limit(1)

  if (applicabilityError) throw applicabilityError
  const applicability = applicabilityRows?.[0] as Record<string, unknown> | undefined
  if (!applicability) {
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

  if (versionResult.error) throw versionResult.error
  if (subjectResult.error) throw subjectResult.error
  const subjectRow = subjectResult.data?.[0] as Record<string, unknown> | undefined
  if (!subjectRow) {
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

  if (periodsResult.error) throw periodsResult.error
  if (domainsResult.error) throw domainsResult.error
  if (standardsResult.error) throw standardsResult.error
  if (competenciesResult.error) throw competenciesResult.error

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
