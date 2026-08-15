import fs from 'node:fs'
import path from 'node:path'

const configPath = path.resolve('supabase/config.toml')
if (!fs.existsSync(configPath)) {
  console.error('Edge Function preflight smoke test failed: supabase/config.toml is missing.')
  process.exit(1)
}

const config = fs.readFileSync(configPath, 'utf8')
const slugs = [...config.matchAll(/^\[functions\.([^\]]+)\]\s*$/gm)].map((match) => match[1])
if (!slugs.length) {
  console.error('Edge Function preflight smoke test failed: no configured functions were found.')
  process.exit(1)
}

for (const slug of slugs) {
  const entrypoint = path.resolve('supabase/functions', slug, 'index.ts')
  if (!fs.existsSync(entrypoint)) {
    console.error(`Edge Function preflight smoke test failed: ${slug} is configured but ${path.relative(process.cwd(), entrypoint)} is missing.`)
    process.exit(1)
  }
}

const rawBaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
if (!rawBaseUrl) {
  console.error('Edge Function preflight smoke test failed: SUPABASE_URL/VITE_SUPABASE_URL is not set.')
  process.exit(1)
}

const baseUrl = new URL(rawBaseUrl)
const localHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
if (!localHosts.has(baseUrl.hostname)) {
  console.error(`Refusing to run Edge Function smoke tests against a non-local Supabase URL: ${baseUrl.origin}`)
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const failures = []

for (const slug of slugs) {
  const url = new URL(`/functions/v1/${slug}`, baseUrl)
  let last = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://127.0.0.1:4173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, apikey, content-type',
        },
        signal: AbortSignal.timeout(10_000),
      })
      const body = (await response.text()).slice(0, 500)
      last = { status: response.status, body }
      if (response.ok) break
    } catch (error) {
      last = { status: 0, body: error instanceof Error ? error.message : String(error) }
    }

    if (attempt < 3) await sleep(750)
  }

  if (!last || last.status < 200 || last.status >= 300) {
    failures.push({ slug, ...last })
    continue
  }

  console.log(`Edge Function preflight OK: ${slug} (${last.status})`)
}

if (failures.length) {
  console.error('Edge Function preflight smoke test failed:')
  for (const failure of failures) {
    console.error(`- ${failure.slug}: status ${failure.status || 'network error'}${failure.body ? ` — ${failure.body}` : ''}`)
  }
  process.exit(1)
}

console.log(`Edge Function preflight smoke test passed (${slugs.length} configured functions).`)
