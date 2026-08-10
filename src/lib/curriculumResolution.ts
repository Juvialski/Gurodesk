export type CurriculumApplicabilityCandidate = {
  versionId: string
  priority: number
}

export type CurriculumVersionCandidate = {
  id: string
  code: string
}

export type CurriculumSubjectCandidate<T> = {
  versionId: string
  name: string
  value: T
}

export type CurriculumSubjectResolution<T> = {
  versionId: string | null
  subject: T | null
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('en')
}

/**
 * Resolve a subject across concurrent curriculum versions without assuming the
 * first grade/year applicability row is globally correct. A source-catalogued
 * curriculum code wins when available; otherwise the configured applicability
 * priority is authoritative. The function is pure so phased/pilot/legacy
 * coexistence can be regression-tested without a Supabase connection.
 */
export function resolveCurriculumSubjectVersion<T>(
  applicability: CurriculumApplicabilityCandidate[],
  versions: CurriculumVersionCandidate[],
  subjects: CurriculumSubjectCandidate<T>[],
  acceptedSubjectNames: Iterable<string>,
  preferredCurriculumCode?: string | null,
): CurriculumSubjectResolution<T> {
  const applicable = [...applicability]
    .filter((entry) => entry.versionId)
    .sort((left, right) => left.priority - right.priority || left.versionId.localeCompare(right.versionId, 'en'))

  if (!applicable.length) return { versionId: null, subject: null }

  const applicableIds = new Set(applicable.map((entry) => entry.versionId))
  const priorityByVersion = new Map(applicable.map((entry) => [entry.versionId, entry.priority]))
  const versionById = new Map(versions.filter((entry) => applicableIds.has(entry.id)).map((entry) => [entry.id, entry]))
  const names = new Set([...acceptedSubjectNames].map(normalized).filter(Boolean))

  const matches = subjects
    .filter((entry) => applicableIds.has(entry.versionId) && names.has(normalized(entry.name)))
    .sort((left, right) => {
      const leftVersion = versionById.get(left.versionId)
      const rightVersion = versionById.get(right.versionId)
      const leftPreferred = preferredCurriculumCode && leftVersion?.code === preferredCurriculumCode ? 0 : 1
      const rightPreferred = preferredCurriculumCode && rightVersion?.code === preferredCurriculumCode ? 0 : 1
      if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred

      const priorityDifference = (priorityByVersion.get(left.versionId) ?? 100) - (priorityByVersion.get(right.versionId) ?? 100)
      if (priorityDifference !== 0) return priorityDifference

      return left.versionId.localeCompare(right.versionId, 'en') || left.name.localeCompare(right.name, 'en')
    })

  const selected = matches[0]
  if (selected) return { versionId: selected.versionId, subject: selected.value }
  return { versionId: applicable[0].versionId, subject: null }
}
