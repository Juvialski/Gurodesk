import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function run(label, args) {
  process.stdout.write(`\n[validate] ${label}\n`)
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const validatorFiles = readdirSync(new URL('.', import.meta.url))
  .filter((name) => /^check-.+\.mjs$/u.test(name))
  .sort((left, right) => left.localeCompare(right, 'en'))

const curriculumFiles = readdirSync(new URL('../data/curriculum/', import.meta.url))
  .filter((name) => name.endsWith('.json'))
  .sort((left, right) => left.localeCompare(right, 'en'))
  .map((name) => `data/curriculum/${name}`)

run('curriculum manifests', ['scripts/validate-curriculum.mjs', ...curriculumFiles])
for (const validator of validatorFiles) run(validator, [`scripts/${validator}`])

process.stdout.write(`\n[validate] ${validatorFiles.length + 1} existing validator commands passed.\n`)
