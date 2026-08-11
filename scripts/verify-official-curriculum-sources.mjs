import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const sourceRoot = resolve(process.argv[2] ?? '')
if (!process.argv[2]) {
  console.error('Usage: node scripts/verify-official-curriculum-sources.mjs <source-pdf-root> [source-register.json]')
  process.exit(2)
}
const registerPath = resolve(process.argv[3] ?? 'data/curriculum/sources/official-source-register.json')
const register = JSON.parse(await readFile(registerPath, 'utf8'))
const failures = []

function sourceSubdirectory(family) {
  if (family === 'revised_k10') return 'k10'
  if (family === 'strengthened_shs_grade11') return 'sshs'
  if (family === 'strengthened_shs_grade12') return 'g12'
  throw new Error(`Unsupported source family ${family}`)
}

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

for (const source of register.sources) {
  const path = resolve(sourceRoot, sourceSubdirectory(source.family), source.fileName)
  try {
    const info = await stat(path)
    if (info.size !== source.byteSize) failures.push(`${source.id}: expected ${source.byteSize} bytes, got ${info.size}`)
    const header = await readFile(path).then((bytes) => bytes.subarray(0, 5).toString('ascii'))
    if (header !== '%PDF-') failures.push(`${source.id}: file does not have a PDF header`)
    const digest = await sha256(path)
    if (digest !== source.sha256) failures.push(`${source.id}: SHA-256 mismatch (${digest})`)
  } catch (error) {
    failures.push(`${source.id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failures.length) {
  console.error('Pinned source verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`✓ ${register.sources.length} official source PDFs match the pinned byte sizes and SHA-256 digests`)
