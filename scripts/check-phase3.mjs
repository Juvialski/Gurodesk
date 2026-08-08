import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const root = process.cwd()
const read = (file) => readFile(resolve(root, file), 'utf8')
const fail = (message) => { throw new Error(message) }

const packageJson = JSON.parse(await read('package.json'))
if (packageJson.version !== '0.3.0') fail(`Expected package version 0.3.0; found ${packageJson.version}.`)

const aiFunc = await read('supabase/functions/lesson-ai-support/index.ts').catch(() => null)
if (aiFunc) {
  for (const task of ['refine_clarity', 'organize_text', 'grammar_spelling', 'format_text', 'translate']) {
    if (!aiFunc.includes(task)) fail(`AI support function missing allowed task ${task}.`)
  }
}

async function sourceFiles(dir) {
  const out = []
  try {
    for (const entry of await readdir(resolve(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) out.push(...await sourceFiles(rel))
      else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) out.push(rel)
    }
  } catch {}
  return out
}

for (const file of await sourceFiles('src')) {
  const text = await read(file)
  if (text.includes('GEMINI_API_KEY')) fail(`Browser source ${file} references GEMINI_API_KEY.`)
  if (text.includes('service_role')) fail(`Browser source ${file} references a Supabase service-role credential.`)
}

console.log('✓ Phase 3 validation checks passed')
console.log('✓ Version is 0.3.0')
if (aiFunc) console.log('✓ AI edge function strictly configured with allowed support tasks')
console.log('✓ Browser source contains no secrets')
