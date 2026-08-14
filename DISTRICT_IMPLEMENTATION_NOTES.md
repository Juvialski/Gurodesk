# GuroDesk District identity implementation

## Data policy

The national school identity table remains grounded in the DepEd National Inventory Dashboard.
District is modeled separately because NID does not currently expose a complete nationwide
School ID-to-District mapping.

A district is considered verified only when the corresponding `philippine_schools` record has
an explicit district sourced from an official DepEd page/dataset. Otherwise, a teacher can enter
the official district once and GuroDesk stores it as manual/unverified.

No municipality-to-district inference is allowed.

## Profile fields

- `district`
- `district_source`: `deped_official | manual | unknown`
- `district_verified`

## Directory enrichment fields

- `district_code`
- `district_name`
- `district_source_name`
- `district_source_url`
- `district_verified_at`

## Historical integrity

New `documents`, `assessment_documents`, and `result_sessions` rows snapshot District together
with School ID/School/Region/Division. Existing historical rows are not backfilled.

## UX

- Verified mappings: Region -> Division -> District -> School.
- Missing mapping: Region -> Division -> District text entry + School search.
- Result pages: 20 at a time; Load more appends without replacing prior rows.
- Mobile rows use auto height and wrapping.


## Verified district enrichment

`scripts/schools/import-verified-districts.mjs` is intentionally strict. It accepts only reviewed
mappings where the official source explicitly contains the DepEd School ID and District. It rejects
name-only/fuzzy joins as verified mappings. This lets district coverage grow division-by-division
without weakening the canonical national School ID identity.
