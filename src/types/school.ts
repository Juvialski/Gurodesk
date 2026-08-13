export type SchoolSource = 'deped_nid' | 'custom'

export type PhilippineSchool = {
  id: string
  schoolId: string
  schoolName: string
  regionCode: string
  regionName: string
  divisionCode: string | null
  divisionName: string
  municipality: string | null
  province: string | null
  schoolType: string | null
  classification: string | null
  isActive: boolean
  sourceName: string
  sourceUrl: string | null
  sourceVersion: string | null
  sourceCheckedAt: string | null
}

export type SchoolRegionOption = {
  regionCode: string
  regionName: string
}

export type SchoolDivisionOption = {
  divisionCode: string | null
  divisionName: string
}

export type SchoolSearchOptions = {
  query?: string
  region?: string
  division?: string
  limit?: number
}
