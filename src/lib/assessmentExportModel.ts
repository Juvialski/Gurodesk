import type { Assessment, AssessmentAnswer, AssessmentItem, QuestionType } from '../types/assessment'
import { normalizeAssessmentMathText } from './assessmentMathText'
import { recommendedAssessmentResponseLines } from './assessmentExportPresentation'
import { neutralAssessmentVisualAltText } from './assessmentVisualValidation'
import type {
  AssessmentAnswerKeyExportQuestion,
  AssessmentExportLabels,
  AssessmentExportModel,
  AssessmentExportOptions,
  AssessmentExportQuestionBase,
  AssessmentStudentExportQuestion,
  AssessmentTeacherExportQuestion,
} from '../types/assessmentExport'

function clean(value: string | null | undefined) { return (value ?? '').trim() }
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function array(value: unknown) { return Array.isArray(value) ? value : [] }

const ENGLISH_LABELS: AssessmentExportLabels = {
  documentTitle: 'ASSESSMENT', teacher: 'Teacher', school: 'School', gradeLevel: 'Grade Level', learningArea: 'Learning Area', schoolYear: 'School Year', gradingTerm: 'Grading Term', curriculumPeriods: 'Curriculum Periods', learnerName: 'Learner Name', section: 'Section', instructions: 'Instructions', answer: 'Answer', answerKey: 'ANSWER KEY / SCORING GUIDE', competency: 'Competency', cognitiveCategory: 'Cognitive Category', rationale: 'Rationale', points: 'Points', choicePrefix: 'Choice', responseLine: 'Response', totalItems: 'Items', totalPoints: 'Total Points', solution: 'Solution / method', rubric: 'Rubric', columnA: 'Column A', columnB: 'Column B', tolerance: 'Tolerance',
}

const FILIPINO_LABELS: AssessmentExportLabels = {
  documentTitle: 'PAGTATAYA', teacher: 'Guro', school: 'Paaralan', gradeLevel: 'Baitang', learningArea: 'Larangan ng Pagkatuto', schoolYear: 'Taong Panuruan', gradingTerm: 'Termino ng Pagmamarka', curriculumPeriods: 'Panahon sa Kurikulum', learnerName: 'Pangalan ng Mag-aaral', section: 'Seksyon', instructions: 'Panuto', answer: 'Sagot', answerKey: 'SUSI NG SAGOT / GABAY SA PAGMAMARKA', competency: 'Kasanayan', cognitiveCategory: 'Kategoryang Kognitibo', rationale: 'Paliwanag', points: 'Puntos', choicePrefix: 'Pagpipilian', responseLine: 'Sagot', totalItems: 'Bilang ng Aytem', totalPoints: 'Kabuuang Puntos', solution: 'Solusyon / paraan', rubric: 'Rubrik', columnA: 'Hanay A', columnB: 'Hanay B', tolerance: 'Pagpapahintulot',
}

function looksFilipino(text: string) {
  const normalized = ` ${text.toLocaleLowerCase().replace(/[^a-záéíóúñ\s-]/g, ' ')} `
  const markers = [' ang ', ' mga ', ' ng ', ' sa ', ' ay ', ' upang ', ' mag-aaral', ' aralin', ' gawain', ' pagkatuto', ' sagot', ' panuto']
  return markers.reduce((score, marker) => score + (normalized.includes(marker) ? 1 : 0), 0) >= 3
}

function resolveLanguage(assessment: Assessment, options: AssessmentExportOptions) {
  if (options.documentLanguage === 'filipino') return 'filipino' as const
  if (options.documentLanguage === 'english') return 'english' as const
  const authored = [assessment.title, assessment.instructions, ...assessment.items.map((item) => item.prompt)].filter(Boolean).join('\n')
  return looksFilipino(authored) ? 'filipino' as const : 'english' as const
}

function answerOf(item: AssessmentItem) { return item.answer as unknown as Record<string, unknown> }
function questionType(item: AssessmentItem) { return item.questionType as QuestionType }

/** Keep the export model independent of React/page modules so print/export
 * validators and offline document generation can load it in isolation. */
function pointsForItem(item: AssessmentItem) {
  const value = (item as unknown as Record<string, unknown>).pointsPossible ?? (item as unknown as Record<string, unknown>).points
  const points = Number(value)
  return Number.isFinite(points) && points > 0 ? points : 1
}

function assessmentTotalPoints(assessment: Assessment) { return assessment.items.reduce((sum, item) => sum + pointsForItem(item), 0) }

function choicesFor(item: AssessmentItem) {
  const answer = answerOf(item)
  const choices = array(answer.choices ?? answer.options)
  return choices.map((choice, index) => {
    const value = object(choice)
    return { id: clean(String(value.id ?? value.key ?? String.fromCharCode(65 + index))), text: normalizeAssessmentMathText(clean(String(value.text ?? value.value ?? value.label))), ...(value.label ? { label: clean(String(value.label)) } : {}) }
  }).filter((choice) => choice.text)
}

