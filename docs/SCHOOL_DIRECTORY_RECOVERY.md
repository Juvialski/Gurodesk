# School directory audit and resumable reconciliation

Directory search already uses server-side query/region/division/district filters, School ID lookup, and offset pagination. The picker now ignores stale “load more” responses after the search changes. District remains teacher-entered/unverified unless an explicit official School ID-to-District mapping exists; municipality is never substituted for District.

Production population is **unverified**. An anonymous REST request returned an empty RLS-visible result; the repository allows school reads only for authenticated teachers. That response must not be used as a zero-school count. The Supabase SQL connector returned `28P01`, so total counts, alphabetical coverage, division/region completeness, duplicates, and production migration history could not be established.

## Read-only coverage audit

Use `node scripts/schools/audit-directory.mjs --help` for the authorized environment requirements. The script pages through accessible school rows and prints only counts by region/division/initial, duplicates and verified-District coverage. A teacher JWT reports only RLS-visible active schools; backend-authorized reads can see the wider directory. Do not paste credentials into chat or commit environment files. No audit requests were run with a teacher/service credential in this session.

## Import workflow

```powershell
# Read official DepEd public pages and produce a validated snapshot; no Supabase writes.
npm.cmd run schools:import:nid

# Resume interrupted requests from the default ignored page cache (24-hour reuse).
npm.cmd run schools:import:nid

# Validate a completed snapshot without making more DepEd requests.
node scripts/schools/import-deped-nid.mjs --from-file data/schools/philippine-schools.generated.json
```

`--cache-dir`, `--cache-hours` (0 refreshes, maximum 168), `--concurrency` (1–8, default 3), and `--delay` preserve bounded courteous crawling. Cached evidence keeps its original fetched timestamp. An incomplete division with an advertised count is rejected before a national snapshot is published. Conflicting duplicate School IDs and national coverage under 40,000 / 95% of the reported total are rejected.

For an authorized isolated sync, provide backend-only Supabase environment values and add `--sync --from-file <snapshot>`. A hosted target additionally requires `--allow-remote-sync`. The complete input is reconciled before any write, and `<out>.reconciliation.json` reports new, unchanged, and conflicting identities. Identity conflicts stop all writes. `--accept-source-updates` is only for reviewed NID-owned updates. Newly missing municipality/province/type fields cannot erase existing facts, District fields are never sent by this importer, missing schools are never automatically deactivated, and unreviewed inserts ignore existing IDs.

No national crawl or production import was performed during this implementation. Production reconciliation remains a human-authorized operation after database access is recovered.
