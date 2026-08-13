# Curriculum standards handover — 2026-08-13

## Delivered

- 2,394 newly transcribed, exact-source content/performance standards:
  - 1,506 across 45 Revised K–10 manifests;
  - 888 across all 116 Strengthened SHS manifests.
- 2,838 standards total across 175 of 196 official manifests when combined with the 444 Mathematics and Science standards already present.
- Reviewable source-hash-pinned sidecars in `data/curriculum/sources/verified-standards/`.
- Additive migration `202608130038_verified_curriculum_standards_expansion.sql`, generated from all 175 standards-complete manifests.

Competency collections are checksum-locked by regression tests. Migration 038 only inserts missing exact standards; it does not update/delete competencies, existing standards, finalized TOS data, assessment snapshots, or RLS policies. Deploy it after migration 037, which fixes historical assessment snapshot validation.

## Exact-source hold

Twenty-one Revised K–10 manifests intentionally remain without standards: Grades 4–10 for each of Araling Panlipunan, MAPEH Music and Arts, and MAPEH Physical Education and Health. The currently obtainable public downloads do not match the already registered bytes, and the registered SharePoint URLs reject downloads. No alternate mirror or invented curriculum text was used.

| Registered source | SHA-256 |
| --- | --- |
| `FINAL MATATAG Araling Panlipunan CG 2023 Grades 4-10.pdf` | `7b643c05dbac653b229416aa19d3d14d1f2b7baadb93c64a66c762e45ef91490` |
| `FINAL MATATAG Music and Arts CG 2023 Grades 4-10.pdf` | `df37bef41e2af8c4bf0320b718461948f8e3ddc3687ffb49cd99a1e68e61ea67` |
| `FINAL MATATAG PE and Health CG 2023 Grades 4-10.pdf` | `31e3758e6260530bd41db71f6f7ea614ee6ceba6136b62f20aa62be88960943d` |

The coverage validator fails if any other manifest lacks standards or if these blocked-source identities change unexpectedly. Complete the remaining 21 only after recovering and hash-verifying the exact registered files, or after an intentional reviewed source-register revision.
