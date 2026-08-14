/**
 * Core district candidate reconciliation and verification validation logic.
 *
 * STRICT RULE: Candidate matches are NEVER marked as verified and MUST NOT
 * be written into philippine_schools.district_name.
 */

export type NidSchoolInput = {
  schoolId: string
  schoolName: string
}

export type SdoSchoolInput = {
  schoolName: string
  district: string
  type?: string | null
  municipality?: string | null
}

export type DistrictCandidateRecord = {
  schoolId: string
  nidSchoolName: string
  officialSourceSchoolName: string | null
  candidateDistrict: string | null
  sourceName: string
  sourceUrl: string
  matchMethod: string
  confidence: 'high_single_match' | 'ambiguous_duplicate_name_requires_explicit_id' | 'unmatched'
  reviewState: 'unverified_candidate' | 'unverified_ambiguous_candidate' | 'unmatched_nid_school'
  ambiguityNote?: string
}

export type DistrictCandidateDataset = {
  divisionName: string
  regionName: string
  sourceName: string
  sourceUrl: string
  sourceLastCheckedAt: string
  verifiedStatus: 'unverified'
  verificationBlocker: string
  summary: {
    nidSchoolCount: number
    sdoSchoolCount: number
    candidateMatches: number
    ambiguousDuplicateNames: number
    unmatchedSchools: number
  }
  records: DistrictCandidateRecord[]
}

export type VerifiedDistrictRecord = {
  schoolId: string
  districtName: string
  districtCode: string | null
}

export type VerifiedDistrictPayload = {
  sourceName: string
  sourceUrl: string
  verificationMethod: string
  records: Array<{
    schoolId: string
    districtName: string
    districtCode?: string | null
  }>
}

