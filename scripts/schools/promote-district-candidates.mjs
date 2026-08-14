#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  extractAmbiguousCandidateSummary,
  markCandidatesReviewed,
  promoteCandidateToVerified,
  revertCandidateStatus,
  validateCandidatePayload,
  validateVerifiedDistrictPayload,
} from '../../src/lib/districtReconciliation.ts'

function usage() {
  console.log(`Usage:
  node scripts/schools/promote-district-candidates.mjs [action] [options]

Actions:
  --verify-school         Promote a SINGLE School ID to verified using explicit School ID evidence
  --review-school         Mark a candidate record as human-reviewed (STILL UNVERIFIED)
  --all-single-reviewed   Mark all non-ambiguous single-match candidate records as reviewed (STILL UNVERIFIED)
  --revert                Revert reviewed/verified status back to unverified candidate
  --audit                 Print ambiguous duplicate-name audit report

Options for --verify-school (ALL REQUIRED FOR VERIFICATION):
  --candidate <path>            Path to candidate JSON
  --school-id <id>              DepEd School ID to verify
  --district-name <name>        Official verified district name
  --district-code <code>        Optional official district code
  --evidence-source-name <str>  Name of explicit School ID source/document
  --evidence-source-url <url>   HTTPS URL of explicit School ID source
  --evidence-type <type>        "explicit_official_school_id_district" OR
                                "manual_document_review_with_explicit_school_id"
  --reviewer <name>             Reviewer identity / maintainer ID
  --note <text>                 Documented verification rationale
  --out-verified <path>         Optional path to write/append verified mapping JSON

Options for --review-school / --all-single-reviewed:
  --candidate <path>            Path to candidate JSON
  --school-id <id>              School ID (for --review-school)
  --reviewer <name>             Reviewer identity (REQUIRED)
  --note <text>                 Review notes / rationale (REQUIRED)

Safety Rules:
- Bulk promotion to verified is STRICTLY DISABLED.
- Exact-name matching alone is NEVER marked verified.
- Explicit School ID evidence is MANDATORY for verification.
`)
}

