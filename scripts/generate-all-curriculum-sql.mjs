import { mkdir, readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const inputDir = resolve(process.argv[2] ?? 'data/curriculum')
const outputDir = resolve(process.argv[3] ?? 'supabase/seeds/generated')
await mkdir(outputDir, { recursive: true })

const files = (await readdir(inputDir))
  .filter((name) => name.endsWith('.json'))
  .sort((left, right) => left.localeCompare(right, 'en'))

if (!files.length) {
  console.error(`No curriculum manifests found in ${inputDir}`)
  process.exit(2)
}

let generated = 0
for (const file of files) {
  const input = resolve(inputDir, file)
  const manifest = JSON.parse(await readFile(input, 'utf8'))
  if (manifest?.verification?.status !== 'verified' || !manifest?.subject || !Array.isArray(manifest?.competencies)) {
    console.log(`skip ${file}: not a verified detailed competency manifest`)
    continue
  }

  const slug = String(manifest.slug || file.replace(/\.json$/u, ''))
  const output = resolve(outputDir, `${slug}.sql`)
  const result = spawnSync(process.execPath, ['scripts/generate-curriculum-sql.mjs', input, output], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
  generated += 1
}

console.log(`Generated ${generated} verified curriculum seed file${generated === 1 ? '' : 's'} in ${outputDir}.`)
