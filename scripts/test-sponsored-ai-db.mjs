import { spawnSync } from 'node:child_process'
const candidate = process.env.SUPABASE_DB_URL
if (!candidate) throw new Error('SUPABASE_DB_URL is required for the isolated local database assertion suite.')
const url = new URL(candidate)
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Refusing non-local database assertions.')
const result = spawnSync('psql', ['-X', '--set=ON_ERROR_STOP=1', '--file=tests/database/sponsored-ai.sql'], { stdio: 'inherit', env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '54322', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1) } })
if (result.error) throw new Error('PostgreSQL client is unavailable; install psql to execute the local quota assertions.')
process.exitCode = result.status ?? 1
