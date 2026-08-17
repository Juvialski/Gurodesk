---
name: curriculum-and-district-standards
description: >-
  Authoritative guide for managing Philippine DepEd K-12 and Matatag national curriculum manifests,
  database seed generation rules, and verified school district directory reconciliation.
---

# Philippine Curriculum & School District Standards

This skill defines the governance rules for national curriculum data, database seeds, and official school directory reconciliation in GuroDesk.

---

## 1. National Curriculum Governance (196 Official Manifests)

The source of truth for the Philippine curriculum is the 196 official JSON manifests in:
`data/curriculum/official/*.json`

### Critical Rules
1. **Never Manually Edit `supabase/seeds/official-curriculum-complete.sql`**:
   - This file is a deterministic generated artifact and is untracked in Git.
   - It is generated exclusively by `scripts/generate-official-curriculum-bundle.mjs`.
   - CI validation generates into OS temporary storage (`tmpdir`) and cleans up immediately.
2. **Never Invent Curriculum Content**:
   - All learning areas, grade levels, quarter/period assignments, competencies, and performance standards must be sourced directly from official DepEd curriculum guides and department orders.
   - Competency codes and descriptions must preserve official Philippine DepEd terminology.

---

## 2. Philippine School District Directory System

- **District is First-Class**:
  - In DepEd administrative hierarchy: `Region` &rarr; `Division (Schools Division Office)` &rarr; `District` &rarr; `School`.
  - District represents an administrative grouping of elementary/secondary schools under a Public Schools District Supervisor (PSDS).
- **No Inferred Districts**:
  - Never infer District from municipality or city name; Philippine school districts frequently split municipalities (e.g. *Daet North*, *Daet South*).
  - A verified District requires an explicit official DepEd School ID &rarr; District mapping in `data/schools/`.
  - If a verified mapping is not yet present, allow teacher-entered manual / unverified district text without blocking the onboarding workflow.

---

## 3. Pre-Commit Validation

Before pushing any curriculum or school directory changes, run:
```powershell
node scripts/check-school-directory-contract.mjs
node scripts/check-school-district-contract.mjs
node scripts/schools/validate-school-directory.mjs data/schools/philippine-schools.sample.json
```
