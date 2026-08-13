-- Mathematics standards data-quality continuation (Grades 5 and 6).
-- Adds source-pinned standards only; existing competencies and historical snapshots are untouched.
begin;

-- Grade 5 Mathematics: 36 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', '12- and 24-hour time, and world time zones.', 1, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = '12- and 24-hour time, and world time zones.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the GMDAS rules for operations with numbers.', 2, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the GMDAS rules for operations with numbers.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'multiplication of fractions.', 3, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'multiplication of fractions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'area of a parallelogram, triangle, and trapezoid.', 4, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'area of a parallelogram, triangle, and trapezoid.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use 12- and 24- hour time. (MG)', 1, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use 12- and 24- hour time. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'compare the time in world time zones with the time in the Philippines. (MG)', 2, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'compare the time in world time zones with the time in the Philippines. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use the GMDAS rules for 3 or more different operations. (NA)', 3, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use the GMDAS rules for 3 or more different operations. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'multiply fractions. (NA)', 4, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'multiply fractions. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine the area of a parallelogram, triangle, and trapezoid. (MG)', 5, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine the area of a parallelogram, triangle, and trapezoid. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'division of fractions.', 1, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'division of fractions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'decimal numbers with decimal parts up to ten thousandths.', 2, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'decimal numbers with decimal parts up to ten thousandths.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition and subtraction of decimal numbers.', 3, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition and subtraction of decimal numbers.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'divisibility rules.', 4, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'divisibility rules.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'prime and composite numbers.', 5, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'prime and composite numbers.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'divide fractions. (NA)', 1, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'divide fractions. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'compare, order, and round decimals to the nearest one thousandth. (NA)', 2, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'compare, order, and round decimals to the nearest one thousandth. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'add and subtract decimal numbers. (NA)', 3, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'add and subtract decimal numbers. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use divisibility rules. (NA)', 4, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use divisibility rules. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'distinguish prime numbers from composite numbers. (NA)', 5, sd.id, 45
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'distinguish prime numbers from composite numbers. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'double bar graphs and double line graphs.', 1, sd.id, 46
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'double bar graphs and double line graphs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'theoretical probability.', 2, sd.id, 46
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'theoretical probability.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'multiplication and division of decimal numbers.', 3, sd.id, 46
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'multiplication and division of decimal numbers.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'identify, construct, and interpret double bar graphs and double line graphs. (DP)', 1, sd.id, 46
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'identify, construct, and interpret double bar graphs and double line graphs. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'draw conclusions and make inferences from data represented in double bar graphs and double line graphs. (DP)', 2, sd.id, 46
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'draw conclusions and make inferences from data represented in double bar graphs and double line graphs. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'calculate theoretical probability. (DP)', 3, sd.id, 46
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'calculate theoretical probability. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'multiply and divide decimal numbers. (NA)', 4, sd.id, 46
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'multiply and divide decimal numbers. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'GMDAS rules when performing three or more operations with fractions and decimals.', 1, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'GMDAS rules when performing three or more operations with fractions and decimals.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'prisms and pyramids.', 2, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'prisms and pyramids.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'surface area of solid figures.', 3, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'surface area of solid figures.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'cubes and rectangular prisms.', 4, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'cubes and rectangular prisms.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'resulting image after rotation', 5, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'resulting image after rotation'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'apply the GMDAS rules with operations with fractions and decimals. (NA)', 1, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'apply the GMDAS rules with operations with fractions and decimals. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'illustrate and describe solid figures and their nets. (MG)', 2, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'illustrate and describe solid figures and their nets. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine the surface area of solid figures. (MG)', 3, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine the surface area of solid figures. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'distinguish between cubes and rectangular prisms, and estimate their volumes. (MG)', 4, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'distinguish between cubes and rectangular prisms, and estimate their volumes. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'draw the image of an object after applying rotation about a point (MG)', 5, sd.id, 47
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'draw the image of an object after applying rotation about a point (MG)'
  );

