import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Integration tests are deliberately local-only.  In particular, never point
 * a test at the browser default in src/lib/supabase.ts: the test performs
 * destructive fixture cleanup and creates throw-away auth users.
 */
export const PRODUCTION_PROJECT_REF = 'hmeybakjxtzmiebtxonc'

export type LocalSupabaseConfig = {
  url: string
  anonKey: string
  serviceRoleKey: string
}

export type TestTeacher = {
  id: string
  email: string
  password: string
  accessToken: string
  refreshToken: string
  client: SupabaseClient
}

export type CanonicalCurriculumFixture = {
  version: { id: string; code: string; name: string }
  subject: { id: string; grade_level: string; name: string; source_document_id: string | null }
  period: { id: string; label: string }
  competency: {
    id: string
    competency_code: string | null
    competency_text: string
    source_page: number | null
    academic_period_id: string | null
    source_document_id: string | null
  }
  source: { title: string; source_url: string | null }
  gradingTerm: { id: string; label: string }
}

export type TestAssignment = {
  id: string
  userId: string
  schoolYear: string
  gradeLevel: string
  learningArea: string
  sectionName: string
}

export type TestHarness = {
  config: LocalSupabaseConfig
  service: SupabaseClient
  runId: string
  teachers: TestTeacher[]
  assignments: TestAssignment[]
  cleanup: () => Promise<void>
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = typeof process !== 'undefined' ? process.env[name] : undefined
    if (value?.trim()) return value.trim()
  }
  return ''
}

/**
 * Return null when the local stack has not been configured. The suite turns
 * that into a hard failure so a missing live gate is never silently skipped.
 */
export function localSupabaseConfig(): LocalSupabaseConfig | null {
  const browserUrl = envValue('VITE_SUPABASE_URL')
  const browserAnonKey = envValue('VITE_SUPABASE_PUBLISHABLE_KEY')
  const url = browserUrl || envValue('SUPABASE_URL')
  assertSafeTestTarget(url)
  const anonKey = browserAnonKey || envValue('SUPABASE_ANON_KEY')
  const serviceRoleKey = envValue('SUPABASE_SERVICE_ROLE_KEY')
  // The application repositories read only VITE_* values via import.meta.env.
  // Require those browser values here as well; otherwise a fallback env could
  // make the fixture client local while the repository silently used its
  // production default.
  if (!browserUrl || !browserAnonKey || !url || !anonKey || !serviceRoleKey) return null
  return { url, anonKey, serviceRoleKey }
}

/** Explicit refusal guard for the production project and non-local targets. */
export function assertSafeTestTarget(url: string) {
  if (!url) return
  if (url.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(`Refusing to run Supabase integration tests against production project ${PRODUCTION_PROJECT_REF}.`)
  }
  let hostname = ''
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    throw new Error(`Invalid SUPABASE_URL for integration tests: ${url}`)
  }
  const localHostnames = new Set(['127.0.0.1', 'localhost', '::1'])
  if (!localHostnames.has(hostname)) {
    throw new Error(`Supabase integration tests require a local stack; refusing host ${hostname}.`)
  }
}

function randomSuffix() {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '')
    : `${Date.now()}${Math.random().toString(36).slice(2)}`
  return uuid.slice(0, 18)
}

