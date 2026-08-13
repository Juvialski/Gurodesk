-- Mathematics standards data-quality continuation (Grades 8-10).
-- Adds source-pinned standards only; existing competencies and historical snapshots are untouched.
begin;

-- Grade 8 Mathematics: 39 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'measures of central tendency of ungrouped data.', 1, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'measures of central tendency of ungrouped data.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'algebraic expressions and operations with monomials, binomials, and multinomials.', 2, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'algebraic expressions and operations with monomials, binomials, and multinomials.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'special products for binomials, and factorization of polynomials.', 3, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'special products for binomials, and factorization of polynomials.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'rational algebraic expressions and equations.', 4, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'rational algebraic expressions and equations.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'rules for obtaining terms in sequences.', 5, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'rules for obtaining terms in sequences.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'plotting points, and finding distance and the midpoint of line segments on the Cartesian coordinate plane.', 1, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'plotting points, and finding distance and the midpoint of line segments on the Cartesian coordinate plane.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'volume of pyramids (other than square and rectangular pyramids), cones, and spheres.', 2, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'volume of pyramids (other than square and rectangular pyramids), cones, and spheres.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the Pythagorean Theorem.', 3, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the Pythagorean Theorem.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'triangle inequality theorems.', 4, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'triangle inequality theorems.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'earning money, profit and loss, ‘best buys’, buying on terms.', 5, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'earning money, profit and loss, ‘best buys’, buying on terms.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'linear equations in one variable.', 1, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'linear equations in one variable.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'linear inequalities in one variable and their graphs.', 2, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'linear inequalities in one variable and their graphs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'linear equations in two variables and their graphs.', 3, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'linear equations in two variables and their graphs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'systems of linear equations in two variables.', 4, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'systems of linear equations in two variables.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'linear inequalities in two variables.', 5, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'linear inequalities in two variables.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'measures of variability for ungrouped data.', 1, sd.id, 59
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'measures of variability for ungrouped data.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'interpretation and analysis of graphs from primary and secondary data.', 2, sd.id, 59
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'interpretation and analysis of graphs from primary and secondary data.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'experimental and theoretical probability.', 3, sd.id, 59
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'experimental and theoretical probability.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the Fundamental Counting Principle.', 4, sd.id, 59
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the Fundamental Counting Principle.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine measures of central tendency of ungrouped data and use the measures to draw conclusions. (DP)', 1, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine measures of central tendency of ungrouped data and use the measures to draw conclusions. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'add and subtract monomials, and multiply combinations of monomials, binomials, and multinomials. (NA)', 2, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'add and subtract monomials, and multiply combinations of monomials, binomials, and multinomials. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'obtain special binomial products. (NA)', 3, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'obtain special binomial products. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'factorize different types of polynomials. (NA)', 4, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'factorize different types of polynomials. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'simplify, and operate with, rational algebraic expressions and solve simple rational algebraic equations. (NA)', 5, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'simplify, and operate with, rational algebraic expressions and solve simple rational algebraic equations. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'obtain the rule for finding the next term in a sequence. (NA)', 6, sd.id, 56
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'obtain the rule for finding the next term in a sequence. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'plot points, find the distance between two points, and find the midpoint of line segments, on the Cartesian coordinate plane. (NA)', 1, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'plot points, find the distance between two points, and find the midpoint of line segments, on the Cartesian coordinate plane. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'finds the volume of pyramids other than square and rectangular pyramids, and the volumes of cones and spheres. (MG)', 2, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'finds the volume of pyramids other than square and rectangular pyramids, and the volumes of cones and spheres. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use the Pythagorean theorem to find sides in right triangles and its converse to classify triangles. (MG)', 3, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use the Pythagorean theorem to find sides in right triangles and its converse to classify triangles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use the triangle inequality theorems to establish results for angles and sides in triangles. (MG)', 4, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use the triangle inequality theorems to establish results for angles and sides in triangles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'solve financial problems involving earning money, profit and loss, “best buys,” and buying on terms. (NA)', 5, sd.id, 57
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'solve financial problems involving earning money, profit and loss, “best buys,” and buying on terms. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'solve linear equations and linear inequalities in one variable. (NA)', 1, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'solve linear equations and linear inequalities in one variable. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'graph linear inequalities in one variable. (NA)', 2, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'graph linear inequalities in one variable. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'graph linear equations in two variables. (NA)', 3, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'graph linear equations in two variables. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'solve a system of linear equations graphically and algebraically. (NA)', 4, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'solve a system of linear equations graphically and algebraically. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use linear inequalities in two variables in the solution of problems. (NA)', 5, sd.id, 58
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use linear inequalities in two variables in the solution of problems. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'calculate measures of variability for ungrouped data. (DP)', 1, sd.id, 59
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'calculate measures of variability for ungrouped data. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'interpret and analyze graphs from primary and secondary data. (DP)', 2, sd.id, 59
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'interpret and analyze graphs from primary and secondary data. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine the number of possible outcomes of an experiment using the Fundamental Counting Principle. (DP)', 3, sd.id, 59
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine the number of possible outcomes of an experiment using the Fundamental Counting Principle. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'calculate the probability of a single event and the probability of simple combined events. (DP)', 4, sd.id, 59
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 8'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'calculate the probability of a single event and the probability of simple combined events. (DP)'
  );

