-- Science standards data-quality continuation (Grades 3-6).
-- Adds source-pinned standards only; existing competencies and historical snapshots are untouched.
begin;

-- Grade 3 Science: 18 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Science is important in understanding how the natural world works.', 1, sd.id, 29
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Science is important in understanding how the natural world works.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Using science process skills, simple science equipment, and participating in guided activities leads to better understanding of science.', 2, sd.id, 29
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Using science process skills, simple science equipment, and participating in guided activities leads to better understanding of science.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Physical properties of materials determine their use.', 3, sd.id, 29
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Physical properties of materials determine their use.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners demonstrate simple science processes to explore common local materials, their physical properties and uses. They participate in guided science activities including simple measurements using units, such as millimeters, centimeters, and meters. They demonstrate safe handling procedures to use equipment and materials.', 1, sd.id, 29
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners demonstrate simple science processes to explore common local materials, their physical properties and uses. They participate in guided science activities including simple measurements using units, such as millimeters, centimeters, and meters. They demonstrate safe handling procedures to use equipment and materials.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Using science process skills, simple pieces of science equipment, and participating in guided activities leads to a better understanding of science.', 1, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Using science process skills, simple pieces of science equipment, and participating in guided activities leads to a better understanding of science.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Characteristics of growth, response and reproduction identify living things.', 2, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Characteristics of growth, response and reproduction identify living things.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Body parts of plants and animals enable them to live and grow.', 3, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Body parts of plants and animals enable them to live and grow.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'All living things have the same basic needs that need to be met by their environment.', 4, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'All living things have the same basic needs that need to be met by their environment.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners describe the basic needs of living things. They explain how the body parts allow them to carry out their daily activities. They recognize the need to protect the environment to ensure that the basic needs of living things can be met. They observe and measure living and non- living things in their local environment. They make models and collages of living things and their basic needs.', 1, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners describe the basic needs of living things. They explain how the body parts allow them to carry out their daily activities. They recognize the need to protect the environment to ensure that the basic needs of living things can be met. They observe and measure living and non- living things in their local environment. They make models and collages of living things and their basic needs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Objects that change position encounter a push or a pull.', 1, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Objects that change position encounter a push or a pull.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Using science processes and curiosity is important in understanding how objects move.', 2, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Using science processes and curiosity is important in understanding how objects move.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Light and sound are examples of energy that affect daily life.', 3, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Light and sound are examples of energy that affect daily life.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'People can modify light and sound to make them useful.', 4, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'People can modify light and sound to make them useful.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners use everyday language to explore, describe, and make suggestions about simple movements of objects. They identify and explore sources of light and sound in their local environment and suggest how to use them safely in their lives. Learners apply their curiosity in the world around them and their creativity to propose solutions to simple challenges.', 1, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners use everyday language to explore, describe, and make suggestions about simple movements of objects. They identify and explore sources of light and sound in their local environment and suggest how to use them safely in their lives. Learners apply their curiosity in the world around them and their creativity to propose solutions to simple challenges.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Non-living things found in the environment are the sources of useful products.', 1, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Non-living things found in the environment are the sources of useful products.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Weather affects our daily activities and may pose threats to health and safety.', 2, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Weather affects our daily activities and may pose threats to health and safety.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'The natural objects in the sky affect the activities of people.', 3, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'The natural objects in the sky affect the activities of people.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners explore their immediate neighborhood to locate and describe useful non-living things that can be used by people to produce useful materials and objects. They learn through guided activities to make safe and careful observations of natural objects in the sky and demonstrate scientific ways of recording observations to reveal patterns in nature.', 1, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 3'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners explore their immediate neighborhood to locate and describe useful non-living things that can be used by people to produce useful materials and objects. They learn through guided activities to make safe and careful observations of natural objects in the sky and demonstrate scientific ways of recording observations to reveal patterns in nature.'
  );

