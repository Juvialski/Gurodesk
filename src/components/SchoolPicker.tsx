import { CheckCircle2, Search, School, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Profile } from '../types/app'
import type {
  PhilippineSchool,
  SchoolDistrictOption,
  SchoolDivisionOption,
  SchoolRegionOption,
} from '../types/school'
import { customSchoolIdentityPatch, schoolIdentityPatch } from '../lib/schoolDirectory'
import {
  loadSchoolDistricts,
  loadSchoolDivisions,
  loadSchoolRegions,
  searchPhilippineSchools,
} from '../lib/schoolDirectoryRepository'
import '../school-directory.css'

type Props = {
  value: Profile
  onChange: (patch: Partial<Profile>) => void
  isDemo: boolean
  required?: boolean
}

const PAGE_SIZE = 20

export function SchoolPicker({ value, onChange, isDemo, required = false }: Props) {
  const initiallyCustom = value.schoolIsCustom !== false || !value.schoolDirectoryId
  const [manualMode, setManualMode] = useState(initiallyCustom)
  const [regions, setRegions] = useState<SchoolRegionOption[]>([])
  const [divisions, setDivisions] = useState<SchoolDivisionOption[]>([])
  const [districts, setDistricts] = useState<SchoolDistrictOption[]>([])
  const [region, setRegion] = useState(value.schoolIsCustom === false ? value.region : '')
  const [division, setDivision] = useState(value.schoolIsCustom === false ? value.division : '')
  const [districtFilter, setDistrictFilter] = useState(
    value.schoolIsCustom === false && value.districtVerified ? value.district ?? '' : '',
  )
  const [districtText, setDistrictText] = useState(value.district ?? '')
  const [query, setQuery] = useState(value.schoolIsCustom === false ? value.schoolName : '')
  const [results, setResults] = useState<PhilippineSchool[]>([])
  const [busy, setBusy] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const searchVersion = useRef(0)

  const officialSelected = value.schoolIsCustom === false && Boolean(value.schoolDirectoryId)
  const verifiedDistrictDirectory = districts.length > 0
  const useManualDistrictInput = officialSelected
    ? value.districtVerified !== true
    : !verifiedDistrictDirectory
  const canSearch = !officialSelected && (query.trim().length >= 2 || Boolean(division))

  useEffect(() => {
    if (manualMode) return
    let cancelled = false
    void loadSchoolRegions(isDemo).then((items) => {
      if (!cancelled) {
        setRegions(items)
        setDirectoryError(null)
      }
    }).catch((error) => {
      if (!cancelled) setDirectoryError(error instanceof Error ? error.message : 'School directory is unavailable.')
    })
    return () => { cancelled = true }
  }, [isDemo, manualMode])

  useEffect(() => {
    if (manualMode || !region) {
      setDivisions([])
      setDistricts([])
      setDistrictFilter('')
      return
    }
    let cancelled = false
    void loadSchoolDivisions(region, isDemo).then((items) => {
      if (!cancelled) setDivisions(items)
    }).catch((error) => {
      if (!cancelled) setDirectoryError(error instanceof Error ? error.message : 'Unable to load school divisions.')
    })
    return () => { cancelled = true }
  }, [isDemo, manualMode, region])

  useEffect(() => {
    if (manualMode || !region || !division) {
      setDistricts([])
      setDistrictFilter('')
      return
    }
    let cancelled = false
    void loadSchoolDistricts(region, division, isDemo).then((items) => {
      if (cancelled) return
      setDistricts(items)
      const currentDistrict = value.districtVerified ? (value.district ?? '') : ''
      setDistrictFilter(items.some((item) => item.districtName === currentDistrict) ? currentDistrict : '')
    }).catch((error) => {
      if (!cancelled) {
        setDistricts([])
        setDistrictFilter('')
        setDirectoryError(error instanceof Error ? error.message : 'Unable to load school districts.')
      }
    })
    return () => { cancelled = true }
  }, [division, isDemo, manualMode, region])

  useEffect(() => {
    searchVersion.current += 1
    setLoadingMore(false)
    if (manualMode || !canSearch) {
      setResults([])
      setHasMore(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setBusy(true)
      setDirectoryError(null)
      void searchPhilippineSchools({
        query,
        region: region || undefined,
        division: division || undefined,
        district: verifiedDistrictDirectory && districtFilter ? districtFilter : undefined,
        limit: PAGE_SIZE,
        offset: 0,
      }, isDemo)
        .then((items) => {
          if (!cancelled) {
            setResults(items)
            setHasMore(items.length === PAGE_SIZE)
            setDirectoryError(null)
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setResults([])
            setHasMore(false)
            setDirectoryError(error instanceof Error ? error.message : 'Unable to search the school directory.')
          }
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    canSearch,
    districtFilter,
    isDemo,
    manualMode,
    query,
    region,
    division,
    verifiedDistrictDirectory,
  ])

  const selectedDescription = useMemo(() => {
    if (!officialSelected) return null
    return [
      value.schoolId ? `School ID ${value.schoolId}` : null,
      value.district ? `District: ${value.district}` : null,
      value.division,
      value.region,
    ].filter(Boolean).join(' · ')
  }, [officialSelected, value.district, value.division, value.region, value.schoolId])

  async function loadMore() {
    if (busy || loadingMore || !hasMore || !canSearch) return
    const version = searchVersion.current
    setLoadingMore(true)
    setDirectoryError(null)
    try {
      const items = await searchPhilippineSchools({
        query,
        region: region || undefined,
        division: division || undefined,
        district: verifiedDistrictDirectory && districtFilter ? districtFilter : undefined,
        limit: PAGE_SIZE,
        offset: results.length,
      }, isDemo)
      if (version !== searchVersion.current) return
      setResults((current) => {
        const merged = new Map(current.map((school) => [school.id, school]))
        items.forEach((school) => merged.set(school.id, school))
        return [...merged.values()]
      })
      setHasMore(items.length === PAGE_SIZE)
    } catch (error) {
      if (version !== searchVersion.current) return
      setDirectoryError(error instanceof Error ? error.message : 'Unable to load more schools.')
    } finally {
      if (version === searchVersion.current) setLoadingMore(false)
    }
  }

  function chooseSchool(school: PhilippineSchool) {
    const fallbackDistrict = verifiedDistrictDirectory ? districtFilter : districtText
    onChange(schoolIdentityPatch(school, fallbackDistrict))
    setRegion(school.regionName)
    setDivision(school.divisionName)
    setDistrictText(school.districtName ?? fallbackDistrict)
    if (school.districtName) setDistrictFilter(school.districtName)
    setQuery(school.schoolName)
    setResults([])
    setHasMore(false)
    setDirectoryError(null)
  }

  function enterManualMode() {
    setManualMode(true)
    setResults([])
    setHasMore(false)
    onChange(customSchoolIdentityPatch({
      schoolName: value.schoolName,
      schoolId: value.schoolId,
      region: value.region,
      division: value.division,
      district: value.district,
    }))
  }

  function useDirectory() {
    setManualMode(false)
    setRegion('')
    setDivision('')
    setDistricts([])
    setDistrictFilter('')
    setDistrictText('')
    setQuery('')
    setResults([])
    setHasMore(false)
    setDirectoryError(null)
  }

  function clearOfficialSelection() {
    setQuery('')
    setResults([])
    setHasMore(false)
    setDistrictText('')
    setDistrictFilter('')
    onChange({
      schoolDirectoryId: null,
      schoolId: null,
      schoolName: '',
      district: '',
      districtSource: 'unknown',
      districtVerified: false,
      schoolSource: 'custom',
      schoolIsCustom: true,
    })
  }

  function updateManualDistrict(nextDistrict: string) {
    setDistrictText(nextDistrict)
    if (officialSelected) {
      onChange({
        district: nextDistrict,
        districtSource: nextDistrict.trim() ? 'manual' : 'unknown',
        districtVerified: false,
      })
    }
  }

  function manualPatch(changes: Partial<{
    schoolName: string
    schoolId: string | null
    region: string
    division: string
    district: string
  }>) {
    onChange(customSchoolIdentityPatch({
      schoolName: changes.schoolName ?? value.schoolName,
      schoolId: changes.schoolId === undefined ? value.schoolId : changes.schoolId,
      region: changes.region ?? value.region,
      division: changes.division ?? value.division,
      district: changes.district ?? value.district ?? '',
    }))
  }

  if (manualMode) {
    return (
      <section className="school-picker school-picker-manual">
        <div className="school-picker-heading">
          <div>
            <strong>School</strong>
            <small>Enter details manually if your school is not in the DepEd directory.</small>
          </div>
          <button className="button ghost compact" type="button" onClick={useDirectory}>
            Use DepEd directory
          </button>
        </div>

        <div className="school-picker-manual-grid">
          <label>
            School name
            <input
              required={required}
              value={value.schoolName}
              onChange={(event) => manualPatch({ schoolName: event.target.value })}
              placeholder="Your school"
            />
          </label>
          <label>
            <span>School ID <small className="field-optional">(optional)</small></span>
            <input
              inputMode="numeric"
              value={value.schoolId ?? ''}
              onChange={(event) => manualPatch({ schoolId: event.target.value })}
              placeholder="e.g. 136418"
            />
          </label>
          <label>
            Region
            <input
              value={value.region}
              onChange={(event) => manualPatch({ region: event.target.value })}
              placeholder="e.g. Region III"
            />
          </label>
          <label>
            Schools Division
            <input
              value={value.division}
              onChange={(event) => manualPatch({ division: event.target.value })}
              placeholder="e.g. Bulacan"
            />
          </label>
          <label className="school-picker-district-field">
            District
            <input
              value={value.district ?? ''}
              onChange={(event) => manualPatch({ district: event.target.value })}
              placeholder="e.g. District I"
            />
          </label>
        </div>

        <div className="school-picker-source custom">
          <School size={15} /> Custom school identity
        </div>
      </section>
    )
  }

  return (
    <section className="school-picker">
      <div className="school-picker-heading">
        <div>
          <strong>Your school</strong>
          <small>Search the DepEd directory by school name or School ID.</small>
        </div>
        <button className="button ghost compact" type="button" onClick={enterManualMode}>
          Enter manually
        </button>
      </div>

      {officialSelected && (
        <div className="school-picker-selected">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <strong>{value.schoolName}</strong>
            <span>{selectedDescription}</span>
            {value.district && (
              <small className={value.districtVerified ? 'district-verified' : 'district-manual'}>
                {value.districtVerified ? 'District verified from an official DepEd source' : 'District saved from teacher entry'}
              </small>
            )}
          </div>
          <button type="button" className="button ghost compact" onClick={clearOfficialSelection}>
            Change
          </button>
        </div>
      )}

      <div className="school-picker-filters">
        <label>
          Region
          <select
            value={region}
            onChange={(event) => {
              setRegion(event.target.value)
              setDivision('')
              setDistricts([])
              setDistrictFilter('')
              setDistrictText('')
              setResults([])
              setHasMore(false)
            }}
          >
            <option value="">All regions</option>
            {regions.map((item) => (
              <option key={`${item.regionCode}-${item.regionName}`} value={item.regionName}>
                {item.regionName}
              </option>
            ))}
          </select>
        </label>

        <label>
          Schools Division
          <select
            value={division}
            onChange={(event) => {
              setDivision(event.target.value)
              setDistricts([])
              setDistrictFilter('')
              setDistrictText('')
              setResults([])
              setHasMore(false)
            }}
            disabled={!region}
          >
            <option value="">All divisions</option>
            {divisions.map((item) => (
              <option key={`${item.divisionCode ?? ''}-${item.divisionName}`} value={item.divisionName}>
                {item.divisionName}
              </option>
            ))}
          </select>
        </label>

        {division && (
          <label className="school-picker-district-field">
            District
            {useManualDistrictInput ? (
              <>
                <input
                  value={districtText}
                  onChange={(event) => updateManualDistrict(event.target.value)}
                  placeholder="e.g. District I"
                />
                <small>
                  Verified School ID → District mapping is not loaded for this school yet.
                  Enter the official district name once; GuroDesk will save it for documents.
                </small>
              </>
            ) : (
              <>
                <select
                  value={districtFilter}
                  onChange={(event) => setDistrictFilter(event.target.value)}
                  disabled={officialSelected && value.districtVerified === true}
                >
                  <option value="">All districts</option>
                  {districts.map((item) => (
                    <option key={`${item.districtCode ?? ''}-${item.districtName}`} value={item.districtName}>
                      {item.districtName}
                    </option>
                  ))}
                </select>
                <small>Verified district mapping is available for this division.</small>
              </>
            )}
          </label>
        )}
      </div>

      {!officialSelected && (
        <label className="school-picker-search-label">
          School name or School ID
          <div className="school-picker-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or ID"
              autoComplete="off"
            />
          </div>
        </label>
      )}

      {busy && <div className="school-picker-state" aria-live="polite">Searching schools…</div>}

      {!busy && canSearch && !directoryError && results.length === 0 && (
        <div className="school-picker-state">
          No matching school found. Adjust the filters, search by School ID, or enter the school manually.
        </div>
      )}

      {directoryError && (
        <div className="school-picker-error" role="alert">
          <TriangleAlert size={17} />
          <span>{directoryError}</span>
          <button type="button" className="button ghost compact" onClick={enterManualMode}>
            Enter manually
          </button>
        </div>
      )}

      {!busy && results.length > 0 && (
        <div className="school-picker-results-shell">
          <div className="school-picker-results" role="listbox" aria-label="School search results">
            {results.map((school) => (
              <button
                key={school.id}
                type="button"
                role="option"
                aria-selected={school.id === value.schoolDirectoryId}
                onClick={() => chooseSchool(school)}
              >
                <School className="school-picker-result-icon" size={17} aria-hidden="true" />
                <span className="school-picker-result-copy">
                  <strong>{school.schoolName}</strong>
                  <small>
                    {[
                      `School ID ${school.schoolId}`,
                      school.districtName ? `District: ${school.districtName}` : null,
                      school.divisionName,
                      school.regionName,
                    ].filter(Boolean).join(' · ')}
                  </small>
                </span>
              </button>
            ))}
          </div>

          <div className="school-picker-results-footer">
            <small>{results.length} school{results.length === 1 ? '' : 's'} shown</small>
            {hasMore && (
              <button
                className="button ghost compact school-picker-load-more"
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? 'Loading…' : 'Load more schools'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="school-picker-source">
        <CheckCircle2 size={15} />
        School identity source: DepEd National Inventory Dashboard {/* Official directory source */}
      </div>
    </section>
  )
}
