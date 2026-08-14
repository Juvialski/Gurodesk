#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function usage() {
  console.log(`Usage:
  node scripts/schools/import-verified-districts.mjs <mapping.json> [--sync]

JSON shape:
{
  "sourceName": "DepEd Schools Division of ...",
  "sourceUrl": "https://...",
  "verificationMethod": "explicit_school_id",
  "records": [
    { "schoolId": "123456", "districtName": "District I", "districtCode": null }
  ]
}

Rules:
- source must be an HTTPS official-government/DepEd page selected and reviewed by the maintainer;
- every row must explicitly contain the DepEd School ID from that source;
- name-only, municipality-based, or fuzzy matching is intentionally rejected;
- --sync requires backend-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
`)
}

function parseArgs(argv) {
  const args = [...argv]
  const sync = args.includes('--sync')
  const positional = args.filter((arg) => arg !== '--sync')
  if (positional.length !== 1) {
    usage()
    process.exit(positional.includes('--help') ? 0 : 1)
  }
  return { path: positional[0], sync }
}

function clean(value) {
  return String(value ?? '').trim()
}

export function validatePayload(payload) {
  const errors = []
  const sourceName = clean(payload.sourceName)
  const sourceUrl = clean(payload.sourceUrl)
  const method = clean(payload.verificationMethod)

  if (!sourceName) errors.push('sourceName is required.')
  if (!/^https:\/\//i.test(sourceUrl)) errors.push('sourceUrl must be HTTPS.')
  
  // Must be official DepEd or Gov domain
  const isOfficialDomain = /^https:\/\/(?:[a-zA-Z0-9-]+\.)*(?:deped\.gov\.ph|gov\.ph|deped[a-zA-Z0-9-]*\.ph)(?:\/|$)/i.test(sourceUrl)
  if (!isOfficialDomain) {
    errors.push(`sourceUrl "${sourceUrl}" is not recognized as an official DepEd or Philippine Government domain.`)
  }

  if (method !== 'explicit_school_id') {
    errors.push('verificationMethod must be "explicit_school_id"; name-only/fuzzy joins are not accepted as verified.')
  }
  if (!Array.isArray(payload.records) || payload.records.length === 0) {
    errors.push('records must be a non-empty array.')
  }

  const ids = new Set()
  for (const [index, raw] of (payload.records ?? []).entries()) {
    const schoolId = clean(raw.schoolId)
    const districtName = clean(raw.districtName)
    if (!/^\d{5,8}$/.test(schoolId)) errors.push(`Row ${index + 1}: invalid School ID ${schoolId || '(blank)'}.`)
    if (!districtName) errors.push(`Row ${index + 1}: districtName is required.`)
    if (ids.has(schoolId)) errors.push(`Duplicate School ID ${schoolId}.`)
    ids.add(schoolId)
  }

  if (errors.length) throw new Error(`District mapping validation failed:\n- ${errors.join('\n- ')}`)

  return {
    sourceName,
    sourceUrl,
    records: payload.records.map((raw) => ({
      schoolId: clean(raw.schoolId),
      districtName: clean(raw.districtName),
      districtCode: clean(raw.districtCode) || null,
    })),
  }
}

async function syncToSupabase(mapping) {
  const url = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    throw new Error('--sync requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in a backend-only environment.')
  }

  const base = url.replace(/\/$/, '')
  const checkedAt = new Date().toISOString()

  for (const [index, record] of mapping.records.entries()) {
    const select = await fetch(
      `${base}/rest/v1/philippine_schools?school_id=eq.${encodeURIComponent(record.schoolId)}&select=id,school_id,school_name,division_name`,
      {
        headers: {
          apikey: serviceRole,
          authorization: `Bearer ${serviceRole}`,
          accept: 'application/json',
        },
      },
    )
    if (!select.ok) throw new Error(`Unable to verify School ID ${record.schoolId}: HTTP ${select.status} ${await select.text()}`)
    const matches = await select.json()
    if (!Array.isArray(matches) || matches.length !== 1) {
      throw new Error(`School ID ${record.schoolId} does not resolve to exactly one existing GuroDesk school record.`)
    }

    const update = await fetch(
      `${base}/rest/v1/philippine_schools?school_id=eq.${encodeURIComponent(record.schoolId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceRole,
          authorization: `Bearer ${serviceRole}`,
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        body: JSON.stringify({
          district_code: record.districtCode,
          district_name: record.districtName,
          district_source_name: mapping.sourceName,
          district_source_url: mapping.sourceUrl,
          district_verified_at: checkedAt,
        }),
      },
    )
    if (!update.ok) {
      throw new Error(`Unable to update School ID ${record.schoolId}: HTTP ${update.status} ${await update.text()}`)
    }

    if ((index + 1) % 50 === 0 || index + 1 === mapping.records.length) {
      console.log(`Verified district mappings: ${index + 1} / ${mapping.records.length}`)
    }
  }
}

async function main() {
  const { path, sync } = parseArgs(process.argv.slice(2))
  const payload = JSON.parse(await readFile(path, 'utf8'))
  const mapping = validatePayload(payload)

  console.log(`✓ ${mapping.records.length} explicit School ID → District mapping(s) validated`)
  console.log(`Source: ${mapping.sourceName}`)
  console.log(`URL: ${mapping.sourceUrl}`)

  if (!sync) {
    console.log('Validation only. Re-run with --sync in a backend-only environment to update Supabase.')
    return
  }

  await syncToSupabase(mapping)
  console.log('✓ Verified district mappings synced to philippine_schools.')
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error)
    process.exit(1)
  })
}
