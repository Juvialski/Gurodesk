import { describe, expect, it } from 'vitest'
import {
  extractAmbiguousCandidateSummary,
  promoteCandidates,
  reconcileDistrictCandidates,
  revertCandidatePromotion,
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

    const clusters = extractAmbiguousCandidateSummary(result)
    expect(clusters.length).toBe(1)
    expect(clusters[0].schoolName).toBe('San Isidro Elementary School')
    expect(clusters[0].schoolIds).toEqual(['112166', '112273', '112293'])
  })

  it('rejects candidate payloads with invalid verifiedStatus', () => {
    expect(() => validateCandidatePayload({
      divisionName: 'Camarines Norte',
      regionName: 'Region V',
      sourceName: 'DepEd SDO',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      verifiedStatus: 'invalid_status' as unknown as 'unverified',
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
    })).toThrow('Invalid verifiedStatus')
  })

  it('allows safe promotion of single-match candidates and generates verified payload', () => {
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

    const { updatedDataset, verifiedPayload, promotedRecords } = promoteCandidates({
      dataset,
      schoolIds: ['112148'],
      reviewer: 'al_matubis',
      verificationBasis: 'Human-assisted review of 1-to-1 exact name match against official SDO directory',
    })

    expect(promotedRecords.length).toBe(1)
    expect(updatedDataset.summary.promotedCount).toBe(1)
    expect(updatedDataset.verifiedStatus).toBe('partially_promoted')

    const zurbanoCandidate = updatedDataset.records.find((r) => r.schoolId === '112148')
    expect(zurbanoCandidate?.reviewState).toBe('promoted_verified')
    expect(zurbanoCandidate?.promotedBy).toBe('al_matubis')
    expect(zurbanoCandidate?.promotedAt).toBeDefined()

    expect(verifiedPayload.records.length).toBe(1)
    expect(verifiedPayload.records[0].schoolId).toBe('112148')
    expect(verifiedPayload.records[0].districtName).toBe('DAET SOUTH')
    expect(verifiedPayload.records[0].verifiedBy).toBe('al_matubis')
  })

  it('blocks automatic promotion of ambiguous duplicate-name candidates without override note', () => {
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

    expect(() => promoteCandidates({
      dataset,
      schoolIds: ['112166'],
      reviewer: 'maintainer',
      verificationBasis: 'Batch promotion',
    })).toThrow('Cannot promote ambiguous duplicate-name candidate')
  })

  it('allows promoting ambiguous candidate when explicit disambiguation override note is provided', () => {
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

    const { updatedDataset, promotedRecords } = promoteCandidates({
      dataset,
      schoolIds: ['112166'],
      reviewer: 'maintainer',
      verificationBasis: 'Manual review',
      allowAmbiguousOverride: true,
      overrideNotes: {
        '112166': 'Cross-referenced with Barangay San Isidro, Basud DepEd School Profile memo #42',
      },
    })

    expect(promotedRecords.length).toBe(1)
    const promoted = updatedDataset.records.find((r) => r.schoolId === '112166')
    expect(promoted?.reviewState).toBe('promoted_verified')
    expect(promoted?.reviewNotes).toContain('Barangay San Isidro, Basud')
  })

  it('supports reversible promotion via revertCandidatePromotion', () => {
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

    const { updatedDataset } = promoteCandidates({
      dataset,
      schoolIds: ['112148'],
      reviewer: 'tester',
      verificationBasis: 'Test basis',
    })

    expect(updatedDataset.records[0].reviewState).toBe('promoted_verified')

    const reverted = revertCandidatePromotion({
      dataset: updatedDataset,
      schoolIds: ['112148'],
    })

    expect(reverted.records[0].reviewState).toBe('unverified_candidate')
    expect(reverted.records[0].promotedBy).toBeNull()
    expect(reverted.summary.promotedCount).toBe(0)
  })
})
