-- Generated from matatag-grade7-mathematics.json. Do not hand-edit; update the verified manifest and regenerate.
begin;

insert into public.source_documents (source_type, title, issuance_code, source_url, published_on, publisher, retrieved_on, verification_status)
values ('curriculum_guide', 'MATATAG Curriculum: Mathematics Grades 1, 4 and 7', null, 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf', null, 'Department of Education', '2026-08-08', 'verified')
on conflict (source_url) where source_url is not null do update set
  title = excluded.title,
  issuance_code = excluded.issuance_code,
  published_on = excluded.published_on,
  publisher = excluded.publisher,
  retrieved_on = excluded.retrieved_on,
  verification_status = 'verified',
  updated_at = timezone('utc', now());

insert into public.curriculum_versions (code, name, framework, effective_from_school_year, effective_to_school_year, status, implementation_notes)
values ('REVISED-K10-MATATAG', 'Revised K to 10 / MATATAG Curriculum', 'Revised K to 10 Curriculum', '2024-2025', null, 'active', 'Grade 7 entered phased implementation in SY 2024-2025. Curriculum guide sequence for this subject remains organized by quarters.')
on conflict (code) do update set
  name = excluded.name,
  framework = excluded.framework,
  effective_from_school_year = excluded.effective_from_school_year,
  effective_to_school_year = excluded.effective_to_school_year,
  status = excluded.status,
  implementation_notes = excluded.implementation_notes,
  updated_at = timezone('utc', now());

insert into public.curriculum_applicability (curriculum_version_id, school_year, grade_level, implementation_status, priority, notes)
select cv.id, '2024-2025', 'Grade 7', 'full', 10, 'Grade 7 Phase 1 implementation.'
from public.curriculum_versions cv where cv.code = 'REVISED-K10-MATATAG'
on conflict (curriculum_version_id, school_year, grade_level, implementation_status) do update set
  priority = excluded.priority,
  notes = excluded.notes;

insert into public.curriculum_applicability (curriculum_version_id, school_year, grade_level, implementation_status, priority, notes)
select cv.id, '2025-2026', 'Grade 7', 'full', 10, 'Grade 7 continues under the Revised K to 10 / MATATAG curriculum.'
from public.curriculum_versions cv where cv.code = 'REVISED-K10-MATATAG'
on conflict (curriculum_version_id, school_year, grade_level, implementation_status) do update set
  priority = excluded.priority,
  notes = excluded.notes;

insert into public.curriculum_applicability (curriculum_version_id, school_year, grade_level, implementation_status, priority, notes)
select cv.id, '2026-2027', 'Grade 7', 'full', 10, 'Grade 7 continues under the Revised K to 10 / MATATAG curriculum. Three-term grading is modeled separately from curriculum-quarter sequencing.'
from public.curriculum_versions cv where cv.code = 'REVISED-K10-MATATAG'
on conflict (curriculum_version_id, school_year, grade_level, implementation_status) do update set
  priority = excluded.priority,
  notes = excluded.notes;

insert into public.curriculum_subjects (curriculum_version_id, grade_level, code, name, description, source_document_id)
select cv.id, 'Grade 7', 'MATH7', 'Mathematics', 'Official Grade 7 Mathematics curriculum records from the MATATAG curriculum guide.', sd.id
from public.curriculum_versions cv
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG'
on conflict (curriculum_version_id, grade_level, name) do update set
  code = excluded.code,
  description = excluded.description,
  source_document_id = excluded.source_document_id,
  updated_at = timezone('utc', now());

insert into public.academic_periods (curriculum_version_id, subject_id, label, sequence, period_type, grade_min, grade_max)
select cv.id, cs.id, 'Quarter 1', 1, 'quarter', 7, 7
from public.curriculum_versions cv
join public.curriculum_subjects cs on cs.curriculum_version_id = cv.id and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics'
where cv.code = 'REVISED-K10-MATATAG'
on conflict (subject_id, label) where subject_id is not null do update set
  sequence = excluded.sequence,
  period_type = excluded.period_type,
  grade_min = excluded.grade_min,
  grade_max = excluded.grade_max;

insert into public.academic_periods (curriculum_version_id, subject_id, label, sequence, period_type, grade_min, grade_max)
select cv.id, cs.id, 'Quarter 2', 2, 'quarter', 7, 7
from public.curriculum_versions cv
join public.curriculum_subjects cs on cs.curriculum_version_id = cv.id and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics'
where cv.code = 'REVISED-K10-MATATAG'
on conflict (subject_id, label) where subject_id is not null do update set
  sequence = excluded.sequence,
  period_type = excluded.period_type,
  grade_min = excluded.grade_min,
  grade_max = excluded.grade_max;

insert into public.academic_periods (curriculum_version_id, subject_id, label, sequence, period_type, grade_min, grade_max)
select cv.id, cs.id, 'Quarter 3', 3, 'quarter', 7, 7
from public.curriculum_versions cv
join public.curriculum_subjects cs on cs.curriculum_version_id = cv.id and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics'
where cv.code = 'REVISED-K10-MATATAG'
on conflict (subject_id, label) where subject_id is not null do update set
  sequence = excluded.sequence,
  period_type = excluded.period_type,
  grade_min = excluded.grade_min,
  grade_max = excluded.grade_max;

insert into public.academic_periods (curriculum_version_id, subject_id, label, sequence, period_type, grade_min, grade_max)
select cv.id, cs.id, 'Quarter 4', 4, 'quarter', 7, 7
from public.curriculum_versions cv
join public.curriculum_subjects cs on cs.curriculum_version_id = cv.id and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics'
where cv.code = 'REVISED-K10-MATATAG'
on conflict (subject_id, label) where subject_id is not null do update set
  sequence = excluded.sequence,
  period_type = excluded.period_type,
  grade_min = excluded.grade_min,
  grade_max = excluded.grade_max;

insert into public.curriculum_domains (subject_id, code, name, sort_order)
select cs.id, 'MG', 'Measurement and Geometry', 1
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics'
on conflict (subject_id, name) do update set
  code = excluded.code,
  sort_order = excluded.sort_order;

insert into public.curriculum_domains (subject_id, code, name, sort_order)
select cs.id, 'NA', 'Number and Algebra', 2
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics'
on conflict (subject_id, name) do update set
  code = excluded.code,
  sort_order = excluded.sort_order;

insert into public.curriculum_domains (subject_id, code, name, sort_order)
select cs.id, 'DP', 'Data and Probability', 3
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics'
on conflict (subject_id, name) do update set
  code = excluded.code,
  sort_order = excluded.sort_order;

delete from public.curriculum_standards
where subject_id = (select cs.id from public.curriculum_subjects cs join public.curriculum_versions cv on cv.id = cs.curriculum_version_id where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics')
  and source_document_id = (select id from public.source_documents where source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf');

insert into public.curriculum_standards (subject_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, ap.id, 'performance', 'By the end of the quarter, the learners are able to draw and describe the features/properties of regular and irregular polygons; use percentages in different contexts; identify and use rates; create a financial plan; and describe, order, and perform operations on rational numbers.', 1, sd.id, 30
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_standards (subject_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, ap.id, 'performance', 'By the end of the quarter, the learners are able to determine square roots of perfect squares and cube roots of perfect cubes, and identify irrational numbers; convert units of measure from different systems of measure; find the volume of square and rectangular pyramids and the volume of cylinders; describe sets and their subsets, and the union and intersection of sets; and illustrate sets and subsets, and union and intersection of sets, using Venn diagrams.', 2, sd.id, 31
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_standards (subject_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, ap.id, 'performance', 'By the end of the quarter, the learners are able to collect data and organize data in a frequency distribution table; represent and interpret data in different types of graphs; compare and order integers, including through the use of the number line; perform the four operations with integers; simplify numerical expressions involving integers; and identify the absolute value of an integer.', 3, sd.id, 32
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_standards (subject_id, academic_period_id, standard_type, standard_text, sort_order, source_document_id, source_page)
select cs.id, ap.id, 'performance', 'By the end of the quarter, the learners are able to solve simple equations; substitute into an algebraic expression to evaluate the expression; rearrange a formula to make a different variable the subject of the formula; gather data from experiments and represent the data in different forms; and write numbers in scientific notation and perform operations on numbers written in scientific notation.', 4, sd.id, 33
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

delete from public.curriculum_competencies
where subject_id = (select cs.id from public.curriculum_subjects cs join public.curriculum_versions cv on cv.id = cs.curriculum_version_id where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics')
  and source_document_id = (select id from public.source_documents where source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf');

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Draw and describe regular and irregular polygons with 5, 6, 8, or 10 sides, based on measurements of sides and angles, using a ruler and protractor.', 1, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Draw triangles, quadrilaterals, and regular polygons (5, 6, 8, or 10 sides) with given angle measures.', 2, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Describe and explain the relationships between angle pairs based on their measures.', 3, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Classify polygons according to the number of sides, whether they are regular or irregular, and whether they are convex or non-convex.', 4, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Deduce the relationship between the exterior angle and adjacent interior angle of a polygon.', 5, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Determine the measures of angles and the number of sides of polygons.', 6, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Solve problems involving percentage increase and percentage decrease.', 7, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Solve money problems involving percentages, such as discount, commission, sales tax, and simple interest.', 8, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Create a financial plan.', 9, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Identify and explain the uses of rates.', 10, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Solve problems involving rates, such as speed.', 11, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Describe given rational numbers as fractions, decimals, or percentages.', 12, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Order rational numbers on a number line.', 13, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Perform operations on rational numbers.', 14, sd.id, 30, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Determine the square roots of perfect squares and the cube roots of perfect cubes.', 1, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Identify irrational numbers involving square roots and cube roots, and their locations on the number line.', 2, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Convert units of measure within the International System of Units (SI) and across different systems of measure.', 3, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Explain inductively the volume of a cylinder using the area of a circle, leading to the identification of the formula.', 4, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Find the volume of a cylinder.', 5, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Solve problems involving the volumes of cylinders.', 6, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Explore inductively the volume of square and rectangular pyramids using rectangular prisms, leading to the identification of the formula.', 7, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Estimate volumes of square and rectangular pyramids.', 8, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Solve problems involving volumes of square or rectangular pyramids.', 9, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'MG'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Describe sets and their subsets, the union of sets, and the intersection of sets.', 10, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Illustrate sets and their subsets, the union of sets, and the intersection of sets through the use of Venn diagrams.', 11, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Illustrate the different subsets of real numbers.', 12, sd.id, 31, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 2
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Investigate different data collection and sampling techniques.', 1, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'DP'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Organize statistical data in a frequency distribution table.', 2, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'DP'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Use appropriate graphs to represent organized data: pie graph, bar graph, line graph, and stem-and-leaf plot.', 3, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'DP'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Interpret statistical graphs.', 4, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'DP'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Describe the set of integers.', 5, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Use positive and negative numbers to describe directions or opposites in real-life situations.', 6, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Locate integers on the number line.', 7, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Compare and order integers.', 8, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Add and subtract integers using concrete models, pictorial models, and integers written as numerals.', 9, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Multiply and divide integers.', 10, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Simplify numerical expressions involving integers using number properties and the order of operations (GEMDAS).', 11, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Identify the absolute value of an integer and its meaning on the number line.', 12, sd.id, 32, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 3
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Solve simple equations represented by bar models to find unknowns.', 1, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Distinguish a variable from a constant in an algebraic expression.', 2, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Evaluate algebraic expressions given the value or values of the variables.', 3, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Translate verbal phrases into algebraic expressions.', 4, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Illustrate the properties of equality.', 5, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Solve one variable in terms of the other variables in a formula.', 6, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Write equations in algebraic form.', 7, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Find the value of an unknown in an equation where the unknown is non-negative.', 8, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Solve problems involving algebraic expressions and formulas.', 9, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Collect data from experiments, such as coin tosses or die rolls.', 10, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'DP'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Express outcomes in words and/or symbols, and represent outcomes in tables and/or graphs.', 11, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'DP'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Solve problems using the outcomes of experiments.', 12, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'DP'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Write numbers in scientific notation to represent very large or very small numbers, and vice versa.', 13, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

insert into public.curriculum_competencies (subject_id, domain_id, academic_period_id, competency_code, competency_text, sort_order, source_document_id, source_page, verification_status)
select cs.id, cd.id, ap.id, null, 'Perform operations on numbers expressed in scientific notation.', 14, sd.id, 33, 'verified'
from public.curriculum_subjects cs
join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
join public.curriculum_domains cd on cd.subject_id = cs.id and cd.code = 'NA'
join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 4
join public.source_documents sd on sd.source_url = 'https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf'
where cv.code = 'REVISED-K10-MATATAG' and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics';

commit;