function promptsFor(item: AssessmentItem) {
  const answer = answerOf(item)
  return array(answer.prompts ?? answer.columnA).map((entry, index) => {
    const value = object(entry)
    return { id: clean(String(value.id ?? value.key ?? `prompt-${index + 1}`)), text: normalizeAssessmentMathText(clean(String(value.text ?? value.value))) }
  }).filter((entry) => entry.text)
}

function blanksFor(item: AssessmentItem) {
  const answer = answerOf(item)
  return array(answer.blanks).map((_, index) => ({ label: String.fromCharCode(65 + index), answerSpaceLines: 1 }))
}

function subpartsFor(item: AssessmentItem) {
  const answer = answerOf(item)
  return array(answer.subparts).map((entry, index) => {
    const part = object(entry)
    const points = Number(part.pointsPossible ?? part.points)
    return {
      label: String.fromCharCode(97 + index),
      prompt: normalizeAssessmentMathText(clean(String(part.prompt ?? ''))),
      pointsPossible: Number.isFinite(points) && points > 0 ? points : 0,
    }
  }).filter((part) => part.prompt)
}

function answerSpaceLines(item: AssessmentItem) {
  const type = questionType(item)
  if (type === 'multiple_choice' || type === 'multiple_select' || type === 'matching') return 0
  if (type === 'fill_in_the_blank') return Math.max(0, blanksFor(item).length)
  return 1
}

function scoringGuide(item: AssessmentItem) {
  const answer = answerOf(item)
  const type = questionType(item)
  const rubric = array(answer.rubric ?? answer.scoringCriteria).map((entry, index) => {
    const criterion = object(entry)
    const label = clean(String(criterion.label ?? `Criterion ${index + 1}`))
    const points = Number(criterion.pointsPossible ?? criterion.points)
    const description = clean(String(criterion.description ?? ''))
    return `${label}${Number.isFinite(points) ? ` — ${points} pt${points === 1 ? '' : 's'}` : ''}${description ? `: ${description}` : ''}`
  }).filter(Boolean)
  if (type === 'problem_solving') {
    const subparts = array(answer.subparts).map((entry, index) => {
      const part = object(entry)
      const prompt = clean(String(part.prompt ?? ''))
      const expected = part.expectedAnswer === undefined ? '' : clean(String(part.expectedAnswer))
      const points = Number(part.pointsPossible ?? part.points)
      return `Part ${String.fromCharCode(97 + index)}${prompt ? `: ${prompt}` : ''}${expected ? ` — Expected: ${expected}` : ''}${Number.isFinite(points) ? ` — ${points} pt${points === 1 ? '' : 's'}` : ''}`
    })
    return [answer.solutionOutline ? `Method: ${String(answer.solutionOutline)}` : '', ...subparts, ...rubric].filter(Boolean).join('\n')
  }
  if (type === 'essay') return [array(answer.keyPoints).length ? `Key points: ${array(answer.keyPoints).map(String).join('; ')}` : '', ...rubric, answer.scoringNotes ? `Scoring notes: ${String(answer.scoringNotes)}` : ''].filter(Boolean).join('\n')
  if (type === 'constructed_response') return [answer.rubricGuidance ? String(answer.rubricGuidance) : '', array(answer.expectedElements).length ? `Expected elements: ${array(answer.expectedElements).map(String).join('; ')}` : '', ...rubric].filter(Boolean).join('\n')
  if (type === 'matching') {
    const mappings = array(answer.mappings)
    const perMatch = Number(answer.pointsPerMatch)
    if (Number.isFinite(perMatch)) return `${perMatch} point${perMatch === 1 ? '' : 's'} per match.`
    if (mappings.some((entry) => Number.isFinite(Number(object(entry).pointsPossible)))) return mappings.map((entry, index) => { const points = Number(object(entry).pointsPossible); return `Match ${index + 1}: ${points} pt${points === 1 ? '' : 's'}` }).join('; ')
    if (mappings.length) {
      const perResponse = Math.round(pointsForItem(item) / mappings.length * 100) / 100
      return `${perResponse} point${perResponse === 1 ? '' : 's'} per match; ${pointsForItem(item)} total.`
    }
  }
  return ''
}

