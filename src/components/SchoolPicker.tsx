import { CheckCircle2, Search, School, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '../types/app'
import type { PhilippineSchool, SchoolDivisionOption, SchoolRegionOption } from '../types/school'
import { customSchoolIdentityPatch, schoolIdentityPatch } from '../lib/schoolDirectory'
import { loadSchoolDivisions, loadSchoolRegions, searchPhilippineSchools } from '../lib/schoolDirectoryRepository'
import '../school-directory.css'

type Props = {
  value: Profile
  onChange: (patch: Partial<Profile>) => void
  isDemo: boolean
  required?: boolean
}

export function SchoolPicker({ value, onChange, isDemo, required = false }: Props) {
  const initiallyCustom = value.schoolIsCustom !== false || !value.schoolDirectoryId
  const [manualMode, setManualMode] = useState(initiallyCustom)
  const [regions, setRegions] = useState<SchoolRegionOption[]>([])
  const [divisions, setDivisions] = useState<SchoolDivisionOption[]>([])
  const [region, setRegion] = useState(value.schoolIsCustom === false ? value.region : '')
  const [division, setDivision] = useState(value.schoolIsCustom === false ? value.division : '')
  const [query, setQuery] = useState(value.schoolIsCustom === false ? value.schoolName : '')
  const [results, setResults] = useState<PhilippineSchool[]>([])
  const [busy, setBusy] = useState(false)
  const [directoryError, setDirectoryError] = useState<string | null>(null)

  const officialSelected = value.schoolIsCustom === false && Boolean(value.schoolDirectoryId)
  const canSearch = query.trim().length >= 2 || Boolean(division)

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
    if (manualMode || !canSearch) {
      setResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setBusy(true)
      void searchPhilippineSchools({ query, region: region || undefined, division: division || undefined, limit: 20 }, isDemo)
        .then((items) => {
          if (!cancelled) {
            setResults(items)
            setDirectoryError(null)
          }
        })
        .catch((error) => {
          if (!cancelled) setDirectoryError(error instanceof Error ? error.message : 'Unable to search the school directory.')
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [canSearch, division, isDemo, manualMode, query, region])

  const selectedDescription = useMemo(() => {
    if (!officialSelected) return null
    return [value.schoolId ? `School ID ${value.schoolId}` : null, value.division, value.region].filter(Boolean).join(' · ')
  }, [officialSelected, value.division, value.region, value.schoolId])

  function chooseSchool(school: PhilippineSchool) {
    onChange(schoolIdentityPatch(school))
    setRegion(school.regionName)
    setDivision(school.divisionName)
    setQuery(school.schoolName)
    setResults([])
    setDirectoryError(null)
  }

  function enterManualMode() {
    setManualMode(true)
    setResults([])
    onChange(customSchoolIdentityPatch({
      schoolName: value.schoolName,
      schoolId: value.schoolId,
      region: value.region,
      division: value.division,
    }))
  }

  function useDirectory() {
    setManualMode(false)
    setRegion('')
    setDivision('')
    setQuery('')
    setDirectoryError(null)
  }

  if (manualMode) {
    return (
      <section className="school-picker school-picker-manual">
        <div className="school-picker-heading">
          <div><strong>School</strong><small>Enter details manually if your school is not in the DepEd directory.</small></div>
          <button className="button ghost compact" type="button" onClick={useDirectory}>Use DepEd directory</button>
        </div>
        <div className="school-picker-manual-grid">
          <label>School name<input required={required} value={value.schoolName} onChange={(e) => onChange(customSchoolIdentityPatch({ schoolName: e.target.value, schoolId: value.schoolId, region: value.region, division: value.division }))} placeholder="Your school" /></label>
          <label>School ID <small>(optional)</small><input inputMode="numeric" value={value.schoolId ?? ''} onChange={(e) => onChange(customSchoolIdentityPatch({ schoolName: value.schoolName, schoolId: e.target.value, region: value.region, division: value.division }))} placeholder="e.g. 136418" /></label>
          <label>Region<input value={value.region} onChange={(e) => onChange(customSchoolIdentityPatch({ schoolName: value.schoolName, schoolId: value.schoolId, region: e.target.value, division: value.division }))} placeholder="e.g. Region III" /></label>
          <label>Schools Division<input value={value.division} onChange={(e) => onChange(customSchoolIdentityPatch({ schoolName: value.schoolName, schoolId: value.schoolId, region: value.region, division: e.target.value }))} placeholder="e.g. Bulacan" /></label>
        </div>
        <div className="school-picker-source custom"><School size={15} /> Custom school identity</div>
      </section>
    )
  }

  return (
    <section className="school-picker">
      <div className="school-picker-heading">
        <div><strong>Your school</strong><small>Search the DepEd directory by school name or School ID.</small></div>
        <button className="button ghost compact" type="button" onClick={enterManualMode}>Enter manually</button>
      </div>

      {officialSelected && (
        <div className="school-picker-selected">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div><strong>{value.schoolName}</strong><span>{selectedDescription}</span></div>
          <button type="button" className="button ghost compact" onClick={() => { setQuery(''); onChange({ schoolDirectoryId: null, schoolId: null, schoolName: '', region: '', division: '', schoolSource: 'custom', schoolIsCustom: true }) }}>Change</button>
        </div>
      )}

      <div className="school-picker-filters">
        <label>Region<select value={region} onChange={(e) => { setRegion(e.target.value); setDivision('') }}><option value="">All regions</option>{regions.map((item) => <option key={`${item.regionCode}-${item.regionName}`} value={item.regionName}>{item.regionName}</option>)}</select></label>
        <label>Schools Division<select value={division} onChange={(e) => setDivision(e.target.value)} disabled={!region}><option value="">All divisions</option>{divisions.map((item) => <option key={`${item.divisionCode ?? ''}-${item.divisionName}`} value={item.divisionName}>{item.divisionName}</option>)}</select></label>
      </div>

      <label className="school-picker-search-label">School name or School ID<div className="school-picker-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or ID" autoComplete="off" /></div></label>

      {busy && <div className="school-picker-state" aria-live="polite">Searching schools…</div>}
      {!busy && canSearch && !directoryError && results.length === 0 && !officialSelected && <div className="school-picker-state">No matching school found. You can adjust the filters or enter the school manually.</div>}
      {directoryError && <div className="school-picker-error" role="alert"><TriangleAlert size={17} /><span>{directoryError}</span><button type="button" className="button ghost compact" onClick={enterManualMode}>Enter manually</button></div>}

      {!busy && results.length > 0 && (
        <div className="school-picker-results" role="listbox" aria-label="School search results">
          {results.map((school) => <button key={school.id} type="button" role="option" aria-selected={school.id === value.schoolDirectoryId} onClick={() => chooseSchool(school)}><School size={17} aria-hidden="true" /><span><strong>{school.schoolName}</strong><small>School ID {school.schoolId} · {school.divisionName} · {school.regionName}</small></span></button>)}
        </div>
      )}

      <div className="school-picker-source"><CheckCircle2 size={15} /> Official directory source: DepEd National Inventory Dashboard</div>
    </section>
  )
}
