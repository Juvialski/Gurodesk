import { describe, expect, it } from 'vitest'
import { validateVerifiedDistrictPayload } from '../../src/lib/districtReconciliation'

describe('verified district importer validation', () => {
  it('accepts valid explicit School ID mappings from official HTTPS DepEd domains', () => {
    const valid = {
      sourceName: 'DepEd Schools Division of Camarines Norte',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      verificationMethod: 'explicit_school_id',
      records: [
        { schoolId: '112148', districtName: 'Daet South', districtCode: null },
        { schoolId: '112082', districtName: 'Basud', districtCode: '051601' },
      ],
    }

    const validated = validateVerifiedDistrictPayload(valid)
    expect(validated.records.length).toBe(2)
    expect(validated.records[0].schoolId).toBe('112148')
    expect(validated.records[0].districtName).toBe('Daet South')
    expect(validated.records[1].districtCode).toBe('051601')
  })

  it('rejects payloads using non-official domains', () => {
    const invalid = {
      sourceName: 'Third Party Directory',
      sourceUrl: 'https://random-schools-wiki.org/schools',
      verificationMethod: 'explicit_school_id',
      records: [{ schoolId: '112148', districtName: 'Daet South' }],
    }
    expect(() => validateVerifiedDistrictPayload(invalid)).toThrow('not recognized as an official DepEd')
  })

  it('rejects name-only or fuzzy verification methods', () => {
    const invalid = {
      sourceName: 'DepEd Schools Division of Camarines Norte',
      sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
      verificationMethod: 'fuzzy_name_match',
      records: [{ schoolId: '112148', districtName: 'Daet South' }],
    }
    expect(() => validateVerifiedDistrictPayload(invalid)).toThrow('verificationMethod must be "explicit_school_id"')
  })

  it('rejects duplicate School IDs in verified payload', () => {
    const invalid = {
      sourceName: 'DepEd SDO',
      sourceUrl: 'https://deped.gov.ph/schools',
      verificationMethod: 'explicit_school_id',
      records: [
        { schoolId: '112148', districtName: 'Daet South' },
        { schoolId: '112148', districtName: 'Daet North' },
      ],
    }
    expect(() => validateVerifiedDistrictPayload(invalid)).toThrow('Duplicate School ID 112148')
  })

  it('rejects blank district names', () => {
    const invalid = {
      sourceName: 'DepEd SDO',
      sourceUrl: 'https://deped.gov.ph/schools',
      verificationMethod: 'explicit_school_id',
      records: [{ schoolId: '112148', districtName: '   ' }],
    }
    expect(() => validateVerifiedDistrictPayload(invalid)).toThrow('districtName is required')
  })
})