-- Grade 4 Science: 21 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Science inventions have brought about major changes to our daily lives.', 1, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Science inventions have brought about major changes to our daily lives.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Chemical properties of materials determine their uses.', 2, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Chemical properties of materials determine their uses.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Communication skills and open mindedness are needed in solving environmental issues.', 3, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Communication skills and open mindedness are needed in solving environmental issues.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners describe chemical properties of materials and changes to them. They demonstrate an understanding that science processes can solve everyday problems and use creativity and determination to provide examples. They exhibit objectivity and open-mindedness in gathering information related to environmental issues and concerns in the community.', 1, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners describe chemical properties of materials and changes to them. They demonstrate an understanding that science processes can solve everyday problems and use creativity and determination to provide examples. They exhibit objectivity and open-mindedness in gathering information related to environmental issues and concerns in the community.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Animals and plants have systems that function to keep them alive.', 1, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Animals and plants have systems that function to keep them alive.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Animals and plants live in habitats that meet their basic needs.', 2, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Animals and plants live in habitats that meet their basic needs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Animals have life cycles that include development and reproduction.', 3, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Animals have life cycles that include development and reproduction.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Animals can be grouped according to the food that they eat.', 4, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Animals can be grouped according to the food that they eat.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Food chains show a series of living things that depend on each other for food.', 5, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Food chains show a series of living things that depend on each other for food.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Using drawings, tables, and flowcharts is an important skill in learning science concepts and in learning about science processes.', 6, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Using drawings, tables, and flowcharts is an important skill in learning science concepts and in learning about science processes.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners identify that plants and animals have systems whose function is to keep them alive. They observe, describe, and create representations to show how living things interact with their habitat, survive, and reproduce in specific environments. They use flowcharts to show the feeding relationship among different organisms within a given environment.', 1, sd.id, 34
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners identify that plants and animals have systems whose function is to keep them alive. They observe, describe, and create representations to show how living things interact with their habitat, survive, and reproduce in specific environments. They use flowcharts to show the feeding relationship among different organisms within a given environment.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Science processes help in observing and predicting how things move.', 1, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Science processes help in observing and predicting how things move.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Pushes and pulls can change the position and shape of objects.', 2, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Pushes and pulls can change the position and shape of objects.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Gathering scientific information helps explain the behavior of objects and materials.', 3, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Gathering scientific information helps explain the behavior of objects and materials.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Magnets affect some objects and materials without touching them.', 4, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Magnets affect some objects and materials without touching them.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Energy is present whenever there is movement, sound, light, or heat.', 5, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Energy is present whenever there is movement, sound, light, or heat.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners use simple equipment and processes to measure and record data related to movement and describe and predict the way things around them move using more scientifically technical language and concepts, such as speed and force. They demonstrate an understanding that science processes are used to gain deeper understanding about forces and energy that cannot be seen directly, including the properties of magnet, light, sound, and heat. Learners apply their observation skills and objectivity to identify where energy is evident in their local communities and how it is used by people.', 1, sd.id, 35
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners use simple equipment and processes to measure and record data related to movement and describe and predict the way things around them move using more scientifically technical language and concepts, such as speed and force. They demonstrate an understanding that science processes are used to gain deeper understanding about forces and energy that cannot be seen directly, including the properties of magnet, light, sound, and heat. Learners apply their observation skills and objectivity to identify where energy is evident in their local communities and how it is used by people.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Soil and water resources are needed by plants and animals to live and grow.', 1, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Soil and water resources are needed by plants and animals to live and grow.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Characteristics of the weather can be observed and measured.', 2, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Characteristics of the weather can be observed and measured.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'The Sun is a ball of hot gases about 100 times the size of Earth, which radiates light energy needed by living things.', 3, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'The Sun is a ball of hot gases about 100 times the size of Earth, which radiates light energy needed by living things.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners use simple equipment to identify how types of soil hold water to support the growth of plants. They use instruments and secondary sources to measure and describe the characteristics of weather and use the information to make predictions about weather patterns in their local area. They demonstrate appreciation for the dangers of extreme weather events and use safe practice to protect themselves if they are caught in bad weather. Learners use personal observations and reliable secondary information sources to describe the Sun and explain its importance to life on Earth.', 1, sd.id, 36
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 4'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners use simple equipment to identify how types of soil hold water to support the growth of plants. They use instruments and secondary sources to measure and describe the characteristics of weather and use the information to make predictions about weather patterns in their local area. They demonstrate appreciation for the dangers of extreme weather events and use safe practice to protect themselves if they are caught in bad weather. Learners use personal observations and reliable secondary information sources to describe the Sun and explain its importance to life on Earth.'
  );

