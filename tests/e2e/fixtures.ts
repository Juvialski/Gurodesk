import os from 'node:os'
import path from 'node:path'
import { expect, test as base, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAssessmentBlueprint } from '../../src/lib/assessmentBlueprint'
import type { AssessmentItem, AssessmentRecord } from '../../src/types/assessment'
import type { TosContent, TosRecord } from '../../src/types/tos'

const localSupabaseHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])
const blockedAiHosts = ['generativelanguage.googleapis.com', 'aiplatform.googleapis.com']

export const authStateFile = process.env.E2E_AUTH_STATE_FILE?.trim()
  || path.join(os.tmpdir(), 'gurodesk-playwright-auth.json')

const mockedAiStatus = {
  // Keep the E2E teacher explicitly unconfigured. Ordinary workspace and
  // manual workflows must still open; AI setup is covered only when a feature
  // asks for it.
  configured: false,
  keyLast4: null,
  verifiedAt: null,
  preferredModel: 'gemini-3.5-flash-lite',
  fallbackModel: 'gemini-3.1-flash-lite',
  fallbackEnabled: true,
}

function isBlockedExternalAiRequest(requestUrl: string) {
  let parsed: URL
  try {
    parsed = new URL(requestUrl)
  } catch {
    return false
  }

  if (blockedAiHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    return true
  }

  // This guard also covers a reused Vite process that was started with a
  // remote Supabase default. The tests must fail closed before a request can
  // reach a non-local project.
  if (parsed.hostname.endsWith('.supabase.co')) return true
  return false
}

function isSupabaseFunction(requestUrl: string) {
  try {
    return new URL(requestUrl).pathname.includes('/functions/v1/')
  } catch {
    return false
  }
}

function isAiSettingsRequest(requestUrl: string) {
  try {
    const parsed = new URL(requestUrl)
    return parsed.pathname.endsWith('/functions/v1/ai-settings')
      && localSupabaseHosts.has(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Install the test-only network boundary before the first navigation.
 *
 * The app still uses the local Supabase REST/Auth APIs for this suite. The
 * feature-local setup status call is fulfilled so a test account can enter the
 * workspace without a Gemini key; all generation/verification functions and
 * direct Gemini hosts are aborted.
 */
export async function installE2eNetworkGuards(page: Page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url()
    if (isBlockedExternalAiRequest(requestUrl)) {
      await route.abort()
      return
    }

    if (isAiSettingsRequest(requestUrl)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
        },
        body: JSON.stringify(mockedAiStatus),
      })
      return
    }

    // No E2E case should invoke an AI provider. Keeping this explicit makes a
    // future accidental click fail locally instead of using a real key.
    if (isSupabaseFunction(requestUrl)) {
      await route.abort()
      return
    }

    await route.continue()
  })
}

async function visible(page: Page, role: 'heading' | 'textbox', name: RegExp | string, timeout = 4_000) {
  const locator = page.getByRole(role, { name })
  try {
    await locator.waitFor({ state: 'visible', timeout })
    return true
  } catch {
    return false
  }
}

async function completeOnboarding(page: Page) {
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible()
  await page.getByLabel('Full name').fill(process.env.E2E_FULL_NAME?.trim() || 'Playwright Teacher')
  await page.getByLabel('School name').fill(process.env.E2E_SCHOOL_NAME?.trim() || 'Playwright Local School')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'What do you teach?' })).toBeVisible()
  await page.getByLabel('Sections').fill(process.env.E2E_SECTIONS?.trim() || 'E2E Section')
  await page.getByRole('button', { name: 'Add assignment' }).click()
  await expect(page.getByText('Grade 7 · Mathematics', { exact: true })).toBeVisible()

  // AI setup is a four-step, optional onboarding decision. The local E2E
  // suite deliberately exercises the non-AI path so ordinary workspace entry
  // remains covered without configuring a provider key.
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Optional AI setup' })).toBeVisible()
  await page.getByRole('button', { name: 'Set up later', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'You’re ready to go' })).toBeVisible()
  await page.getByRole('button', { name: 'Open workspace', exact: true }).click()
}