export function normalizeSchoolName(name: string): string {
  return String(name ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function reconcileDistrictCandidates(options: {
  divisionName: string
  regionName: string
  sourceName: string
  sourceUrl: string
  sourceLastCheckedAt?: string
  nidSchools: NidSchoolInput[]
  sdoSchools: SdoSchoolInput[]
}): DistrictCandidateDataset {
  const {
    divisionName,
    regionName,
    sourceName,
    sourceUrl,
    sourceLastCheckedAt = new Date().toISOString(),
    nidSchools,
    sdoSchools,
  } = options

  if (!divisionName || !regionName) throw new Error('divisionName and regionName are required.')
  if (!sourceName || !sourceUrl) throw new Error('sourceName and sourceUrl are required.')
  if (!Array.isArray(nidSchools) || nidSchools.length === 0) throw new Error('nidSchools must be non-empty.')
  if (!Array.isArray(sdoSchools) || sdoSchools.length === 0) throw new Error('sdoSchools must be non-empty.')

  const nidByName = new Map<string, NidSchoolInput[]>()
  for (const s of nidSchools) {
    const k = normalizeSchoolName(s.schoolName)
    if (!nidByName.has(k)) nidByName.set(k, [])
    nidByName.get(k)!.push(s)
  }

  const sdoByName = new Map<string, SdoSchoolInput[]>()
  for (const s of sdoSchools) {
    const k = normalizeSchoolName(s.schoolName)
    if (!sdoByName.has(k)) sdoByName.set(k, [])
    sdoByName.get(k)!.push(s)
  }

  const records: DistrictCandidateRecord[] = []
  let singleMatches = 0
  let ambiguousMatches = 0
  let unmatchedNidCount = 0

  for (const nidSchool of nidSchools) {
    const k = normalizeSchoolName(nidSchool.schoolName)
    const sdoMatches = sdoByName.get(k) ?? []
    const nidDuplicates = nidByName.get(k) ?? []

    if (sdoMatches.length === 0) {
      unmatchedNidCount++
      records.push({
        schoolId: nidSchool.schoolId,
        nidSchoolName: nidSchool.schoolName,
        officialSourceSchoolName: null,
        candidateDistrict: null,
        sourceName,
        sourceUrl,
        matchMethod: 'no_sdo_match',
        confidence: 'unmatched',
        reviewState: 'unmatched_nid_school',
      })
      continue
    }

    const sdoRecord = sdoMatches[0]
    const isDuplicateName = nidDuplicates.length > 1 || sdoMatches.length > 1

    if (isDuplicateName) {
      ambiguousMatches++
      const otherIds = nidDuplicates.map((s) => s.schoolId).filter((id) => id !== nidSchool.schoolId)
      records.push({
        schoolId: nidSchool.schoolId,
        nidSchoolName: nidSchool.schoolName,
        officialSourceSchoolName: sdoRecord.schoolName,
        candidateDistrict: sdoRecord.district,
        sourceName,
        sourceUrl,
        matchMethod: 'exact_normalized_school_name',
        confidence: 'ambiguous_duplicate_name_requires_explicit_id',
        reviewState: 'unverified_ambiguous_candidate',
        ambiguityNote: `${nidDuplicates.length} distinct School IDs in ${divisionName} share this name (${[nidSchool.schoolId, ...otherIds].join(', ')}). Official source lacks School ID; mapping requires explicit verification.`,
      })
    } else {
      singleMatches++
      records.push({
        schoolId: nidSchool.schoolId,
        nidSchoolName: nidSchool.schoolName,
        officialSourceSchoolName: sdoRecord.schoolName,
        candidateDistrict: sdoRecord.district,
        sourceName,
        sourceUrl,
        matchMethod: 'exact_normalized_school_name',
        confidence: 'high_single_match',
        reviewState: 'unverified_candidate',
      })
    }
  }

  records.sort((a, b) => a.schoolId.localeCompare(b.schoolId))

  return {
    divisionName,
    regionName,
    sourceName,
    sourceUrl,
    sourceLastCheckedAt,
    verifiedStatus: 'unverified',
    verificationBlocker: `The official SDO source publishes school names and districts, but DepEd School ID is not explicitly provided in the source records. ${ambiguousMatches} school(s) in this division share duplicate names across multiple distinct School IDs. In accordance with strict GuroDesk safety rules, these candidate mappings remain unverified until an official DepEd dataset linking School ID to District is available.`,
    summary: {
      nidSchoolCount: nidSchools.length,
      sdoSchoolCount: sdoSchools.length,
      candidateMatches: singleMatches,
      ambiguousDuplicateNames: ambiguousMatches,
      unmatchedSchools: unmatchedNidCount,
    },
    records,
  }
}

export function validateCandidatePayload(payload: Partial<DistrictCandidateDataset>): boolean {
  const errors: string[] = []

  if (!payload.divisionName?.trim()) errors.push('divisionName is required.')
  if (!payload.regionName?.trim()) errors.push('regionName is required.')
  if (!payload.sourceName?.trim()) errors.push('sourceName is required.')
  if (!/^https:\/\//i.test(payload.sourceUrl ?? '')) errors.push('sourceUrl must be HTTPS.')
  if (payload.verifiedStatus !== 'unverified') {
    errors.push(`verifiedStatus must be "unverified"; received "${payload.verifiedStatus}". Candidate datasets must never claim verified status.`)
  }
  if (!Array.isArray(payload.records) || payload.records.length === 0) {
    errors.push('records must be a non-empty array.')
  }

  const ids = new Set<string>()
  for (const [index, r] of (payload.records ?? []).entries()) {
    if (!/^\d{5,8}$/.test(r.schoolId ?? '')) {
      errors.push(`Row ${index + 1}: invalid School ID "${r.schoolId}".`)
    }
    if (ids.has(r.schoolId)) {
      errors.push(`Row ${index + 1}: duplicate School ID "${r.schoolId}".`)
    }
    ids.add(r.schoolId)

    if (!r.sourceName?.trim()) errors.push(`Row ${index + 1}: sourceName is required.`)
    if (!/^https:\/\//i.test(r.sourceUrl ?? '')) errors.push(`Row ${index + 1}: sourceUrl must be HTTPS.`)
    if (!r.matchMethod?.trim()) errors.push(`Row ${index + 1}: matchMethod is required.`)
    if (!['unverified_candidate', 'unverified_ambiguous_candidate', 'unmatched_nid_school'].includes(r.reviewState)) {
      errors.push(`Row ${index + 1}: reviewState must be an unverified candidate state (got "${r.reviewState}").`)
    }
  }

  if (errors.length) {
    throw new Error(`District candidate validation failed:\n- ${errors.join('\n- ')}`)
  }

  return true
}

export function validateVerifiedDistrictPayload(payload: Partial<VerifiedDistrictPayload>): {
  sourceName: string
  sourceUrl: string
  records: VerifiedDistrictRecord[]
} {
  const errors: string[] = []
  const sourceName = String(payload.sourceName ?? '').trim()
  const sourceUrl = String(payload.sourceUrl ?? '').trim()
  const method = String(payload.verificationMethod ?? '').trim()

  if (!sourceName) errors.push('sourceName is required.')
  if (!/^https:\/\//i.test(sourceUrl)) errors.push('sourceUrl must be HTTPS.')

  const isOfficialDomain = /^https:\/\/(?:[a-zA-Z0-9-]+\.)*(?:deped\.gov\.ph|gov\.ph|deped[a-zA-Z0-9-]*\.ph)(?:\/|$)/i.test(sourceUrl)
  if (!isOfficialDomain) {
    errors.push(`sourceUrl "${sourceUrl}" is not recognized as an official DepEd or Philippine Government domain.`)
  }

  if (method !== 'explicit_school_id') {
    errors.push('verificationMethod must be "explicit_school_id"; name-only/fuzzy joins are not accepted as verified.')
  }
  if (!Array.isArray(payload.records) || payload.records.length === 0) {
    errors.push('records must be a non-empty array.')
  }

  const ids = new Set<string>()
  for (const [index, raw] of (payload.records ?? []).entries()) {
    const schoolId = String(raw.schoolId ?? '').trim()
    const districtName = String(raw.districtName ?? '').trim()
    if (!/^\d{5,8}$/.test(schoolId)) errors.push(`Row ${index + 1}: invalid School ID ${schoolId || '(blank)'}.`)
    if (!districtName) errors.push(`Row ${index + 1}: districtName is required.`)
    if (ids.has(schoolId)) errors.push(`Duplicate School ID ${schoolId}.`)
    ids.add(schoolId)
  }

  if (errors.length) throw new Error(`District mapping validation failed:\n- ${errors.join('\n- ')}`)

  return {
    sourceName,
    sourceUrl,
    records: (payload.records ?? []).map((raw) => ({
      schoolId: String(raw.schoolId ?? '').trim(),
      districtName: String(raw.districtName ?? '').trim(),
      districtCode: raw.districtCode ? String(raw.districtCode).trim() : null,
    })),
  }
}