-- Grade 5 Science: 25 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Scientists identify three states of matter based on shape and volume.', 1, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Scientists identify three states of matter based on shape and volume.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Temperature can cause changes of state.', 2, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Temperature can cause changes of state.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Planned simple scientific investigations require several steps and processes.', 3, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Planned simple scientific investigations require several steps and processes.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'An understanding of matter can be applied to solve real world problems.', 4, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'An understanding of matter can be applied to solve real world problems.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners describe three states of matter based on properties of shape and volume and identify that heat is involved in changes of state. They plan a simple scientific investigation following appropriate steps and using units such as milliliters, liters, grams, kilograms, and degrees Celsius for measuring.', 1, sd.id, 37
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners describe three states of matter based on properties of shape and volume and identify that heat is involved in changes of state. They plan a simple scientific investigation following appropriate steps and using units such as milliliters, liters, grams, kilograms, and degrees Celsius for measuring.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Animals have systems that help them grow, respond, and reproduce.', 1, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Animals have systems that help them grow, respond, and reproduce.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Living things can be grouped as plants, animals, and microorganisms based on their characteristics.', 2, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Living things can be grouped as plants, animals, and microorganisms based on their characteristics.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'The life cycles of plants and animals allow them to survive and reproduce.', 3, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'The life cycles of plants and animals allow them to survive and reproduce.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Plants have specialized structures that help them overcome unfavorable conditions.', 4, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Plants have specialized structures that help them overcome unfavorable conditions.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners describe and create models of the body systems whose function is to help humans grow, develop, and reproduce. They use tables to group living things as plants, animals, or microorganisms. They use skills of observation, predicting, measuring, and recording to plan and carry out a simple activity to observe the life cycle of a plant and compare it to the life cycles of animals.', 1, sd.id, 38
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners describe and create models of the body systems whose function is to help humans grow, develop, and reproduce. They use tables to group living things as plants, animals, or microorganisms. They use skills of observation, predicting, measuring, and recording to plan and carry out a simple activity to observe the life cycle of a plant and compare it to the life cycles of animals.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Science investigations provide evidence to support predictions and explanations.', 1, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Science investigations provide evidence to support predictions and explanations.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Forces are pushes or pulls that act in a specific direction.', 2, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Forces are pushes or pulls that act in a specific direction.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Friction is an everyday force created by two surfaces interacting.', 3, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Friction is an everyday force created by two surfaces interacting.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Gravity causes all objects to fall towards the ground.', 4, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Gravity causes all objects to fall towards the ground.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Static electricity occurs when some materials rub on other materials causing charges to jump.', 5, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Static electricity occurs when some materials rub on other materials causing charges to jump.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Electric current requires a pathway for charges to flow.', 6, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Electric current requires a pathway for charges to flow.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners use objectivity and measurement to carry out scientific investigations using fair tests and multiple trials to explore how forces influence the movement of familiar objects and extend their understanding to predict how gravity affects objects on Earth. They plan and carry out valid and reliable scientific investigations to explore frictional forces by identifying and controlling variables. They observe and describe basic features of static electricity and electric current through practical activities and use their understanding and interest to explain and show appreciation for some applications of forces and electrical energy in the home and community.', 1, sd.id, 39
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners use objectivity and measurement to carry out scientific investigations using fair tests and multiple trials to explore how forces influence the movement of familiar objects and extend their understanding to predict how gravity affects objects on Earth. They plan and carry out valid and reliable scientific investigations to explore frictional forces by identifying and controlling variables. They observe and describe basic features of static electricity and electric current through practical activities and use their understanding and interest to explain and show appreciation for some applications of forces and electrical energy in the home and community.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Landforms influence living and non-living components of the environment.', 1, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Landforms influence living and non-living components of the environment.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Rocks are composed of grains of minerals that break down to form soil.', 2, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Rocks are composed of grains of minerals that break down to form soil.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Weathering and erosion shape the Earth’s surface by breaking down and transporting rocks.', 3, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Weathering and erosion shape the Earth’s surface by breaking down and transporting rocks.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'The Water Cycle includes processes of evaporation, precipitation and transportation.', 4, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'The Water Cycle includes processes of evaporation, precipitation and transportation.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Weather disturbances feature low pressure, strong winds, and storms.', 5, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Weather disturbances feature low pressure, strong winds, and storms.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'The planets and moons vary in physical features and composition.', 6, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'The planets and moons vary in physical features and composition.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Phases of the Moon depend on its position relative to Earth and Sun.', 7, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Phases of the Moon depend on its position relative to Earth and Sun.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners relate changes in landforms and earth materials to processes and effects of the water cycle. They explain causes and impacts of extreme weather and identify appropriate and safe ways to respond to such events. They demonstrate curiosity as they make detailed observations guided by science classification systems and demonstrate creativity in communicating information about earth processes to other people. They show an appreciation of the scale of space in describing the features of the solar system and use models to communicate significant relationships and movements.', 1, sd.id, 40
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 5'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners relate changes in landforms and earth materials to processes and effects of the water cycle. They explain causes and impacts of extreme weather and identify appropriate and safe ways to respond to such events. They demonstrate curiosity as they make detailed observations guided by science classification systems and demonstrate creativity in communicating information about earth processes to other people. They show an appreciation of the scale of space in describing the features of the solar system and use models to communicate significant relationships and movements.'
  );

