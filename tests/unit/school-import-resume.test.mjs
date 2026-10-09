import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crawlDivision, fetchHtml, parseArgs, syncToSupabase } from '../../scripts/schools/import-deped-nid.mjs'

let directory
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); if (directory) { await rm(directory, { recursive: true, force: true }); directory = undefined } })
describe('official NID importer resumability and non-destructive reconciliation', () => {
  it('reuses fetched pages without repeated requests and rejects incomplete division coverage', async () => {
    directory = await mkdtemp(join(tmpdir(), 'gurodesk-school-cache-'))
    const html = '<p>2 schools total</p><table><tr><td>100001</td><td>Fixture School</td></tr></table>'
    const network = vi.fn(async () => new Response(html))
    vi.stubGlobal('fetch', network)
    const options = { cacheDir: directory, cacheHours: 24, delay: 0 }
    const url = 'https://nid.deped.gov.ph/public-dashboard/region/NCR/division/Manila'
    await fetchHtml(url, 0, options); await fetchHtml(url, 0, options)
    expect(network).toHaveBeenCalledTimes(1)
    await expect(crawlDivision('NCR', 'Manila', options)).rejects.toThrow('parsed 1 unique schools')
    expect(network).toHaveBeenCalledTimes(1)
  })
  it('refuses identity conflicts before any database writes and leaves a reconciliation report', async () => {
    directory = await mkdtemp(join(tmpdir(), 'gurodesk-school-reconcile-'))
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'disposable-test-fixture')
    const network = vi.fn(async () => new Response(JSON.stringify([{ school_id: '100001', school_name: 'Existing Name', region_name: 'NCR', division_name: 'Manila', source_name: 'DepEd National Inventory Dashboard', municipality: 'Existing Municipality', district_name: 'Verified District' }])))
    vi.stubGlobal('fetch', network)
    await expect(syncToSupabase([{ schoolId: '100001', schoolName: 'Changed Name', regionName: 'NCR', divisionName: 'Manila', regionCode: 'NCR', municipality: null }], { out: join(directory, 'snapshot.json'), allowRemoteSync: false, acceptSourceUpdates: false })).rejects.toThrow('Existing school identities differ')
    expect(network.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)
    const report = JSON.parse(await readFile(join(directory, 'snapshot.json.reconciliation.json'), 'utf8'))
    expect(report.conflicts[0].schoolId).toBe('100001')
    expect(report.conflicts[0].fields).not.toContain('municipality')
    expect(report.conflicts[0].fields).not.toContain('district_name')
  })
  it('requires explicit remote sync and validates bounded crawl/cache options', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://fixture.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'unit-not-real')
    await expect(syncToSupabase([], {})).rejects.toThrow('--allow-remote-sync')
    expect(() => parseArgs(['--cache-hours', '-1'])).toThrow()
    expect(() => parseArgs(['--concurrency', '99'])).toThrow()
    expect(parseArgs(['--from-file', 'snapshot.json', '--cache-hours', '48']).fromFile).toBe('snapshot.json')
  })
})