-- Grade 9 Mathematics: 38 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'simple geometric concepts and notations.', 1, sd.id, 60
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'simple geometric concepts and notations.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'perpendicular and parallel lines, and angles formed by parallel lines cut by a transversal.', 2, sd.id, 60
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'perpendicular and parallel lines, and angles formed by parallel lines cut by a transversal.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'relations and functions.', 3, sd.id, 60
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'relations and functions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'graphs of linear functions, and the identification of domain and range, slope, intercepts, and zeros.', 4, sd.id, 60
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'graphs of linear functions, and the identification of domain and range, slope, intercepts, and zeros.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'parallelism and perpendicularity of lines.', 1, sd.id, 61
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'parallelism and perpendicularity of lines.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'different quadrilaterals and their properties.', 2, sd.id, 61
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'different quadrilaterals and their properties.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'congruence of triangles.', 3, sd.id, 61
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'congruence of triangles.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'congruence proofs.', 4, sd.id, 61
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'congruence proofs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'quadratic equations and graphs of quadratic functions.', 1, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'quadratic equations and graphs of quadratic functions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the solution of quadratic equations.', 2, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the solution of quadratic equations.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'similarity of polygons.', 3, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'similarity of polygons.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'special triangles.', 4, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'special triangles.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'direct and inverse variation.', 5, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'direct and inverse variation.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'triangle theorems and triangle inequality theorems.', 1, sd.id, 64
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'triangle theorems and triangle inequality theorems.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the trigonometric ratios and their application.', 2, sd.id, 64
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the trigonometric ratios and their application.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'interpretation and analysis of data to assess whether the data may be misleading.', 3, sd.id, 64
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'interpretation and analysis of data to assess whether the data may be misleading.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'probabilities of simple and compound events.', 4, sd.id, 64
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'probabilities of simple and compound events.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'illustrate and describe points, lines, rays, line segments, angles, and planes. (MG)', 1, sd.id, 60
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'illustrate and describe points, lines, rays, line segments, angles, and planes. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'construct perpendicular and parallel lines. (MG)', 2, sd.id, 60
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'construct perpendicular and parallel lines. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine the measure of the angles formed by parallel lines cut by a transversal. (MG)', 3, sd.id, 60
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine the measure of the angles formed by parallel lines cut by a transversal. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'identify relations and functions. (NA)', 4, sd.id, 60
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'identify relations and functions. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'graph a linear function and identify the domain and range, intercepts, slope, and zeros. (NA)', 5, sd.id, 60
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'graph a linear function and identify the domain and range, intercepts, slope, and zeros. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine the conditions for lines to be parallel or perpendicular. (MG)', 1, sd.id, 61
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine the conditions for lines to be parallel or perpendicular. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'use geometric properties to find unknown sides and angles of quadrilaterals. (MG)', 2, sd.id, 61
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'use geometric properties to find unknown sides and angles of quadrilaterals. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'apply the triangle congruence postulates and theorems. (MG)', 3, sd.id, 61
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'apply the triangle congruence postulates and theorems. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'construct and justify the construction of segments, angles, and triangles. (MG)', 4, sd.id, 61
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'construct and justify the construction of segments, angles, and triangles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'construct proofs of the congruence of triangles. (MG)', 5, sd.id, 61
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'construct proofs of the congruence of triangles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'represent quadratic relationships. (NA)', 1, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'represent quadratic relationships. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'interpret features of a parabola. (NA)', 2, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'interpret features of a parabola. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'express quadratic functions in different forms. (NA)', 3, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'express quadratic functions in different forms. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'sketch the graph of a quadratic function. (NA)', 4, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'sketch the graph of a quadratic function. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'solve quadratic equations. (NA)', 5, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'solve quadratic equations. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'illustrate and apply similarity of polygons, including triangles. (MG)', 6, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'illustrate and apply similarity of polygons, including triangles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'apply direct and inverse variation. (NA)', 7, sd.id, 62
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'apply direct and inverse variation. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'apply triangle theorems and triangle inequality theorems. (MG)', 1, sd.id, 64
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'apply triangle theorems and triangle inequality theorems. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'apply trigonometric ratios to solve right triangles. (MG)', 2, sd.id, 64
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'apply trigonometric ratios to solve right triangles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'interpret and analyze data to assess whether the data may be misleading. (DP)', 3, sd.id, 64
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'interpret and analyze data to assess whether the data may be misleading. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine the probabilities of simple and compound events. (DP)', 4, sd.id, 64
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 9'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine the probabilities of simple and compound events. (DP)'
  );

