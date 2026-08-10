import { describe, expect, it } from 'vitest'
import { normalizeCustomCurriculumReview, validateCustomCurriculumReview } from '../../src/lib/curriculumImport'
import { createManualCurriculumReview } from '../../src/types/customCurriculum'

describe('custom curriculum review model', () => {
  it('creates a safe manual draft without inventing competencies', () => {
    const review = createManualCurriculumReview({
      mode: 'custom',
      title: 'School Mathematics 2026',
      organizationName: 'Example Academy',
      schoolYear: '2026-2027',
      gradeLevel: 'Grade 7',
      learningArea: 'Mathematics',
    })
    expect(review.periods).toHaveLength(4)
    expect(review.domains).toHaveLength(1)
    expect(review.competencies).toEqual([])
    expect(validateCustomCurriculumReview(review)).toContain('Add at least one competency or learning objective before approval.')
  })

  it('normalizes bounded structured AI output and preserves school wording', () => {
    const review = normalizeCustomCurriculumReview({
      schemaVersion: 1,
      curriculumMode: 'custom',
      title: 'Grade 7 School Mathematics',
      organizationName: 'Example Academy',
      schoolYear: '2026-2027',
      gradeLevel: 'Grade 7',
      learningArea: 'Mathematics',
      periods: [{ key: 'q1', label: 'Quarter 1', sequence: 1, periodType: 'quarter' }],
      domains: [{ key: 'geometry', code: 'GEO', name: 'Geometry', sortOrder: 1 }],
      standards: [{
        standardType: 'content', standardText: 'The learner understands polygons.',
        periodKey: 'q1', domainKey: 'geometry', sortOrder: 1, sourcePage: 4,
      }],
      competencies: [{
        competencyCode: 'SCH-G7-GEO-01',
        competencyText: 'Classify polygons used in school design projects.',
        periodKey: 'q1', domainKey: 'geometry', sortOrder: 1, sourcePage: 5,
      }],
      warnings: [],
    })
    expect(review.competencies[0].competencyText).toBe('Classify polygons used in school design projects.')
    expect(review.competencies[0].periodKey).toBe('q1')
    expect(review.competencies[0].domainKey).toBe('geometry')
    expect(validateCustomCurriculumReview(review)).toEqual([])
  })

  it('uses a typed year fallback when no valid periods are provided', () => {
    const review = normalizeCustomCurriculumReview({ periods: [] })
    expect(review.periods).toEqual([{ key: 'year', label: 'Year', sequence: 1, periodType: 'year' }])
  })

  it('drops unknown period/domain references rather than trusting malformed AI links', () => {
    const review = normalizeCustomCurriculumReview({
      curriculumMode: 'hybrid',
      title: 'School enrichment',
      organizationName: 'Example Academy',
      schoolYear: '2026-2027',
      gradeLevel: 'Grade 7',
      learningArea: 'Mathematics',
      periods: [{ key: 'q1', label: 'Quarter 1', sequence: 1, periodType: 'quarter' }],
      domains: [{ key: 'enrichment', name: 'Enrichment', code: null, sortOrder: 0 }],
      competencies: [{ competencyText: 'Model a school budget.', periodKey: 'q9', domainKey: 'missing', sourcePage: -1 }],
    })
    expect(review.curriculumMode).toBe('hybrid')
    expect(review.competencies[0].periodKey).toBeNull()
    expect(review.competencies[0].domainKey).toBeNull()
    expect(review.competencies[0].sourcePage).toBeNull()
  })
})
