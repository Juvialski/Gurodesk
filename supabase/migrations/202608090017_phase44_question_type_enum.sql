-- Enum values are committed in their own migration before functions that
-- reference them are parsed.  This avoids PostgreSQL's "unsafe use of new
-- value" rule on hosted migration runners.
alter type public.assessment_question_type add value if not exists 'identification';
alter type public.assessment_question_type add value if not exists 'fill_in_the_blank';
alter type public.assessment_question_type add value if not exists 'numerical_answer';
alter type public.assessment_question_type add value if not exists 'problem_solving';
alter type public.assessment_question_type add value if not exists 'matching';
alter type public.assessment_question_type add value if not exists 'multiple_select';
alter type public.assessment_question_type add value if not exists 'essay';
