// Read-only authenticated directory coverage audit. Never imports or modifies schools.
if (process.argv.includes('--help')) {
  console.log('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SCHOOL_AUDIT_USER_JWT (or backend-only SUPABASE_SERVICE_ROLE_KEY). Run node scripts/schools/audit-directory.mjs. Only aggregate directory coverage is printed. Teacher JWTs report only RLS-visible active schools.')
} else {
  const base = process.env.SUPABASE_URL
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = process.env.SCHOOL_AUDIT_USER_JWT || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !apiKey || !token) throw new Error('Authorized school-audit environment is missing. No requests were made.')
  const regions = new Map(); const divisions = new Map(); const initials = new Map(); const ids = new Set()
  let total = 0; let duplicates = 0; let verifiedDistricts = 0; let manualOrMissingDistricts = 0
  for (let offset = 0; ; offset += 1000) {
    const endpoint = `${base.replace(/\/$/, '')}/rest/v1/philippine_schools?select=school_id,school_name,region_name,division_name,district_verified_at&order=school_id.asc&offset=${offset}&limit=1000`
    const response = await fetch(endpoint, { headers: { apikey: apiKey, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`Directory audit read failed: HTTP ${response.status}. No records were modified.`)
    const rows = await response.json()
    for (const row of rows) {
      total++; if (ids.has(row.school_id)) duplicates++; ids.add(row.school_id)
      regions.set(row.region_name, (regions.get(row.region_name) ?? 0) + 1)
      const division = `${row.region_name} / ${row.division_name}`; divisions.set(division, (divisions.get(division) ?? 0) + 1)
      const initial = row.school_name?.trim().charAt(0).toUpperCase() || '[blank]'; initials.set(initial, (initials.get(initial) ?? 0) + 1)
      if (row.district_verified_at) verifiedDistricts++; else manualOrMissingDistricts++
    }
    if (rows.length < 1000) break
  }
  console.log(JSON.stringify({ scope: process.env.SCHOOL_AUDIT_USER_JWT ? 'teacher-RLS-visible active directory' : 'backend-authorized directory', total, duplicates, verifiedDistricts, manualOrMissingDistricts, regions: Object.fromEntries([...regions].sort()), divisions: Object.fromEntries([...divisions].sort()), alphabeticalCoverage: Object.fromEntries([...initials].sort()) }, null, 2))
}