function parseArgs(argv) {
  const options = {
    action: '',
    candidatePath: '',
    outVerifiedPath: '',
    schoolId: '',
    districtName: '',
    districtCode: null,
    evidenceSourceName: '',
    evidenceSourceUrl: '',
    evidenceType: '',
    reviewer: '',
    note: '',
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help') options.help = true
    else if (arg === '--verify-school') options.action = 'verify'
    else if (arg === '--review-school') options.action = 'review'
    else if (arg === '--all-single-reviewed') options.action = 'all-single-reviewed'
    else if (arg === '--revert') options.action = 'revert'
    else if (arg === '--audit') options.action = 'audit'
    else if (arg === '--candidate') options.candidatePath = argv[++i]
    else if (arg === '--out-verified') options.outVerifiedPath = argv[++i]
    else if (arg === '--school-id') options.schoolId = argv[++i]
    else if (arg === '--district-name') options.districtName = argv[++i]
    else if (arg === '--district-code') options.districtCode = argv[++i]
    else if (arg === '--evidence-source-name') options.evidenceSourceName = argv[++i]
    else if (arg === '--evidence-source-url') options.evidenceSourceUrl = argv[++i]
    else if (arg === '--evidence-type') options.evidenceType = argv[++i]
    else if (arg === '--reviewer') options.reviewer = argv[++i]
    else if (arg === '--note') options.note = argv[++i]
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

  if (options.action === 'audit' || (!options.action && !options.schoolId)) {
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

  if (options.action === 'revert') {
    if (!options.schoolId) throw new Error('--revert requires --school-id <id>.')
    const revertedDataset = revertCandidateStatus({
      dataset: candidateRaw,
      schoolIds: [options.schoolId],
    })
    validateCandidatePayload(revertedDataset)
    await writeFile(options.candidatePath, `${JSON.stringify(revertedDataset, null, 2)}\n`, 'utf8')
    console.log(`✓ Reverted School ID ${options.schoolId} to unverified candidate state in ${options.candidatePath}`)
    return
  }

  if (options.action === 'all-single-reviewed') {
    if (!options.reviewer || !options.note) {
      throw new Error('--all-single-reviewed requires both --reviewer <name> and --note <text>.')
    }
    const singleMatches = candidateRaw.records
      .filter((r) => r.reviewState === 'unverified_candidate' && r.confidence === 'high_single_match')
      .map((r) => r.schoolId)

    const { updatedDataset, reviewedRecords } = markCandidatesReviewed({
      dataset: candidateRaw,
      schoolIds: singleMatches,
      reviewedBy: options.reviewer,
      reviewNotes: options.note,
    })

    validateCandidatePayload(updatedDataset)
    await writeFile(options.candidatePath, `${JSON.stringify(updatedDataset, null, 2)}\n`, 'utf8')
    console.log(`✓ Marked ${reviewedRecords.length} single-match candidate(s) as REVIEWED (remains UNVERIFIED) in ${options.candidatePath}`)
    return
  }

  if (options.action === 'review') {
    if (!options.schoolId) throw new Error('--review-school requires --school-id <id>.')
    if (!options.reviewer || !options.note) {
      throw new Error('--review-school requires both --reviewer <name> and --note <text>.')
    }

    const { updatedDataset, reviewedRecords } = markCandidatesReviewed({
      dataset: candidateRaw,
      schoolIds: [options.schoolId],
      reviewedBy: options.reviewer,
      reviewNotes: options.note,
    })

    validateCandidatePayload(updatedDataset)
    await writeFile(options.candidatePath, `${JSON.stringify(updatedDataset, null, 2)}\n`, 'utf8')
    console.log(`✓ Marked School ID ${options.schoolId} as REVIEWED (remains UNVERIFIED) in ${options.candidatePath}`)
    return
  }

  if (options.action === 'verify') {
    if (!options.schoolId) throw new Error('--verify-school requires --school-id <id>.')
    if (!options.districtName) throw new Error('--verify-school requires --district-name <name>.')
    if (!options.evidenceSourceName) throw new Error('--verify-school requires --evidence-source-name <str>.')
    if (!options.evidenceSourceUrl) throw new Error('--verify-school requires --evidence-source-url <url>.')
    if (!options.evidenceType) {
      throw new Error(
        '--verify-school requires --evidence-type ("explicit_official_school_id_district" or "manual_document_review_with_explicit_school_id").',
      )
    }
    if (!options.reviewer) throw new Error('--verify-school requires --reviewer <name>.')
    if (!options.note) throw new Error('--verify-school requires --note <text>.')

    const { updatedDataset, verifiedRecord, verifiedPayload } = promoteCandidateToVerified({
      dataset: candidateRaw,
      schoolId: options.schoolId,
      districtName: options.districtName,
      districtCode: options.districtCode,
      evidenceSourceName: options.evidenceSourceName,
      evidenceSourceUrl: options.evidenceSourceUrl,
      evidenceType: options.evidenceType,
      reviewedBy: options.reviewer,
      verificationNote: options.note,
    })

    validateCandidatePayload(updatedDataset)
    validateVerifiedDistrictPayload(verifiedPayload)

    await writeFile(options.candidatePath, `${JSON.stringify(updatedDataset, null, 2)}\n`, 'utf8')
    console.log(`✓ Promoted School ID ${options.schoolId} to VERIFIED in candidate dataset: ${options.candidatePath}`)

    if (options.outVerifiedPath) {
      const outTarget = resolve(options.outVerifiedPath)
      await mkdir(dirname(outTarget), { recursive: true })
      await writeFile(outTarget, `${JSON.stringify(verifiedPayload, null, 2)}\n`, 'utf8')
      console.log(`✓ Wrote verified mapping payload: ${outTarget} (1 record ready for import-verified-districts)`)
    }
    return
  }

  usage()
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