async function dismissTeacherTourIfVisible(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Welcome to GuroDesk' })
  try {
    await dialog.waitFor({ state: 'visible', timeout: 750 })
  } catch {
    return
  }
  await dialog.getByRole('button', { name: 'Skip tour', exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function ensureGrade7MathematicsAssignment(page: Page) {
  await page.goto('/classes')
  await expect(page.getByRole('heading', { name: 'Classes' })).toBeVisible()

  const matchingRows = page.getByRole('row').filter({ hasText: 'Grade 7' }).filter({ hasText: 'Mathematics' })
  if (await matchingRows.count() === 0) {
    await page.getByRole('button', { name: 'Add class' }).click()
    await page.getByLabel('Sections').fill(process.env.E2E_SECTIONS?.trim() || 'E2E Section')
    await page.locator('.workflow-sections-field').getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('button', { name: 'Save class', exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: 'Grade 7' }).filter({ hasText: 'Mathematics' })).toHaveCount(1)
  }

  await page.goto('/')
}

/** Sign in through the real local Supabase-backed form and reach the workspace. */
export async function loginAndOpenWorkspace(page: Page) {
  await page.goto('/')

  if (await visible(page, 'heading', /Good (?:morning|afternoon|evening)/i)) {
    await dismissTeacherTourIfVisible(page)
    await ensureGrade7MathematicsAssignment(page)
    return
  }

  if (await visible(page, 'heading', 'About you')) {
    await completeOnboarding(page)
    await expect(page.getByRole('heading', { name: /Good (?:morning|afternoon|evening)/i })).toBeVisible()
    await dismissTeacherTourIfVisible(page)
    return
  }

  await expect(page.getByRole('heading', { name: /Welcome back|Local preview/i })).toBeVisible()
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL!.trim())
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!.trim())
  await page.getByRole('button', { name: /^Sign in/ }).click()

  if (await visible(page, 'heading', 'About you', 20_000)) {
    await completeOnboarding(page)
  }

  await expect(page.getByRole('heading', { name: /Good (?:morning|afternoon|evening)/i })).toBeVisible({ timeout: 30_000 })
  await dismissTeacherTourIfVisible(page)
  await ensureGrade7MathematicsAssignment(page)
}

export async function openAssessmentList(page: Page) {
  await page.goto('/assessments')
  await expect(page.getByRole('heading', { name: 'Assessments' })).toBeVisible()
  await expect(page.getByText(/Teacher Review/i)).toBeVisible()
}

