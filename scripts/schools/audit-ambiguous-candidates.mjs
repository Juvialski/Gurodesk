#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import {
  extractAmbiguousCandidateSummary,
  validateCandidatePayload,
} from '../../src/lib/districtReconciliation.ts'

async function main() {
  const paths = process.argv.slice(2)
  if (paths.length === 0) {
    console.log('Usage: node scripts/schools/audit-ambiguous-candidates.mjs <candidate.json>')
    process.exit(1)
  }

  for (const path of paths) {
    const raw = JSON.parse(await readFile(path, 'utf8'))
    validateCandidatePayload(raw)
    const clusters = extractAmbiguousCandidateSummary(raw)

    console.log(`\n==================================================`)
    console.log(`AMBIGUOUS CANDIDATE AUDIT: ${raw.divisionName} (${raw.regionName})`)
    console.log(`Source: ${raw.sourceName} (${raw.sourceUrl})`)
    console.log(`Total ambiguous duplicate clusters: ${clusters.length}`)
    console.log(`Total affected schools: ${clusters.reduce((acc, c) => acc + c.schoolIds.length, 0)}`)
    console.log(`==================================================\n`)

    clusters.forEach((c, idx) => {
      console.log(`Cluster ${idx + 1}: "${c.schoolName}"`)
      console.log(`  Candidate District: ${c.candidateDistrict ?? 'N/A'}`)
      console.log(`  School IDs (${c.schoolIds.length}): ${c.schoolIds.join(', ')}`)
      console.log(`  Reason: ${c.reason}\n`)
    })
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
