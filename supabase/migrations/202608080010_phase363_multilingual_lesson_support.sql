-- GuroDesk Phase 3.6.3: multilingual lesson support.
-- Adds explicit local-language naming and document-label language preferences.

alter table public.teacher_lesson_preferences
  add column if not exists local_language_name text not null default '';

alter table public.teacher_lesson_preferences
  alter column language_preference set default 'Auto';

-- Existing installs used English as the implicit default before Auto existed.
-- Auto still resolves to English for non-Filipino lessons, while allowing Filipino
-- learning areas to work natively without each teacher having to change this once.
update public.teacher_lesson_preferences
set language_preference = 'Auto'
where language_preference = 'English';

alter table public.teacher_export_preferences
  add column if not exists document_language text not null default 'match';

alter table public.teacher_export_preferences
  drop constraint if exists teacher_export_preferences_document_language_check;

alter table public.teacher_export_preferences
  add constraint teacher_export_preferences_document_language_check
  check (document_language in ('match', 'english', 'filipino'));

comment on column public.teacher_lesson_preferences.local_language_name is
'Optional teacher-provided language name used when Mother tongue / local language is selected, e.g. Cebuano or Ilocano.';

comment on column public.teacher_export_preferences.document_language is
'Controls printable document labels only: match lesson language, English, or Filipino. Lesson content is never translated during export.';