function e2eSupabaseConfig() {
  const url = (process.env.E2E_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = (process.env.E2E_SUPABASE_ANON_KEY || process.env.E2E_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  const email = process.env.E2E_EMAIL?.trim() || ''
  const password = process.env.E2E_PASSWORD?.trim() || ''
  if (!url || !anonKey || !email || !password) throw new Error('Local E2E Supabase/auth configuration is incomplete.')
  const parsed = new URL(url)
  if (!localSupabaseHosts.has(parsed.hostname)) throw new Error(`Refusing to create an E2E assessment fixture outside local Supabase: ${url}`)
  return { url, anonKey, email, password }
}

function e2eAssessmentItemWire(item: AssessmentItem) {
  return {
    id: item.id,
    itemNumber: item.itemNumber,
    competencySnapshot: structuredClone(item.competencySnapshot),
    cognitiveCategorySnapshot: structuredClone(item.cognitiveCategorySnapshot),
    mapping: structuredClone(item.mapping),
    questionType: item.questionType,
    prompt: item.prompt ?? '',
    answer: structuredClone(item.answer),
    pointsPossible: item.pointsPossible,
    points: item.pointsPossible,
    rationale: item.rationale ?? '',
    teacherNotes: item.teacherNotes ?? '',
    authorshipState: item.authorshipState,
    qaState: item.qaState ?? 'empty',
    locked: item.locked === true,
    history: structuredClone(item.history ?? []).slice(-5),
  }
}

function e2eAssessmentMirror(record: AssessmentRecord) {
  return {
    schemaVersion: 1,
    sourceTos: record.sourceTos ? structuredClone(record.sourceTos) : undefined,
    sourceTosDocumentId: record.sourceTos?.id ?? null,
    sourceTosVersionNumber: record.sourceTos?.versionNumber ?? null,
    title: record.title,
    instructions: record.instructions,
    gradeLevel: record.gradeLevel,
    learningArea: record.learningArea,
    schoolYear: record.schoolYear,
    gradingTermId: record.gradingTermId,
    gradingTermLabel: record.gradingTermLabel,
    curriculumPeriodIds: [...record.curriculumPeriodIds],
    curriculumPeriodLabels: [...record.curriculumPeriodLabels],
    totalItems: record.totalItems,
    totalPoints: record.items.reduce((sum, item) => sum + item.pointsPossible, 0),
    settings: structuredClone(record.settings ?? {}),
    items: record.items.map(e2eAssessmentItemWire),
  }
}

/**
 * Seed a deterministic manual assessment draft through the same guarded local
 * Supabase RPC used by production saves.  Assessment Generation V2 requires a
 * Gemini master-plan call, which the E2E network boundary deliberately blocks;
 * editor/export regression tests therefore seed their draft without restoring
 * the removed legacy UI "Create draft" action or calling any external AI.
 */
export async function createManualAssessmentDraftFixture(sourceTosId: string, title: string, instructions = '') {
  const config = e2eSupabaseConfig()
  const client = createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email: config.email, password: config.password })
  if (signInError || !signedIn.user) throw new Error(`Unable to authenticate E2E assessment fixture teacher: ${signInError?.message ?? 'no user'}`)

  const { data: source, error: sourceError } = await client
    .from('documents')
    .select('id,user_id,assignment_id,title,school_year,academic_period_label,status,structured_content')
    .eq('id', sourceTosId)
    .eq('document_type', 'tos')
    .single()
  if (sourceError || !source) throw new Error(`Unable to load finalized E2E TOS: ${sourceError?.message ?? 'no source'}`)
  if (source.status !== 'final') throw new Error('E2E assessment fixture requires a finalized TOS.')

  const { data: versions, error: versionError } = await client
    .from('document_versions')
    .select('version_number')
    .eq('document_id', sourceTosId)
    .order('version_number', { ascending: false })
    .limit(1)
  if (versionError) throw new Error(`Unable to resolve finalized E2E TOS version: ${versionError.message}`)
  const versionNumber = Number(versions?.[0]?.version_number ?? 0)
  if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) throw new Error('Finalized E2E TOS has no immutable version.')

  const content = structuredClone(source.structured_content) as TosContent
  const tos: TosRecord = {
    id: String(source.id),
    userId: String(source.user_id),
    assignmentId: source.assignment_id ? String(source.assignment_id) : null,
    title: String(source.title ?? content.title ?? 'E2E TOS'),
    schoolYear: String(source.school_year ?? content.schoolYear ?? ''),
    academicPeriodLabel: source.academic_period_label ? String(source.academic_period_label) : null,
    status: 'final',
    content,
    versionNumber,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
  }
  const blueprint = createAssessmentBlueprint(tos, { userId: signedIn.user.id, title, instructions })
  const itemPayload = blueprint.items.map(e2eAssessmentItemWire)
  const mirror = e2eAssessmentMirror(blueprint)
  const { data: saved, error: saveError } = await client.rpc('save_assessment_document', {
    p_document_id: null,
    p_assignment_id: blueprint.assignmentId,
    p_source_tos_document_id: sourceTosId,
    p_title: title,
    p_school_year: blueprint.schoolYear,
    p_academic_period_label: blueprint.gradingTermLabel || null,
    p_instructions: instructions,
    p_status: 'draft',
    p_structured_content: mirror,
    p_items: itemPayload,
    p_change_note: 'Deterministic local E2E assessment fixture',
  })
  if (saveError || !saved) throw new Error(`Unable to create local E2E assessment fixture: ${saveError?.message ?? 'no row returned'}`)
  const row = Array.isArray(saved) ? saved[0] : saved
  const id = String((row as { id?: unknown })?.id ?? '')
  if (!id) throw new Error('Local E2E assessment fixture RPC returned no document ID.')
  await client.auth.signOut()
  return { id, title }
}