-- Grade 6 Mathematics: 30 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'tessellation of shapes.', 1, sd.id, 48
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'tessellation of shapes.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'translation, reflection and rotation with shapes', 2, sd.id, 48
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'translation, reflection and rotation with shapes'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the four operations with decimals.', 3, sd.id, 48
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the four operations with decimals.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the four operations with different combinations of fractions, whole numbers, and mixed numbers.', 4, sd.id, 48
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the four operations with different combinations of fractions, whole numbers, and mixed numbers.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'tessellate a surface using different shapes. (MG)', 1, sd.id, 48
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'tessellate a surface using different shapes. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform the four operations with decimals. (NA)', 2, sd.id, 48
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform the four operations with decimals. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform the four operations with different combinations of fractions, whole numbers, and mixed numbers. (NA)', 3, sd.id, 48
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform the four operations with different combinations of fractions, whole numbers, and mixed numbers. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'ratio and proportion.', 1, sd.id, 49
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'ratio and proportion.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'percentages, and their relationships with fractions and decimals.', 2, sd.id, 49
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'percentages, and their relationships with fractions and decimals.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'exponential form, including calculation using the GEMDAS rules.', 3, sd.id, 49
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'exponential form, including calculation using the GEMDAS rules.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'describe and apply the concepts of ratio and proportion. (NA)', 1, sd.id, 49
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'describe and apply the concepts of ratio and proportion. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'relate percentages to fractions and decimals. (NA)', 2, sd.id, 49
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'relate percentages to fractions and decimals. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'evaluate, and perform calculations with, numbers expressed in exponential form. (NA)', 3, sd.id, 49
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'evaluate, and perform calculations with, numbers expressed in exponential form. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'units of volume and capacity.', 1, sd.id, 50
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'units of volume and capacity.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'volume of cubes and rectangular prisms.', 2, sd.id, 50
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'volume of cubes and rectangular prisms.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'perimeter and area of triangles, parallelograms, trapezoids, and composite figures composed of triangles, squares, and rectangles.', 3, sd.id, 50
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'perimeter and area of triangles, parallelograms, trapezoids, and composite figures composed of triangles, squares, and rectangles.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'parts of a circle, including circumference.', 4, sd.id, 50
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'parts of a circle, including circumference.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'convert between units of volume and capacity. (MG)', 1, sd.id, 50
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'convert between units of volume and capacity. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find the volume of cubes and rectangular prisms. (MG)', 2, sd.id, 50
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find the volume of cubes and rectangular prisms. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find the perimeter and area of triangles, parallelograms, trapezoids, and composite figures composed of triangles, squares, and rectangles. (MG)', 3, sd.id, 50
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find the perimeter and area of triangles, parallelograms, trapezoids, and composite figures composed of triangles, squares, and rectangles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'describe the parts of a circle. (MG)', 4, sd.id, 50
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'describe the parts of a circle. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use pi (π) to calculate the circumference of a circle. (MG)', 5, sd.id, 50
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use pi (π) to calculate the circumference of a circle. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'area of a circle', 1, sd.id, 51
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'area of a circle'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'composite figures composed of any two or more of: triangle, square, rectangle, circle, semi-circle.', 2, sd.id, 51
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'composite figures composed of any two or more of: triangle, square, rectangle, circle, semi-circle.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'pie graphs.', 3, sd.id, 51
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'pie graphs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'common factors, greatest common factors, common multiples, and least common multiples.', 4, sd.id, 51
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'common factors, greatest common factors, common multiples, and least common multiples.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find the area of a circle. (MG)', 1, sd.id, 51
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find the area of a circle. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find the area of composite figures composed of any two or more of: triangle, square, rectangle, circle, semi-circle. (MG)', 2, sd.id, 51
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find the area of composite figures composed of any two or more of: triangle, square, rectangle, circle, semi-circle. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'construct and interpret pie graphs. (DP)', 3, sd.id, 51
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'construct and interpret pie graphs. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find common factors, greatest common factors, common multiples, and least common multiples. (NA)', 4, sd.id, 51
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find common factors, greatest common factors, common multiples, and least common multiples. (NA)'
  );

commit;
