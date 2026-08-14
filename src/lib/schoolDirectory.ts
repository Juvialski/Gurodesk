import type { Profile } from '../types/app'
import type { PhilippineSchool } from '../types/school'

export function normalizeSchoolSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function districtIdentity(districtName: string | null | undefined, fallbackDistrict = '') {
  const verified = (districtName ?? '').trim()
  const manual = fallbackDistrict.trim()
  if (verified) {
    return {
      district: verified,
      districtSource: 'deped_official' as const,
      districtVerified: true,
    }
  }
  return {
    district: manual,
    districtSource: manual ? 'manual' as const : 'unknown' as const,
    districtVerified: false,
  }
}

export function schoolIdentityPatch(
  school: PhilippineSchool,
  fallbackDistrict = '',
): Partial<Profile> {
  return {
    schoolDirectoryId: school.id,
    schoolId: school.schoolId,
    schoolName: school.schoolName,
    region: school.regionName,
    division: school.divisionName,
    ...districtIdentity(school.districtName, fallbackDistrict),
    schoolSource: 'deped_nid',
    schoolIsCustom: false,
  }
}

export function customSchoolIdentityPatch(input: {
  schoolName: string
  schoolId?: string | null
  region: string
  division: string
  district?: string | null
}): Partial<Profile> {
  const district = (input.district ?? '').trim()
  return {
    schoolDirectoryId: null,
    schoolId: input.schoolId ?? null,
    schoolName: input.schoolName,
    region: input.region,
    division: input.division,
    district,
    districtSource: district ? 'manual' : 'unknown',
    districtVerified: false,
    schoolSource: 'custom',
    schoolIsCustom: true,
  }
}
