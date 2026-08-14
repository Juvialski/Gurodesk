import { describe, expect, it } from 'vitest'
import { customSchoolIdentityPatch, normalizeSchoolSearch, schoolIdentityPatch } from '../../src/lib/schoolDirectory'
import type { PhilippineSchool } from '../../src/types/school'

const school: PhilippineSchool = {
  id: 'school-1',
  schoolId: '136418',
  schoolName: 'A. C. Herrera Elementary School',
  regionCode: 'NCR',
  regionName: 'NCR',
  divisionCode: null,
  divisionName: 'Manila',
  districtCode: null,
  districtName: null,
  districtSourceName: null,
  districtSourceUrl: null,
  districtVerifiedAt: null,
  municipality: 'Manila',
  province: null,
  schoolType: null,
  classification: null,
  isActive: true,
  sourceName: 'DepEd National Inventory Dashboard',
  sourceUrl: null,
  sourceVersion: null,
  sourceCheckedAt: null,
}

describe('school directory identity helpers', () => {
  it('normalizes punctuation, whitespace, and accents for tolerant search', () => {
    expect(normalizeSchoolSearch('  A. C.  Hérrera—Elementary School ')).toBe('A C HERRERA ELEMENTARY SCHOOL')
  })

  it('turns an official directory record into canonical profile fields', () => {
    expect(schoolIdentityPatch(school)).toEqual({
      schoolDirectoryId: 'school-1',
      schoolId: '136418',
      schoolName: 'A. C. Herrera Elementary School',
      region: 'NCR',
      division: 'Manila',
      district: '',
      districtSource: 'unknown',
      districtVerified: false,
      schoolSource: 'deped_nid',
      schoolIsCustom: false,
    })
  })

  it('keeps manual schools explicitly custom', () => {
    expect(customSchoolIdentityPatch({ schoolName: 'My School', schoolId: '123456', region: 'Region III', division: 'Bulacan' })).toMatchObject({
      schoolDirectoryId: null,
      schoolId: '123456',
      schoolSource: 'custom',
      schoolIsCustom: true,
    })
  })
})
