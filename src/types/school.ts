export type SchoolSource = 'deped_nid' | 'custom'

export type PhilippineSchool = {
  id: string
  schoolId: string
  schoolName: string
  regionCode: string
  regionName: string
  divisionCode: string | null
  divisionName: string
  districtCode: string | null
  districtName: string | null
  districtSourceName: string | null
  districtSourceUrl: string | null
  districtVerifiedAt: string | null
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

export type SchoolDistrictOption = {
  districtCode: string | null
  districtName: string
}

export type SchoolSearchOptions = {
  query?: string
  region?: string
  division?: string
  district?: string
  limit?: number
  offset?: number
}
