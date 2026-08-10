import { describe, expect, it } from 'vitest'
import { resolveCurriculumSubjectVersion } from '../../src/lib/curriculumResolution'

describe('curriculum subject/version resolution', () => {
  const applicability = [
    { versionId: 'legacy', priority: 10 },
    { versionId: 'pilot', priority: 20 },
  ]
  const versions = [
    { id: 'legacy', code: 'K12-SHS-LEGACY' },
    { id: 'pilot', code: 'STRENGTHENED-SHS-2026' },
  ]

  it('prefers the source-catalogued curriculum code when the same subject exists in concurrent versions', () => {
    const resolution = resolveCurriculumSubjectVersion(
      applicability,
      versions,
      [
        { versionId: 'legacy', name: 'General Mathematics', value: 'legacy-math' },
        { versionId: 'pilot', name: 'General Mathematics', value: 'pilot-math' },
      ],
      ['General Mathematics'],
      'STRENGTHENED-SHS-2026',
    )

    expect(resolution).toEqual({ versionId: 'pilot', subject: 'pilot-math' })
  })

  it('uses applicability priority when no catalog code distinguishes the matches', () => {
    const resolution = resolveCurriculumSubjectVersion(
      applicability,
      versions,
      [
        { versionId: 'pilot', name: 'Subject', value: 'pilot' },
        { versionId: 'legacy', name: 'Subject', value: 'legacy' },
      ],
      ['Subject'],
    )

    expect(resolution).toEqual({ versionId: 'legacy', subject: 'legacy' })
  })

  it('supports accepted aliases and returns the top applicable version when a subject pack is not loaded', () => {
    expect(resolveCurriculumSubjectVersion(
      applicability,
      versions,
      [{ versionId: 'pilot', name: 'TLE', value: 'tle-row' }],
      ['Technology and Livelihood Education', 'TLE'],
      'STRENGTHENED-SHS-2026',
    )).toEqual({ versionId: 'pilot', subject: 'tle-row' })

    expect(resolveCurriculumSubjectVersion(
      applicability,
      versions,
      [],
      ['Missing Subject'],
    )).toEqual({ versionId: 'legacy', subject: null })
  })
})
