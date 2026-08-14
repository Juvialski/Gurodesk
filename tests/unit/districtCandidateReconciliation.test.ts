import { describe, expect, it } from 'vitest'
import {
  reconcileDistrictCandidates,
  validateCandidatePayload,
} from '../../src/lib/districtReconciliation'

describe('district candidate reconciliation and validation', () => {
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
  })

  it('rejects candidate payloads claiming verified status or missing provenance', () => {
    expect(() => validateCandidatePayload({
      divisionName: 'Camarines Norte',
      regionName: 'Region V',
      sourceName: 'DepEd SDO',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      verifiedStatus: 'verified' as unknown as 'unverified', // ILLEGAL: candidate datasets must be 'unverified'
      records: [
        {
          schoolId: '112148',
          nidSchoolName: 'Zurbano Elementary School',
          officialSourceSchoolName: 'Zurbano Elementary School',
          candidateDistrict: 'DAET SOUTH',
          sourceName: 'DepEd SDO',
          sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
          matchMethod: 'exact',
          confidence: 'high_single_match',
          reviewState: 'unverified_candidate',
        },
      ],
    })).toThrow('verifiedStatus must be "unverified"')
  })
})
