/**
 * Core district candidate reconciliation, verification validation, and
 * auditable candidate review/verification system.
 *
 * STRICT DATA RULE:
 * A District may be marked VERIFIED only when evidence explicitly links:
 * DepEd School ID -> District
 * from an authoritative DepEd source or individually documented manual document
 * review with explicit School ID.
 *
 * Exact school-name reconciliation alone is NOT explicit School ID verification
 * and may produce only reviewed candidates, NEVER production-verified mappings.
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

export type VerificationEvidenceType =
  | 'explicit_official_school_id_district'
  | 'manual_document_review_with_explicit_school_id'

export type CandidateReviewState =
  | 'unverified_candidate'
  | 'unverified_ambiguous_candidate'
  | 'reviewed_candidate'
  | 'verified_mapping'
  | 'unmatched_nid_school'
  | 'rejected'

export type DistrictCandidateRecord = {
  schoolId: string
  nidSchoolName: string
  officialSourceSchoolName: string | null
  candidateDistrict: string | null
  sourceName: string
  sourceUrl: string
  matchMethod: string
  confidence: 'high_single_match' | 'ambiguous_duplicate_name_requires_explicit_id' | 'unmatched'
  reviewState: CandidateReviewState
  ambiguityNote?: string
  reviewedAt?: string | null
  reviewedBy?: string | null
  reviewNotes?: string | null
  evidenceType?: VerificationEvidenceType | null
  evidenceSourceName?: string | null
  evidenceSourceUrl?: string | null
  verifiedAt?: string | null
  verifiedBy?: string | null
}

export type DistrictCandidateDataset = {
  divisionName: string
  regionName: string
  sourceName: string
  sourceUrl: string
  sourceLastCheckedAt: string
  verifiedStatus: 'unverified' | 'partially_reviewed' | 'reviewed' | 'partially_verified' | 'fully_verified'
  verificationBlocker: string
  summary: {
    nidSchoolCount: number
    sdoSchoolCount: number
    candidateMatches: number
    ambiguousDuplicateNames: number
    reviewedCount: number
    verifiedCount: number
    unmatchedSchools: number
  }
  records: DistrictCandidateRecord[]
}

export type VerifiedDistrictRecord = {
  schoolId: string
  districtName: string
  districtCode: string | null
  evidenceType?: VerificationEvidenceType | null
  sourceName?: string | null
  sourceUrl?: string | null
  verifiedBy?: string | null
  verifiedAt?: string | null
  verificationBasis?: string | null
}

export type VerifiedDistrictPayload = {
  sourceName: string
  sourceUrl: string
  verificationMethod: 'explicit_school_id'
  records: Array<{
    schoolId: string
    districtName: string
    districtCode?: string | null
    evidenceType?: VerificationEvidenceType | null
    sourceName?: string | null
    sourceUrl?: string | null
    verifiedBy?: string | null
    verifiedAt?: string | null
    verificationBasis?: string | null
  }>
}

export type AmbiguousCluster = {
  schoolName: string
  candidateDistrict: string | null
  schoolIds: string[]
  reason: string
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
      reviewedCount: 0,
      verifiedCount: 0,
      unmatchedSchools: unmatchedNidCount,
    },
    records,
  }
}

export function extractAmbiguousCandidateSummary(dataset: DistrictCandidateDataset): AmbiguousCluster[] {
  const clusters = new Map<string, AmbiguousCluster>()

  for (const record of dataset.records) {
    if (record.reviewState === 'unverified_ambiguous_candidate' || record.confidence === 'ambiguous_duplicate_name_requires_explicit_id') {
      const name = record.nidSchoolName
      if (!clusters.has(name)) {
        clusters.set(name, {
          schoolName: name,
          candidateDistrict: record.candidateDistrict,
          schoolIds: [],
          reason: `Multiple schools share the exact name "${name}" in ${dataset.divisionName}. Without an explicit DepEd School ID in the SDO source, automatic promotion could assign the wrong district to the wrong school.`,
        })
      }
      clusters.get(name)!.schoolIds.push(record.schoolId)
    }
  }

  return Array.from(clusters.values()).sort((a, b) => a.schoolName.localeCompare(b.schoolName))
}

function calculateDatasetStatus(records: DistrictCandidateRecord[]): DistrictCandidateDataset['verifiedStatus'] {
  const verifiedCount = records.filter((r) => r.reviewState === 'verified_mapping').length
  const reviewedCount = records.filter((r) => r.reviewState === 'reviewed_candidate').length
  const total = records.length

  if (verifiedCount === total) return 'fully_verified'
  if (verifiedCount > 0) return 'partially_verified'
  if (reviewedCount === total) return 'reviewed'
  if (reviewedCount > 0) return 'partially_reviewed'
  return 'unverified'
}

/**
 * Marks candidate records as human-reviewed name matches.
 *
 * NOTE: Reviewed candidates remain UNVERIFIED. They do not produce a verified payload
 * and do not update philippine_schools.district_name.
 */
