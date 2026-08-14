#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  extractAmbiguousCandidateSummary,
  promoteCandidates,
  revertCandidatePromotion,
  validateCandidatePayload,
  validateVerifiedDistrictPayload,
} from '../../src/lib/districtReconciliation.ts'

function usage() {
  console.log(`Usage:
  node scripts/schools/promote-district-candidates.mjs [options]

Options:
  --candidate <path>      Path to candidate JSON (e.g. data/schools/district-candidates/camarines-norte.json)
  --out-verified <path>   Path to output verified JSON (e.g. data/schools/verified-districts/camarines-norte.json)
  --school-id <id>        Promote specific School ID (can be specified multiple times)
  --all-single            Promote all non-ambiguous single-match candidate records
  --reviewer <name>       Reviewer identity / email / maintainer tag (REQUIRED for promotion)
  --basis <text>          Documented verification basis / rationale (REQUIRED for promotion)
  --allow-ambiguous       Allow promotion of ambiguous duplicate-name candidate (requires explicit override note)
  --override-note <text>  Disambiguation note for ambiguous candidate
  --revert                Revert previously promoted candidate(s) back to unverified state
  --audit                 Print ambiguous duplicate-name audit report and exit
  --help                  Show this help

Safety Rules:
- Ambiguous duplicate-name cases are BLOCKED from automatic promotion.
- Reviewer identity and verification basis are MANDATORY for promotion.
- Promotion is auditable and reversible.
`)
}

function parseArgs(argv) {
  const options = {
    candidatePath: '',
    outVerifiedPath: '',
    schoolIds: [],
    allSingle: false,
    reviewer: '',
    basis: '',
    allowAmbiguous: false,
    overrideNote: '',
    revert: false,
    audit: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help') options.help = true
    else if (arg === '--candidate') options.candidatePath = argv[++i]
    else if (arg === '--out-verified') options.outVerifiedPath = argv[++i]
    else if (arg === '--school-id') options.schoolIds.push(argv[++i])
    else if (arg === '--all-single') options.allSingle = true
    else if (arg === '--reviewer') options.reviewer = argv[++i]
    else if (arg === '--basis') options.basis = argv[++i]
    else if (arg === '--allow-ambiguous') options.allowAmbiguous = true
    else if (arg === '--override-note') options.overrideNote = argv[++i]
    else if (arg === '--revert') options.revert = true
    else if (arg === '--audit') options.audit = true
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help || !options.candidatePath) {
    usage()
    process.exit(options.help ? 0 : 1)
  }

  const candidateRaw = JSON.parse(await readFile(options.candidatePath, 'utf8'))
  validateCandidatePayload(candidateRaw)

  if (options.audit) {
    const clusters = extractAmbiguousCandidateSummary(candidateRaw)
    console.log(`=== Ambiguous Duplicate-Name Audit for ${candidateRaw.divisionName} ===`)
    console.log(`Total duplicate clusters: ${clusters.length}`)
    console.log(`Total affected schools: ${clusters.reduce((acc, c) => acc + c.schoolIds.length, 0)}\n`)
    clusters.forEach((c, idx) => {
      console.log(`${idx + 1}. School Name: "${c.schoolName}"`)
      console.log(`   Candidate District: ${c.candidateDistrict ?? '(none)'}`)
      console.log(`   School IDs: [ ${c.schoolIds.join(', ')} ] (${c.schoolIds.length} schools)`)
      console.log(`   Safety Blocker: ${c.reason}\n`)
    })
    return
  }

  if (options.revert) {
    if (options.schoolIds.length === 0) {
      throw new Error('--revert requires at least one --school-id.')
    }
    const revertedDataset = revertCandidatePromotion({
      dataset: candidateRaw,
      schoolIds: options.schoolIds,
    })
    validateCandidatePayload(revertedDataset)
    await writeFile(options.candidatePath, `${JSON.stringify(revertedDataset, null, 2)}\n`, 'utf8')
    console.log(`✓ Reverted ${options.schoolIds.length} candidate(s) to unverified state in ${options.candidatePath}`)
    return
  }

  let targetIds = [...options.schoolIds]
  if (options.allSingle) {
    const singleMatches = candidateRaw.records
      .filter((r) => r.reviewState === 'unverified_candidate' && r.confidence === 'high_single_match')
      .map((r) => r.schoolId)
    targetIds = [...new Set([...targetIds, ...singleMatches])]
  }

  if (targetIds.length === 0) {
    throw new Error('No target School IDs specified. Use --school-id <id> or --all-single.')
  }

  if (!options.reviewer || !options.basis) {
    throw new Error('Promotion requires both --reviewer <name> and --basis <rationale>.')
  }

  const overrideNotes = {}
  if (options.overrideNote && options.schoolIds.length > 0) {
    options.schoolIds.forEach((id) => {
      overrideNotes[id] = options.overrideNote
    })
  }

  const { updatedDataset, verifiedPayload, promotedRecords } = promoteCandidates({
    dataset: candidateRaw,
    schoolIds: targetIds,
    reviewer: options.reviewer,
    verificationBasis: options.basis,
    allowAmbiguousOverride: options.allowAmbiguous,
    overrideNotes,
  })

  validateCandidatePayload(updatedDataset)
  validateVerifiedDistrictPayload(verifiedPayload)

  await writeFile(options.candidatePath, `${JSON.stringify(updatedDataset, null, 2)}\n`, 'utf8')
  console.log(`✓ Updated candidate dataset: ${options.candidatePath} (${promotedRecords.length} record(s) marked promoted)`)

  if (options.outVerifiedPath) {
    const outTarget = resolve(options.outVerifiedPath)
    await mkdir(dirname(outTarget), { recursive: true })
    await writeFile(outTarget, `${JSON.stringify(verifiedPayload, null, 2)}\n`, 'utf8')
    console.log(`✓ Wrote verified mapping payload: ${outTarget} (${verifiedPayload.records.length} records ready for import)`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
