import manifest from '../../data/curriculum/official/revised-k10-grade-7-mathematics.json'
import type { CurriculumNavigatorBundle } from '../types/curriculum'

const source = {
  id: `src-${manifest.slug}`,
  sourceType: manifest.source.sourceType as 'curriculum_guide',
  title: manifest.source.title,
  issuanceCode: manifest.source.issuanceCode,
  sourceUrl: manifest.source.sourceUrl,
  publishedOn: manifest.source.publishedOn,
  verificationStatus: 'verified' as const,
}

const version = {
  id: `cv-${manifest.curriculumVersion.code.toLowerCase()}`,
  code: manifest.curriculumVersion.code,
  name: manifest.curriculumVersion.name,
  framework: manifest.curriculumVersion.framework,
  effectiveFromSchoolYear: manifest.curriculumVersion.effectiveFromSchoolYear,
  effectiveToSchoolYear: manifest.curriculumVersion.effectiveToSchoolYear,
  status: manifest.curriculumVersion.status as 'active',
  implementationNotes: manifest.curriculumVersion.implementationNotes,
}

const subject = {
  id: `subj-${manifest.subject.code.toLowerCase()}`,
  gradeLevel: manifest.subject.gradeLevel,
  code: manifest.subject.code,
  name: manifest.subject.name,
  description: manifest.subject.description,
}

const periods = manifest.periods.map((period) => ({
  id: `period-${manifest.subject.code.toLowerCase()}-${period.sequence}`,
  label: period.label,
  sequence: period.sequence,
  periodType: period.periodType as 'quarter',
}))

const domains = manifest.domains.map((domain) => ({
  id: `domain-${manifest.subject.code.toLowerCase()}-${domain.code.toLowerCase()}`,
  code: domain.code,
  name: domain.name,
  sortOrder: domain.sortOrder,
}))

const periodIdByQuarter = Object.fromEntries(periods.map((period) => [period.sequence, period.id]))
const domainIdByCode = Object.fromEntries(domains.map((domain) => [domain.code, domain.id]))

const manifestStandards = manifest.standards as Array<{
  recordId: string
  type: 'content' | 'performance'
  quarter: number
  domain: string | null
  sortOrder: number
  text: string
  sourcePage: number
}>

const standards = manifestStandards.map((standard) => ({
  id: standard.recordId,
  standardType: standard.type,
  standardText: standard.text,
  domainId: standard.domain ? (domainIdByCode[standard.domain] ?? null) : null,
  academicPeriodId: periodIdByQuarter[standard.quarter] ?? null,
  sourcePage: standard.sourcePage,
}))

const competencies = manifest.competencies.map((competency) => ({
  id: `comp-${manifest.subject.code.toLowerCase()}-q${competency.quarter}-${competency.sortOrder}`,
  competencyCode: competency.competencyCode,
  competencyText: competency.text,
  sortOrder: competency.sortOrder,
  domainId: domainIdByCode[competency.domain] ?? null,
  academicPeriodId: periodIdByQuarter[competency.quarter] ?? null,
  sourcePage: competency.sourcePage,
  verificationStatus: competency.verificationStatus as 'verified',
}))

const bundle: CurriculumNavigatorBundle = {
  available: true,
  schoolYear: '2026-2027',
  gradeLevel: manifest.subject.gradeLevel,
  learningArea: manifest.subject.name,
  version,
  subject,
  periods,
  domains,
  standards,
  competencies,
  source,
  coverageNote:
    'Demo mode intentionally includes one verified Grade 7 Mathematics pack. Supabase mode exposes the complete official curriculum pack after the aggregate seed is imported.',
}

export function getDemoCurriculumBundle(
  schoolYear: string,
  gradeLevel: string,
  learningArea: string,
): CurriculumNavigatorBundle {
  const applicable = manifest.applicability.some(
    (item) => item.schoolYear === schoolYear && item.gradeLevel === gradeLevel,
  )

  if (applicable && gradeLevel === manifest.subject.gradeLevel && learningArea === manifest.subject.name) {
    return { ...bundle, schoolYear }
  }

  return {
    available: false,
    schoolYear,
    gradeLevel,
    learningArea,
    version: null,
    subject: null,
    periods: [],
    domains: [],
    standards: [],
    competencies: [],
    source: null,
    coverageNote:
      'This assignment is outside the intentionally small demo fixture. Supabase mode exposes it after the complete official curriculum seed is imported.',
  }
}
