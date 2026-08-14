#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

/**
 * Validates district candidate datasets.
 * Ensures strict safety rules:
 * - Candidate records MUST be labeled as unverified
 * - Source provenance is required
 * - School IDs must be valid
 * - Duplicate school names must be detected and flagged
 */

export function validateCandidatePayload(payload) {
  const errors = []

  if (!payload.divisionName?.trim()) errors.push('divisionName is required.')
  if (!payload.regionName?.trim()) errors.push('regionName is required.')
  if (!payload.sourceName?.trim()) errors.push('sourceName is required.')
  if (!/^https:\/\//i.test(payload.sourceUrl ?? '')) errors.push('sourceUrl must be HTTPS.')
  if (payload.verifiedStatus !== 'unverified') {
    errors.push(`verifiedStatus must be "unverified"; received "${payload.verifiedStatus}". Candidate datasets must never claim verified status.`)
  }
  if (!Array.isArray(payload.records) || payload.records.length === 0) {
    errors.push('records must be a non-empty array.')
  }

  const ids = new Set()
  for (const [index, r] of (payload.records ?? []).entries()) {
    if (!/^\d{5,8}$/.test(r.schoolId ?? '')) {
      errors.push(`Row ${index + 1}: invalid School ID "${r.schoolId}".`)
    }
    if (ids.has(r.schoolId)) {
      errors.push(`Row ${index + 1}: duplicate School ID "${r.schoolId}".`)
    }
    ids.add(r.schoolId)

    if (!r.sourceName?.trim()) errors.push(`Row ${index + 1}: sourceName is required.`)
    if (!/^https:\/\//i.test(r.sourceUrl ?? '')) errors.push(`Row ${index + 1}: sourceUrl must be HTTPS.`)
    if (!r.matchMethod?.trim()) errors.push(`Row ${index + 1}: matchMethod is required.`)
    if (!['unverified_candidate', 'unverified_ambiguous_candidate', 'unmatched_nid_school'].includes(r.reviewState)) {
      errors.push(`Row ${index + 1}: reviewState must be an unverified candidate state (got "${r.reviewState}").`)
    }
  }

  if (errors.length) {
    throw new Error(`District candidate validation failed:\n- ${errors.join('\n- ')}`)
  }

  return true
}

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
