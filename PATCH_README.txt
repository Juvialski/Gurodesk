GURODESK — SCHOOL DIRECTORY BUILD HOTFIX

Target broken main: b8511ece875531795d908e67679ac1bf8027b984

Upload/extract this ZIP at the repository root. It directly fixes the two TypeScript blockers visible in Render:
- missing school identity fields on Profile
- wrong ./supabaseClient import

It also makes build/CI auto-run the idempotent school overlay so Onboarding, Settings, profile persistence, and validation are no longer left half-applied.

Preferred AI Studio instruction:
"Apply AI_STUDIO_BUILD_HOTFIX_20260814.txt exactly. Commit the overlay result only after validate:schools, typecheck, unit tests, and build pass. Preserve assessment/Gemini/TikZ code."
