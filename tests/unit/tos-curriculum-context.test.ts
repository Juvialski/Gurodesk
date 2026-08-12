import { describe, expect, it } from 'vitest'
import type { CurriculumNavigatorBundle } from '../../src/types/curriculum'
import type { TosContent } from '../../src/types/tos'
import { createTosCompetencyRow, curriculumContextForCompetency, normalizeTosContent } from '../../src/lib/tosFactory'

const bundle: CurriculumNavigatorBundle = {
  available: true,
  schoolYear: '2026-2027',
  gradeLevel: 'Grade 7',
  learningArea: 'Mathematics',
  version: null,
  subject: null,
  periods: [{ id: 'q1', label: 'Quarter 1', sequence: 1, periodType: 'quarter' }],
  domains: [{ id: 'mg', code: 'MG', name: 'Measurement and Geometry', sortOrder: 1 }],
  standards: [
    { id: 'cs1', standardType: 'content', standardText: 'Verified content standard', domainId: 'mg', academicPeriodId: 'q1', sourcePage: 10 },
    { id: 'ps1', standardType: 'performance', standardText: 'Verified performance standard', domainId: null, academicPeriodId: 'q1', sourcePage: 10 },
    { id: 'other', standardType: 'content', standardText: 'Wrong period', domainId: 'mg', academicPeriodId: 'q2', sourcePage: 11 },
  ],
  competencies: [{ id: 'c1', competencyCode: null, competencyText: 'Classify polygons.', sortOrder: 1, domainId: 'mg', academicPeriodId: 'q1', sourcePage: 10, verificationStatus: 'verified' }],
  source: { id: 'source', sourceType: 'curriculum_guide', title: 'Verified guide', issuanceCode: null, sourceUrl: null, publishedOn: null, verificationStatus: 'verified' },
  coverageNote: null,
}

describe('TOS curriculum context snapshots', () => {
  it('attaches only verified period/domain curriculum context to a competency row', () => {
    const competency = bundle.competencies[0]
    const context = curriculumContextForCompetency(bundle, competency)
    expect(context.contentArea).toBe('Measurement and Geometry')
    expect(context.standards.map((standard) => standard.id)).toEqual(['cs1', 'ps1'])

    const row = createTosCompetencyRow(competency, bundle, [{ id: 'remembering', label: 'Remembering', shortLabel: 'R', weight: '1', sortOrder: 1 }], 1)
    expect(row.competency.contentArea).toBe('Measurement and Geometry')
    expect(row.competency.standards?.map((standard) => standard.type)).toEqual(['content', 'performance'])
  })

  it('keeps legacy TOS rows valid when curriculum context fields are absent', () => {
    const row = createTosCompetencyRow(bundle.competencies[0], bundle, [{ id: 'remembering', label: 'Remembering', shortLabel: 'R', weight: '1', sortOrder: 1 }], 1)
    const legacy = {
      schemaVersion: 1,
      title: 'Legacy TOS',
      assessmentTitle: '',
      gradeLevel: 'Grade 7',
      learningArea: 'Mathematics',
      sections: [],
      schoolYear: '2026-2027',
      gradingTermId: 'term-1',
      gradingTermLabel: 'Term 1',
      curriculumVersionId: 'v1',
      curriculumVersionCode: 'v1',
      curriculumVersionName: 'Version 1',
      curriculumSubjectId: 'subject',
      curriculumPeriodIds: ['q1'],
      curriculumPeriodLabels: ['Quarter 1'],
      sourceTitle: '',
      sourceUrl: '',
      totalItems: 1,
      weightingMethod: 'equal',
      cognitiveCategories: [{ id: 'remembering', label: 'Remembering', shortLabel: 'R', weight: '1', sortOrder: 1 }],
      rows: [{ ...row, competency: { ...row.competency, domainId: undefined, contentArea: undefined, standards: undefined } }],
      notes: '',
      calculation: row ? { engine: 'hamilton-largest-remainder-v1', valid: true, totalAllocated: 1, calculatedAt: null, warnings: [] } : undefined,
    } as TosContent
    const normalized = normalizeTosContent(legacy)
    expect(normalized.rows[0].competency.contentArea).toBe('')
    expect(normalized.rows[0].competency.domainId).toBeNull()
    expect(normalized.rows[0].competency.standards).toEqual([])
  })
})
