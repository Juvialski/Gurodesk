import { describe, expect, it } from 'vitest'
import {
  extractAmbiguousCandidateSummary,
  markCandidatesReviewed,
  promoteCandidateToVerified,
  reconcileDistrictCandidates,
  revertCandidateStatus,
  validateCandidatePayload,
} from '../../src/lib/districtReconciliation'

describe('district candidate reconciliation and hardened verification semantics', () => {
  it('reconciles single matches with high confidence and unverified candidate state', () => {
    const nidSchools = [
      { schoolId: '112148', schoolName: 'Zurbano Elementary School' },
      { schoolId: '112082', schoolName: 'Angas Elementary School' },
    ]
    const sdoSchools = [
      { schoolName: 'Zurbano Elementary School', district: 'DAET SOUTH' },
      { schoolName: 'Angas Elementary School', district: 'BASUD' },
    ]

    const result = reconcileDistrictCandidates({
      divisionName: 'Camarines Norte',
      regionName: 'Region V',
      sourceName: 'DepEd Schools Division of Camarines Norte',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      nidSchools,
      sdoSchools,
    })

    expect(result.verifiedStatus).toBe('unverified')
    expect(result.summary.candidateMatches).toBe(2)
    expect(result.summary.ambiguousDuplicateNames).toBe(0)
    expect(result.summary.verifiedCount).toBe(0)
    expect(result.summary.reviewedCount).toBe(0)

    const zurbano = result.records.find((r) => r.schoolId === '112148')
    expect(zurbano).toBeDefined()
    expect(zurbano?.candidateDistrict).toBe('DAET SOUTH')
    expect(zurbano?.reviewState).toBe('unverified_candidate')
    expect(zurbano?.confidence).toBe('high_single_match')

    expect(validateCandidatePayload(result)).toBe(true)
  })

  it('detects duplicate school names and flags them as ambiguous requiring explicit ID', () => {
    const nidSchools = [
      { schoolId: '112166', schoolName: 'San Isidro Elementary School' },
      { schoolId: '112273', schoolName: 'San Isidro Elementary School' },
      { schoolId: '112293', schoolName: 'San Isidro Elementary School' },
    ]
    const sdoSchools = [
      { schoolName: 'San Isidro Elementary School', district: 'BASUD' },
    ]

    const result = reconcileDistrictCandidates({
      divisionName: 'Camarines Norte',
      regionName: 'Region V',
      sourceName: 'DepEd Schools Division of Camarines Norte',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      nidSchools,
      sdoSchools,
    })

    expect(result.summary.ambiguousDuplicateNames).toBe(3)
    expect(result.records.length).toBe(3)
    for (const record of result.records) {
      expect(record.reviewState).toBe('unverified_ambiguous_candidate')
      expect(record.confidence).toBe('ambiguous_duplicate_name_requires_explicit_id')
      expect(record.ambiguityNote).toContain('3 distinct School IDs')
    }

    const clusters = extractAmbiguousCandidateSummary(result)
    expect(clusters.length).toBe(1)
    expect(clusters[0].schoolName).toBe('San Isidro Elementary School')
    expect(clusters[0].schoolIds).toEqual(['112166', '112273', '112293'])
  })

  it('marks candidate records as reviewed without creating a verified payload (remains unverified)', () => {
    const dataset = reconcileDistrictCandidates({
      divisionName: 'Camarines Norte',
      regionName: 'Region V',
      sourceName: 'DepEd Schools Division of Camarines Norte',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      nidSchools: [
        { schoolId: '112148', schoolName: 'Zurbano Elementary School' },
        { schoolId: '112082', schoolName: 'Angas Elementary School' },
      ],
      sdoSchools: [
        { schoolName: 'Zurbano Elementary School', district: 'DAET SOUTH' },
        { schoolName: 'Angas Elementary School', district: 'BASUD' },
      ],
    })

    const { updatedDataset, reviewedRecords } = markCandidatesReviewed({
      dataset,
      schoolIds: ['112148', '112082'],
      reviewedBy: 'human_reviewer',
      reviewNotes: 'Reviewed 1-to-1 name match against official SDO directory list',
    })

    expect(reviewedRecords.length).toBe(2)
    expect(updatedDataset.summary.reviewedCount).toBe(2)
    expect(updatedDataset.summary.verifiedCount).toBe(0)
    expect(updatedDataset.verifiedStatus).toBe('reviewed')

    const zurbano = updatedDataset.records.find((r) => r.schoolId === '112148')
    expect(zurbano?.reviewState).toBe('reviewed_candidate')
    expect(zurbano?.reviewedBy).toBe('human_reviewer')
    expect(zurbano?.reviewedAt).toBeDefined()
    expect(zurbano?.verifiedAt).toBeUndefined()
    expect(zurbano?.evidenceType).toBeUndefined()

    expect(validateCandidatePayload(updatedDataset)).toBe(true)
  })

  it('blocks bulk review from marking ambiguous duplicate-name candidates without explicit disambiguation', () => {
    const dataset = reconcileDistrictCandidates({
      divisionName: 'Camarines Norte',
      regionName: 'Region V',
      sourceName: 'DepEd Schools Division of Camarines Norte',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      nidSchools: [
        { schoolId: '112166', schoolName: 'San Isidro Elementary School' },
        { schoolId: '112273', schoolName: 'San Isidro Elementary School' },
      ],
      sdoSchools: [
        { schoolName: 'San Isidro Elementary School', district: 'BASUD' },
      ],
    })

    expect(() => markCandidatesReviewed({
      dataset,
      schoolIds: ['112166'],
      reviewedBy: 'reviewer',
      reviewNotes: 'Bulk review attempt',
    })).toThrow('Cannot mark ambiguous duplicate-name candidate School ID 112166')
  })

  it('promotes an individual candidate to VERIFIED only when structured explicit School ID evidence is supplied', () => {
    const dataset = reconcileDistrictCandidates({
      divisionName: 'Camarines Norte',
      regionName: 'Region V',
      sourceName: 'DepEd Schools Division of Camarines Norte',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      nidSchools: [
        { schoolId: '112148', schoolName: 'Zurbano Elementary School' },
      ],
      sdoSchools: [
        { schoolName: 'Zurbano Elementary School', district: 'DAET SOUTH' },
      ],
    })

    const { updatedDataset, verifiedRecord, verifiedPayload } = promoteCandidateToVerified({
      dataset,
      schoolId: '112148',
      districtName: 'Daet South',
      districtCode: '051602',
      evidenceSourceName: 'DepEd LMS Region V School Masterlist / SDO Memorandum #141',
      evidenceSourceUrl: 'https://web.depedcamnorte.ph/uploads/issuances/11460c57cbffd7153e092f21f779f3b9.pdf',
      evidenceType: 'manual_document_review_with_explicit_school_id',
      reviewedBy: 'division_planning_officer',
      verificationNote: 'Explicit School ID 112148 verified in official DepEd Division Training roster',
    })

    expect(updatedDataset.summary.verifiedCount).toBe(1)
    expect(updatedDataset.verifiedStatus).toBe('fully_verified')

    const record = updatedDataset.records.find((r) => r.schoolId === '112148')
    expect(record?.reviewState).toBe('verified_mapping')
    expect(record?.evidenceType).toBe('manual_document_review_with_explicit_school_id')
    expect(record?.verifiedBy).toBe('division_planning_officer')
    expect(record?.verifiedAt).toBeDefined()

    expect(verifiedRecord.schoolId).toBe('112148')
    expect(verifiedRecord.districtName).toBe('Daet South')
    expect(verifiedRecord.districtCode).toBe('051602')
    expect(verifiedRecord.evidenceType).toBe('manual_document_review_with_explicit_school_id')

    expect(verifiedPayload.verificationMethod).toBe('explicit_school_id')
    expect(verifiedPayload.records.length).toBe(1)
    expect(verifiedPayload.records[0].schoolId).toBe('112148')
    expect(verifiedPayload.records[0].districtName).toBe('Daet South')
    expect(verifiedPayload.records[0].evidenceType).toBe('manual_document_review_with_explicit_school_id')
  })

  it('rejects promotion when evidenceType is missing or invalid', () => {
    const dataset = reconcileDistrictCandidates({
      divisionName: 'Camarines Norte',
      regionName: 'Region V',
      sourceName: 'DepEd Schools Division of Camarines Norte',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      nidSchools: [
        { schoolId: '112148', schoolName: 'Zurbano Elementary School' },
      ],
      sdoSchools: [
        { schoolName: 'Zurbano Elementary School', district: 'DAET SOUTH' },
      ],
    })

    expect(() => promoteCandidateToVerified({
      dataset,
      schoolId: '112148',
      districtName: 'Daet South',
      evidenceSourceName: 'Web Directory',
      evidenceSourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      evidenceType: 'name_matching_only' as unknown as 'explicit_official_school_id_district', // ILLEGAL
      reviewedBy: 'reviewer',
      verificationNote: 'Name matches',
    })).toThrow('Invalid evidenceType')
  })

  it('safely reverts reviewed or verified records back to candidate status', () => {
    const dataset = reconcileDistrictCandidates({
      divisionName: 'Camarines Norte',
      regionName: 'Region V',
      sourceName: 'DepEd Schools Division of Camarines Norte',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      nidSchools: [
        { schoolId: '112148', schoolName: 'Zurbano Elementary School' },
      ],
      sdoSchools: [
        { schoolName: 'Zurbano Elementary School', district: 'DAET SOUTH' },
      ],
    })

    const { updatedDataset } = promoteCandidateToVerified({
      dataset,
      schoolId: '112148',
      districtName: 'Daet South',
      evidenceSourceName: 'DepEd SDO',
      evidenceSourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      evidenceType: 'explicit_official_school_id_district',
      reviewedBy: 'reviewer',
      verificationNote: 'Documented note',
    })

    expect(updatedDataset.records[0].reviewState).toBe('verified_mapping')

    const reverted = revertCandidateStatus({
      dataset: updatedDataset,
      schoolIds: ['112148'],
    })

    expect(reverted.records[0].reviewState).toBe('unverified_candidate')
    expect(reverted.records[0].verifiedBy).toBeNull()
    expect(reverted.records[0].evidenceType).toBeNull()
    expect(reverted.summary.verifiedCount).toBe(0)
    expect(reverted.verifiedStatus).toBe('unverified')
  })
})
