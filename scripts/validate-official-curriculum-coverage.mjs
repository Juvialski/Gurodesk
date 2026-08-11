import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { transform } from 'esbuild'

const EXPECTED = Object.freeze({ catalogEntries: 189, manifests: 196, sources: 129, competencies: 6181 })
const manifestDir = resolve('data/curriculum/official')
const snapshotPath = resolve('data/curriculum/sources/catalog-snapshot.json')
const registerPath = resolve('data/curriculum/sources/official-source-register.json')
const indexPath = resolve('data/curriculum/sources/official-pack-index.json')

const [manifestNames, snapshot, register, index, catalogSource] = await Promise.all([
  readdir(manifestDir),
  readFile(snapshotPath, 'utf8').then(JSON.parse),
  readFile(registerPath, 'utf8').then(JSON.parse),
  readFile(indexPath, 'utf8').then(JSON.parse),
  readFile(resolve('src/data/curriculumCatalog.ts'), 'utf8'),
])

const failures = []
const fail = (message) => failures.push(message)

const compiled = await transform(catalogSource, { loader: 'ts', format: 'esm', target: 'es2022' })
const catalogModuleUrl = `data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`
const { CURRICULUM_CATALOG } = await import(catalogModuleUrl)
const liveEntries = CURRICULUM_CATALOG
  .filter((entry) => entry.track === 'revised_k10' || entry.track.startsWith('sshs_'))
  .map((entry) => ({
    id: entry.id,
    curriculumCode: entry.curriculumCode,
    gradeLevel: entry.gradeLevel,
    learningArea: entry.learningArea,
    track: entry.track,
    schoolYears: entry.schoolYears,
  }))
  .sort((left, right) => left.id.localeCompare(right.id, 'en'))

if (liveEntries.some((entry) => CURRICULUM_CATALOG.find((item) => item.id === entry.id)?.status !== 'verified_competencies')) {
  fail('every current official catalog entry must be marked verified_competencies')
}
if (JSON.stringify(liveEntries) !== JSON.stringify(snapshot.entries)) fail('catalog-snapshot.json is stale; run npm run curriculum:catalog:snapshot')

const jsonNames = manifestNames.filter((name) => name.endsWith('.json')).sort((left, right) => left.localeCompare(right, 'en'))
const manifests = await Promise.all(jsonNames.map(async (name) => JSON.parse(await readFile(resolve(manifestDir, name), 'utf8'))))
const sourcesById = new Map(register.sources.map((source) => [source.id, source]))
const catalogById = new Map(snapshot.entries.map((entry) => [entry.id, entry]))
const manifestsBySlug = new Map(manifests.map((manifest) => [manifest.slug, manifest]))

for (const [label, actual, expected] of [
  ['catalog entries', snapshot.entryCount, EXPECTED.catalogEntries],
  ['manifest files', manifests.length, EXPECTED.manifests],
  ['registered sources', register.sourceCount, EXPECTED.sources],
  ['pack index entries', index.manifestCount, EXPECTED.manifests],
]) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`)
}
if (index.catalogEntryCount !== EXPECTED.catalogEntries) fail(`pack index catalog count must be ${EXPECTED.catalogEntries}`)
if (new Set(manifests.map((manifest) => manifest.slug)).size !== manifests.length) fail('manifest slugs must be unique')
if (new Set(register.sources.map((source) => source.id)).size !== register.sources.length) fail('source IDs must be unique')
if (new Set(register.sources.map((source) => source.sha256)).size !== register.sources.length) fail('pinned source hashes must be unique')
if (register.totalBytes !== register.sources.reduce((sum, source) => sum + source.byteSize, 0)) fail('source register totalBytes is stale')

const sourceFamilyCounts = Object.fromEntries(
  [...new Set(register.sources.map((source) => source.family))].map((family) => [family, register.sources.filter((source) => source.family === family).length]),
)
for (const [family, expected] of Object.entries({ revised_k10: 13, strengthened_shs_grade11: 94, strengthened_shs_grade12: 22 })) {
  if (sourceFamilyCounts[family] !== expected) fail(`${family}: expected ${expected} sources, got ${sourceFamilyCounts[family] ?? 0}`)
}

const mappingCounts = new Map()
const usedSourceIds = new Set()
for (const pack of index.packs) {
  const catalog = catalogById.get(pack.catalogId)
  const source = sourcesById.get(pack.sourceId)
  const manifest = manifestsBySlug.get(pack.slug)
  if (!catalog) fail(`${pack.slug}: missing catalog entry ${pack.catalogId}`)
  if (!source) fail(`${pack.slug}: missing source ${pack.sourceId}`)
  if (!manifest) fail(`${pack.slug}: missing manifest file`)
  if (!catalog || !source || !manifest) continue

  mappingCounts.set(pack.catalogId, (mappingCounts.get(pack.catalogId) ?? 0) + 1)
  usedSourceIds.add(pack.sourceId)
  if (manifest.curriculumVersion.code !== pack.curriculumCode) fail(`${pack.slug}: curriculum code does not match pack index`)
  if (manifest.subject.gradeLevel !== pack.gradeLevel || manifest.subject.name !== pack.learningArea) fail(`${pack.slug}: grade/learning-area linkage does not match pack index`)
  if ((manifest.subject.component ?? null) !== (pack.component ?? null)) fail(`${pack.slug}: component linkage does not match pack index`)
  for (const field of ['title', 'fileName', 'fileId', 'sourceUrl', 'landingPageUrl', 'edition', 'sha256', 'byteSize', 'pageCount', 'retrievedOn']) {
    if (manifest.source[field] !== source[field]) fail(`${pack.slug}: source.${field} does not match source register`)
  }
}

for (const catalog of snapshot.entries) {
  const count = mappingCounts.get(catalog.id) ?? 0
  const expected = catalog.learningArea === 'MAPEH' && /^Grade (?:4|5|6|7|8|9|10)$/u.test(catalog.gradeLevel) ? 2 : 1
  if (count !== expected) fail(`${catalog.id}: expected ${expected} source manifest mapping(s), got ${count}`)
}
if (usedSourceIds.size !== register.sources.length) {
  const unused = register.sources.filter((source) => !usedSourceIds.has(source.id)).map((source) => source.id)
  fail(`every pinned source must be used; unused: ${unused.join(', ')}`)
}

const manifestFamilyCounts = {
  revisedK10: manifests.filter((manifest) => manifest.curriculumVersion.code === 'REVISED-K10-MATATAG').length,
  grade11: manifests.filter((manifest) => manifest.subject.gradeLevel === 'Grade 11').length,
  grade12: manifests.filter((manifest) => manifest.subject.gradeLevel === 'Grade 12').length,
}
for (const [label, actual, expected] of [
  ['Revised K-10 manifests', manifestFamilyCounts.revisedK10, 80],
  ['Grade 11 manifests', manifestFamilyCounts.grade11, 94],
  ['Grade 12 manifests', manifestFamilyCounts.grade12, 22],
]) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`)
}

const competencyCount = manifests.reduce((sum, manifest) => sum + manifest.competencies.length, 0)
if (competencyCount !== EXPECTED.competencies) fail(`competency total: expected ${EXPECTED.competencies}, got ${competencyCount}`)
if (jsonNames.some((name, index) => name !== `${manifests[index].slug}.json`)) fail('every manifest filename must equal its slug')

if (failures.length) {
  console.error('Official curriculum coverage validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`✓ official coverage: ${EXPECTED.catalogEntries} catalog entries → ${EXPECTED.manifests} manifests → ${EXPECTED.sources} pinned sources → ${competencyCount} competencies`)
