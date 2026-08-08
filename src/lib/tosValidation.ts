import type { CurriculumNavigatorBundle } from '../types/curriculum'
import type { TosContent, TosValidationIssue, TosValidationResult } from '../types/tos'
import { calculateTosAllocation, decimalStringsSumTo } from './tosAllocation'
import { sourceWeightForRow } from './tosFactory'

function issue(key: string, message: string, rowId?: string, severity: 'error' | 'warning' = 'error'): TosValidationIssue {
  return { key, message, rowId, severity }
}

function verifiedInBundle(content: TosContent, bundle: CurriculumNavigatorBundle, rowIndex: number) {
  const row = content.rows[rowIndex]
  const exact = bundle.competencies.find((item) => item.id === row.competency.id)
    ?? bundle.competencies.find((item) =>
      item.verificationStatus === 'verified'
      && item.competencyText === row.competency.text
      && item.sourcePage === row.competency.sourcePage,
    )
  return Boolean(exact && exact.verificationStatus === 'verified')
}

export function validateTos(content: TosContent, bundle?: CurriculumNavigatorBundle | null): TosValidationResult {
  const errors: TosValidationIssue[] = []
  const warnings: TosValidationIssue[] = []
  if (!content.title.trim()) errors.push(issue('title', 'Enter a TOS title.'))
  if (!content.gradeLevel.trim()) errors.push(issue('grade', 'Grade level is required.'))
  if (!content.learningArea.trim()) errors.push(issue('learning-area', 'Learning area is required.'))
  if (!content.schoolYear.trim()) errors.push(issue('school-year', 'School year is required.'))
  if (!content.gradingTermId || !content.gradingTermLabel.trim()) errors.push(issue('grading-term', 'Select the school grading term.'))
  if (!content.curriculumVersionId || !content.curriculumSubjectId) errors.push(issue('curriculum', 'Load a verified curriculum version and subject before finalizing.'))
  if (!content.curriculumPeriodIds.length) errors.push(issue('curriculum-period', 'Select at least one curriculum-guide period. It is separate from the grading term.'))
  if (!Number.isSafeInteger(content.totalItems) || content.totalItems <= 0) errors.push(issue('total-items', 'Total test items must be a positive whole number.'))
  if (!content.rows.length) errors.push(issue('competencies', 'Select at least one verified competency.'))
  if (!content.cognitiveCategories.length) errors.push(issue('categories', 'Add at least one cognitive-process category.'))

  const categoryIds = new Set<string>()
  const categoryLabels = new Set<string>()
  content.cognitiveCategories.forEach((category) => {
    const labelKey = category.label.trim().toLocaleLowerCase('en')
    if (!category.id.trim() || !category.label.trim() || !category.shortLabel.trim()) errors.push(issue('categories', 'Every cognitive category needs an ID, label, and short label.'))
    if (categoryIds.has(category.id) || categoryLabels.has(labelKey)) errors.push(issue('categories', `Duplicate cognitive category: ${category.label || category.id}.`))
    categoryIds.add(category.id)
    categoryLabels.add(labelKey)
  })

  if (content.weightingMethod === 'manual_percentage' && content.rows.length) {
    if (!decimalStringsSumTo(content.rows.map((row) => row.manualWeight), '100')) {
      errors.push(issue('manual-weights', 'Manual percentage weights must total exactly 100%.'))
    }
  }

  const competencyIds = new Set<string>()
  const competencySnapshots = new Set<string>()
  content.rows.forEach((row, index) => {
    const snapshotKey = `${row.competency.text}\u0000${row.competency.sourcePage ?? ''}`
    if (!row.competency.id || !row.competency.text.trim() || row.competency.verificationStatus !== 'verified') {
      errors.push(issue('verified-competency', `Competency ${index + 1} is not a verified curriculum record.`, row.id))
    }
    if (competencyIds.has(row.competency.id) || competencySnapshots.has(snapshotKey)) {
      errors.push(issue('duplicate-competency', `Competency ${index + 1} is selected more than once.`, row.id))
    }
    competencyIds.add(row.competency.id)
    competencySnapshots.add(snapshotKey)
    if (!content.curriculumPeriodIds.includes(row.competency.academicPeriodId ?? '')
      && !content.curriculumPeriodLabels.includes(row.competency.curriculumPeriodLabel)) {
      errors.push(issue('period-membership', `Competency ${index + 1} is outside the selected curriculum-guide periods.`, row.id))
    }
    if (bundle && !verifiedInBundle(content, bundle, index)) {
      errors.push(issue('stale-competency', `Competency ${index + 1} is stale or no longer verified in the current curriculum bundle.`, row.id))
    }
  })

  if (bundle) {
    if (!bundle.available || bundle.source?.verificationStatus !== 'verified') errors.push(issue('verified-source', 'The current curriculum source is unavailable or not verified.'))
    if (bundle.version?.code !== content.curriculumVersionCode
      || bundle.subject?.gradeLevel !== content.gradeLevel
      || bundle.subject?.name.toLocaleLowerCase('en') !== content.learningArea.toLocaleLowerCase('en')) {
      errors.push(issue('curriculum-context', 'The selected competencies no longer match this assignment’s current curriculum version and subject.'))
    }
  }

  const allocation = calculateTosAllocation({
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
  allocation.errors.forEach((message, index) => errors.push(issue(`allocation-${index}`, message)))
  allocation.warnings.forEach((message, index) => warnings.push(issue(`allocation-warning-${index}`, message, undefined, 'warning')))
  if (allocation.ok && allocation.totalAllocated !== content.totalItems) errors.push(issue('item-total', 'Allocated items do not match the selected total.'))
  if (allocation.ok && allocation.rows.some((row) => row.itemCount <= 0)) errors.push(issue('zero-items', 'Every selected competency must receive at least one item before finalization.'))

  return { ready: errors.length === 0, errors, warnings }
}
