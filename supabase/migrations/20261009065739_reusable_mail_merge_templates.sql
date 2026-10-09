-- Reuse the existing private template bucket and teacher ownership policies.
-- Existing lesson/TOS formats and rows retain their original contracts.
alter table public.document_templates drop constraint if exists document_templates_document_type_check;
alter table public.document_templates add constraint document_templates_document_type_check
  check (document_type in ('lesson_plan', 'tos', 'teacher_document'));
