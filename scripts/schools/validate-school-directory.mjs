#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

const path = process.argv[2] ?? 'data/schools/philippine-schools.sample.json'
const minIndex = process.argv.indexOf('--min')
const minimum = minIndex >= 0 ? Number(process.argv[minIndex + 1]) : 1

function fail(message) {
  console.error(`School directory validation failed: ${message}`)
  process.exit(1)
}

let parsed
try {
  parsed = JSON.parse(await readFile(path, 'utf8'))
} catch (error) {
  fail(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
}

const schools = Array.isArray(parsed) ? parsed : parsed.schools
if (!Array.isArray(schools)) fail('Expected a JSON array or an object with a schools array.')
if (!Number.isFinite(minimum) || minimum < 1) fail('--min must be a positive number.')
if (schools.length < minimum) fail(`Expected at least ${minimum} records, found ${schools.length}.`)

const ids = new Set()
for (const [index, school] of schools.entries()) {
  const label = `record ${index + 1}`
  if (!/^\d{5,8}$/.test(String(school.schoolId ?? ''))) fail(`${label} has an invalid schoolId.`)
  if (!String(school.schoolName ?? '').trim()) fail(`${label} is missing schoolName.`)
  if (!String(school.regionName ?? '').trim()) fail(`${label} is missing regionName.`)
  if (!String(school.divisionName ?? '').trim()) fail(`${label} is missing divisionName.`)
  if (ids.has(String(school.schoolId))) fail(`Duplicate School ID ${school.schoolId}.`)
  ids.add(String(school.schoolId))
}

if (parsed?.sample === true && schools.length > 100) fail('A sample file should remain small; use the generated directory for production sync.')
console.log(`✓ School directory data valid: ${schools.length} unique records in ${path}${parsed?.sample ? ' (sample only)' : ''}`)
