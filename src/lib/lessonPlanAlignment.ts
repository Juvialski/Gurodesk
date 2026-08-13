import type {
  LegacyLessonPlanCompetencySnapshot,
  LessonPlanCompetencySnapshot,
  LessonPlanContent,
} from '../types/lessonPlan'

type LessonPlanAlignmentState = Pick<
  LessonPlanContent,
  'alignmentMode' | 'competency' | 'curriculumAlignments' | 'primaryCompetencyId'
>

type LessonPlanCompetencyInput = LessonPlanCompetencySnapshot | LegacyLessonPlanCompetencySnapshot

export function emptyLessonCompetencySnapshot(
  overrides: Partial<LessonPlanCompetencySnapshot> = {},
): LessonPlanCompetencySnapshot {
  return {
    id: '',
    code: null,
    text: '',
    sourcePage: null,
    sourceTitle: null,
    academicPeriodId: null,
    curriculumPeriodLabel: '',
    domainId: null,
    contentArea: '',
    verificationStatus: 'verified',
    ...overrides,
    contentStandards: [...(overrides.contentStandards ?? [])],
    performanceStandards: [...(overrides.performanceStandards ?? [])],
  }
}

export function normalizeLessonCompetencySnapshot(
  snapshot: LessonPlanCompetencyInput,
): LessonPlanCompetencySnapshot {
  // Current/runtime snapshots fail closed when status is absent or non-verified.
  // Legacy v1 snapshots use the explicit legacy adapter below.
  if (snapshot.verificationStatus !== 'verified') {
    return emptyLessonCompetencySnapshot()
  }
  return normalizeVerifiedSnapshot(snapshot)
}

function normalizeVerifiedSnapshot(snapshot: LessonPlanCompetencyInput): LessonPlanCompetencySnapshot {
  return emptyLessonCompetencySnapshot({
    id: snapshot.id,
    code: snapshot.code,
    text: snapshot.text,
    sourcePage: snapshot.sourcePage,
    sourceTitle: snapshot.sourceTitle,
    academicPeriodId: snapshot.academicPeriodId ?? null,
    curriculumPeriodLabel: snapshot.curriculumPeriodLabel ?? '',
    domainId: snapshot.domainId ?? null,
    contentArea: snapshot.contentArea ?? '',
    contentStandards: snapshot.contentStandards ?? [],
    performanceStandards: snapshot.performanceStandards ?? [],
    verificationStatus: 'verified',
  })
}

export function normalizeLegacyLessonCompetencySnapshot(
  snapshot: LegacyLessonPlanCompetencySnapshot,
): LessonPlanCompetencySnapshot {
  if (snapshot.verificationStatus !== undefined && snapshot.verificationStatus !== 'verified') {
    return emptyLessonCompetencySnapshot()
  }
  return normalizeVerifiedSnapshot(snapshot)
}

function normalizedIdentityPart(value: string | null) {
  return value?.trim().toLocaleLowerCase() ?? ''
}

function lessonCompetencyIdentity(snapshot: LessonPlanCompetencySnapshot) {
  const id = snapshot.id.trim()
  if (id) return `id:${id}`

  return [
    'snapshot',
    normalizedIdentityPart(snapshot.code),
    normalizedIdentityPart(snapshot.text),
    snapshot.sourcePage === null ? '' : String(snapshot.sourcePage),
    normalizedIdentityPart(snapshot.sourceTitle),
  ].join('|')
}

export function isLessonCompetencySnapshotEmpty(snapshot: LessonPlanCompetencyInput) {
  return !snapshot.id.trim()
    && !snapshot.text.trim()
    && !snapshot.code?.trim()
    && snapshot.sourcePage === null
    && !snapshot.sourceTitle?.trim()
    && !snapshot.academicPeriodId?.trim()
    && !snapshot.curriculumPeriodLabel?.trim()
    && !snapshot.domainId?.trim()
    && !snapshot.contentArea?.trim()
    && !(snapshot.contentStandards?.length)
    && !(snapshot.performanceStandards?.length)
}