function makeTeacherClient(config: LocalSupabaseConfig) {
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function checked(label: string, request: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<any> {
  const { data, error } = await request
  if (error) throw new Error(`${label}: ${error.message}`)
  if (data === null || data === undefined) throw new Error(`${label}: no row returned`)
  return data
}

export async function createLocalTestHarness(): Promise<TestHarness> {
  const config = localSupabaseConfig()
  if (!config) throw new Error('Local Supabase integration variables are not configured.')
  assertSafeTestTarget(config.url)

  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const runId = `phase55-${randomSuffix()}`
  const teachers: TestTeacher[] = []
  const assignments: TestAssignment[] = []

  try {
    for (const label of ['alpha', 'beta']) {
      const email = `${runId}-${label}@example.test`
      const password = `T-${randomSuffix()}-a9!`
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Phase 5.5 ${label}` },
      })
      if (error || !data.user) throw new Error(`create ${label} auth teacher: ${error?.message ?? 'no user returned'}`)
      const client = makeTeacherClient(config)
      const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password })
      if (signInError || !signIn.session) throw new Error(`sign in ${label} auth teacher: ${signInError?.message ?? 'no session returned'}`)
      teachers.push({
        id: data.user.id,
        email,
        password,
        accessToken: signIn.session.access_token,
        refreshToken: signIn.session.refresh_token,
        client,
      })
    }

    const assignmentRows = teachers.map((teacher, index) => ({
      user_id: teacher.id,
      school_year: '2026-2027',
      grade_level: 'Grade 7',
      learning_area: 'Mathematics',
      section_names: [`Phase55-${index + 1}`],
      is_active: true,
    }))
    const inserted = await checked('create teacher assignments', service.from('teacher_assignments').insert(assignmentRows).select('id,user_id,school_year,grade_level,learning_area,section_names'))
    for (const row of inserted ?? []) {
      assignments.push({
        id: String(row.id),
        userId: String(row.user_id),
        schoolYear: String(row.school_year),
        gradeLevel: String(row.grade_level),
        learningArea: String(row.learning_area),
        sectionName: Array.isArray(row.section_names) ? String(row.section_names[0]) : 'Phase55-1',
      })
    }
    if (assignments.length !== teachers.length) throw new Error('The local stack did not return one assignment per test teacher.')
  } catch (error) {
    await cleanupHarnessRows(service, teachers, assignments).catch(() => undefined)
    throw error
  }

  let cleaned = false
  return {
    config,
    service,
    runId,
    teachers,
    assignments,
    cleanup: async () => {
      if (cleaned) return
      cleaned = true
      await cleanupHarnessRows(service, teachers, assignments)
    },
  }
}

async function deleteWhere(service: SupabaseClient, table: string, column: string, value: string) {
  const { error } = await service.from(table).delete().eq(column, value)
  if (error && !/relation .* does not exist/i.test(error.message)) throw error
}

async function deleteDocumentsByType(service: SupabaseClient, owner: string, documentType: string) {
  const { error } = await service.from('documents').delete().eq('user_id', owner).eq('document_type', documentType)
  if (error && !/relation .* does not exist/i.test(error.message)) throw error
}

async function bestEffortLifecycleCleanup(action: () => Promise<void>) {
  try {
    await action()
  } catch (error) {
    const message = String((error as { message?: unknown })?.message ?? error)
    // Final assessments/TOS documents and historical result sessions are
    // intentionally archive-only in the schema.  Do not turn a passing test
    // into a teardown failure when those lifecycle guards correctly refuse a
    // service-role hard delete; local stacks can be reset between runs.
    if (/cannot be hard deleted|cannot be deleted|only draft|on delete restrict|foreign key|still referenced|violates|immutable/i.test(message)) return
    throw error
  }
}

async function cleanupHarnessRows(service: SupabaseClient, teachers: TestTeacher[], assignments: TestAssignment[]) {
  // Child-first deletion is explicit because assessment source documents are
  // referenced with ON DELETE RESTRICT.  Auth deletion is the final fallback
  // for profiles and any rows not named here.
  for (const teacher of teachers) {
    const owner = teacher.id
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'remediation_plan_participants', 'user_id', owner))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'remediation_plan_targets', 'user_id', owner))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'remediation_plans', 'user_id', owner))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'result_item_outcomes', 'user_id', owner))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'result_score_only_outcomes', 'user_id', owner))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'result_session_learners', 'user_id', owner))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'result_sessions', 'user_id', owner))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'class_learners', 'user_id', owner))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'assessment_ai_audit_events', 'user_id', owner))
    // Assessment source_tos_document_id is intentionally ON DELETE RESTRICT;
    // delete assessment documents before their finalized TOS sources instead
    // of issuing one broad documents delete with an order-dependent FK check.
    await bestEffortLifecycleCleanup(() => deleteDocumentsByType(service, owner, 'assessment'))
    await bestEffortLifecycleCleanup(() => deleteDocumentsByType(service, owner, 'tos'))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'documents', 'user_id', owner))
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'teacher_assignments', 'user_id', owner))
    await service.auth.admin.deleteUser(owner).catch(() => undefined)
  }
  // If auth cleanup already cascaded, this is harmless; it also covers rows
  // created by a partially failed setup before a teacher was recorded.
  for (const assignment of assignments) {
    await bestEffortLifecycleCleanup(() => deleteWhere(service, 'teacher_assignments', 'id', assignment.id))
  }
}

export async function signInTestTeacher(teacher: TestTeacher) {
  const { data, error } = await teacher.client.auth.signInWithPassword({ email: teacher.email, password: teacher.password })
  if (error || !data.session) throw new Error(`sign in fixture teacher: ${error?.message ?? 'no session returned'}`)
  teacher.accessToken = data.session.access_token
  teacher.refreshToken = data.session.refresh_token
  return data.session
}

export async function resolveCanonicalFixture(service: SupabaseClient): Promise<CanonicalCurriculumFixture> {
  const version = await checked('find active curriculum version', service.from('curriculum_versions').select('id,code,name').eq('code', 'REVISED-K10-MATATAG').in('status', ['active', 'superseded']).single())
  const subject = await checked('find Grade 7 Mathematics subject', service.from('curriculum_subjects').select('id,grade_level,name,source_document_id').eq('curriculum_version_id', version.id).eq('grade_level', 'Grade 7').eq('name', 'Mathematics').single())
  const period = await checked('find first Mathematics curriculum period', service.from('academic_periods').select('id,label').eq('subject_id', subject.id).order('sequence', { ascending: true }).limit(1).single())
  const competency = await checked('find verified Mathematics competency', service.from('curriculum_competencies').select('id,competency_code,competency_text,source_page,academic_period_id,source_document_id').eq('subject_id', subject.id).eq('academic_period_id', period.id).eq('verification_status', 'verified').order('sort_order', { ascending: true }).limit(1).single())
  const sourceId = competency.source_document_id ?? subject.source_document_id
  const source = sourceId
    ? await checked('load curriculum source metadata', service.from('source_documents').select('title,source_url').eq('id', sourceId).single())
    : { title: 'Verified Grade 7 Mathematics curriculum', source_url: null }
  const calendar = await checked('find active school-year calendar', service.from('school_year_calendars').select('id').eq('school_year', '2026-2027').in('status', ['active', 'superseded']).single())
  const gradingTerm = await checked('find first grading term', service.from('grading_periods').select('id,label').eq('school_year_calendar_id', calendar.id).order('sequence', { ascending: true }).limit(1).single())
  return { version, subject, period, competency, source, gradingTerm }
}

export async function provisionFinalTos(
  teacher: TestTeacher,
  assignment: TestAssignment,
  curriculum: CanonicalCurriculumFixture,
  content: Record<string, unknown>,
  rows: unknown[],
) {
  return checked('create finalized fixture TOS', teacher.client.rpc('save_tos_document', {
    p_document_id: null,
    p_assignment_id: assignment.id,
    p_title: String(content.title),
    p_school_year: assignment.schoolYear,
    p_academic_period_label: String(content.gradingTermLabel),
    p_status: 'final',
    p_structured_content: content,
    p_rows: rows,
    p_change_note: 'Phase 5.5 integration fixture',
  }))
}