function baseQuestion(item: AssessmentItem): AssessmentExportQuestionBase {
  const type = questionType(item)
  return {
    itemNumber: item.itemNumber,
    prompt: normalizeAssessmentMathText(item.prompt),
    questionType: type,
    choices: choicesFor(item),
    prompts: promptsFor(item),
    blanks: blanksFor(item),
    subparts: subpartsFor(item),
    answerSpaceLines: recommendedAssessmentResponseLines({ questionType: type, pointsPossible: pointsForItem(item), answerSpaceLines: answerSpaceLines(item) }),
    pointsPossible: pointsForItem(item),
    points: pointsForItem(item),
    ...(item.visual ? { visual: item.visual } : {}),
    ...(type === 'problem_solving' || type === 'essay' ? { responseInstructions: 'Show your reasoning. The teacher will score the response using the scoring guide.' } : {}),
  }
}

function studentQuestion(item: AssessmentItem): AssessmentStudentExportQuestion {
  const base = baseQuestion(item)
  const learnerVisual = base.visual ? { ...base.visual, altText: neutralAssessmentVisualAltText(base.visual) } : undefined
  // The base projection always supplies these presentation arrays; choices: base.choices.map is intentionally deterministic.
  return {
    ...base,
    choices: base.choices ? base.choices.map((choice) => choice.text) : undefined,
    prompts: base.prompts ? base.prompts.map((prompt) => prompt.text) : undefined,
    // Blank labels are presentation-only and contain no answer or internal ID.
    blanks: base.blanks?.map((blank) => ({ ...blank })),
    ...(learnerVisual ? { visual: learnerVisual } : {}),
  }
}

function teacherQuestion(item: AssessmentItem, options: AssessmentExportOptions): AssessmentTeacherExportQuestion {
  const includeAnswer = options.includeAnswer !== false
  return {
    ...baseQuestion(item),
    ...(includeAnswer ? { answer: item.answer } : {}),
    ...(options.includeCompetency ? { competency: item.competencySnapshot } : {}),
    ...(options.includeCognitiveCategory ? { cognitiveCategory: item.cognitiveCategorySnapshot } : {}),
    ...(options.includeRationale && item.rationale?.trim() ? { rationale: normalizeAssessmentMathText(item.rationale) } : {}),
    ...(scoringGuide(item) ? { scoringGuide: normalizeAssessmentMathText(scoringGuide(item)) } : {}),
  }
}

function answerKeyQuestion(item: AssessmentItem): AssessmentAnswerKeyExportQuestion {
  return { itemNumber: item.itemNumber, questionType: questionType(item), answerSpaceLines: 0, pointsPossible: pointsForItem(item), points: pointsForItem(item), answer: item.answer, ...(item.visual ? { visual: item.visual } : {}), ...(scoringGuide(item) ? { scoringGuide: normalizeAssessmentMathText(scoringGuide(item)) } : {}) }
}

export function buildAssessmentExportModel(assessment: Assessment, options: AssessmentExportOptions): AssessmentExportModel {
  const language = resolveLanguage(assessment, options)
  const labels = language === 'filipino' ? FILIPINO_LABELS : ENGLISH_LABELS
  const mode = options.mode
  const title = clean(assessment.title) || labels.documentTitle
  const questions = mode === 'student' ? assessment.items.map(studentQuestion) : mode === 'answer_key' ? assessment.items.map(answerKeyQuestion) : assessment.items.map((item) => teacherQuestion(item, options))
  return {
    mode,
    language,
    labels: { ...labels, documentTitle: mode === 'answer_key' ? labels.answerKey : labels.documentTitle },
    status: assessment.status,
    title,
    instructions: mode === 'answer_key' ? '' : assessment.instructions,
    metadata: {
      teacherName: clean(options.teacherName), positionTitle: clean(options.positionTitle), schoolName: clean(options.schoolName), region: clean(options.region), division: clean(options.division),
      ...(mode !== 'answer_key' ? { learnerName: clean(options.learnerName), section: clean(options.section) } : {}),
      gradeLevel: clean(assessment.gradeLevel), learningArea: clean(assessment.learningArea), schoolYear: clean(assessment.schoolYear), gradingTerm: clean(assessment.gradingTermLabel),
      ...(mode === 'teacher' ? { curriculumPeriods: assessment.curriculumPeriodLabels.map(clean).filter(Boolean).join(', ') } : {}),
      totalItems: assessment.items.length,
      totalPoints: assessmentTotalPoints(assessment),
    },
    questions,
  }
}

export function buildAssessmentStudentExportModel(assessment: Assessment, options: Omit<AssessmentExportOptions, 'mode'> = {}) { return buildAssessmentExportModel(assessment, { ...options, mode: 'student' }) }
export function buildAssessmentTeacherExportModel(assessment: Assessment, options: Omit<AssessmentExportOptions, 'mode'> = {}) { return buildAssessmentExportModel(assessment, { ...options, mode: 'teacher' }) }
export function buildAssessmentAnswerKeyExportModel(assessment: Assessment, options: Omit<AssessmentExportOptions, 'mode'> = {}) { return buildAssessmentExportModel(assessment, { ...options, mode: 'answer_key' }) }