export function markCandidatesReviewed(options: {
  dataset: DistrictCandidateDataset
  schoolIds: string[]
  reviewedBy: string
  reviewNotes: string
}): {
  updatedDataset: DistrictCandidateDataset
  reviewedRecords: DistrictCandidateRecord[]
} {
  const { dataset, schoolIds, reviewedBy, reviewNotes } = options

  if (!reviewedBy?.trim()) throw new Error('reviewedBy is required to mark candidates as reviewed.')
  if (!reviewNotes?.trim()) throw new Error('reviewNotes is required to mark candidates as reviewed.')
  if (!Array.isArray(schoolIds) || schoolIds.length === 0) throw new Error('schoolIds must be a non-empty array.')

  const targetSet = new Set(schoolIds)
  const now = new Date().toISOString()
  const reviewedList: DistrictCandidateRecord[] = []

  const updatedRecords = dataset.records.map((r) => {
    if (!targetSet.has(r.schoolId)) return r

    if (r.reviewState === 'unverified_ambiguous_candidate') {
      throw new Error(
        `Cannot mark ambiguous duplicate-name candidate School ID ${r.schoolId} ("${r.nidSchoolName}") as reviewed without explicit disambiguation.`,
      )
    }

    if (!r.candidateDistrict) {
      throw new Error(`Cannot review School ID ${r.schoolId} because it has no candidate district.`)
    }

    const updated: DistrictCandidateRecord = {
      ...r,
      reviewState: 'reviewed_candidate',
      reviewedAt: now,
      reviewedBy: reviewedBy.trim(),
      reviewNotes: reviewNotes.trim(),
    }
    reviewedList.push(updated)
    return updated
  })

  const reviewedCount = updatedRecords.filter((r) => r.reviewState === 'reviewed_candidate').length
  const verifiedCount = updatedRecords.filter((r) => r.reviewState === 'verified_mapping').length

  const updatedDataset: DistrictCandidateDataset = {
    ...dataset,
    verifiedStatus: calculateDatasetStatus(updatedRecords),
    summary: {
      ...dataset.summary,
      reviewedCount,
      verifiedCount,
    },
    records: updatedRecords,
  }

  return { updatedDataset, reviewedRecords: reviewedList }
}

/**
 * Promotes an individual candidate to VERIFIED based on explicit School ID evidence.
 *
 * STRICT RULE: Requires explicit_official_school_id_district or manual_document_review_with_explicit_school_id.
 * Bulk promotion is disallowed; each record must have verified evidence.
 */