-- Grade 6 Science: 22 verified standards.
insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Diagrams and flowcharts demonstrate processes involving heat energy and changes of state.', 1, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Diagrams and flowcharts demonstrate processes involving heat energy and changes of state.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Changes in materials can be either reversible or irreversible.', 2, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Changes in materials can be either reversible or irreversible.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Mixtures and the products of their separation techniques are very useful in our daily lives.', 3, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Mixtures and the products of their separation techniques are very useful in our daily lives.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Scientific investigations need to satisfy the features of a fair test and use accurate and reliable measurements.', 4, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Scientific investigations need to satisfy the features of a fair test and use accurate and reliable measurements.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners demonstrate an understanding of the benefits of various separation techniques. They use diagrams and flowcharts to describe changes of state. They use the words reversible and irreversible to describe changes to materials. They demonstrate skills in the use of equipment. They recognize and apply their understanding of the features of a fair test.', 1, sd.id, 41
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D01'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners demonstrate an understanding of the benefits of various separation techniques. They use diagrams and flowcharts to describe changes of state. They use the words reversible and irreversible to describe changes to materials. They demonstrate skills in the use of equipment. They recognize and apply their understanding of the features of a fair test.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Animals have systems that help them grow, respond, and reproduce.', 1, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Animals have systems that help them grow, respond, and reproduce.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'There are several modes of reproduction in plants.', 2, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'There are several modes of reproduction in plants.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'To be valid and reliable, scientific investigations need to include fair tests and multiple trials.', 3, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'To be valid and reliable, scientific investigations need to include fair tests and multiple trials.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Animals can be grouped as vertebrates or invertebrates based on their characteristics.', 4, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Animals can be grouped as vertebrates or invertebrates based on their characteristics.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Producers, consumers, scavengers, and decomposers have important roles in food webs.', 5, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Producers, consumers, scavengers, and decomposers have important roles in food webs.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Interactions within an ecosystem can have important impacts on the living things within it.', 6, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Interactions within an ecosystem can have important impacts on the living things within it.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners demonstrate an understanding of the different ways that plants reproduce. Plan a simple scientific investigation to determine which method works best in a given habitat. They describe and provide examples of vertebrates as animals with a backbone and invertebrates as animals that do not have a backbone. They design an example of a food web showing the role of consumers, producers, scavengers, and decomposers. They identify the technical terms biotic and abiotic as referring to living and non-living things.', 1, sd.id, 42
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D02'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners demonstrate an understanding of the different ways that plants reproduce. Plan a simple scientific investigation to determine which method works best in a given habitat. They describe and provide examples of vertebrates as animals with a backbone and invertebrates as animals that do not have a backbone. They design an example of a food web showing the role of consumers, producers, scavengers, and decomposers. They identify the technical terms biotic and abiotic as referring to living and non-living things.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Simple machines allow people to change the direction and size of forces.', 1, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Simple machines allow people to change the direction and size of forces.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Waves transfer energy between source and receiver.', 2, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Waves transfer energy between source and receiver.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Science processes and concepts help solve everyday problems.', 3, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Science processes and concepts help solve everyday problems.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners demonstrate objective inquiry by carrying out investigations to critically observe patterns and systems scientifically. They support their observations and conclusions using secondary sources to explain occurrences and concepts using technical scientific language. They use critical thinking skills and creativity to make models and other devices to communicate their understanding to other people.', 1, sd.id, 43
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D03'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners demonstrate objective inquiry by carrying out investigations to critically observe patterns and systems scientifically. They support their observations and conclusions using secondary sources to explain occurrences and concepts using technical scientific language. They use critical thinking skills and creativity to make models and other devices to communicate their understanding to other people.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Volcanoes are vents from which molten rock from Earth’s crust erupts onto the surface releasing pressure and gases.', 1, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Volcanoes are vents from which molten rock from Earth’s crust erupts onto the surface releasing pressure and gases.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'The Philippine volcanoes can violently and unpredictably erupt lava, ash, and ballistic projectiles.', 2, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'The Philippine volcanoes can violently and unpredictably erupt lava, ash, and ballistic projectiles.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Weather and climate have predictable patterns throughout the year, which affect human activities.', 3, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Weather and climate have predictable patterns throughout the year, which affect human activities.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'The revolution and the rotation of the Earth demonstrate observable patterns.', 4, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'The revolution and the rotation of the Earth demonstrate observable patterns.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'content', 'Constellations are patterns of stars in the sky.', 5, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'content'
      and existing.standard_text = 'Constellations are patterns of stars in the sky.'
  );

