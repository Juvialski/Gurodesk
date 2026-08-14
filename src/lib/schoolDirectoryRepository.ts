import { supabase } from './supabase'
import { normalizeSchoolSearch } from './schoolDirectory'
import type {
  PhilippineSchool,
  SchoolDistrictOption,
  SchoolDivisionOption,
  SchoolRegionOption,
  SchoolSearchOptions,
} from '../types/school'

const SOURCE_NAME = 'DepEd National Inventory Dashboard'

const DEMO_SCHOOLS: PhilippineSchool[] = [
  {
    id: 'demo-136418', schoolId: '136418', schoolName: 'A. C. Herrera Elementary School',
    regionCode: 'NCR', regionName: 'NCR', divisionCode: null, divisionName: 'Manila',
    districtCode: null, districtName: null, districtSourceName: null, districtSourceUrl: null, districtVerifiedAt: null,
    municipality: 'Manila', province: null, schoolType: null, classification: null, isActive: true,
    sourceName: SOURCE_NAME, sourceUrl: 'https://nid.deped.gov.ph/public-dashboard/region/NCR/division/Manila', sourceVersion: '2026-08', sourceCheckedAt: null,
  },
  {
    id: 'demo-136419', schoolId: '136419', schoolName: 'Barrio Obrero Elementary School',
    regionCode: 'NCR', regionName: 'NCR', divisionCode: null, divisionName: 'Manila',
    districtCode: null, districtName: null, districtSourceName: null, districtSourceUrl: null, districtVerifiedAt: null,
    municipality: 'Manila', province: null, schoolType: null, classification: null, isActive: true,
    sourceName: SOURCE_NAME, sourceUrl: 'https://nid.deped.gov.ph/public-dashboard/region/NCR/division/Manila', sourceVersion: '2026-08', sourceCheckedAt: null,
  },
  {
    id: 'demo-136421', schoolId: '136421', schoolName: 'Lapu-Lapu Elementary School',
    regionCode: 'NCR', regionName: 'NCR', divisionCode: null, divisionName: 'Manila',
    districtCode: null, districtName: null, districtSourceName: null, districtSourceUrl: null, districtVerifiedAt: null,
    municipality: 'Manila', province: null, schoolType: null, classification: null, isActive: true,
    sourceName: SOURCE_NAME, sourceUrl: 'https://nid.deped.gov.ph/public-dashboard/region/NCR/division/Manila', sourceVersion: '2026-08', sourceCheckedAt: null,
  },
  {
    id: 'demo-114625', schoolId: '114625', schoolName: 'Altavas ES',
    regionCode: 'Region VI', regionName: 'Region VI', divisionCode: null, divisionName: 'Aklan',
    districtCode: null, districtName: null, districtSourceName: null, districtSourceUrl: null, districtVerifiedAt: null,
    municipality: null, province: 'Aklan', schoolType: null, classification: null, isActive: true,
    sourceName: SOURCE_NAME, sourceUrl: 'https://nid.deped.gov.ph/public-dashboard/region/Region%20VI/division/Aklan', sourceVersion: '2026-08', sourceCheckedAt: null,
  },
  {
    id: 'demo-114626', schoolId: '114626', schoolName: 'Cabangila ES',
    regionCode: 'Region VI', regionName: 'Region VI', divisionCode: null, divisionName: 'Aklan',
    districtCode: null, districtName: null, districtSourceName: null, districtSourceUrl: null, districtVerifiedAt: null,
    municipality: null, province: 'Aklan', schoolType: null, classification: null, isActive: true,
    sourceName: SOURCE_NAME, sourceUrl: 'https://nid.deped.gov.ph/public-dashboard/region/Region%20VI/division/Aklan', sourceVersion: '2026-08', sourceCheckedAt: null,
  },
  {
    id: 'demo-302773', schoolId: '302773', schoolName: 'Bagonbon NHS',
    regionCode: 'NIR', regionName: 'NIR', divisionCode: null, divisionName: 'San Carlos City',
    districtCode: null, districtName: null, districtSourceName: null, districtSourceUrl: null, districtVerifiedAt: null,
    municipality: 'San Carlos City', province: null, schoolType: null, classification: null, isActive: true,
    sourceName: SOURCE_NAME, sourceUrl: 'https://nid.deped.gov.ph/public-dashboard/region/NIR/division/San%20Carlos%20City', sourceVersion: '2026-08', sourceCheckedAt: null,
  },
]

type SchoolRow = Record<string, unknown>

