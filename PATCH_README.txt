GURODESK SCHOOL DISTRICT + MOBILE A–Z SCHOOL PICKER FIX

Upload/extract this ZIP at the repository root.

Then tell AI Studio / your coding agent:

"Apply AI_STUDIO_DISTRICT_MERGE_INSTRUCTIONS.txt exactly. This package supersedes the previous
GuroDesk_School_Picker_Mobile_AZ_Fix_20260814.zip. Preserve newer unrelated work. Run the district
overlay, full school validation, type checks, unit tests, build, fresh and upgrade migrations,
then mobile-test 360/390/412px. Do not alter Gemini, TikZ, assessment scoring, or curriculum data."

Key behavior:
- Region -> Schools Division -> District -> School where verified district mappings exist.
- When a verified district map is not available, District remains a teacher-entered profile/document field.
- District is never inferred from municipality.
- School results paginate 20 at a time with "Load more schools", so browsing is not limited to A/B.
- Long school names wrap into auto-height rows and must never overlap.
- District is persisted in document history and included in built-in document headers.
