import { mkdir, readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const inputDir = resolve(process.argv[2] ?? 'data/curriculum/official')
const outputDir = resolve(process.argv[3] ?? 'supabase/seeds/generated')
await mkdir(outputDir, { recursive: true })

async function jsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return jsonFiles(path)
    return entry.isFile() && entry.name.endsWith('.json') ? [path] : []
  }))
  return nested.flat()
}

const files = (await jsonFiles(inputDir)).sort((left, right) => left.localeCompare(right, 'en'))
if (!files.length) {
  console.error(`No curriculum manifests found in ${inputDir}`)
  process.exit(2)
}

let generated = 0
for (const input of files) {
  const manifest = JSON.parse(await readFile(input, 'utf8'))
  if (manifest?.schemaVersion !== 2 || manifest?.verification?.status !== 'verified' || !Array.isArray(manifest?.competencies)) {
    continue
  }

  const slug = String(manifest.slug)
  const output = resolve(outputDir, `${slug}.sql`)
  const result = spawnSync(process.execPath, ['scripts/generate-curriculum-sql.mjs', input, output], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
  generated += 1
}

if (generated !== 196) {
  console.error(`Expected 196 official curriculum seed files, generated ${generated}.`)
  process.exit(1)
}
console.log(`Generated ${generated} verified curriculum seed files in ${outputDir}.`)
