#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

/**
 * Reconciles an official SDO School Name -> District directory against
 * canonical DepEd NID records to generate an auditable unverified candidate dataset.
 *
 * STRICT RULE: Candidate matches are NEVER marked as verified and MUST NOT
 * be written into philippine_schools.district_name.
 */

function normalizeName(name) {
  return String(name ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function reconcileSchools({
  divisionName,
  regionName,
  sourceName,
  sourceUrl,
  sourceLastCheckedAt = new Date().toISOString(),
  nidSchools,
  sdoSchools,
}) {
  if (!divisionName || !regionName) throw new Error('divisionName and regionName are required.')
  if (!sourceName || !sourceUrl) throw new Error('sourceName and sourceUrl are required.')
  if (!Array.isArray(nidSchools) || nidSchools.length === 0) throw new Error('nidSchools must be non-empty.')
  if (!Array.isArray(sdoSchools) || sdoSchools.length === 0) throw new Error('sdoSchools must be non-empty.')

  // Group NID schools by normalized name
  const nidByName = new Map()
  for (const s of nidSchools) {
    const k = normalizeName(s.schoolName)
    if (!nidByName.has(k)) nidByName.set(k, [])
    nidByName.get(k).push(s)
  }

  // Group SDO schools by normalized name
  const sdoByName = new Map()
  for (const s of sdoSchools) {
    const k = normalizeName(s.schoolName)
    if (!sdoByName.has(k)) sdoByName.set(k, [])
    sdoByName.get(k).push(s)
  }

  const records = []
  let singleMatches = 0
  let ambiguousMatches = 0
  let unmatchedNidCount = 0

  for (const nidSchool of nidSchools) {
    const k = normalizeName(nidSchool.schoolName)
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

  // Sort records deterministically by schoolId
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

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.length < 3) {
    console.log(`Usage: node scripts/schools/reconcile-district-candidates.mjs <nid.json> <sdo.json> <out.json> [options]`)
    process.exit(args.includes('--help') ? 0 : 1)
  }

  const [nidPath, sdoPath, outPath] = args
  const nidRaw = JSON.parse(await readFile(nidPath, 'utf8'))
  const sdoRaw = JSON.parse(await readFile(sdoPath, 'utf8'))

  const nidSchools = Array.isArray(nidRaw) ? nidRaw : (nidRaw.schools ?? [])
  const sdoSchools = Array.isArray(sdoRaw) ? sdoRaw : (sdoRaw.schools ?? [])

  const reconciled = reconcileSchools({
    divisionName: 'Camarines Norte',
    regionName: 'Region V',
    sourceName: 'DepEd Schools Division of Camarines Norte',
    sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
    nidSchools,
    sdoSchools,
  })

  const target = resolve(outPath)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(reconciled, null, 2)}\n`, 'utf8')
  console.log(`✓ Generated unverified district candidate dataset: ${target}`)
  console.log(`- NID Schools: ${reconciled.summary.nidSchoolCount}`)
  console.log(`- SDO Schools: ${reconciled.summary.sdoSchoolCount}`)
  console.log(`- Single Candidates: ${reconciled.summary.candidateMatches}`)
  console.log(`- Ambiguous Duplicate Name Candidates: ${reconciled.summary.ambiguousDuplicateNames}`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
