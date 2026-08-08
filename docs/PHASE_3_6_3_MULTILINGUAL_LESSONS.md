# Phase 3.6.3 — Multilingual lesson support

GuroDesk now treats lesson language as an explicit teacher-controlled setting rather than relying on Gemini to infer it inconsistently.

## AI suggestion language

`My teaching setup` supports:

- Auto — match subject / lesson text
- English
- Filipino
- English + Filipino
- Mother tongue / local language, with an optional explicit language name such as Cebuano, Ilocano, or Hiligaynon

The lesson AI Edge Function adds an explicit output-language rule to Quick Draft and all planning-suggestion prompts. Non-translation polishing preserves the teacher's existing language. Explicit Translate actions can translate a teacher-authored field to Filipino, English, or the configured local language.

Auto mode chooses Filipino for the Filipino learning area and when existing lesson text is predominantly Filipino; otherwise it defaults to English.

## Printable document language

Export Settings now supports:

- Match lesson language
- English
- Filipino

This changes only printable headings and labels. It never translates the teacher's actual lesson content during PDF, Word, or print generation.

When `Match lesson language` is selected, Filipino lessons receive Filipino ILAW headings and metadata labels automatically. English lessons remain English.

## Database migration

`202608080010_phase363_multilingual_lesson_support.sql` adds:

- `teacher_lesson_preferences.local_language_name`
- `teacher_export_preferences.document_language`

Both remain teacher-owned through the RLS policies already defined on their parent tables.
