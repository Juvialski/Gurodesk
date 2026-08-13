#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const BASE_URL = 'https://nid.deped.gov.ph/public-dashboard'
const SOURCE_NAME = 'DepEd National Inventory Dashboard'
const DEFAULT_OUT = 'data/schools/philippine-schools.generated.json'

function parseArgs(argv) {
  const options = { out: DEFAULT_OUT, concurrency: 3, delay: 150, sync: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--sync') options.sync = true
    else if (arg === '--out') options.out = argv[++i]
    else if (arg === '--concurrency') options.concurrency = Number(argv[++i])
    else if (arg === '--delay') options.delay = Number(argv[++i])
    else if (arg === '--help') options.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!Number.isFinite(options.concurrency) || options.concurrency < 1 || options.concurrency > 8) throw new Error('--concurrency must be between 1 and 8.')
  if (!Number.isFinite(options.delay) || options.delay < 0) throw new Error('--delay must be 0 or greater.')
  return options
}

function usage() {
  console.log(`Usage: node scripts/schools/import-deped-nid.mjs [options]\n\nOptions:\n  --out <path>          Output JSON path (default: ${DEFAULT_OUT})\n  --concurrency <1-8>  Concurrent division crawls (default: 3)\n  --delay <ms>          Courtesy delay between requests (default: 150)\n  --sync                Upsert validated records to Supabase using backend-only service-role env vars\n  --help                Show this help\n`)
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
}

