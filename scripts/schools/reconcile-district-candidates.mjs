#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  reconcileDistrictCandidates,
  validateCandidatePayload,
} from '../../src/lib/districtReconciliation.ts'

export { reconcileDistrictCandidates as reconcileSchools }

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

  const reconciled = reconcileDistrictCandidates({
    divisionName: 'Camarines Norte',
    regionName: 'Region V',
    sourceName: 'DepEd Schools Division of Camarines Norte',
    sourceUrl: 'https://web.depedcamnorte.ph/page/schools',
    nidSchools,
    sdoSchools,
  })

  validateCandidatePayload(reconciled)

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
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
