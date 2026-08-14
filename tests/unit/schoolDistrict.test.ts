import { describe, expect, it } from 'vitest'
import { customSchoolIdentityPatch, schoolIdentityPatch } from '../../src/lib/schoolDirectory'
import type { PhilippineSchool } from '../../src/types/school'

function school(overrides: Partial<PhilippineSchool> = {}): PhilippineSchool {
  return {
    id: 'school-1',
    schoolId: '123456',
    schoolName: 'Example Elementary School',
    regionCode: 'Region V',
    regionName: 'Region V',
    divisionCode: null,
    divisionName: 'Camarines Norte',
    districtCode: null,
    districtName: null,
    districtSourceName: null,
    districtSourceUrl: null,
    districtVerifiedAt: null,
    municipality: null,
    province: null,
    schoolType: null,
    classification: null,
    isActive: true,
    sourceName: 'DepEd National Inventory Dashboard',
    sourceUrl: null,
    sourceVersion: null,
    sourceCheckedAt: null,
    ...overrides,
  }
}

describe('school district identity', () => {
  it('uses an official mapped district when available', () => {
    const patch = schoolIdentityPatch(school({ districtName: 'District I' }), 'Wrong manual value')
    expect(patch.district).toBe('District I')
    expect(patch.districtSource).toBe('deped_official')
    expect(patch.districtVerified).toBe(true)
  })

  it('keeps teacher-entered district when a verified mapping is not loaded', () => {
    const patch = schoolIdentityPatch(school(), 'District II')
    expect(patch.district).toBe('District II')
    expect(patch.districtSource).toBe('manual')
    expect(patch.districtVerified).toBe(false)
  })

  it('marks custom school district as teacher-entered rather than verified', () => {
    const patch = customSchoolIdentityPatch({
      schoolName: 'Local Learning Center',
      schoolId: null,
      region: 'Region V',
      division: 'Camarines Norte',
      district: 'District III',
    })
    expect(patch.district).toBe('District III')
    expect(patch.districtSource).toBe('manual')
    expect(patch.districtVerified).toBe(false)
  })
})