function textFromHtml(value) {
  return decodeHtml(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function pathSegments(href) {
  try {
    return decodeURIComponent(new URL(href, BASE_URL).pathname).split('/').filter(Boolean)
  } catch {
    return []
  }
}

function extractHrefs(html) {
  return Array.from(html.matchAll(/href\s*=\s*["']([^"']+)["']/gi), (match) => match[1])
}

function extractRegions(html) {
  const names = new Set()
  for (const href of extractHrefs(html)) {
    const parts = pathSegments(href)
    const index = parts.indexOf('region')
    if (index >= 0 && parts[index + 1] && !parts.includes('division')) names.add(parts[index + 1])
  }
  return [...names]
}

function extractDivisions(html, regionName) {
  const names = new Set()
  for (const href of extractHrefs(html)) {
    const parts = pathSegments(href)
    const regionIndex = parts.indexOf('region')
    const divisionIndex = parts.indexOf('division')
    if (regionIndex >= 0 && divisionIndex > regionIndex && parts[regionIndex + 1] === regionName && parts[divisionIndex + 1]) {
      names.add(parts[divisionIndex + 1])
    }
  }
  return [...names]
}

function parseNationalCount(html) {
  const text = textFromHtml(html)
  const patterns = [
    /Total Schools\s*([0-9,]+)/i,
    /([0-9,]+)\s*Total Schools/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return Number(match[1].replace(/,/g, ''))
  }
  return null
}

function parseLastUpdated(html) {
  const text = textFromHtml(html)
  return text.match(/Last updated:\s*([^#|]+?)(?:National Inventory Dashboard|Regional overview|Division-level|Individual school|Total Schools)/i)?.[1]?.trim() ?? null
}

function parseDivisionTotal(html) {
  const text = textFromHtml(html)
  const match = text.match(/([0-9,]+)\s+schools total/i) ?? text.match(/([0-9,]+)\s+total in division/i)
  return match ? Number(match[1].replace(/,/g, '')) : null
}

function parseSchoolRows(html, regionName, divisionName, sourceUrl, checkedAt) {
  const rows = []
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from(rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), (match) => textFromHtml(match[1]))
    if (cells.length < 2) continue
    const schoolId = cells[0].replace(/\s+/g, '')
    const schoolName = cells[1].trim()
    if (!/^\d{5,8}$/.test(schoolId) || !schoolName) continue
    rows.push({
      schoolId,
      schoolName,
      regionCode: regionName,
      regionName,
      divisionCode: null,
      divisionName,
      municipality: null,
      province: null,
      schoolType: null,
      classification: null,
      isActive: true,
      sourceName: SOURCE_NAME,
      sourceUrl,
      sourceVersion: checkedAt?.slice(0, 10) ?? null,
      sourceCheckedAt: checkedAt,
    })
  }
  return rows
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

async function fetchHtml(url, delay) {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (delay) await sleep(delay)
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'GuroDesk-School-Directory-Importer/1.0 (+official DepEd reference sync)',
        },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
      if (attempt < 4) await sleep(500 * (2 ** (attempt - 1)))
    }
  }
  throw new Error(`Unable to fetch ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

function routeUrl(regionName, divisionName, page) {
  const base = `${BASE_URL}/region/${encodeURIComponent(regionName)}/division/${encodeURIComponent(divisionName)}`
  return page > 1 ? `${base}?page=${page}` : base
}

async function crawlDivision(regionName, divisionName, options) {
  const firstUrl = routeUrl(regionName, divisionName, 1)
  const firstHtml = await fetchHtml(firstUrl, options.delay)
  const total = parseDivisionTotal(firstHtml)
  const checkedAt = new Date().toISOString()
  const schools = parseSchoolRows(firstHtml, regionName, divisionName, firstUrl, checkedAt)
  const maxPages = total ? Math.max(1, Math.ceil(total / 50)) : 100

  for (let page = 2; page <= maxPages; page += 1) {
    const url = routeUrl(regionName, divisionName, page)
    const html = await fetchHtml(url, options.delay)
    const pageRows = parseSchoolRows(html, regionName, divisionName, url, checkedAt)
    if (pageRows.length === 0) break
    schools.push(...pageRows)
    if (!total && pageRows.length < 50) break
  }

  const unique = new Map(schools.map((school) => [school.schoolId, school]))
  if (total && unique.size < Math.min(total, 1)) throw new Error(`${divisionName}, ${regionName}: parsed zero schools from a division reporting ${total}.`)
  return [...unique.values()]
}

async function mapPool(items, concurrency, mapper) {
  const output = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      output[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return output
}

function validateSchools(schools, expectedCount) {
  const errors = []
  const ids = new Set()
  for (const [index, school] of schools.entries()) {
    if (!/^\d{5,8}$/.test(school.schoolId)) errors.push(`Row ${index + 1}: invalid School ID ${school.schoolId}`)
    if (!school.schoolName?.trim()) errors.push(`Row ${index + 1}: missing school name`)
    if (!school.regionName?.trim()) errors.push(`Row ${index + 1}: missing region`)
    if (!school.divisionName?.trim()) errors.push(`Row ${index + 1}: missing division`)
    if (ids.has(school.schoolId)) errors.push(`Duplicate School ID ${school.schoolId}`)
    ids.add(school.schoolId)
  }
  if (schools.length < 40_000) errors.push(`Only ${schools.length} schools were collected; refusing to label this a national directory.`)
  if (expectedCount && schools.length < Math.floor(expectedCount * 0.95)) errors.push(`Collected ${schools.length} of ${expectedCount} schools (<95%).`)
  if (errors.length) throw new Error(`School directory validation failed:\n- ${errors.slice(0, 30).join('\n- ')}${errors.length > 30 ? `\n- …and ${errors.length - 30} more` : ''}`)
}

function toDbRow(school) {
  return {
    school_id: school.schoolId,
    school_name: school.schoolName,
    region_code: school.regionCode,
    region_name: school.regionName,
    division_code: school.divisionCode,
    division_name: school.divisionName,
    municipality: school.municipality,
    province: school.province,
    school_type: school.schoolType,
    classification: school.classification,
    is_active: school.isActive,
    source_name: school.sourceName,
    source_url: school.sourceUrl,
    source_version: school.sourceVersion,
    source_checked_at: school.sourceCheckedAt,
  }
}

async function syncToSupabase(schools) {
  const url = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) throw new Error('--sync requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in a backend-only environment.')

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/philippine_schools?on_conflict=school_id`
  const batchSize = 500
  for (let start = 0; start < schools.length; start += batchSize) {
    const batch = schools.slice(start, start + batchSize).map(toDbRow)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceRole,
        authorization: `Bearer ${serviceRole}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) throw new Error(`Supabase upsert failed at row ${start + 1}: HTTP ${response.status} ${await response.text()}`)
    console.log(`Synced ${Math.min(start + batchSize, schools.length)} / ${schools.length}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) return usage()

  console.log(`Reading official school hierarchy from ${BASE_URL}`)
  const nationalHtml = await fetchHtml(BASE_URL, options.delay)
  const expectedSchoolCount = parseNationalCount(nationalHtml)
  const sourceLastUpdated = parseLastUpdated(nationalHtml)
  const regions = extractRegions(nationalHtml)
  if (regions.length < 15) throw new Error(`Expected the national page to expose the Philippine regions; found only ${regions.length}. The NID markup may have changed.`)

  const divisions = []
  for (const regionName of regions) {
    const regionUrl = `${BASE_URL}/region/${encodeURIComponent(regionName)}`
    const html = await fetchHtml(regionUrl, options.delay)
    const names = extractDivisions(html, regionName)
    if (names.length === 0) throw new Error(`No divisions found for ${regionName}; refusing a partial import.`)
    for (const divisionName of names) divisions.push({ regionName, divisionName })
  }

  console.log(`Found ${regions.length} regions and ${divisions.length} divisions. Crawling schools…`)
  const grouped = await mapPool(divisions, options.concurrency, async ({ regionName, divisionName }, index) => {
    const schools = await crawlDivision(regionName, divisionName, options)
    console.log(`[${index + 1}/${divisions.length}] ${regionName} / ${divisionName}: ${schools.length}`)
    return schools
  })

  const deduped = new Map()
  for (const school of grouped.flat()) {
    const existing = deduped.get(school.schoolId)
    if (existing && (existing.schoolName !== school.schoolName || existing.regionName !== school.regionName || existing.divisionName !== school.divisionName)) {
      throw new Error(`School ID ${school.schoolId} appeared with conflicting identities.`)
    }
    deduped.set(school.schoolId, school)
  }
  const schools = [...deduped.values()].sort((a, b) => a.schoolId.localeCompare(b.schoolId))
  validateSchools(schools, expectedSchoolCount)

  const output = {
    generatedAt: new Date().toISOString(),
    source: SOURCE_NAME,
    sourceUrl: BASE_URL,
    sourceLastUpdated,
    expectedSchoolCount,
    schoolCount: schools.length,
    note: 'Generated from official DepEd NID public pages. School status/project fields are intentionally not imported; GuroDesk uses only stable school identity/reference fields.',
    schools,
  }
  const outPath = resolve(options.out)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`Validated ${schools.length} unique schools. Wrote ${outPath}`)

  if (options.sync) await syncToSupabase(schools)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exit(1)
})
