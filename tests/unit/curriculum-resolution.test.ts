import { describe, expect, it } from 'vitest'
import { resolveCurriculumVersion, subjectNamesMatch } from '../../src/lib/curriculumResolution'

describe('curriculum version resolution', () => {
  it('matches official aliases without fuzzy guessing', () => {
    expect(subjectNamesMatch('TLE', 'Technology and Livelihood Education', ['TLE'])).toBe(true)
    expect(subjectNamesMatch('Science', 'Mathematics', ['Math'])).toBe(false)
  })

  it('prefers the catalog curriculum code when overlapping versions contain the subject', () => {
    const result = resolveCurriculumVersion({
      versions: [
        { id: 'legacy', code: 'K12-LEGACY-TRANSITION', priority: 1, note: 'legacy' },
        { id: 'revised', code: 'REVISED-K10-MATATAG', priority: 5, note: 'revised' },
      ],
      subjects: [
        { id: 's1', curriculumVersionId: 'legacy', gradeLevel: 'Grade 8', name: 'Mathematics' },
        { id: 's2', curriculumVersionId: 'revised', gradeLevel: 'Grade 8', name: 'Mathematics' },
      ],
      gradeLevel: 'Grade 8',
      learningArea: 'Mathematics',
      preferredCurriculumCode: 'REVISED-K10-MATATAG',
    })
    expect(result?.version.id).toBe('revised')
    expect(result?.subject.id).toBe('s2')
  })

  it('falls back to priority when no catalog code matches', () => {
    const result = resolveCurriculumVersion({
      versions: [
        { id: 'a', code: 'A', priority: 4, note: null },
        { id: 'b', code: 'B', priority: 2, note: null },
      ],
      subjects: [
        { id: 'sa', curriculumVersionId: 'a', gradeLevel: 'Grade 12', name: 'General Mathematics' },
        { id: 'sb', curriculumVersionId: 'b', gradeLevel: 'Grade 12', name: 'General Mathematics' },
      ],
      gradeLevel: 'Grade 12',
      learningArea: 'General Mathematics',
      preferredCurriculumCode: 'MISSING',
    })
    expect(result?.version.id).toBe('b')
  })
})
