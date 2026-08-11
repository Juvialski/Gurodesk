import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { transform } from 'esbuild'

const output = resolve(process.argv[2] ?? 'data/curriculum/sources/catalog-snapshot.json')
const catalogSource = resolve('src/data/curriculumCatalog.ts')
const source = await readFile(catalogSource, 'utf8')
const compiled = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' })
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`
const { CURRICULUM_CATALOG } = await import(moduleUrl)

const entries = CURRICULUM_CATALOG
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

const snapshot = {
  schemaVersion: 1,
  generatedFrom: pathToFileURL(catalogSource).pathname.split('/').slice(-3).join('/'),
  entryCount: entries.length,
  entries,
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
console.log(`Wrote ${entries.length} current official catalog entries to ${output}`)
