import type {
  CurriculumCompetency,
  CurriculumNavigatorBundle,
} from '../types/curriculum'
import type { LessonPlanCompetencySnapshot } from '../types/lessonPlan'

export type LessonCurriculumGroup = {
  key: string
  periodLabel: string
  contentArea: string
  contentStandards: string[]
  performanceStandards: string[]
  competencies: CurriculumCompetency[]
}

function relevantStandards(
  bundle: CurriculumNavigatorBundle,
  competency: CurriculumCompetency,
) {
  return bundle.standards.filter((standard) =>
    standard.academicPeriodId === competency.academicPeriodId
    && (standard.domainId === null || standard.domainId === competency.domainId)
    && (standard.standardType === 'content' || standard.standardType === 'performance'),
  )
}

export function createLessonCompetencySnapshot(
  bundle: CurriculumNavigatorBundle,
  competency: CurriculumCompetency,
): LessonPlanCompetencySnapshot {
  if (competency.verificationStatus !== 'verified') {
    throw new Error('Only verified curriculum competencies can align a lesson plan.')
  }
  const period = bundle.periods.find((item) => item.id === competency.academicPeriodId) ?? null
  const domain = bundle.domains.find((item) => item.id === competency.domainId) ?? null
  const standards = relevantStandards(bundle, competency)
  return {
    id: competency.id,
    code: competency.competencyCode,
    text: competency.competencyText,
    sourcePage: competency.sourcePage,
    sourceTitle: bundle.source?.title ?? null,
    academicPeriodId: competency.academicPeriodId,
    curriculumPeriodLabel: period?.label ?? '',
    domainId: competency.domainId,
    contentArea: domain?.name ?? '',
    contentStandards: standards
      .filter((item) => item.standardType === 'content')
      .map((item) => item.standardText),
    performanceStandards: standards
      .filter((item) => item.standardType === 'performance')
      .map((item) => item.standardText),
    verificationStatus: 'verified',
  }
}

export function groupLessonCompetencies(
  bundle: CurriculumNavigatorBundle | null,
  competencies: CurriculumCompetency[],
): LessonCurriculumGroup[] {
  if (!bundle) return []
  const groups = new Map<string, LessonCurriculumGroup>()
  for (const competency of competencies) {
    const snapshot = createLessonCompetencySnapshot(bundle, competency)
    const key = `${snapshot.academicPeriodId ?? 'none'}:${snapshot.domainId ?? 'none'}`
    const existing = groups.get(key)
    if (existing) {
      existing.competencies.push(competency)
      continue
    }
    groups.set(key, {
      key,
      periodLabel: snapshot.curriculumPeriodLabel || 'Curriculum period',
      contentArea: snapshot.contentArea || 'Other curriculum content',
      contentStandards: snapshot.contentStandards,
      performanceStandards: snapshot.performanceStandards,
      competencies: [competency],
    })
  }
  return [...groups.values()]
}

function normalizedTokens(value: string, keepShortNumbers = false) {
  return [...new Set(value
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 || (keepShortNumbers && /^\d+$/u.test(item))))]
}

function searchText(bundle: CurriculumNavigatorBundle, competency: CurriculumCompetency) {
  const domain = bundle.domains.find((item) => item.id === competency.domainId)
  const standards = relevantStandards(bundle, competency)
  return [
    competency.competencyCode,
    competency.competencyText,
    domain?.name,
    ...standards.map((item) => item.standardText),
  ].filter(Boolean).join(' ').toLocaleLowerCase('en')
}

/**
 * Ranks only verified rows already present in the curriculum bundle. It never
 * fabricates a topic or competency when the teacher's wording has no match.
 */
export function rankVerifiedLessonCompetencies(
  bundle: CurriculumNavigatorBundle | null,
  competencies: CurriculumCompetency[],
  lessonFocus: string,
  search: string,
) {
  if (!bundle) return []
  const searchTokens = normalizedTokens(search, true)
  const searchPhrase = search.trim().toLocaleLowerCase('en')
  const focusTokens = normalizedTokens(lessonFocus)
  return competencies
    .filter((item) => item.verificationStatus === 'verified')
    .map((item) => {
      const haystack = searchText(bundle, item)
      const searchMatches = Boolean(searchPhrase) && (
        haystack.includes(searchPhrase)
        || searchTokens.every((token) => haystack.includes(token))
      )
      if (searchPhrase && !searchMatches) return null
      const score = focusTokens.reduce(
        (total, token) => total + (haystack.includes(token) ? 1 : 0),
        0,
      )
      return { item, score }
    })
    .filter((entry): entry is { item: CurriculumCompetency; score: number } => Boolean(entry))
    .filter((entry) => focusTokens.length === 0 || entry.score > 0 || searchTokens.length > 0)
    .sort((left, right) => right.score - left.score || left.item.sortOrder - right.item.sortOrder)
    .map((entry) => entry.item)
}

export function curriculumContentAreaSuggestions(
  bundle: CurriculumNavigatorBundle | null,
  periodId: string | null,
) {
  if (!bundle) return []
  const domainIds = new Set(bundle.competencies
    .filter((item) => item.verificationStatus === 'verified' && (!periodId || item.academicPeriodId === periodId))
    .map((item) => item.domainId)
    .filter((id): id is string => Boolean(id)))
  return bundle.domains
    .filter((domain) => domainIds.has(domain.id))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((domain) => ({ id: domain.id, label: domain.name }))
}
