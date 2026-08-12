import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const paths = process.argv.slice(2)
if (!paths.length) {
  console.error('Usage: node scripts/validate-curriculum.mjs <manifest.json> [...]')
  process.exit(2)
}

const failures = []
let manifestCount = 0
let competencyCount = 0

function fail(file, message) {
  failures.push(`${file}: ${message}`)
}

function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').trim().replace(/\s+/gu, ' ').toLowerCase()
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex')
}

function hasConsecutiveDuplicatePhrase(value) {
  const tokens = [...String(value).toLowerCase().matchAll(/[\p{L}\p{N}’'-]+/gu)].map((match) => match[0])
  for (let size = Math.min(40, Math.floor(tokens.length / 2)); size >= 5; size -= 1) {
    for (let index = 0; index + (2 * size) <= tokens.length; index += 1) {
      if (tokens.slice(index, index + size).every((token, offset) => token === tokens[index + size + offset])) return true
    }
  }
  return false
}

function officialLandingUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    if (url.hostname === 'deped.gov.ph' || url.hostname.endsWith('.deped.gov.ph')) return true
    return url.hostname === 'sites.google.com' && url.pathname.startsWith('/deped.gov.ph/')
  } catch {
    return false
  }
}

function trustedSourceUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    return url.hostname === 'depedph-my.sharepoint.com'
      || url.hostname === 'drive.google.com'
      || url.hostname === 'deped.gov.ph'
      || url.hostname.endsWith('.deped.gov.ph')
  } catch {
    return false
  }
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

  manifestCount += 1
  if (manifest.schemaVersion !== 2) fail(input, 'schemaVersion must be 2')
  if (!manifest.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(manifest.slug)) fail(input, 'slug must be a lowercase kebab-case identifier')
  if (manifest.verification?.status !== 'verified') fail(input, 'verification.status must be verified')
  if (!manifest.verification?.verifiedOn || !manifest.verification?.method || !manifest.verification?.notes) {
    fail(input, 'verifiedOn, method, and notes are required')
  }

  const source = manifest.source ?? {}
  for (const field of ['sourceType', 'title', 'sourceUrl', 'landingPageUrl', 'publisher', 'fileName', 'fileId', 'sha256', 'retrievedOn']) {
    if (!source[field]) fail(input, `source.${field} is required`)
  }
  if (source.sourceType !== 'curriculum_guide') fail(input, 'source.sourceType must be curriculum_guide')
  if (source.publisher !== 'Department of Education') fail(input, 'source.publisher must be Department of Education')
  if (!trustedSourceUrl(source.sourceUrl)) fail(input, `source.sourceUrl is not a trusted official/institutional source: ${source.sourceUrl}`)
  if (!officialLandingUrl(source.landingPageUrl)) fail(input, `source.landingPageUrl is not an official DepEd page: ${source.landingPageUrl}`)
  if (!source.edition && !source.publishedOn) fail(input, 'source.edition or source.publishedOn is required')
  if (!/^[a-f0-9]{64}$/u.test(source.sha256 ?? '')) fail(input, 'source.sha256 must be a lowercase SHA-256 digest')
  if (!Number.isInteger(source.byteSize) || source.byteSize <= 0) fail(input, 'source.byteSize must be a positive integer')
  if (!Number.isInteger(source.pageCount) || source.pageCount <= 0) fail(input, 'source.pageCount must be a positive integer')
  if (source.retrievedOn !== manifest.verification?.verifiedOn) fail(input, 'source.retrievedOn must match verification.verifiedOn')

  const version = manifest.curriculumVersion ?? {}
  for (const field of ['code', 'name', 'framework', 'effectiveFromSchoolYear', 'status', 'implementationNotes']) {
    if (!version[field]) fail(input, `curriculumVersion.${field} is required`)
  }
  if (!['active', 'superseded'].includes(version.status)) fail(input, 'curriculumVersion.status must be active or superseded')

  const subject = manifest.subject ?? {}
  for (const field of ['gradeLevel', 'code', 'name', 'description']) {
    if (!subject[field]) fail(input, `subject.${field} is required`)
  }

  const periods = Array.isArray(manifest.periods) ? manifest.periods : []
  if (!periods.length) fail(input, 'at least one official period is required')
  const periodSequences = new Set()
  const periodLabels = new Set()
  for (const period of periods) {
    if (!Number.isInteger(period.sequence) || period.sequence < 1 || period.sequence > 4) fail(input, `invalid period sequence ${period.sequence}`)
    if (!['term', 'quarter', 'semester', 'year'].includes(period.periodType)) fail(input, `invalid period type ${period.periodType}`)
    if (!period.sourceLabel?.trim()) fail(input, `period ${period.sequence} must preserve its official sourceLabel`)
    if (!Number.isInteger(period.sourcePage) || period.sourcePage < 1 || period.sourcePage > source.pageCount) fail(input, `invalid period sourcePage ${period.sourcePage}`)
    if (periodSequences.has(period.sequence)) fail(input, `duplicate period sequence ${period.sequence}`)
    if (periodLabels.has(normalize(period.label))) fail(input, `duplicate period label ${period.label}`)
    periodSequences.add(period.sequence)
    periodLabels.add(normalize(period.label))
  }
  if (subject.gradeLevel === 'Grade 12') {
    if (periods.length !== 1 || periods[0]?.periodType !== 'term' || normalize(periods[0]?.sourceLabel) !== 'one term') {
      fail(input, 'Grade 12 guides must retain their explicit one-term source structure')
    }
  } else if (subject.gradeLevel === 'Kindergarten') {
    if (periods.some((period) => period.periodType !== 'term' || !/^theme\s+(?:i|ii|iii|iv)$/iu.test(period.sourceLabel))) {
      fail(input, 'Kindergarten periods must retain official Theme I-IV labels')
    }
  } else if (periods.some((period) => period.periodType !== 'quarter')) {
    fail(input, 'non-Kindergarten K-11 manifests must retain official quarter periods')
  }

  const domains = Array.isArray(manifest.domains) ? manifest.domains : []
  if (!domains.length) fail(input, 'at least one domain is required')
  const domainCodes = new Set()
  const domainNames = new Set()
  for (const domain of domains) {
    if (!domain.code || !domain.name) fail(input, 'every domain needs code and name')
    if (!Number.isInteger(domain.sortOrder) || domain.sortOrder <= 0) fail(input, `invalid domain sortOrder for ${domain.name}`)
    if (domainCodes.has(domain.code)) fail(input, `duplicate domain code ${domain.code}`)
    if (domainNames.has(normalize(domain.name))) fail(input, `duplicate normalized domain name ${domain.name}`)
    domainCodes.add(domain.code)
    domainNames.add(normalize(domain.name))
  }

  const competencies = Array.isArray(manifest.competencies) ? manifest.competencies : []
  competencyCount += competencies.length
  if (!competencies.length) fail(input, 'at least one competency is required')
  const recordIds = new Set()
  const samePeriodCodes = new Set()
  const sameDomainText = new Set()
  const perPeriodOrders = new Map()
  for (const competency of competencies) {
    if (!competency.recordId || !competency.recordId.startsWith(`${manifest.slug}:period-`)) fail(input, `invalid recordId ${competency.recordId}`)
    if (recordIds.has(competency.recordId)) fail(input, `duplicate official competency recordId ${competency.recordId}`)
    recordIds.add(competency.recordId)
    if (!periodSequences.has(competency.quarter)) fail(input, `competency uses unknown period ${competency.quarter}`)
    if (!domainCodes.has(competency.domain)) fail(input, `competency uses unknown domain ${competency.domain}`)
    if (!competency.text?.trim() || normalize(competency.text).length < 10) fail(input, `competency text is empty or implausibly short: ${competency.recordId}`)
    if (/\uFFFD|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(competency.text)) fail(input, `invalid Unicode/control character leaked into ${competency.recordId}`)
    if (/\b(?:page|pahina)\s+\d+\s+(?:of|ng)\s+\d+\b/iu.test(competency.text)) fail(input, `page footer leaked into ${competency.recordId}`)
    if (/(?:^|\s)\d{1,3}\.\s+(?=[\p{L}])/u.test(competency.text)) fail(input, `embedded source row number leaked into ${competency.recordId}`)
    if (/(?:^|\s)(?:[\p{L}]\s+){4,}[\p{L}](?:\s|$)/u.test(competency.text)) fail(input, `letter-spaced font artifact leaked into ${competency.recordId}`)
    if (/\bduring the during the\b|\band hair and hair\b/iu.test(competency.text) || hasConsecutiveDuplicatePhrase(competency.text)) {
      fail(input, `duplicated PDF text layer leaked into ${competency.recordId}`)
    }
    if (/https?:\/\//iu.test(competency.text)) fail(input, `URL leaked into ${competency.recordId}`)
    if (source.fileName.startsWith('FINAL MATATAG Mathematics') && /["$#]/u.test(competency.text)) fail(input, `malformed mathematics font glyph leaked into ${competency.recordId}`)
    if (competency.verificationStatus !== 'verified') fail(input, `${competency.recordId} is not verified`)
    if (!Number.isInteger(competency.sourcePage) || competency.sourcePage < 1 || competency.sourcePage > source.pageCount) fail(input, `invalid sourcePage for ${competency.recordId}`)
    if (!Number.isInteger(competency.sortOrder) || competency.sortOrder <= 0) fail(input, `invalid sortOrder for ${competency.recordId}`)
    if (competency.competencyCode !== null && typeof competency.competencyCode !== 'string') fail(input, `competencyCode must be a string or null for ${competency.recordId}`)

    if (competency.competencyCode) {
      const codeKey = `${competency.quarter}:${competency.competencyCode}`
      if (samePeriodCodes.has(codeKey)) fail(input, `duplicate official competency code in period ${competency.quarter}: ${competency.competencyCode}`)
      samePeriodCodes.add(codeKey)
    }
    const textKey = `${competency.quarter}:${competency.domain}:${normalize(competency.text)}`
    if (sameDomainText.has(textKey)) fail(input, `duplicate competency text in period/domain: ${competency.text}`)
    sameDomainText.add(textKey)

    const orders = perPeriodOrders.get(competency.quarter) ?? []
    orders.push(competency.sortOrder)
    perPeriodOrders.set(competency.quarter, orders)
  }

  for (const period of periodSequences) {
    const sorted = [...(perPeriodOrders.get(period) ?? [])].sort((left, right) => left - right)
    const expected = Array.from({ length: sorted.length }, (_, index) => index + 1)
    if (sorted.join(',') !== expected.join(',')) fail(input, `sortOrder values for period ${period} must be contiguous from 1`)
  }

  const canonicalStandards = Array.isArray(manifest.standards) ? manifest.standards : null
  const legacyPerformanceStandards = Array.isArray(manifest.performanceStandards) ? manifest.performanceStandards : []
  const standards = canonicalStandards ?? legacyPerformanceStandards.map((standard) => ({ ...standard, type: 'performance' }))
  const supportedStandardTypes = new Set(['content', 'performance', 'stage', 'key_stage', 'other'])
  const standardKeys = new Set()
  const standardOrders = new Map()
  for (const standard of standards) {
    if (!supportedStandardTypes.has(standard.type)) fail(input, `unsupported standard type ${standard.type}`)
    if (!periodSequences.has(standard.quarter)) fail(input, `${standard.type ?? 'unknown'} standard uses unknown period ${standard.quarter}`)
    if (!standard.text?.trim()) fail(input, 'standard text cannot be empty')
    if (!Number.isInteger(standard.sourcePage) || standard.sourcePage < 1 || standard.sourcePage > source.pageCount) fail(input, 'invalid standard sourcePage')
    if (standard.domain != null && !domainCodes.has(standard.domain)) fail(input, `standard uses unknown domain ${standard.domain}`)
    if (standard.verificationStatus != null && standard.verificationStatus !== 'verified') fail(input, 'official standard verificationStatus must be verified')
    if (canonicalStandards && (!Number.isInteger(standard.sortOrder) || standard.sortOrder < 1)) fail(input, 'standard sortOrder must be a positive integer')
    const key = `${standard.type}:${standard.quarter}:${standard.domain ?? ''}:${normalize(standard.text)}`
    if (standardKeys.has(key)) fail(input, `duplicate standard: ${standard.text}`)
    standardKeys.add(key)
    if (canonicalStandards) {
      const orderKey = `${standard.type}:${standard.quarter}`
      const orders = standardOrders.get(orderKey) ?? []
      orders.push(standard.sortOrder)
      standardOrders.set(orderKey, orders)
    }
  }
  for (const [group, orders] of standardOrders) {
    const sorted = [...orders].sort((left, right) => left - right)
    const expected = Array.from({ length: sorted.length }, (_, index) => index + 1)
    if (sorted.join(',') !== expected.join(',')) fail(input, `standard sortOrder values for ${group} must be contiguous from 1`)
  }
  if (canonicalStandards) {
    const content = standards.filter((standard) => standard.type === 'content')
    const performance = standards.filter((standard) => standard.type === 'performance')
    if (Array.isArray(manifest.contentStandards) && JSON.stringify(manifest.contentStandards) !== JSON.stringify(content)) fail(input, 'contentStandards compatibility collection must match standards[type=content]')
    if (Array.isArray(manifest.performanceStandards) && JSON.stringify(manifest.performanceStandards) !== JSON.stringify(performance)) fail(input, 'performanceStandards compatibility collection must match standards[type=performance]')
    const coverage = manifest.verification?.standardsCoverage
    if (coverage) {
      if (coverage.status !== 'verified') fail(input, 'standardsCoverage.status must be verified')
      if (coverage.contentCount !== content.length) fail(input, `standardsCoverage.contentCount must be ${content.length}`)
      if (coverage.performanceCount !== performance.length) fail(input, `standardsCoverage.performanceCount must be ${performance.length}`)
      if (coverage.sourcePinned !== true) fail(input, 'standardsCoverage.sourcePinned must be true')
    }
  }

  const usedPages = [...competencies.map((item) => item.sourcePage), ...standards.map((item) => item.sourcePage)]
  const expectedPagesUsed = usedPages.length ? { from: Math.min(...usedPages), to: Math.max(...usedPages) } : null
  if (source.pagesUsed?.from !== expectedPagesUsed?.from || source.pagesUsed?.to !== expectedPagesUsed?.to) {
    fail(input, `source.pagesUsed must match curriculum provenance (${JSON.stringify(expectedPagesUsed)})`)
  }

  const applicability = Array.isArray(manifest.applicability) ? manifest.applicability : []
  if (!applicability.length) fail(input, 'at least one applicability record is required')
  const applicabilityKeys = new Set()
  for (const item of applicability) {
    if (!item.schoolYear || !item.gradeLevel || !item.implementationStatus) fail(input, 'applicability requires schoolYear, gradeLevel, and implementationStatus')
    if (item.gradeLevel !== subject.gradeLevel) fail(input, `applicability grade ${item.gradeLevel} does not match subject grade ${subject.gradeLevel}`)
    if (!['full', 'pilot', 'transitional', 'legacy'].includes(item.implementationStatus)) fail(input, `invalid applicability status ${item.implementationStatus}`)
    const key = `${item.schoolYear}:${item.gradeLevel}:${item.implementationStatus}`
    if (applicabilityKeys.has(key)) fail(input, `duplicate applicability ${key}`)
    applicabilityKeys.add(key)
  }

  const consistency = manifest.verification?.sourceConsistency
  if (consistency) {
    const detailed = periods.map((period) => competencies.filter((item) => item.quarter === period.sequence).length)
    if (JSON.stringify(consistency.detailedTableCountsByQuarter) !== JSON.stringify(detailed)) fail(input, 'sourceConsistency detailed counts do not match manifest rows')
    if (!Array.isArray(consistency.publishedSummaryCountsByQuarter) || consistency.publishedSummaryCountsByQuarter.length !== detailed.length) fail(input, 'sourceConsistency published summary counts are invalid')
    const expectedStatus = JSON.stringify(detailed) === JSON.stringify(consistency.publishedSummaryCountsByQuarter) ? 'matched' : 'official_source_variance'
    if (consistency.status !== expectedStatus) fail(input, `sourceConsistency.status must be ${expectedStatus}`)
    if (!consistency.resolution) fail(input, 'sourceConsistency.resolution is required')
  }

  const hasCanonicalStandards = Array.isArray(manifest.standards)
  const expectedHash = sha256Json({
    slug: manifest.slug,
    sourceSha256: source.sha256,
    periods,
    domains,
    ...(hasCanonicalStandards ? { standards } : {}),
    competencies,
  })
  const expectedExtractorVersion = hasCanonicalStandards ? 'official-curriculum-v2' : 'official-curriculum-v1'
  if (manifest.integrity?.extractorVersion !== expectedExtractorVersion) fail(input, `integrity.extractorVersion must be ${expectedExtractorVersion}`)
  if (manifest.integrity?.competencyPayloadSha256 !== expectedHash) fail(input, `integrity hash mismatch; expected ${expectedHash}`)
}

if (failures.length) {
  console.error('\nCurriculum validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`✓ ${manifestCount} official curriculum manifests: ${competencyCount} verified competencies with source and payload integrity`)
