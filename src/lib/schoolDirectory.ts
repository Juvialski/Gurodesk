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

export function schoolIdentityPatch(school: PhilippineSchool): Partial<Profile> {
  return {
    schoolDirectoryId: school.id,
    schoolId: school.schoolId,
    schoolName: school.schoolName,
    region: school.regionName,
    division: school.divisionName,
    schoolSource: 'deped_nid',
    schoolIsCustom: false,
  }
}

export function customSchoolIdentityPatch(input: {
  schoolName: string
  schoolId?: string | null
  region: string
  division: string
}): Partial<Profile> {
  return {
    schoolDirectoryId: null,
    schoolId: input.schoolId ?? null,
    schoolName: input.schoolName,
    region: input.region,
    division: input.division,
    schoolSource: 'custom',
    schoolIsCustom: true,
  }
}
