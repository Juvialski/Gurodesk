#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { validateCandidatePayload } from '../../src/lib/districtReconciliation.ts'

export { validateCandidatePayload }

async function main() {
  const paths = process.argv.slice(2)
  if (paths.length === 0) {
    console.log('Usage: node scripts/schools/validate-district-candidates.mjs <file1.json> [file2.json...]')
    process.exit(1)
  }

  for (const path of paths) {
    const raw = JSON.parse(await readFile(path, 'utf8'))
    validateCandidatePayload(raw)
    console.log(`✓ Candidate dataset passed strict validation: ${path} (${raw.records.length} records, status: ${raw.verifiedStatus})`)
  }
}

if (process.argv[1] && process.argv[1].endsWith('validate-district-candidates.mjs')) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
