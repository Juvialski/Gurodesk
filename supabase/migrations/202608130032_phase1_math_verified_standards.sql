-- Phase 1 Mathematics standards data-quality continuation (Grades 1 and 4).
-- Adds source-pinned standards only; existing competencies and historical snapshots are untouched.
begin;

-- Grade 1 Mathematics: 30 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'simple 2-dimensional shapes and their features.', 1, sd.id, 25
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'simple 2-dimensional shapes and their features.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'whole numbers up to 100.', 2, sd.id, 25
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'whole numbers up to 100.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'ordinal numbers up to 10th.', 3, sd.id, 25
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'ordinal numbers up to 10th.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition of numbers with sums up to 20.', 4, sd.id, 25
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition of numbers with sums up to 20.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'identify and distinguish simple 2-dimensional shapes. (MG)', 1, sd.id, 25
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'identify and distinguish simple 2-dimensional shapes. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'count, recognize and represent whole numbers up to 100. (NA)', 2, sd.id, 25
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'count, recognize and represent whole numbers up to 100. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use ordinal numbers up to 10th to describe position. (NA)', 3, sd.id, 25
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use ordinal numbers up to 10th to describe position. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'compare and order numbers up to 20 and perform addition of numbers with sums up to 20. (NA)', 4, sd.id, 25
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'compare and order numbers up to 20 and perform addition of numbers with sums up to 20. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'measurement of length and distance using non-standard units.', 1, sd.id, 26
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'measurement of length and distance using non-standard units.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'place value in any 2-digit number.', 2, sd.id, 26
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'place value in any 2-digit number.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition of numbers, with sums up to 100.', 3, sd.id, 26
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition of numbers, with sums up to 100.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use non-standard units to compare and measure length and distance. (MG)', 1, sd.id, 26
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use non-standard units to compare and measure length and distance. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'order and decompose (into tens and ones) numbers up to 100. (NA)', 2, sd.id, 26
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'order and decompose (into tens and ones) numbers up to 100. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform addition of numbers with sums up to 100. (NA)', 3, sd.id, 26
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform addition of numbers with sums up to 100. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'a pictograph without a scale for the representation of data.', 1, sd.id, 27
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'a pictograph without a scale for the representation of data.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'subtraction of numbers where both numbers are less than 100.', 2, sd.id, 27
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'subtraction of numbers where both numbers are less than 100.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'repeating patterns.', 3, sd.id, 27
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'repeating patterns.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'represent and interpret data in a pictograph without a scale. (DP)', 1, sd.id, 27
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'represent and interpret data in a pictograph without a scale. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform subtraction of numbers where both numbers are less than 100. (NA)', 2, sd.id, 27
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform subtraction of numbers where both numbers are less than 100. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'extend existing repeating patterns and create new repeating patterns. (NA)', 3, sd.id, 27
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'extend existing repeating patterns and create new repeating patterns. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'fractions ½ and ¼.', 1, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'fractions ½ and ¼.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the denominations and values of Philippine coins and bills up to ₱100.', 2, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the denominations and values of Philippine coins and bills up to ₱100.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition of money where the sum is up to ₱100 and subtraction of money where both amounts are less than ₱100.', 3, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition of money where the sum is up to ₱100 and subtraction of money where both amounts are less than ₱100.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the movement of objects in half turn or quarter turn, in clockwise or counter clockwise direction.', 4, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the movement of objects in half turn or quarter turn, in clockwise or counter clockwise direction.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'time measured in hours, half hours, quarter hours, days, weeks, months, and years.', 5, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'time measured in hours, half hours, quarter hours, days, weeks, months, and years.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'illustrate and compare the fractions ½ and ¼. (NA)', 1, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'illustrate and compare the fractions ½ and ¼. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'recognize, and determine the value of, Philippine coins and bills up to ₱100. (NA)', 2, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'recognize, and determine the value of, Philippine coins and bills up to ₱100. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'add money where the sum is up to ₱100 and subtract money where both amounts are less than ₱100. (NA)', 3, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'add money where the sum is up to ₱100 and subtract money where both amounts are less than ₱100. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'identify the position of an object following a half turn or quarter turn, in clockwise or counter-clockwise direction. (MG)', 4, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'identify the position of an object following a half turn or quarter turn, in clockwise or counter-clockwise direction. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'identify and work with time measured in hours, half hours, quarter hours, days, weeks, months, and years. (MG)', 5, sd.id, 28
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 1'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'identify and work with time measured in hours, half hours, quarter hours, days, weeks, months, and years. (MG)'
  );