export function promoteCandidateToVerified(options: {
  dataset: DistrictCandidateDataset
  schoolId: string
  districtName: string
  districtCode?: string | null
  evidenceSourceName: string
  evidenceSourceUrl: string
  evidenceType: VerificationEvidenceType
  evidenceCheckedAt?: string
  reviewedBy: string
  verificationNote: string
}): {
  updatedDataset: DistrictCandidateDataset
  verifiedRecord: VerifiedDistrictRecord
  verifiedPayload: VerifiedDistrictPayload
} {
  const {
    dataset,
    schoolId,
    districtName,
    districtCode = null,
    evidenceSourceName,
    evidenceSourceUrl,
    evidenceType,
    evidenceCheckedAt = new Date().toISOString(),
    reviewedBy,
    verificationNote,
  } = options

  if (!schoolId?.trim()) throw new Error('schoolId is required.')
  if (!districtName?.trim()) throw new Error('districtName is required.')
  if (!evidenceSourceName?.trim()) throw new Error('evidenceSourceName is required.')
  if (!/^https:\/\//i.test(evidenceSourceUrl ?? '')) throw new Error('evidenceSourceUrl must be HTTPS.')
  if (!reviewedBy?.trim()) throw new Error('reviewedBy is required.')
  if (!verificationNote?.trim()) throw new Error('verificationNote is required.')

  const validEvidenceTypes: VerificationEvidenceType[] = [
    'explicit_official_school_id_district',
    'manual_document_review_with_explicit_school_id',
  ]
  if (!validEvidenceTypes.includes(evidenceType)) {
    throw new Error(
      `Invalid evidenceType "${evidenceType}". Verification requires explicit School ID evidence: "explicit_official_school_id_district" or "manual_document_review_with_explicit_school_id".`,
    )
  }

  const existing = dataset.records.find((r) => r.schoolId === schoolId)
  if (!existing) {
    throw new Error(`School ID "${schoolId}" was not found in dataset for ${dataset.divisionName}.`)
  }

  const updatedRecord: DistrictCandidateRecord = {
    ...existing,
    candidateDistrict: districtName.trim(),
    reviewState: 'verified_mapping',
    evidenceType,
    evidenceSourceName: evidenceSourceName.trim(),
    evidenceSourceUrl: evidenceSourceUrl.trim(),
    verifiedAt: evidenceCheckedAt,
    verifiedBy: reviewedBy.trim(),
    reviewNotes: verificationNote.trim(),
  }

  const updatedRecords = dataset.records.map((r) => (r.schoolId === schoolId ? updatedRecord : r))
  const verifiedCount = updatedRecords.filter((r) => r.reviewState === 'verified_mapping').length
  const reviewedCount = updatedRecords.filter((r) => r.reviewState === 'reviewed_candidate').length

  const updatedDataset: DistrictCandidateDataset = {
    ...dataset,
    verifiedStatus: calculateDatasetStatus(updatedRecords),
    summary: {
      ...dataset.summary,
      reviewedCount,
      verifiedCount,
    },
    records: updatedRecords,
  }

  const verifiedRecord: VerifiedDistrictRecord = {
    schoolId: schoolId.trim(),
    districtName: districtName.trim(),
    districtCode: districtCode ? districtCode.trim() : null,
    evidenceType,
    sourceName: evidenceSourceName.trim(),
    sourceUrl: evidenceSourceUrl.trim(),
    verifiedBy: reviewedBy.trim(),
    verifiedAt: evidenceCheckedAt,
    verificationBasis: verificationNote.trim(),
  }

  const verifiedPayload: VerifiedDistrictPayload = {
    sourceName: evidenceSourceName.trim(),
    sourceUrl: evidenceSourceUrl.trim(),
    verificationMethod: 'explicit_school_id',
    records: [
      {
        schoolId: verifiedRecord.schoolId,
        districtName: verifiedRecord.districtName,
        districtCode: verifiedRecord.districtCode,
        evidenceType: verifiedRecord.evidenceType,
        verifiedBy: verifiedRecord.verifiedBy,
        verifiedAt: verifiedRecord.verifiedAt,
        verificationBasis: verifiedRecord.verificationBasis,
      },
    ],
  }

  return { updatedDataset, verifiedRecord, verifiedPayload }
}

/**
 * Reverts candidate status back to unverified candidate.
 */
export function revertCandidateStatus(options: {
  dataset: DistrictCandidateDataset
  schoolIds: string[]
}): DistrictCandidateDataset {
  const { dataset, schoolIds } = options
  const targetSet = new Set(schoolIds)

  const updatedRecords = dataset.records.map((r) => {
    if (!targetSet.has(r.schoolId)) return r

    const originalState: CandidateReviewState =
      r.confidence === 'ambiguous_duplicate_name_requires_explicit_id'
        ? 'unverified_ambiguous_candidate'
        : 'unverified_candidate'

    return {
      ...r,
      reviewState: originalState,
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
      evidenceType: null,
      evidenceSourceName: null,
      evidenceSourceUrl: null,
      verifiedAt: null,
      verifiedBy: null,
    }
  })

  const reviewedCount = updatedRecords.filter((r) => r.reviewState === 'reviewed_candidate').length
  const verifiedCount = updatedRecords.filter((r) => r.reviewState === 'verified_mapping').length

  return {
    ...dataset,
    verifiedStatus: calculateDatasetStatus(updatedRecords),
    summary: {
      ...dataset.summary,
      reviewedCount,
      verifiedCount,
    },
    records: updatedRecords,
  }
}

export function validateCandidatePayload(payload: Partial<DistrictCandidateDataset>): boolean {
  const errors: string[] = []

  if (!payload.divisionName?.trim()) errors.push('divisionName is required.')
  if (!payload.regionName?.trim()) errors.push('regionName is required.')
  if (!payload.sourceName?.trim()) errors.push('sourceName is required.')
  if (!/^https:\/\//i.test(payload.sourceUrl ?? '')) errors.push('sourceUrl must be HTTPS.')
  if (!['unverified', 'partially_reviewed', 'reviewed', 'partially_verified', 'fully_verified'].includes(payload.verifiedStatus ?? '')) {
    errors.push(`Invalid verifiedStatus: "${payload.verifiedStatus}".`)
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

    const validStates: CandidateReviewState[] = [
      'unverified_candidate',
      'unverified_ambiguous_candidate',
      'reviewed_candidate',
      'verified_mapping',
      'unmatched_nid_school',
      'rejected',
    ]
    if (!validStates.includes(r.reviewState)) {
      errors.push(`Row ${index + 1}: reviewState must be a valid state (got "${r.reviewState}").`)
    }

    if (r.reviewState === 'verified_mapping') {
      if (!r.evidenceType) {
        errors.push(`Row ${index + 1}: verified_mapping requires evidenceType.`)
      }
      if (!r.evidenceSourceName) {
        errors.push(`Row ${index + 1}: verified_mapping requires evidenceSourceName.`)
      }
      if (!r.evidenceSourceUrl) {
        errors.push(`Row ${index + 1}: verified_mapping requires evidenceSourceUrl.`)
      }
      if (!r.verifiedBy) {
        errors.push(`Row ${index + 1}: verified_mapping requires verifiedBy.`)
      }
    }
  }

  if (errors.length) {
    throw new Error(`District candidate validation failed:\n- ${errors.join('\n- ')}`)
  }

  return true
}

export function validateVerifiedDistrictPayload(payload: Record<string, unknown> | Partial<VerifiedDistrictPayload>): {
  sourceName: string
  sourceUrl: string
  verificationMethod: 'explicit_school_id'
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
  const rawRecords = Array.isArray(payload.records) ? (payload.records as Array<Record<string, unknown>>) : []
  if (rawRecords.length === 0) {
    errors.push('records must be a non-empty array.')
  }

  const ids = new Set<string>()
  for (const [index, raw] of rawRecords.entries()) {
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
    verificationMethod: 'explicit_school_id',
    records: rawRecords.map((raw) => ({
      schoolId: String(raw.schoolId ?? '').trim(),
      districtName: String(raw.districtName ?? '').trim(),
      districtCode: raw.districtCode ? String(raw.districtCode).trim() : null,
      evidenceType: (raw.evidenceType as VerificationEvidenceType | undefined) ?? null,
      sourceName: raw.sourceName ? String(raw.sourceName).trim() : sourceName,
      sourceUrl: raw.sourceUrl ? String(raw.sourceUrl).trim() : sourceUrl,
      verifiedBy: raw.verifiedBy ? String(raw.verifiedBy).trim() : null,
      verifiedAt: raw.verifiedAt ? String(raw.verifiedAt).trim() : null,
      verificationBasis: raw.verificationBasis ? String(raw.verificationBasis).trim() : null,
    })),
  }
}