/**
 * Existing export/assessment regression cases exercise the full question
 * editor (choices, diagrams, and persistence). New assessments open in the
 * guided Simple view, so switch modes through the user-facing toggle instead
 * of coupling those tests to an implementation default.
 */
export async function switchToAssessmentCustomize(page: Page) {
  const toggle = page.getByRole('group', { name: 'Editing mode' })
  const customize = toggle.getByRole('button', { name: 'Customize', exact: true })
  await expect(customize).toBeVisible({ timeout: 30_000 })
  if (await customize.getAttribute('aria-pressed') !== 'true') await customize.click()
  await expect(customize).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Assessment editor' })).toBeVisible({ timeout: 30_000 })
}

export async function createFinalizedTos(page: Page, title: string, competencyText?: string | RegExp) {
  await page.goto('/tos/new')
  await expect(page.getByRole('heading', { name: 'New TOS' })).toBeVisible({ timeout: 30_000 })

  // Finalization coverage still exercises the full allocation editor. New TOS
  // records intentionally start in Simple mode, so opt into Customize through
  // the same public control a teacher uses.
  const editorMode = page.getByRole('group', { name: 'Editing mode' })
  const customize = editorMode.getByRole('button', { name: 'Customize', exact: true })
  await expect(customize).toBeVisible({ timeout: 30_000 })
  if (await customize.getAttribute('aria-pressed') !== 'true') await customize.click()
  await expect(customize).toHaveAttribute('aria-pressed', 'true')

  await page.getByLabel('TOS title').fill(title)

  // School grading term is intentionally independent from the curriculum-guide
  // period. A new TOS does not auto-select one, so the E2E helper must make the
  // same explicit choice a teacher makes before finalization.
  const gradingTermGroup = page.getByRole('group', { name: 'School grading term' })
  const firstGradingTerm = gradingTermGroup.getByRole('button').first()
  await expect(firstGradingTerm).toBeVisible({ timeout: 30_000 })
  await firstGradingTerm.click()
  await expect(firstGradingTerm).toHaveAttribute('aria-pressed', 'true')

  const picker = page.getByRole('button', { name: /Choose verified competencies|verified competenc(?:y|ies) selected/ })
  await picker.click()
  const options = page.locator('#tos-competency-options').getByRole('option')
  const selectedOption = competencyText ? options.filter({ hasText: competencyText }).first() : options.first()
  await expect(selectedOption).toBeVisible({ timeout: 30_000 })
  await selectedOption.click()
  await page.getByRole('button', { name: 'Done' }).click()

  // Finalization readiness is a behavioral contract, not a text-copy contract.
  // Waiting for the actual action to enable is resilient to harmless UI wording changes.
  const finalizeButton = page.getByRole('button', { name: 'Finalize TOS' })
  await expect(finalizeButton).toBeEnabled({ timeout: 15_000 })
  await finalizeButton.click()
  await expect(page.getByText(/TOS finalized\. Its content and allocations are now locked\./)).toBeVisible({ timeout: 30_000 })

  const id = new URL(page.url()).pathname.match(/^\/tos\/([^/]+)$/)?.[1]
  if (!id) throw new Error(`Finalized TOS did not navigate to a document route: ${page.url()}`)
  return { id, title }
}

export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await installE2eNetworkGuards(page)
    await use(page)
  },
})

export { expect }
