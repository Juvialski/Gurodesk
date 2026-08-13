import { describe, expect, it } from 'vitest'
import {
  createLessonCompetencySnapshot,
  curriculumContentAreaSuggestions,
  groupLessonCompetencies,
  rankVerifiedLessonCompetencies,
} from '../../src/lib/lessonCurriculum'
import type { CurriculumNavigatorBundle } from '../../src/types/curriculum'

const bundle: CurriculumNavigatorBundle = {
  available: true,
  schoolYear: '2026-2027',
  gradeLevel: 'Grade 7',
  learningArea: 'Mathematics',
  version: null,
  subject: null,
  periods: [{ id: 'q1', label: 'Quarter 1', sequence: 1, periodType: 'quarter' }],
  domains: [
    { id: 'geometry', code: 'GE', name: 'Measurement and Geometry', sortOrder: 1 },
    { id: 'unverified-domain', code: null, name: 'Unverified content area', sortOrder: 2 },
  ],
  standards: [
    { id: 'content', standardType: 'content', standardText: 'Verified polygon content standard.', domainId: 'geometry', academicPeriodId: 'q1', sourcePage: 20 },
    { id: 'performance', standardType: 'performance', standardText: 'Verified polygon performance standard.', domainId: null, academicPeriodId: 'q1', sourcePage: 20 },
  ],
  competencies: [
    { id: 'regular', competencyCode: 'M7GE-1', competencyText: 'Distinguishes regular and irregular polygons.', sortOrder: 1, domainId: 'geometry', academicPeriodId: 'q1', sourcePage: 21, verificationStatus: 'verified' },
    { id: 'classify', competencyCode: 'M7GE-2', competencyText: 'Classifies polygons according to their properties.', sortOrder: 2, domainId: 'geometry', academicPeriodId: 'q1', sourcePage: 22, verificationStatus: 'verified' },
    { id: 'pending', competencyCode: null, competencyText: 'A pending curriculum statement.', sortOrder: 3, domainId: 'unverified-domain', academicPeriodId: 'q1', sourcePage: null, verificationStatus: 'pending' },
  ],
  source: { id: 'source', sourceType: 'curriculum_guide', title: 'Verified curriculum guide', issuanceCode: null, sourceUrl: null, publishedOn: null, verificationStatus: 'verified' },
  coverageNote: null,
}

describe('topic-assisted verified lesson alignment', () => {
  it('creates a source-grounded immutable snapshot only from a verified row', () => {
    const snapshot = createLessonCompetencySnapshot(bundle, bundle.competencies[0])

    expect(snapshot).toMatchObject({
      id: 'regular',
      contentArea: 'Measurement and Geometry',
      curriculumPeriodLabel: 'Quarter 1',
      sourceTitle: 'Verified curriculum guide',
      verificationStatus: 'verified',
    })
    expect(snapshot.contentStandards).toEqual(['Verified polygon content standard.'])
    expect(snapshot.performanceStandards).toEqual(['Verified polygon performance standard.'])
    expect(() => createLessonCompetencySnapshot(bundle, bundle.competencies[2])).toThrow(/Only verified/u)
  })

  it('ranks existing verified matches without inventing a competency for an unmatched topic', () => {
    expect(rankVerifiedLessonCompetencies(bundle, bundle.competencies, 'Regular and irregular polygons', '').map((item) => item.id))
      .toEqual(['regular', 'classify'])
    expect(rankVerifiedLessonCompetencies(bundle, bundle.competencies, 'Photosynthesis', '')).toEqual([])
    expect(rankVerifiedLessonCompetencies(bundle, bundle.competencies, 'Photosynthesis', 'M7GE-2').map((item) => item.id))
      .toEqual(['classify'])
  })

  it('groups verified matches by real curriculum content area and excludes unverified suggestions', () => {
    const verified = bundle.competencies.filter((item) => item.verificationStatus === 'verified')
    const groups = groupLessonCompetencies(bundle, verified)

    expect(groups).toHaveLength(1)
    expect(groups[0].contentArea).toBe('Measurement and Geometry')
    expect(groups[0].competencies.map((item) => item.id)).toEqual(['regular', 'classify'])
    expect(curriculumContentAreaSuggestions(bundle, 'q1')).toEqual([{ id: 'geometry', label: 'Measurement and Geometry' }])
  })
})