insert into public.curriculum_standards (subject_id, domain_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, cd.id, ap.id, 'performance', 'By the end of the Quarter, learners appreciate that volcanoes can have unexpected and severe impacts on communities and that the uncertainty and impacts of unpredicted eruptions can be offset by understanding and following alerts from authorities. Learners appreciate weather patterns that produce seasons that are largely predictable, and they use models to scientifically understand and describe natural processes and timing that can be relied upon, such as the changes of season. Learners identify that scientific models are valuable in explaining other observations of patterns in nature, such as the apparent movement of celestial objects across the sky. They exhibit respect for cultures and interpretations of natural phenomena by indigenous people over generations and balance that with respect for explaining phenomena using scientific inquiry and objectivity.', 1, sd.id, 44
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'D04'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides%2FFINAL%20MATATAG%20Science%20CG%202023%20Grades%203-10.pdf&parent=%2Fpersonal%2Fouct_deped_gov_ph%2FDocuments%2FMATATAG%20Curriculum%20Guides'
where cv.code = 'REVISED-K10-MATATAG'
  and cs.grade_level = 'Grade 6'
  and cs.name = 'Science'
  and not exists (
    select 1 from public.curriculum_standards existing
    where existing.subject_id = cs.id
      and existing.source_document_id = sd.id
      and existing.academic_period_id = ap.id
      and existing.domain_id = cd.id
      and existing.standard_type = 'performance'
      and existing.standard_text = 'By the end of the Quarter, learners appreciate that volcanoes can have unexpected and severe impacts on communities and that the uncertainty and impacts of unpredicted eruptions can be offset by understanding and following alerts from authorities. Learners appreciate weather patterns that produce seasons that are largely predictable, and they use models to scientifically understand and describe natural processes and timing that can be relied upon, such as the changes of season. Learners identify that scientific models are valuable in explaining other observations of patterns in nature, such as the apparent movement of celestial objects across the sky. They exhibit respect for cultures and interpretations of natural phenomena by indigenous people over generations and balance that with respect for explaining phenomena using scientific inquiry and objectivity.'
  );

commit;
