-- Mathematics standards data-quality continuation (Grades 2 and 3).
-- Adds source-pinned standards only; existing competencies and historical snapshots are untouched.
begin;

-- Grade 2 Mathematics: 35 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'circles, half circles, quarter circles and composite figures made up of squares, rectangles, triangles, circles, half circles, and quarter circles.', 1, sd.id, 29
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'circles, half circles, quarter circles and composite figures made up of squares, rectangles, triangles, circles, half circles, and quarter circles.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'one step slides and flips of basic shapes and figures.', 2, sd.id, 29
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'one step slides and flips of basic shapes and figures.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'whole numbers up to 1000.', 3, sd.id, 29
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'whole numbers up to 1000.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'ordinal numbers up to 20th.', 4, sd.id, 29
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'ordinal numbers up to 20th.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition of numbers with sums up to 1000.', 5, sd.id, 29
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition of numbers with sums up to 1000.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'represent and describe circles, half circles and quarter circles. (MG)', 1, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'represent and describe circles, half circles and quarter circles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'compose and decompose composite figures made up of squares, rectangles, triangles, circles, half circles, and quarter circles. (MG)', 2, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'compose and decompose composite figures made up of squares, rectangles, triangles, circles, half circles, and quarter circles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'describe and draw the effect of one-step slides or flips in basic shapes and figures. (MG)', 3, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'describe and draw the effect of one-step slides or flips in basic shapes and figures. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'count, recognize, and represent, whole numbers up to 1000. (NA)', 4, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'count, recognize, and represent, whole numbers up to 1000. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use ordinal numbers up to 20th to describe position. (NA)', 5, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use ordinal numbers up to 20th to describe position. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform addition of numbers with sums up to 1000. (NA)', 6, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform addition of numbers with sums up to 1000. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the denominations and values of Philippine coins and bills up to ₱1000, and the addition of amounts of money with sums up to ₱1000.', 1, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the denominations and values of Philippine coins and bills up to ₱1000, and the addition of amounts of money with sums up to ₱1000.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'measurement, comparison, and estimation of length and distance using appropriate tools and units.', 2, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'measurement, comparison, and estimation of length and distance using appropriate tools and units.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'subtraction of numbers where both numbers are less than 1000.', 3, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'subtraction of numbers where both numbers are less than 1000.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'increasing patterns and decreasing patterns.', 4, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'increasing patterns and decreasing patterns.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine, and compare the value of, combinations of Philippine coins and bills up to ₱1000. (MG)', 1, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine, and compare the value of, combinations of Philippine coins and bills up to ₱1000. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform addition of amounts of money with sums up to ₱1000. (NA)', 2, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform addition of amounts of money with sums up to ₱1000. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'measure, compare, and estimate, length and distance using appropriate units. (MG)', 3, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'measure, compare, and estimate, length and distance using appropriate units. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform subtraction of numbers where both numbers are less than 1000. (NA)', 4, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform subtraction of numbers where both numbers are less than 1000. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'extend existing increasing patterns and decreasing patterns and create new increasing patterns and decreasing patterns. (NA)', 5, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'extend existing increasing patterns and decreasing patterns and create new increasing patterns and decreasing patterns. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'a pictograph with a scale for the representation of data.', 1, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'a pictograph with a scale for the representation of data.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'multiplication and division of whole numbers using the 2, 3, 4, 5, and 10 multiplication tables.', 2, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'multiplication and division of whole numbers using the 2, 3, 4, 5, and 10 multiplication tables.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'odd and even numbers.', 3, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'odd and even numbers.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'represent and interpret data in a pictograph with a scale. (DP)', 1, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'represent and interpret data in a pictograph with a scale. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'perform multiplication and division of whole numbers using the 2, 3, 4, 5, and 10 multiplication tables. (NA)', 2, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'perform multiplication and division of whole numbers using the 2, 3, 4, 5, and 10 multiplication tables. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'distinguish even and odd numbers. (NA)', 3, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'distinguish even and odd numbers. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'unit fractions and similar fractions with denominators 2, 3, 4, 5, 6, and 8.', 1, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'unit fractions and similar fractions with denominators 2, 3, 4, 5, 6, and 8.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'duration of time, elapsed time, and telling and writing time in hours and minutes (using a.m. and p.m.).', 2, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'duration of time, elapsed time, and telling and writing time in hours and minutes (using a.m. and p.m.).'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'straight and curved lines, and flat and curved surfaces.', 3, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'straight and curved lines, and flat and curved surfaces.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the perimeter of triangles, squares, and rectangles.', 4, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the perimeter of triangles, squares, and rectangles.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'represent, identify, and order unit fractions and similar fractions with denominators 2, 3, 4, 5, 6, and 8. (NA)', 1, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'represent, identify, and order unit fractions and similar fractions with denominators 2, 3, 4, 5, 6, and 8. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'identify and work with time measured in hours, half-hours, quarter hours, days, weeks, months, years. (MG)', 2, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'identify and work with time measured in hours, half-hours, quarter hours, days, weeks, months, years. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'describe duration of time and elapsed time, and read and write time in hours and minutes. (MG)', 3, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'describe duration of time and elapsed time, and read and write time in hours and minutes. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'distinguish between straight and curved lines, and between flat and curved surfaces. (MG)', 4, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'distinguish between straight and curved lines, and between flat and curved surfaces. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find the perimeter of triangles, squares, and rectangles. (MG)', 5, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 2'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find the perimeter of triangles, squares, and rectangles. (MG)'
  );

