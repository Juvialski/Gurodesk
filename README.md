# GuroDesk — Phase 2 Curriculum Engine

GuroDesk is a mobile-friendly web workspace intended to reduce repetitive DepEd teacher planning and paperwork. The product principle is **structured, versioned DepEd knowledge first; AI generation second**.

## Phase 2 implemented

- everything from the Phase 1 React + TypeScript + Supabase foundation
- real Curriculum Navigator UI filtered by the teacher's saved assignments
- school-year-aware curriculum applicability records
- curriculum-guide sequence periods separated from school grading/reporting periods
- SY 2026-2027 three-term grading-calendar metadata foundation
- verified source provenance shown in the teacher UI
- canonical JSON curriculum-manifest format
- manifest validator that rejects unsafe/incomplete verified imports
- deterministic manifest-to-Supabase SQL generator
- first complete verified dataset: **Grade 7 Mathematics, 52 competencies, Quarters 1-4** from the official DepEd MATATAG Mathematics curriculum guide
- demo mode uses the same verified manifest rather than mock competencies
- Supabase seed migration for Grade 7 Mathematics
- source/verification guardrails so normal teachers cannot publish official curriculum records

## Intentionally not implemented yet

- Gemini lesson generation (Phase 3)
- TOS/test generation (Phase 4)
- assessment-result analysis
- paperwork templates
- DOCX/PDF/XLSX export engine
- bulk curriculum coverage for every grade/subject

The curriculum engine is deliberately built before AI generation so later prompts can be grounded in verified records instead of asking Gemini to remember DepEd requirements.

## Run locally / AI Studio

```bash
npm install
npm run dev
```

No environment variables are needed for demo mode. Choose **Open sample teacher workspace** and open **Curriculum** to browse the Grade 7 Mathematics dataset.

## Connect Supabase

Apply migrations in filename order:

```text
supabase/migrations/202608080001_phase1_foundation.sql
supabase/migrations/202608080002_phase2_curriculum_engine.sql
supabase/migrations/202608080003_seed_g7_mathematics.sql
supabase/migrations/202608080004_phase2_pacing_foundation.sql
```

Then copy `.env.example` to `.env.local` and add:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Do **not** put `GEMINI_API_KEY` in a `VITE_*` variable. Gemini remains server-side through Supabase Edge Functions.

## Curriculum data workflow

Verified curriculum data lives under `data/curriculum/` as source-controlled JSON manifests.

Validate all manifests:

```bash
npm run curriculum:validate
```

Regenerate the Grade 7 Mathematics seed:

```bash
npm run curriculum:generate:g7math
```

Never hand-edit generated curriculum SQL. Correct the reviewed manifest, validate it, and regenerate.

## Security / integrity rules

- teacher-owned data remains protected by RLS
- official knowledge tables are read-only to normal authenticated users
- draft curriculum versions are not teacher-visible
- teacher-visible competencies must have `verification_status = verified`
- no curriculum competency is invented by Gemini
- no browser code receives the Gemini API key
- three-term school grading does not overwrite quarter-based sequencing in a curriculum guide

See `docs/PHASE_2_CURRICULUM_ENGINE.md`, `docs/DEPED_SOURCE_REGISTER.md`, `docs/AI_STUDIO_SETUP.md`, and `CODEX_HANDOVER.md`.