-- Grade 4 Mathematics: 36 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'measures of angles.', 1, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'measures of angles.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'properties of triangles and quadrilaterals.', 2, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'properties of triangles and quadrilaterals.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'perimeter of quadrilaterals, and composite figures composed of triangles and quadrilaterals.', 3, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'perimeter of quadrilaterals, and composite figures composed of triangles and quadrilaterals.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'whole numbers up to 1 000 000.', 4, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'whole numbers up to 1 000 000.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition of numbers with sums up to 1 000 000 and subtraction of numbers where both numbers are less than 1 000 000.', 5, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition of numbers with sums up to 1 000 000 and subtraction of numbers where both numbers are less than 1 000 000.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'illustrate and measure different angles. (MG)', 1, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'illustrate and measure different angles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'classify triangles and quadrilateral, and differentiate quadrilaterals, by applying their properties. (MG)', 2, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'classify triangles and quadrilateral, and differentiate quadrilaterals, by applying their properties. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find the perimeter of quadrilaterals and composite figures composed of triangles and quadrilaterals. (MG)', 3, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find the perimeter of quadrilaterals and composite figures composed of triangles and quadrilaterals. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'read, write, and compare whole numbers up to 1 000 000. (NA)', 4, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'read, write, and compare whole numbers up to 1 000 000. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'performs addition of numbers with sums up to 1 000 000 and subtraction of numbers where both numbers are less than 1 000 000. (NA)', 5, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'performs addition of numbers with sums up to 1 000 000 and subtraction of numbers where both numbers are less than 1 000 000. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'multiplication of whole numbers with products up to 1 000 000, division of up to 4-digit numbers by up to 2-digit numbers, and the MDAS rules.', 1, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'multiplication of whole numbers with products up to 1 000 000, division of up to 4-digit numbers by up to 2-digit numbers, and the MDAS rules.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'conversion of units of length, mass, capacity, and time.', 2, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'conversion of units of length, mass, capacity, and time.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition and subtraction of similar fractions, including mixed numbers.', 3, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition and subtraction of similar fractions, including mixed numbers.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform multiplication of whole numbers with products up to 1 000 000. (NA)', 1, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform multiplication of whole numbers with products up to 1 000 000. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform division of up to 4-digit numbers by up to 2-digit numbers. (NA)', 2, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform division of up to 4-digit numbers by up to 2-digit numbers. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform different operations by applying the MDAS rules. (NA)', 3, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform different operations by applying the MDAS rules. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'convert units of length, mass, capacity, and time. (MG)', 4, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'convert units of length, mass, capacity, and time. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform addition and subtraction of similar fractions, including mixed numbers. (NA)', 5, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform addition and subtraction of similar fractions, including mixed numbers. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'dissimilar and equivalent fractions.', 1, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'dissimilar and equivalent fractions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'factors and multiples of numbers up to 100.', 2, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'factors and multiples of numbers up to 100.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition and subtraction of dissimilar fractions.', 3, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition and subtraction of dissimilar fractions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'symmetric figures with respect to a line.', 4, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'symmetric figures with respect to a line.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'resulting images after applying reflection with respect to a line.', 5, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'resulting images after applying reflection with respect to a line.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'represent, compare, and order dissimilar fractions. (NA)', 1, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'represent, compare, and order dissimilar fractions. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find factors and multiples of numbers up to 100. (NA)', 2, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find factors and multiples of numbers up to 100. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'identify symmetry with respect to a line, and create figures that have line symmetry. (MG)', 3, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'identify symmetry with respect to a line, and create figures that have line symmetry. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform reflection with respect to a line, including glide reflection, to obtain images of shapes. (MG)', 4, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform reflection with respect to a line, including glide reflection, to obtain images of shapes. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'presentation and interpretation of data in tabular form and in a single line graph.', 1, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'presentation and interpretation of data in tabular form and in a single line graph.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'simple patterns.', 2, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'simple patterns.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'number sentences.', 3, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'number sentences.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'decimal numbers and their relationship to fractions.', 4, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'decimal numbers and their relationship to fractions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'present and interpret data in tabular form and in a single line graph. (DP)', 1, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'present and interpret data in tabular form and in a single line graph. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'generate a simple pattern and describe the rule used. (NA)', 2, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'generate a simple pattern and describe the rule used. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'complete number sentences to represent number properties and number facts. (NA)', 3, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'complete number sentences to represent number properties and number facts. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'represent, compare, order, and round decimal numbers. (NA)', 4, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'represent, compare, order, and round decimal numbers. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'convert decimal numbers to fractions and fractions (with denominators 10 or 100) to decimals. (NA)', 5, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'convert decimal numbers to fractions and fractions (with denominators 10 or 100) to decimals. (NA)'
  );

commit;