/** Normalize, clone, and de-duplicate alignments while retaining their first-seen order. */
export function normalizeLessonCurriculumAlignments(
  alignments: readonly LessonPlanCompetencyInput[],
): LessonPlanCompetencySnapshot[] {
  const seen = new Set<string>()
  const normalized: LessonPlanCompetencySnapshot[] = []

  for (const alignment of alignments) {
    const snapshot = normalizeLessonCompetencySnapshot(alignment)
    if (isLessonCompetencySnapshotEmpty(snapshot)) continue
    const identity = lessonCompetencyIdentity(snapshot)
    if (seen.has(identity)) continue
    seen.add(identity)
    normalized.push(snapshot)
  }

  return normalized
}

export const normalizeCurriculumAlignments = normalizeLessonCurriculumAlignments

function matchingCompetencyId(left: string | null, right: string) {
  return Boolean(left?.trim() && left.trim() === right.trim())
}

export function getPrimaryLessonCompetency(
  content: Pick<LessonPlanContent, 'curriculumAlignments' | 'primaryCompetencyId'>,
): LessonPlanCompetencySnapshot | null {
  if (!content.primaryCompetencyId) return null
  return content.curriculumAlignments.find((alignment) =>
    matchingCompetencyId(content.primaryCompetencyId, alignment.id),
  ) ?? null
}

/**
 * Return a cloned alignment state with a valid primary projection.
 * The input is never mutated. If the requested primary disappeared, the first
 * remaining alignment with an ID is promoted deterministically.
 */
export function syncLessonCompetencyProjection<T extends LessonPlanAlignmentState>(content: T): T {
  const curriculumAlignments = normalizeLessonCurriculumAlignments(content.curriculumAlignments)
  const requestedPrimary = content.primaryCompetencyId
    ? curriculumAlignments.find((alignment) => matchingCompetencyId(content.primaryCompetencyId, alignment.id))
    : null
  const primary = requestedPrimary ?? curriculumAlignments.find((alignment) => alignment.id.trim()) ?? null

  return {
    ...content,
    alignmentMode: curriculumAlignments.length ? 'curriculum_aligned' : content.alignmentMode,
    curriculumAlignments,
    primaryCompetencyId: primary?.id ?? null,
    // An invalid historical snapshot with no ID remains visible in the legacy
    // projection, but cannot be treated as a valid primary by final validation.
    competency: primary
      ? normalizeLessonCompetencySnapshot(primary)
      : curriculumAlignments[0]
        ? normalizeLessonCompetencySnapshot(curriculumAlignments[0])
        : emptyLessonCompetencySnapshot(),
  }
}

export function setLessonPrimaryCompetency<T extends LessonPlanAlignmentState>(
  content: T,
  competencyId: string,
): T {
  const alignments = normalizeLessonCurriculumAlignments(content.curriculumAlignments)
  const primary = alignments.find((alignment) => matchingCompetencyId(competencyId, alignment.id))
  if (!primary) return syncLessonCompetencyProjection(content)
  return syncLessonCompetencyProjection({
    ...content,
    curriculumAlignments: alignments,
    primaryCompetencyId: primary.id,
  }) as T
}

export function removeLessonCompetency<T extends LessonPlanAlignmentState>(
  content: T,
  competencyId: string,
): T {
  return syncLessonCompetencyProjection({
    ...content,
    curriculumAlignments: content.curriculumAlignments.filter((alignment) =>
      !matchingCompetencyId(competencyId, alignment.id),
    ),
    primaryCompetencyId: matchingCompetencyId(content.primaryCompetencyId, competencyId)
      ? null
      : content.primaryCompetencyId,
  }) as T
}

export function toggleLessonCompetency<T extends LessonPlanAlignmentState>(
  content: T,
  competency: LessonPlanCompetencyInput,
): T {
  const snapshot = normalizeLessonCompetencySnapshot(competency)
  const existing = normalizeLessonCurriculumAlignments(content.curriculumAlignments)
  const identity = lessonCompetencyIdentity(snapshot)
  const selected = existing.some((alignment) => lessonCompetencyIdentity(alignment) === identity)

  if (selected) {
    const withoutSelection = existing.filter((alignment) => lessonCompetencyIdentity(alignment) !== identity)
    return syncLessonCompetencyProjection({
      ...content,
      curriculumAlignments: withoutSelection,
      primaryCompetencyId: matchingCompetencyId(content.primaryCompetencyId, snapshot.id)
        ? null
        : content.primaryCompetencyId,
    }) as T
  }

  return syncLessonCompetencyProjection({
    ...content,
    curriculumAlignments: [...existing, snapshot],
    primaryCompetencyId: content.primaryCompetencyId || snapshot.id || null,
  }) as T
}
