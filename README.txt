This is the surgical repair for the Gemini commit audited at:

1d13db10b6601421010d32433a5a4c839a93fe92

It fixes the three confirmed problems:
1. restores the accidentally truncated 17 MB official curriculum SQL bundle;
2. adds District to Lesson Plan and TOS browser/print previews;
3. fixes the TOS PDF first-page height budget after adding more metadata.

Upload/extract this ZIP at the GuroDesk repository root, then tell AI Studio:

"Run node scripts/repair-district-regression.mjs, then follow
AI_STUDIO_FIX_GEMINI_DISTRICT_REGRESSION.txt exactly. Preserve newer unrelated work and commit
only after all CI, migration, E2E, and document checks pass."