-- Grade 10 Mathematics: 33 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the laws of sines and the laws of cosines.', 1, sd.id, 65
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the laws of sines and the laws of cosines.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'translations, reflections, and rotations, in the Cartesian plane.', 2, sd.id, 65
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'translations, reflections, and rotations, in the Cartesian plane.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'quadratic inequalities in one variable and in two variables.', 3, sd.id, 65
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'quadratic inequalities in one variable and in two variables.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'absolute value equations and inequalities in one variable and their graphs.', 4, sd.id, 65
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'absolute value equations and inequalities in one variable and their graphs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'box-and-whisker plots, and cumulative frequency histograms and polygons.', 1, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'box-and-whisker plots, and cumulative frequency histograms and polygons.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'quartiles, deciles, and percentiles; interquartile range, and outliers.', 2, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'quartiles, deciles, and percentiles; interquartile range, and outliers.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'radical expressions.', 3, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'radical expressions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'the roots of a quadratic equation.', 4, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'the roots of a quadratic equation.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'quadratic functions.', 5, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'quadratic functions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'equations reducible to quadratic equations.', 6, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'equations reducible to quadratic equations.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'equation of a circle and the graph of a circle.', 1, sd.id, 67
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'equation of a circle and the graph of a circle.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'evaluation of statistical reports.', 2, sd.id, 67
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'evaluation of statistical reports.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'union and intersection of events, dependent and independent events, and complementary events.', 3, sd.id, 67
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'union and intersection of events, dependent and independent events, and complementary events.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'simple interest, compound interest, and depreciation.', 1, sd.id, 68
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'simple interest, compound interest, and depreciation.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'central angles; inscribed angles; and angles and lengths formed by intersecting chords, secants, and tangents of a circle.', 2, sd.id, 68
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'central angles; inscribed angles; and angles and lengths formed by intersecting chords, secants, and tangents of a circle.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'sectors and segments of a circle, and their areas.', 3, sd.id, 68
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'sectors and segments of a circle, and their areas.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'find sides and angles in oblique triangles using the laws of sines and the laws of cosines. (MG)', 1, sd.id, 65
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'find sides and angles in oblique triangles using the laws of sines and the laws of cosines. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'describe translations, reflections, and rotations in the Cartesian plane. (MG)', 2, sd.id, 65
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'describe translations, reflections, and rotations in the Cartesian plane. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'solve and graph the solutions of quadratic inequalities in one variable and in two variables. (NA)', 3, sd.id, 65
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'solve and graph the solutions of quadratic inequalities in one variable and in two variables. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'solve absolute value equations in one variable and absolute value inequalities in one variable, and graph the solutions. (NA)', 4, sd.id, 65
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'solve absolute value equations in one variable and absolute value inequalities in one variable, and graph the solutions. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'construct and interpret box-and-whisker plots, and cumulative frequency histograms and polygons. (DP)', 1, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'construct and interpret box-and-whisker plots, and cumulative frequency histograms and polygons. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'calculate quartiles, deciles, and percentiles; interquartile range, and outliers. (DP)', 2, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'calculate quartiles, deciles, and percentiles; interquartile range, and outliers. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'simplify, and perform operations, involving radical expressions. (NA)', 3, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'simplify, and perform operations, involving radical expressions. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine the nature of roots of a quadratic equation. (NA)', 4, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine the nature of roots of a quadratic equation. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'determine the equation of a quadratic function. (NA)', 5, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'determine the equation of a quadratic function. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'solve equations reducible to quadratic equations and radical equations. (NA)', 6, sd.id, 66
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'solve equations reducible to quadratic equations and radical equations. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'transform the equation of a circle from center-radius form to general form, and vice versa, and determine the center and radius from a given equation. (NA)', 1, sd.id, 67
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'transform the equation of a circle from center-radius form to general form, and vice versa, and determine the center and radius from a given equation. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'graph a circle from a given equation of the circle. (NA)', 2, sd.id, 67
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'graph a circle from a given equation of the circle. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'evaluate statistical reports. (DP)', 3, sd.id, 67
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'evaluate statistical reports. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'calculate probabilities in relation to union and intersection of events; dependent and independent events; and complementary events. (DP)', 4, sd.id, 67
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'calculate probabilities in relation to union and intersection of events; dependent and independent events; and complementary events. (DP)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'calculate compound interest and depreciation. (NA)', 1, sd.id, 68
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'calculate compound interest and depreciation. (NA)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'apply properties and relationships of central angles, inscribed angles, chords, secants, and tangents of circles. (MG)', 2, sd.id, 68
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'apply properties and relationships of central angles, inscribed angles, chords, secants, and tangents of circles. (MG)'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'define sectors and segments of a circle, and find their areas. (MG)', 3, sd.id, 68
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Mathematics%20CG%202023%20Grades%201-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 10'
  and cs.name = 'Mathematics'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'define sectors and segments of a circle, and find their areas. (MG)'
  );

commit;
