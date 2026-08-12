import type { TeacherAssignment } from '../types/app'
import type { CurriculumCompetency, CurriculumNavigatorBundle, CurriculumPeriod } from '../types/curriculum'
import type {
  InstructionalPacingEntry,
  TosCognitiveCategory,
  TosCompetencyRow,
  TosContent,
  TosRecord,
} from '../types/tos'
import { calculateTosAllocation } from './tosAllocation'

export const DEFAULT_TOS_COGNITIVE_CATEGORIES: TosCognitiveCategory[] = [
  ['remembering', 'Remembering', 'R'],
  ['understanding', 'Understanding', 'U'],
  ['applying', 'Applying', 'Ap'],
  ['analyzing', 'Analyzing', 'An'],
  ['evaluating', 'Evaluating', 'E'],
  ['creating', 'Creating', 'C'],
].map(([id, label, shortLabel], index) => ({ id, label, shortLabel, weight: '1', sortOrder: index + 1 }))

function blankCalculation() {
  return {
    engine: 'hamilton-largest-remainder-v1' as const,
    valid: false,
    totalAllocated: 0,
    calculatedAt: null,
    warnings: [] as string[],
  }
}

export function createBlankTosContent(assignment: TeacherAssignment): TosContent {
  return {
    schemaVersion: 1,
    title: '',
    assessmentTitle: '',
    gradeLevel: assignment.gradeLevel,
    learningArea: assignment.learningArea,
    sections: [...assignment.sections],
    schoolYear: assignment.schoolYear,
    gradingTermId: '',
    gradingTermLabel: '',
    curriculumVersionId: '',
    curriculumVersionCode: '',
    curriculumVersionName: '',
    curriculumSubjectId: '',
    curriculumPeriodIds: [],
    curriculumPeriodLabels: [],
    sourceTitle: '',
    sourceUrl: '',
    totalItems: 40,
    weightingMethod: 'equal',
    cognitiveCategories: DEFAULT_TOS_COGNITIVE_CATEGORIES.map((item) => ({ ...item })),
    rows: [],
    notes: '',
    calculation: blankCalculation(),
  }
}

export function createBlankTos(userId: string, assignment: TeacherAssignment): TosRecord {
  return {
    id: '',
    userId,
    assignmentId: assignment.id,
    title: '',
    schoolYear: assignment.schoolYear,
    academicPeriodLabel: null,
    status: 'draft',
    content: createBlankTosContent(assignment),
    versionNumber: 0,
    createdAt: '',
    updatedAt: '',
  }
}

function periodFor(bundle: CurriculumNavigatorBundle, competency: CurriculumCompetency): CurriculumPeriod | null {
  return bundle.periods.find((item) => item.id === competency.academicPeriodId) ?? null
}

export function curriculumContextForCompetency(bundle: CurriculumNavigatorBundle, competency: CurriculumCompetency) {
  const domain = bundle.domains.find((item) => item.id === competency.domainId) ?? null
  const standards = bundle.standards
    .filter((standard) => (standard.standardType === 'content' || standard.standardType === 'performance')
      && standard.academicPeriodId === competency.academicPeriodId
      && (standard.domainId === null || standard.domainId === competency.domainId))
    .map((standard) => ({
      id: standard.id,
      type: standard.standardType as 'content' | 'performance',
      text: standard.standardText,
      sourcePage: standard.sourcePage,
    }))
  return {
    domainId: competency.domainId,
    contentArea: domain?.name ?? '',
    standards,
  }
}