-- Grade 3 Mathematics: 39 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'areas of squares and rectangles.', 1, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'areas of squares and rectangles.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'points, lines, line segments, and rays.', 2, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'points, lines, line segments, and rays.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'parallel, perpendicular, and intersecting lines.', 3, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'parallel, perpendicular, and intersecting lines.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'whole numbers up to 10 000.', 4, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'whole numbers up to 10 000.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'ordinal numbers up to 100th.', 5, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'ordinal numbers up to 100th.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine the area of squares and rectangles. (MG)', 1, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine the area of squares and rectangles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'recognize and draw points, lines, lines segments, rays, and parallel and perpendicular lines. (MG)', 2, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'recognize and draw points, lines, lines segments, rays, and parallel and perpendicular lines. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'represent, round, compare, and order numbers up to 10 000. (NA)', 3, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'represent, round, compare, and order numbers up to 10 000. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'measures of mass and capacity.', 1, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'measures of mass and capacity.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition and subtraction of numbers of up to 4 digits and money up to ₱10 000.', 2, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition and subtraction of numbers of up to 4 digits and money up to ₱10 000.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'measure, estimate, and compare mass of objects. (MG)', 1, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'measure, estimate, and compare mass of objects. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'measure and estimate capacity. (MG)', 2, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'measure and estimate capacity. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'add and subtract whole numbers (including amounts of money) of up to 4 digits. (NA)', 3, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'add and subtract whole numbers (including amounts of money) of up to 4 digits. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'data presented in tables and single bar graphs.', 1, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'data presented in tables and single bar graphs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'outcomes from experiments and real-life situations.', 2, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'outcomes from experiments and real-life situations.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'multiplication using 6, 7, 8, and 9 multiplication tables.', 3, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'multiplication using 6, 7, 8, and 9 multiplication tables.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'properties of multiplication', 4, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'properties of multiplication'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'multiplication of numbers with and without regrouping', 5, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'multiplication of numbers with and without regrouping'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'estimation of products of two numbers by first rounding to the nearest multiple of 10.', 6, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'estimation of products of two numbers by first rounding to the nearest multiple of 10.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'determination of missing terms contained in repeating and increasing patterns, and repeating and decreasing patterns.', 7, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'determination of missing terms contained in repeating and increasing patterns, and repeating and decreasing patterns.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'generation of repeating and increasing patterns, and repeating and decreasing patterns.', 8, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'generation of repeating and increasing patterns, and repeating and decreasing patterns.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'present and interpret data in tables and single bar graphs. (DP)', 1, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'present and interpret data in tables and single bar graphs. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'describe and compare outcomes of events. (DP)', 2, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'describe and compare outcomes of events. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'multiply using 6, 7, 8, and 9 multiplication tables. (NA)', 3, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'multiply using 6, 7, 8, and 9 multiplication tables. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'illustrate and applies properties of multiplication. (NA)', 4, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'illustrate and applies properties of multiplication. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'multiply numbers with and without regrouping. (NA)', 5, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'multiply numbers with and without regrouping. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'estimate products of two numbers by first rounding to the nearest multiple of 10. (NA)', 6, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'estimate products of two numbers by first rounding to the nearest multiple of 10. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find a missing term and generate repeating and increasing patterns, and repeating and decreasing patterns. (NA)', 7, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find a missing term and generate repeating and increasing patterns, and repeating and decreasing patterns. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'division using the 6, 7, 8, and 9 multiplication tables.', 1, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'division using the 6, 7, 8, and 9 multiplication tables.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'division of 2- to 4-digit numbers.', 2, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'division of 2- to 4-digit numbers.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'estimation of quotients by first rounding the divisor and dividend to the nearest multiple of 10.', 3, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'estimation of quotients by first rounding the divisor and dividend to the nearest multiple of 10.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'addition and subtraction of similar fractions.', 4, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'addition and subtraction of similar fractions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'line symmetry.', 5, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D05'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'line symmetry.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'resulting figure after a translation.', 6, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D05'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'resulting figure after a translation.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use the 6, 7, 8, and 9 multiplication tables to divide numbers. (N/A)', 1, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use the 6, 7, 8, and 9 multiplication tables to divide numbers. (N/A)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'divide 2- to 4-digit numbers. (N/A)', 2, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'divide 2- to 4-digit numbers. (N/A)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'estimate quotients by first rounding the divisor and dividend to the nearest multiple of 10. (N/A)', 3, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'estimate quotients by first rounding the divisor and dividend to the nearest multiple of 10. (N/A)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'add and subtract similar fractions. (N/A)', 4, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'add and subtract similar fractions. (N/A)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'identify a symmetrical shape and draw the line of symmetry. (M/G)', 5, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D05'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'identify a symmetrical shape and draw the line of symmetry. (M/G)'
  );

commit;
