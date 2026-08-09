import { createClient } from '@supabase/supabase-js'

const productionRef = 'hmeybakjxtzmiebtxonc'
const url = (process.env.E2E_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const email = (process.env.E2E_EMAIL || 'phase55-e2e-teacher@example.test').trim()
const password = (process.env.E2E_PASSWORD || 'Phase55-local-e2e-password-9!').trim()

if (!url || !serviceRoleKey) throw new Error('Local Supabase URL and service-role key are required to prepare the E2E teacher.')
if (url.includes(productionRef)) throw new Error(`Refusing to prepare an E2E user in production project ${productionRef}.`)
const parsed = new URL(url)
if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
  throw new Error(`E2E user preparation requires local Supabase; refusing ${parsed.hostname}.`)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

let existing = null
for (let page = 1; page <= 10 && !existing; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
  if (error) throw new Error(`list local E2E users: ${error.message}`)
  existing = data.users.find((user) => user.email === email) ?? null
  if (data.users.length < 100) break
}

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { full_name: process.env.E2E_FULL_NAME || 'Phase 5.5 E2E Teacher' },
  })
  if (error) throw new Error(`refresh local E2E teacher: ${error.message}`)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: process.env.E2E_FULL_NAME || 'Phase 5.5 E2E Teacher' },
  })
  if (error) throw new Error(`create local E2E teacher: ${error.message}`)
  if (!data.user) throw new Error('create local E2E teacher: no user returned')
}

process.stdout.write(`Prepared local E2E teacher ${email}.\n`)