export function createTosCompetencyRow(
  competency: CurriculumCompetency,
  bundle: CurriculumNavigatorBundle,
  categories: TosCognitiveCategory[],
  sortOrder: number,
  pacing?: InstructionalPacingEntry | null,
): TosCompetencyRow {
  if (competency.verificationStatus !== 'verified') throw new Error('Only verified curriculum competencies can be added to a TOS.')
  const period = periodFor(bundle, competency)
  const curriculumContext = curriculumContextForCompetency(bundle, competency)
  return {
    id: crypto.randomUUID(),
    sortOrder,
    competency: {
      id: competency.id,
      code: competency.competencyCode,
      text: competency.competencyText,
      sourcePage: competency.sourcePage,
      sourceTitle: bundle.source?.title ?? null,
      sourceUrl: bundle.source?.sourceUrl ?? null,
      academicPeriodId: competency.academicPeriodId,
      curriculumPeriodLabel: period?.label ?? '',
      verificationStatus: 'verified',
      ...curriculumContext,
    },
    instructionalMinutes: pacing?.suggestedMinutes === null || pacing?.suggestedMinutes === undefined ? '' : String(pacing.suggestedMinutes),
    manualWeight: '',
    itemCountOverride: '',
    cognitiveWeights: Object.fromEntries(categories.map((item) => [item.id, item.weight])),
    notes: '',
    computedWeightPercent: '0.00',
    itemCount: 0,
    itemStart: null,
    itemEnd: null,
    itemRangeLabel: '',
    cognitiveAllocations: [],
  }
}

export function sourceWeightForRow(content: TosContent, row: TosCompetencyRow) {
  if (content.weightingMethod === 'manual_percentage') return row.manualWeight
  if (content.weightingMethod === 'instructional_time') return row.instructionalMinutes
  return '1'
}

export function recalculateTosContent(content: TosContent): TosContent {
  const result = calculateTosAllocation({
    totalItems: content.totalItems,
    categories: content.cognitiveCategories,
    rows: content.rows.map((row) => ({
      id: row.id,
      sortOrder: row.sortOrder,
      weight: sourceWeightForRow(content, row),
      itemCountOverride: row.itemCountOverride,
      cognitiveWeights: row.cognitiveWeights,
    })),
  })
  const allocatedById = new Map(result.rows.map((row) => [row.id, row]))
  return {
    ...content,
    rows: content.rows.map((row, index) => {
      const allocation = allocatedById.get(row.id)
      return allocation ? { ...row, sortOrder: index + 1, ...allocation } : {
        ...row,
        sortOrder: index + 1,
        computedWeightPercent: '0.00',
        itemCount: 0,
        itemStart: null,
        itemEnd: null,
        itemRangeLabel: '',
        cognitiveAllocations: [],
      }
    }),
    calculation: {
      engine: 'hamilton-largest-remainder-v1',
      valid: result.ok,
      totalAllocated: result.totalAllocated,
      calculatedAt: result.ok ? new Date().toISOString() : null,
      warnings: [...result.errors, ...result.warnings],
    },
  }
}

export function normalizeTosContent(content: TosContent): TosContent {
  const categories = (content.cognitiveCategories?.length ? content.cognitiveCategories : DEFAULT_TOS_COGNITIVE_CATEGORIES)
    .map((item, index) => ({ ...item, sortOrder: index + 1, weight: item.weight ?? '1' }))
  const normalized: TosContent = {
    ...content,
    schemaVersion: 1,
    assessmentTitle: content.assessmentTitle ?? '',
    sections: content.sections ?? [],
    gradingTermId: content.gradingTermId ?? '',
    gradingTermLabel: content.gradingTermLabel ?? '',
    curriculumPeriodIds: content.curriculumPeriodIds ?? [],
    curriculumPeriodLabels: content.curriculumPeriodLabels ?? [],
    sourceTitle: content.sourceTitle ?? '',
    sourceUrl: content.sourceUrl ?? '',
    cognitiveCategories: categories,
    rows: (content.rows ?? []).map((row, index) => ({
      ...row,
      sortOrder: index + 1,
      instructionalMinutes: row.instructionalMinutes ?? '',
      manualWeight: row.manualWeight ?? '',
      itemCountOverride: row.itemCountOverride ?? '',
      cognitiveWeights: Object.fromEntries(categories.map((category) => [category.id, row.cognitiveWeights?.[category.id] ?? category.weight])),
      competency: {
        ...row.competency,
        domainId: row.competency.domainId ?? null,
        contentArea: row.competency.contentArea ?? '',
        standards: (row.competency.standards ?? []).filter((standard) => standard.type === 'content' || standard.type === 'performance'),
      },
      notes: row.notes ?? '',
      cognitiveAllocations: row.cognitiveAllocations ?? [],
    })),
    notes: content.notes ?? '',
    calculation: content.calculation ?? blankCalculation(),
  }
  return recalculateTosContent(normalized)
}
