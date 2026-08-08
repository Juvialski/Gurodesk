import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const paths = process.argv.slice(2)
if (!paths.length) {
  console.error('Usage: node scripts/validate-curriculum.mjs <manifest.json> [...]')
  process.exit(2)
}

const failures = []

function fail(file, message) {
  failures.push(`${file}: ${message}`)
}

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

for (const input of paths) {
  const file = resolve(input)
  let manifest
  try {
    manifest = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    fail(input, `cannot parse JSON (${error instanceof Error ? error.message : String(error)})`)
    continue
  }

  if (manifest.schemaVersion !== 1) fail(input, 'schemaVersion must be 1')
  if (!manifest.slug) fail(input, 'slug is required')
  if (manifest.verification?.status !== 'verified') fail(input, 'manifest verification.status must be verified before import')

  const sourceUrl = manifest.source?.sourceUrl
  if (!sourceUrl) {
    fail(input, 'source.sourceUrl is required for curriculum manifests')
  } else {
    try {
      const url = new URL(sourceUrl)
      if (url.protocol !== 'https:') fail(input, 'source URL must use HTTPS')
      if (!(url.hostname === 'deped.gov.ph' || url.hostname.endsWith('.deped.gov.ph'))) {
        fail(input, `source URL must be an official deped.gov.ph host, got ${url.hostname}`)
      }
    } catch {
      fail(input, 'source.sourceUrl is not a valid URL')
    }
  }

  const version = manifest.curriculumVersion ?? {}
  for (const field of ['code', 'name', 'framework', 'effectiveFromSchoolYear', 'status']) {
    if (!version[field]) fail(input, `curriculumVersion.${field} is required`)
  }
  if (!['active', 'superseded'].includes(version.status)) {
    fail(input, 'curriculumVersion.status must be active or superseded for a verified import')
  }

  const subject = manifest.subject ?? {}
  for (const field of ['gradeLevel', 'name']) {
    if (!subject[field]) fail(input, `subject.${field} is required`)
  }

  const periods = Array.isArray(manifest.periods) ? manifest.periods : []
  if (!periods.length) fail(input, 'at least one curriculum period is required')
  const periodSequences = new Set()
  const periodLabels = new Set()
  for (const period of periods) {
    if (!Number.isInteger(period.sequence) || period.sequence <= 0) fail(input, `invalid period sequence: ${period.sequence}`)
    if (!['term', 'quarter', 'semester', 'year'].includes(period.periodType)) fail(input, `invalid period type: ${period.periodType}`)
    if (periodSequences.has(period.sequence)) fail(input, `duplicate period sequence ${period.sequence}`)
    if (periodLabels.has(normalize(period.label))) fail(input, `duplicate period label ${period.label}`)
    periodSequences.add(period.sequence)
    periodLabels.add(normalize(period.label))
  }

  const domains = Array.isArray(manifest.domains) ? manifest.domains : []
  const domainCodes = new Set()
  for (const domain of domains) {
    if (!domain.code || !domain.name) fail(input, 'every domain needs code and name')
    if (domainCodes.has(domain.code)) fail(input, `duplicate domain code ${domain.code}`)
    domainCodes.add(domain.code)
  }

  const competencies = Array.isArray(manifest.competencies) ? manifest.competencies : []
  if (!competencies.length) fail(input, 'at least one competency is required')
  const duplicateText = new Set()
  const perPeriodOrders = new Map()
  for (const competency of competencies) {
    if (!periodSequences.has(competency.quarter)) fail(input, `competency uses unknown period/quarter ${competency.quarter}`)
    if (!domainCodes.has(competency.domain)) fail(input, `competency uses unknown domain ${competency.domain}`)
    if (!competency.text?.trim()) fail(input, 'competency text cannot be empty')
    if (competency.verificationStatus !== 'verified') fail(input, 'all imported competencies must be verified')
    if (!Number.isInteger(competency.sourcePage) || competency.sourcePage <= 0) fail(input, `invalid source page for competency: ${competency.text}`)
    if (!Number.isInteger(competency.sortOrder) || competency.sortOrder <= 0) fail(input, `invalid sort order for competency: ${competency.text}`)

    const key = `${competency.quarter}:${normalize(competency.text)}`
    if (duplicateText.has(key)) fail(input, `duplicate competency text in period ${competency.quarter}: ${competency.text}`)
    duplicateText.add(key)

    const orders = perPeriodOrders.get(competency.quarter) ?? []
    orders.push(competency.sortOrder)
    perPeriodOrders.set(competency.quarter, orders)
  }

  for (const [period, orders] of perPeriodOrders) {
    const sorted = [...orders].sort((a, b) => a - b)
    const expected = Array.from({ length: sorted.length }, (_, index) => index + 1)
    if (sorted.join(',') !== expected.join(',')) {
      fail(input, `sortOrder values for period ${period} must be contiguous from 1; got ${sorted.join(', ')}`)
    }
  }

  const standards = Array.isArray(manifest.performanceStandards) ? manifest.performanceStandards : []
  for (const standard of standards) {
    if (!periodSequences.has(standard.quarter)) fail(input, `performance standard uses unknown period ${standard.quarter}`)
    if (!standard.text?.trim()) fail(input, 'performance standard text cannot be empty')
    if (!Number.isInteger(standard.sourcePage) || standard.sourcePage <= 0) fail(input, 'performance standard sourcePage must be a positive integer')
  }

  const applicability = Array.isArray(manifest.applicability) ? manifest.applicability : []
  if (!applicability.length) fail(input, 'at least one applicability record is required')
  const applicabilityKeys = new Set()
  for (const item of applicability) {
    if (!item.schoolYear || !item.gradeLevel || !item.implementationStatus) fail(input, 'applicability requires schoolYear, gradeLevel, and implementationStatus')
    if (!['full', 'pilot', 'transitional', 'legacy'].includes(item.implementationStatus)) fail(input, `invalid applicability status ${item.implementationStatus}`)
    const key = `${item.schoolYear}:${item.gradeLevel}:${item.implementationStatus}`
    if (applicabilityKeys.has(key)) fail(input, `duplicate applicability ${key}`)
    applicabilityKeys.add(key)
  }

  if (!failures.some((item) => item.startsWith(`${input}:`))) {
    console.log(`✓ ${input}: ${competencies.length} verified competencies, ${periods.length} periods, ${domains.length} domains`)
  }
}

if (failures.length) {
  console.error('\nCurriculum validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nAll curriculum manifests passed validation.')
