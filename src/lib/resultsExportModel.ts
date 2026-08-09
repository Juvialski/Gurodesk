import type { ItemAnalysisAggregate } from '../types/itemAnalysis'
import type { RemediationPlanDraft, RemediationSignalResult } from '../types/remediation'
import type {
  ResultsCompetencyRow,
  ResultsCognitiveRow,
  ResultsCurriculumPeriodRow,
  ResultsItemAnalysisRow,
  ResultsLearnerScoreRow,
  ResultsOptionRow,
  ResultsRemediationRow,
  ResultsReportBuildOptions,
  ResultsReportInput,
  ResultsReportLabels,
  ResultsReportLanguage,
  ResultsReportMetadata,
  ResultsReportMode,
  ResultsReportModel,
  ResultsSummarySection,
} from '../types/resultsReport'

const ENGLISH_LABELS: ResultsReportLabels = {
  summary: 'Assessment Results Summary',
  itemAnalysis: 'Item Analysis Report',
  competencyPerformance: 'Competency Performance Report',
  remediationPlan: 'Remediation Plan',
  learner: 'Learner',
  rawScore: 'Raw score',
  percentage: 'Percentage',
  attempted: 'Attempted',
  correct: 'Correct',
  incorrect: 'Incorrect',
  omitted: 'Omitted',
  facility: 'Facility',
  points: 'Points',
  item: 'Item',
  competency: 'Competency',
  cognitiveCategory: 'Cognitive category',
  curriculumPeriod: 'Curriculum period',
  discrimination: 'Item-rest correlation',
  options: 'Options',
  count: 'Count',
  evidence: 'Evidence',
  threshold: 'Threshold',
  learners: 'Learners',
  target: 'Target competency',
  plannedActivity: 'Planned activity',
  schedule: 'Schedule',
  followUpEvidence: 'Follow-up evidence/check',
  notes: 'Notes',
  teacherReview: 'Teacher reviewed',
  classAverage: 'Class average',
  median: 'Median',
  highest: 'Highest',
  lowest: 'Lowest',
  total: 'Total',
  possiblePoints: 'Possible points',
  pointAchievement: 'Normalized point achievement',
  analysisBasis: 'Analysis basis',
  administrationDate: 'Administration date',
  gradeLevel: 'Grade level',
  learningArea: 'Learning area',
  schoolYear: 'School year',
  gradingTerm: 'Grading term',
  section: 'Section',
  teacher: 'Teacher',
  school: 'School',
}

const FILIPINO_LABELS: ResultsReportLabels = {
  ...ENGLISH_LABELS,
  summary: 'Buod ng Resulta ng Pagtataya',
  itemAnalysis: 'Ulat ng Pagsusuri ng Aytem',
  competencyPerformance: 'Ulat ng Pagganap sa Kasanayan',
  remediationPlan: 'Plano ng Karagdagang Pagtuturo',
  learner: 'Mag-aaral',
  rawScore: 'Kabuuang puntos',
  percentage: 'Bahagdan',
  attempted: 'Sinagutan',
  correct: 'Tama',
  incorrect: 'Mali',
  omitted: 'Walang sagot',
  facility: 'Proporsyon ng tama',
  points: 'Puntos',
  item: 'Aytem',
  competency: 'Kasanayan',
  cognitiveCategory: 'Kategoryang kognitibo',
  curriculumPeriod: 'Panahon sa kurikulum',
  discrimination: 'Korelasyon ng aytem at natitirang puntos',
  options: 'Mga pagpipilian',
  count: 'Bilang',
  evidence: 'Batayan',
  threshold: 'Hangganan',
  learners: 'Mga mag-aaral',
  target: 'Target na kasanayan',
  plannedActivity: 'Planong gawain',
  schedule: 'Iskedyul',
  followUpEvidence: 'Kasunod na ebidensya/pagsusuri',
  notes: 'Mga tala',
  teacherReview: 'Sinuri ng guro',
  classAverage: 'Katamtaman ng klase',
  median: 'Median',
  highest: 'Pinakamataas',
  lowest: 'Pinakamababa',
  total: 'Kabuuan',
  possiblePoints: 'Posibleng puntos',
  pointAchievement: 'Normalisadong pagganap sa puntos',
  analysisBasis: 'Batayan ng pagsusuri',
  administrationDate: 'Petsa ng pangangasiwa',
  gradeLevel: 'Baitang',
  learningArea: 'Larangan ng pagkatuto',
  schoolYear: 'Taong panuruan',
  gradingTerm: 'Panahon ng pagmamarka',
  section: 'Seksyon',
  teacher: 'Guro',
  school: 'Paaralan',
}