function mapSchool(row: SchoolRow): PhilippineSchool {
  return {
    id: String(row.id),
    schoolId: String(row.school_id ?? ''),
    schoolName: String(row.school_name ?? ''),
    regionCode: String(row.region_code ?? row.region_name ?? ''),
    regionName: String(row.region_name ?? ''),
    divisionCode: row.division_code ? String(row.division_code) : null,
    divisionName: String(row.division_name ?? ''),
    districtCode: row.district_code ? String(row.district_code) : null,
    districtName: row.district_name ? String(row.district_name) : null,
    districtSourceName: row.district_source_name ? String(row.district_source_name) : null,
    districtSourceUrl: row.district_source_url ? String(row.district_source_url) : null,
    districtVerifiedAt: row.district_verified_at ? String(row.district_verified_at) : null,
    municipality: row.municipality ? String(row.municipality) : null,
    province: row.province ? String(row.province) : null,
    schoolType: row.school_type ? String(row.school_type) : null,
    classification: row.classification ? String(row.classification) : null,
    isActive: row.is_active !== false,
    sourceName: String(row.source_name ?? SOURCE_NAME),
    sourceUrl: row.source_url ? String(row.source_url) : null,
    sourceVersion: row.source_version ? String(row.source_version) : null,
    sourceCheckedAt: row.source_checked_at ? String(row.source_checked_at) : null,
  }
}

function filterDemoSchools({
  query = '',
  region,
  division,
  district,
  limit = 20,
  offset = 0,
}: SchoolSearchOptions) {
  const normalized = normalizeSchoolSearch(query)
  const safeLimit = Math.min(Math.max(limit, 1), 50)
  const safeOffset = Math.max(offset, 0)
  return DEMO_SCHOOLS.filter((school) => {
    if (region && school.regionName !== region) return false
    if (division && school.divisionName !== division) return false
    if (district && school.districtName !== district) return false
    if (!normalized) return true
    return normalizeSchoolSearch(`${school.schoolId} ${school.schoolName}`).includes(normalized)
  })
    .sort((a, b) => a.schoolName.localeCompare(b.schoolName) || a.schoolId.localeCompare(b.schoolId))
    .slice(safeOffset, safeOffset + safeLimit)
}

export async function searchPhilippineSchools(
  options: SchoolSearchOptions,
  demo: boolean,
): Promise<PhilippineSchool[]> {
  if (demo) return filterDemoSchools(options)
  if (!supabase) throw new Error('The school directory needs the Supabase backend.')

  const { data, error } = await supabase.rpc('search_philippine_schools_v2', {
    p_query: options.query?.trim() ?? '',
    p_region: options.region?.trim() || null,
    p_division: options.division?.trim() || null,
    p_district: options.district?.trim() || null,
    p_limit: Math.min(Math.max(options.limit ?? 20, 1), 50),
    p_offset: Math.max(options.offset ?? 0, 0),
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: SchoolRow) => mapSchool(row))
}

export async function loadSchoolRegions(demo: boolean): Promise<SchoolRegionOption[]> {
  if (demo) {
    return Array.from(new Map(DEMO_SCHOOLS.map((school) => [school.regionName, {
      regionCode: school.regionCode,
      regionName: school.regionName,
    }])).values()).sort((a, b) => a.regionName.localeCompare(b.regionName))
  }
  if (!supabase) throw new Error('The school directory needs the Supabase backend.')
  const { data, error } = await supabase.rpc('list_philippine_school_regions')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: SchoolRow) => ({
    regionCode: String(row.region_code ?? row.region_name ?? ''),
    regionName: String(row.region_name ?? ''),
  }))
}

export async function loadSchoolDivisions(
  region: string,
  demo: boolean,
): Promise<SchoolDivisionOption[]> {
  if (!region) return []
  if (demo) {
    return Array.from(new Map(DEMO_SCHOOLS
      .filter((school) => school.regionName === region)
      .map((school) => [school.divisionName, {
        divisionCode: school.divisionCode,
        divisionName: school.divisionName,
      }])).values()).sort((a, b) => a.divisionName.localeCompare(b.divisionName))
  }
  if (!supabase) throw new Error('The school directory needs the Supabase backend.')
  const { data, error } = await supabase.rpc('list_philippine_school_divisions', { p_region: region })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: SchoolRow) => ({
    divisionCode: row.division_code ? String(row.division_code) : null,
    divisionName: String(row.division_name ?? ''),
  }))
}

export async function loadSchoolDistricts(
  region: string,
  division: string,
  demo: boolean,
): Promise<SchoolDistrictOption[]> {
  if (!region || !division) return []
  if (demo) {
    return Array.from(new Map(DEMO_SCHOOLS
      .filter((school) => school.regionName === region && school.divisionName === division && school.districtName)
      .map((school) => [school.districtName!, {
        districtCode: school.districtCode,
        districtName: school.districtName!,
      }])).values()).sort((a, b) => a.districtName.localeCompare(b.districtName))
  }
  if (!supabase) throw new Error('The school directory needs the Supabase backend.')
  const { data, error } = await supabase.rpc('list_philippine_school_districts', {
    p_region: region,
    p_division: division,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: SchoolRow) => ({
    districtCode: row.district_code ? String(row.district_code) : null,
    districtName: String(row.district_name ?? ''),
  })).filter((item: SchoolDistrictOption) => item.districtName)
}
