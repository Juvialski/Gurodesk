-- GuroDesk Phase 3.5: teacher-guided lesson suggestions and reusable teaching setup.
-- Specific books, page numbers, materials and devices remain teacher-supplied only.

create table if not exists public.teacher_lesson_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_duration_minutes integer not null default 60 check (default_duration_minutes between 10 and 300),
  language_preference text not null default 'English',
  typical_class_profile text not null default '',
  available_technology text[] not null default '{}',
  preferred_approaches text[] not null default '{}',
  actual_resources text[] not null default '{}',
  resource_notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger teacher_lesson_preferences_set_updated_at
before update on public.teacher_lesson_preferences
for each row execute function public.set_updated_at();

alter table public.teacher_lesson_preferences enable row level security;

create policy "teacher_lesson_preferences_select_own" on public.teacher_lesson_preferences
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "teacher_lesson_preferences_insert_own" on public.teacher_lesson_preferences
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "teacher_lesson_preferences_update_own" on public.teacher_lesson_preferences
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "teacher_lesson_preferences_delete_own" on public.teacher_lesson_preferences
for delete to authenticated
using ((select auth.uid()) = user_id);

alter table public.lesson_plan_ai_events
  drop constraint if exists lesson_plan_ai_events_support_type_check;

alter table public.lesson_plan_ai_events
  add constraint lesson_plan_ai_events_support_type_check check (support_type in (
    'refine_clarity',
    'organize_text',
    'grammar_spelling',
    'format_text',
    'translate',
    'suggest_learning_objectives',
    'suggest_home_alternative',
    'suggest_pre_lesson',
    'suggest_lesson_flow',
    'suggest_contextualization',
    'suggest_inclusion',
    'suggest_formative_assessment',
    'suggest_evidence_of_learning',
    'suggest_next_steps',
    'suggest_extended_learning',
    'quick_draft'
  ));

alter table public.lesson_plan_ai_events
  drop constraint if exists lesson_plan_ai_events_declaration_category_check;

alter table public.lesson_plan_ai_events
  add constraint lesson_plan_ai_events_declaration_category_check
  check (declaration_category in ('limited', 'guided', 'suggested'));

comment on table public.teacher_lesson_preferences is
'Teacher-owned reusable lesson suggestion constraints. Actual resources are entered by the teacher; AI must not invent resources.';