function clean(value: string | null | undefined) {
  return (value ?? '').trim()
}

function looksFilipino(text: string) {
  const normalized = ` ${text.toLocaleLowerCase()} `
  const markers = [' ang ', ' mga ', ' ng ', ' sa ', ' ay ', ' upang ', ' mag-aaral', ' aralin', ' sagot', ' panuto']
  return markers.reduce((score, marker) => score + (normalized.includes(marker) ? 1 : 0), 0) >= 3
}

function resolveLanguage(options: ResultsReportBuildOptions, input: ResultsReportInput): ResultsReportLanguage {
  if (options.documentLanguage === 'filipino') return 'filipino'
  if (options.documentLanguage === 'english') return 'english'
  const authored = [
    options.authoredLanguageHint,
    input.session.title,
    input.session.assessmentSnapshot.learningArea,
    ...input.session.assessmentSnapshot.items.map((item) => item.prompt),
  ].filter(Boolean).join('\n')
  return looksFilipino(authored) ? 'filipino' : 'english'
}

function modeTitle(labels: ResultsReportLabels, mode: ResultsReportMode) {
  if (mode === 'item_analysis') return labels.itemAnalysis
  if (mode === 'competency') return labels.competencyPerformance
  if (mode === 'remediation') return labels.remediationPlan
  return labels.summary
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function summaryModel(input: ResultsReportInput, includeLearnerNames: boolean): ResultsSummarySection {
  const summary = input.analysis.classSummary
  const learners: ResultsLearnerScoreRow[] = input.analysis.learners.map((learner) => ({
    displayName: includeLearnerNames ? learner.displayName : '',
    rawScore: numberOrNull(learner.rawScore),
    possiblePoints: learner.possiblePoints,
    percentage: numberOrNull(learner.percentage),
    attemptedItems: learner.attemptedItems,
    omittedItems: learner.omittedItems,
    correctItems: learner.correctItems,
    incorrectItems: learner.incorrectItems,
  }))
  return {
    classLearnerCount: summary.learnerCount,
    encodedLearnerCount: summary.encodedLearnerCount,
    scoredLearnerCount: summary.scoredLearnerCount,
    averageRawScore: numberOrNull(summary.averageRawScore),
    medianRawScore: numberOrNull(summary.medianRawScore),
    highestRawScore: numberOrNull(summary.highestRawScore),
    lowestRawScore: numberOrNull(summary.lowestRawScore),
    averagePercentage: numberOrNull(summary.averagePercentage),
    medianPercentage: numberOrNull(summary.medianPercentage),
    highestPercentage: numberOrNull(summary.highestPercentage),
    lowestPercentage: numberOrNull(summary.lowestPercentage),
    possiblePoints: input.session.assessmentSnapshot.totalPossiblePoints,
    percentageDistribution: summary.percentageDistribution.map((bin) => ({ label: bin.label, count: bin.count })),
    learners,
  }
}

function itemRows(input: ResultsReportInput): ResultsItemAnalysisRow[] {
  return input.analysis.items.map((item) => ({
    itemNumber: item.itemNumber,
    prompt: item.prompt,
    competency: item.competencyText,
    cognitiveCategory: item.cognitiveCategoryLabel,
    curriculumPeriod: item.curriculumPeriodLabel,
    questionType: item.questionType,
    attempted: item.attempted,
    correct: item.correct,
    incorrect: item.incorrect,
    omitted: item.omitted,
    percentageCorrect: numberOrNull(item.percentageCorrect),
    facility: numberOrNull(item.facility),
    earnedPoints: item.earnedPoints,
    possiblePoints: item.possiblePoints,
    pointFacility: numberOrNull(item.pointFacility),
    normalizedPointAchievement: numberOrNull(item.normalizedPointAchievement),
    pointsPossibleForAll: item.pointsPossibleForAll ?? item.pointsPossibleForAttempted,
    // Phase 5.2 report fixtures and persisted exports predate the explicit
    // basis label. Derive a conservative display label without changing any
    // stored statistic or pretending partial-credit data is binary.
    analysisBasis: item.analysisBasis ?? (
      ['constructed_response', 'problem_solving', 'essay'].includes(item.questionType)
        ? 'teacher_scored_points'
        : item.possiblePoints === 1 && item.percentageCorrect !== null
          ? 'binary_facility'
          : 'normalized_point_achievement'
    ),
    discrimination: numberOrNull(item.discrimination.value),
    discriminationStatus: item.discrimination.status === 'available'
      ? 'available'
      : item.discrimination.reason ?? item.discrimination.status,
    options: item.options.map((option) => ({
      label: option.label,
      count: option.count,
      percentage: numberOrNull(option.percentage),
      correct: option.correct,
      distractorSignal: option.distractorSignal,
    })),
  }))
}

function optionRows(input: ResultsReportInput): ResultsOptionRow[] {
  return input.analysis.items.flatMap((item) => item.options.map((option) => ({
    itemNumber: item.itemNumber,
    option: option.label,
    count: option.count,
    percentage: numberOrNull(option.percentage),
    correct: option.correct,
    distractorSignal: option.distractorSignal,
    omitted: item.omitted,
  })))
}

function competencyRows(input: ResultsReportInput): ResultsCompetencyRow[] {
  return input.analysis.competencies.map((row) => ({
    competency: row.competencyText ?? '',
    code: row.competencyCode ?? '',
    curriculumPeriod: row.curriculumPeriodLabel,
    mappedItems: row.mappedItems,
    itemNumbers: [...row.itemNumbers],
    attempts: row.attempts,
    correct: row.correct,
    incorrect: row.incorrect,
    omitted: row.omitted,
    percentageCorrect: numberOrNull(row.percentageCorrect),
    facility: numberOrNull(row.facility),
    earnedPoints: row.earnedPoints,
    pointFacility: numberOrNull(row.pointFacility),
    normalizedPointAchievement: numberOrNull(row.normalizedPointAchievement),
    pointsPossibleForAll: row.pointsPossibleForAll,
  }))
}

function cognitiveRows(input: ResultsReportInput): ResultsCognitiveRow[] {
  return input.analysis.cognitiveCategories.map((row) => ({
    category: row.cognitiveCategoryLabel ?? '',
    curriculumPeriod: row.curriculumPeriodLabel,
    mappedItems: row.mappedItems,
    itemNumbers: [...row.itemNumbers],
    attempts: row.attempts,
    correct: row.correct,
    incorrect: row.incorrect,
    omitted: row.omitted,
    percentageCorrect: numberOrNull(row.percentageCorrect),
    facility: numberOrNull(row.facility),
    earnedPoints: row.earnedPoints,
    pointFacility: numberOrNull(row.pointFacility),
    normalizedPointAchievement: numberOrNull(row.normalizedPointAchievement),
    pointsPossibleForAll: row.pointsPossibleForAll,
  }))
}

function curriculumRows(input: ResultsReportInput): ResultsCurriculumPeriodRow[] {
  return input.analysis.curriculumPeriods.map((row) => ({
    curriculumPeriod: row.curriculumPeriodLabel,
    mappedItems: row.mappedItems,
    itemNumbers: [...row.itemNumbers],
    attempts: row.attempts,
    correct: row.correct,
    incorrect: row.incorrect,
    omitted: row.omitted,
    percentageCorrect: numberOrNull(row.percentageCorrect),
    facility: numberOrNull(row.facility),
    earnedPoints: row.earnedPoints,
    pointFacility: numberOrNull(row.pointFacility),
    normalizedPointAchievement: numberOrNull(row.normalizedPointAchievement),
    pointsPossibleForAll: row.pointsPossibleForAll,
  }))
}

function remediationRows(
  input: ResultsReportInput,
  signalResult: RemediationSignalResult | undefined,
  plan: RemediationPlanDraft | null | undefined,
): ResultsRemediationRow[] {
  const persisted = plan as (RemediationPlanDraft & {
    threshold?: number
    thresholdBasis?: 'percentage_correct' | 'point_facility'
    thresholdComparison?: 'below' | 'at_or_below'
  }) | null | undefined
  if (!signalResult?.available && !plan?.targets?.length) return []
  const activity = clean(plan?.plannedActivity)
  const schedule = clean(plan?.scheduledFor)
  const followUpEvidence = clean(plan?.followUpEvidence)
  const notes = clean(plan?.notes)
  const reviewed = Boolean(plan?.teacherReviewed)
  const currentSignals = signalResult?.classSignals ?? []
  const signals = plan?.targets?.length ? plan.targets.map((target) => {
    const current = currentSignals.find((signal) => signal.competencyId === target.competencyId
      && signal.curriculumPeriodId === target.curriculumPeriodId)
    return {
      scope: plan.scope,
      targetCompetency: target.competencyText,
      curriculumPeriod: target.curriculumPeriodLabel,
      itemNumbers: target.itemNumbers,
      // Persisted target evidence is the historical plan authority. A later
      // draft-analysis refresh must not silently rewrite it.
      evidenceValue: target.evidenceValue,
      evidenceLabel: target.evidenceLabel,
      denominatorLabel: target.denominatorLabel ?? (target.evidenceLabel === 'point_facility'
        ? 'earned points / possible points for selected learner rows'
        : 'correct / correctness-applicable attempted responses'),
      threshold: persisted?.threshold ?? signalResult?.threshold.percentageThreshold ?? 0.75,
      learnerCount: plan.scope === 'selected_learners'
        ? plan.selectedParticipantIds.length
        : input.analysis.classSummary.learnerCount,
      instructionalMessage: current?.instructionalMessage
        ?? `Teacher-selected target for ${target.competencyText}. Review the evidence and choose the next instructional step.`,
    }
  }) : currentSignals.map((signal) => ({
    scope: signal.scope,
    targetCompetency: signal.competencyText,
    curriculumPeriod: signal.curriculumPeriodLabel,
    itemNumbers: signal.itemNumbers,
    evidenceValue: signal.evidenceValue,
    evidenceLabel: signal.evidenceLabel,
    denominatorLabel: signal.denominatorLabel,
    threshold: signal.threshold,
    learnerCount: signal.numberOfLearners,
    instructionalMessage: signal.instructionalMessage,
  }))
  return signals.map((signal) => ({
    scope: signal.scope,
    targetCompetency: signal.targetCompetency,
    curriculumPeriod: signal.curriculumPeriod,
    itemNumbers: [...signal.itemNumbers],
    evidence: numberOrNull(signal.evidenceValue),
    evidenceLabel: signal.evidenceLabel,
    denominatorLabel: signal.denominatorLabel,
    threshold: signal.threshold,
    learnerCount: signal.learnerCount,
    instructionalMessage: signal.instructionalMessage,
    plannedActivity: activity,
    schedule,
    followUpEvidence,
    notes,
    teacherReviewed: reviewed,
  }))
}

function metadata(input: ResultsReportInput, options: ResultsReportBuildOptions): ResultsReportMetadata {
  const snapshot = input.session.assessmentSnapshot
  return {
    teacherName: clean(options.teacherName),
    schoolName: clean(options.schoolName),
    gradeLevel: clean(snapshot.gradeLevel),
    learningArea: clean(snapshot.learningArea),
    schoolYear: clean(snapshot.schoolYear),
    gradingTerm: clean(snapshot.gradingTermLabel),
    sectionName: clean(options.sectionName ?? input.session.sectionName),
    administrationDate: clean(input.session.administrationDate),
  }
}

/**
 * Produce a teacher-facing, ID-free report model. Assessment mappings remain
 * authoritative in the deterministic analysis; authored competency text is
 * copied verbatim and is never sent through translation or an AI service.
 */
export function buildResultsReportModel(input: ResultsReportInput, options: ResultsReportBuildOptions): ResultsReportModel {
  const language = resolveLanguage(options, input)
  const labels = language === 'filipino' ? FILIPINO_LABELS : ENGLISH_LABELS
  const mode = options.mode
  return {
    mode,
    language,
    labels: { ...labels },
    documentTitle: modeTitle(labels, mode),
    title: clean(input.session.title) || clean(input.session.assessmentSnapshot.assessmentTitle) || modeTitle(labels, mode),
    metadata: metadata(input, options),
    summary: summaryModel(input, options.includeLearnerNames ?? mode === 'summary'),
    items: itemRows(input),
    options: optionRows(input),
    competencies: competencyRows(input),
    cognitiveCategories: cognitiveRows(input),
    curriculumPeriods: curriculumRows(input),
    remediation: remediationRows(input, options.remediation, options.remediationPlan),
  }
}

export function buildResultsSummaryReportModel(input: ResultsReportInput, options: Omit<ResultsReportBuildOptions, 'mode'> = {}) {
  return buildResultsReportModel(input, { ...options, mode: 'summary', includeLearnerNames: options.includeLearnerNames ?? true })
}

export function buildResultsItemAnalysisReportModel(input: ResultsReportInput, options: Omit<ResultsReportBuildOptions, 'mode'> = {}) {
  return buildResultsReportModel(input, { ...options, mode: 'item_analysis', includeLearnerNames: false })
}

export function buildResultsCompetencyReportModel(input: ResultsReportInput, options: Omit<ResultsReportBuildOptions, 'mode'> = {}) {
  return buildResultsReportModel(input, { ...options, mode: 'competency', includeLearnerNames: false })
}

export function buildResultsRemediationReportModel(input: ResultsReportInput, options: Omit<ResultsReportBuildOptions, 'mode'> = {}) {
  return buildResultsReportModel(input, { ...options, mode: 'remediation', includeLearnerNames: false })
}

export function aggregateRowsForReport(model: ResultsReportModel) {
  return [...model.competencies, ...model.cognitiveCategories, ...model.curriculumPeriods]
}

export type { ItemAnalysisAggregate }
