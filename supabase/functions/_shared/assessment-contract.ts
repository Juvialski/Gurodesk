import type { AssessmentQuestionType } from './ai-models.ts'
import { ASSESSMENT_QUESTION_TYPES } from './ai-models.ts'
import { validateAssessmentVisual } from './assessment-visual.ts'
import { extractAssessmentTikzNodeTexts, normalizeAssessmentTikzLearnerText } from './tikz-safety.ts'

export type QuestionType = AssessmentQuestionType
export type Row = Record<string, unknown>

export class AssessmentContractError extends Error {
  readonly category: 'MALFORMED_JSON' | 'UNSUPPORTED_FIELD' | 'SEMANTIC_INVALID' | 'RESOURCE_INVALID' | 'IMMUTABLE_CONTEXT' | 'VISUAL_INVALID'

  constructor(message: string, category: AssessmentContractError['category'] = 'SEMANTIC_INVALID') {
    super(message)
    this.name = 'AssessmentContractError'
    this.category = category
  }
}

export const QUESTION_TYPES = new Set<QuestionType>(ASSESSMENT_QUESTION_TYPES)

function object(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null
}

function has(value: Row, key: string) { return Object.prototype.hasOwnProperty.call(value, key) }

function onlyKeys(value: Row, allowed: readonly string[], label: string) {
  const allowedSet = new Set(allowed)
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key))
  if (unsupported.length) throw new AssessmentContractError(`${label} contains unsupported fields.`, 'UNSUPPORTED_FIELD')
}

function requiredKeys(value: Row, required: readonly string[], label: string) {
  if (required.some((key) => !has(value, key))) throw new AssessmentContractError(`${label} is missing a required field.`)
}

function text(value: unknown, label: string, max: number, required = true) {
  if (typeof value !== 'string') {
    if (!required && value === undefined) return ''
    throw new AssessmentContractError(`${label} must be text.`)
  }
  const normalized = value.trim()
  if (normalized.length > max || (required && normalized.length === 0)) throw new AssessmentContractError(`${label} is empty or exceeds its limit.`)
  return normalized
}

function finiteNumber(value: unknown, label: string, minimum?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (minimum !== undefined && value < minimum)) throw new AssessmentContractError(`${label} must be a finite number.`)
  return value
}

function boolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new AssessmentContractError(`${label} must be boolean.`)
  return value
}

function stringList(value: unknown, label: string, maxItems: number, maxLength: number, options: { required?: boolean; unique?: boolean; minItems?: number } = {}) {
  if (value === undefined && options.required === false) return []
  if (!Array.isArray(value) || value.length < (options.minItems ?? 0) || value.length > maxItems) throw new AssessmentContractError(`${label} must be a bounded array.`)
  const result = value.map((entry) => text(entry, `${label} entry`, maxLength))
  if (options.unique !== false && new Set(result.map((entry) => entry.toLocaleLowerCase('en'))).size !== result.length) throw new AssessmentContractError(`${label} entries must be unique.`)
  return result
}

function acceptedAnswerKey(value: string, caseSensitive: boolean) {
  const normalized = value.normalize('NFKC').trim().replace(/[.,;:!?]+$/u, '').trim()
  return caseSensitive ? normalized : normalized.toLocaleLowerCase('en')
}

function uniqueAcceptedAnswers(value: unknown, label: string, caseSensitive: boolean) {
  const entries = stringList(value, label, 20, 500, { minItems: 1, unique: false })
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of entries) {
    const key = acceptedAnswerKey(entry, caseSensitive)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(entry)
  }
  if (!result.length) throw new AssessmentContractError(`${label} must contain at least one nonblank answer.`)
  return result
}

function id(value: unknown, fallback: string, label: string) {
  const candidate = value === undefined ? fallback : text(value, label, 80)
  if (!candidate || /[\u0000-\u001F<>]/u.test(candidate)) throw new AssessmentContractError(`${label} is invalid.`)
  return candidate
}

function normalizeChoices(value: unknown, label: string, minimum = 2, maximum = 6) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new AssessmentContractError(`${label} must contain ${minimum}–${maximum} choices.`)
  const choices = value.map((entry, index) => {
    const candidate = object(entry)
    if (!candidate) throw new AssessmentContractError(`${label} entries must be objects.`)
    onlyKeys(candidate, ['id', 'text'], `${label} entry`)
    return { id: id(candidate.id, String.fromCharCode(65 + index), `${label} id`), text: text(candidate.text, `${label} text`, 500) }
  })
  if (new Set(choices.map((entry) => entry.id.toLocaleLowerCase('en'))).size !== choices.length || new Set(choices.map((entry) => entry.text.toLocaleLowerCase('en'))).size !== choices.length) throw new AssessmentContractError(`${label} choices must be unique.`)
  return choices
}

function criterionList(value: unknown, label: string, maximum = 12) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > maximum) throw new AssessmentContractError(`${label} must be a bounded array.`)
  const normalized = value.map((entry, index) => {
    const candidate = object(entry)
    if (!candidate) throw new AssessmentContractError(`${label} entries must be objects.`)
    onlyKeys(candidate, ['id', 'label', 'pointsPossible', 'description'], `${label} entry`)
    const result: Row = {
      id: id(candidate.id, `criterion-${index + 1}`, `${label} id`),
      label: text(candidate.label, `${label} label`, 500),
      pointsPossible: finiteNumber(candidate.pointsPossible, `${label} points`, 0.000001),
    }
    if (has(candidate, 'description')) result.description = text(candidate.description, `${label} description`, 1000)
    return result
  })
  if (new Set(normalized.map((entry) => String(entry.id).toLocaleLowerCase('en'))).size !== normalized.length) throw new AssessmentContractError(`${label} IDs must be unique.`)
  return normalized
}

function unverifiedResource(value: string, resources: string[]) {
  const normalize = (claim: string) => claim.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const normalized = normalize(value)
  const allowed = resources.map((entry) => ({ raw: entry.toLocaleLowerCase('en'), normalized: normalize(entry) })).filter((entry) => entry.normalized)
  const urls = value.match(/(?:https?:\/\/|www\.)[^\s)\],]+/giu) ?? []
  if (urls.some((url) => !allowed.some((entry) => entry.raw.includes(url.toLocaleLowerCase('en'))))) return true
  const pages = value.match(/(?:\bpage\b|\bp\.|\bpahina\b)\s*\d+/giu) ?? []
  if (pages.some((page) => !allowed.some((entry) => entry.normalized.includes(normalize(page))))) return true
  const named = /\b(?:textbook|module|worksheet|website|handout|reference\s+(?:book|material|source)|activity\s+sheet|learning\s+material|mobile\s+app|software|device|tablet|computer|laptop|projector|aklat|modyul|sanggunian|kagamitang\s+pampagkatuto|aplikasyon|kompyuter|barangay|municipality|province)\b/iu
  return named.test(value) && !allowed.some((entry) => normalized.includes(entry.normalized))
}

function answerStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(answerStrings)
  if (value && typeof value === 'object') return Object.values(value as Row).flatMap(answerStrings)
  return []
}

function semanticText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/gu, ' ').trim()
}

function directAnswerTerms(answer: Row, questionType: QuestionType) {
  const values: string[] = []
  if (questionType === 'short_answer' || questionType === 'identification') {
    if (Array.isArray(answer.acceptedAnswers)) values.push(...answer.acceptedAnswers.filter((entry): entry is string => typeof entry === 'string'))
  } else if (questionType === 'fill_in_the_blank' && Array.isArray(answer.blanks)) {
    for (const rawBlank of answer.blanks) {
      const blank = object(rawBlank)
      if (blank && Array.isArray(blank.acceptedAnswers)) values.push(...blank.acceptedAnswers.filter((entry): entry is string => typeof entry === 'string'))
    }
  } else if (questionType === 'multiple_choice' && Array.isArray(answer.choices) && typeof answer.choiceId === 'string') {
    const selected = answer.choices.map(object).find((choice) => choice?.id === answer.choiceId)
    if (selected && typeof selected.text === 'string') values.push(selected.text)
  } else if (questionType === 'multiple_select' && Array.isArray(answer.choices) && Array.isArray(answer.choiceIds)) {
    const correct = new Set(answer.choiceIds.filter((entry): entry is string => typeof entry === 'string'))
    for (const choice of answer.choices.map(object)) if (choice && typeof choice.id === 'string' && correct.has(choice.id) && typeof choice.text === 'string') values.push(choice.text)
  } else if (questionType === 'numerical_answer') {
    if (answer.value !== undefined) values.push(String(answer.value))
  } else if (questionType === 'problem_solving' && answer.finalAnswer !== undefined) values.push(String(answer.finalAnswer))
  return [...new Set(values.map(semanticText).filter((entry) => entry.length >= 1 && entry.length <= 120))]
}

function containsAnswerTerm(value: string, terms: string[]) {
  const normalized = ` ${semanticText(value)} `
  return terms.some((term) => normalized.includes(` ${term} `))
}

function directTikzNodeTexts(source: string) {
  return extractAssessmentTikzNodeTexts(source).map(normalizeAssessmentTikzLearnerText).filter(Boolean)
}

function visualTextRevealsAnswer(value: unknown, terms: string[]) {
  if (!terms.length) return false
  const visual = object(value)
  if (!visual) return false
  if (typeof visual.tikzCode === 'string' && directTikzNodeTexts(visual.tikzCode).some((label) => containsAnswerTerm(label, terms))) return true
  if (!Array.isArray(visual.primitives)) return false
  return visual.primitives.map(object).some((primitive) =>
    primitive?.type === 'textLabel'
    && typeof primitive.text === 'string'
    && containsAnswerTerm(primitive.text, terms),
  )
}

function stripAnswerLeakingParentheticals(value: string, terms: string[]) {
  return value.replace(/\([^()]{1,240}\)/gu, (group) => containsAnswerTerm(group, terms) ? '' : group).replace(/\s{2,}/gu, ' ').replace(/\s+([,.;:!?])/gu, '$1').trim()
}

/**
 * AI alt text is normalized to an observational description owned by GuroDesk.
 * It deliberately does not repeat model-supplied classifications or solutions.
 */
function neutralVisualAltText(value: unknown) {
  const visual = object(value)
  const primitives = visual && Array.isArray(visual.primitives) ? visual.primitives.map(object).filter((entry): entry is Row => Boolean(entry)) : []
  if (visual && typeof visual.tikzCode === 'string' && !primitives.length) return 'A mathematical diagram accompanying the question.'
  const axes = primitives.filter((entry) => entry.type === 'cartesianAxes').length
  const plots = primitives.filter((entry) => entry.type === 'cartesianPlot').length
  if (axes) return plots ? 'A Cartesian coordinate graph with plotted data and labeled axes.' : 'A Cartesian coordinate plane with labeled axes.'
  const polygons = primitives.filter((entry) => entry.type === 'polygon')
  const circles = primitives.filter((entry) => entry.type === 'circle').length
  const segments = primitives.filter((entry) => entry.type === 'segment' || entry.type === 'dashedSegment').length
  const angleMarks = primitives.filter((entry) => entry.type === 'angleArc').length
  const congruenceMarks = primitives.filter((entry) => entry.type === 'equalSideMark' || entry.type === 'tickMark').length
  const relationMarks = primitives.filter((entry) => entry.type === 'parallelMark' || entry.type === 'perpendicularMark').length
  const parts: string[] = []
  if (polygons.length === 1) {
    const points = Array.isArray(polygons[0].points) ? polygons[0].points.length : 0
    parts.push(points >= 3 ? `A polygon outline with ${points} vertices.` : 'A polygon outline.')
  } else if (polygons.length > 1) parts.push(`A geometry diagram with ${polygons.length} polygon outlines.`)
  else if (circles) parts.push(circles === 1 ? 'A geometry diagram containing a circle.' : `A geometry diagram containing ${circles} circles.`)
  else parts.push('A geometry diagram with mathematical line work and labels.')
  if (segments) parts.push('Line segments are shown.')
  if (angleMarks) parts.push('Angle markings are shown.')
  if (congruenceMarks) parts.push('Congruence markings are shown.')
  if (relationMarks) parts.push('Parallel or perpendicular markings are shown.')
  return parts.join(' ').slice(0, 240)
}

function normalizeAnswer(answer: unknown, questionType: QuestionType): Row {
  const source = object(answer)
  if (!source) throw new AssessmentContractError('The AI response answer shape is invalid.')
  if (source.type !== questionType) throw new AssessmentContractError('The AI response answer type does not match the verified question type.')

  if (questionType === 'multiple_choice') {
    onlyKeys(source, ['type', 'choices', 'choiceId'], 'Multiple-choice answer')
    const choices = normalizeChoices(source.choices, 'Multiple-choice')
    const choiceId = text(source.choiceId, 'Multiple-choice choiceId', 80)
    if (!choices.some((choice) => choice.id === choiceId)) throw new AssessmentContractError('Multiple-choice answer must reference one returned choice.')
    return { type: questionType, choices, choiceId }
  }
  if (questionType === 'true_false') {
    onlyKeys(source, ['type', 'value'], 'True/False answer'); requiredKeys(source, ['value'], 'True/False answer')
    return { type: questionType, value: boolean(source.value, 'True/False value') }
  }
  if (questionType === 'short_answer' || questionType === 'identification') {
    onlyKeys(source, ['type', 'acceptedAnswers', 'caseSensitive'], 'Accepted-answer shape')
    const caseSensitive = source.caseSensitive === undefined ? false : boolean(source.caseSensitive, 'Case sensitivity')
    const acceptedAnswers = uniqueAcceptedAnswers(source.acceptedAnswers, 'Accepted answers', caseSensitive)
    return { type: questionType, acceptedAnswers, caseSensitive }
  }
  if (questionType === 'fill_in_the_blank') {
    onlyKeys(source, ['type', 'blanks'], 'Fill-in-the-blank answer')
    if (!Array.isArray(source.blanks) || source.blanks.length < 1 || source.blanks.length > 12) throw new AssessmentContractError('Fill-in-the-blank requires 1–12 blanks.')
    const blanks = source.blanks.map((entry, index) => {
      const candidate = object(entry)
      if (!candidate) throw new AssessmentContractError('Fill-in-the-blank blank shape is invalid.')
      onlyKeys(candidate, ['id', 'acceptedAnswers', 'caseSensitive', 'pointsPossible'], 'Fill-in-the-blank blank')
      const caseSensitive = has(candidate, 'caseSensitive') ? boolean(candidate.caseSensitive, 'Blank case sensitivity') : false
      const acceptedAnswers = uniqueAcceptedAnswers(candidate.acceptedAnswers, 'Blank accepted answers', caseSensitive)
      const normalized: Row = { id: id(candidate.id, `blank-${index + 1}`, 'Blank id'), acceptedAnswers }
      if (has(candidate, 'caseSensitive')) normalized.caseSensitive = caseSensitive
      if (has(candidate, 'pointsPossible')) normalized.pointsPossible = finiteNumber(candidate.pointsPossible, 'Blank points', 0.000001)
      return normalized
    })
    if (new Set(blanks.map((entry) => String(entry.id).toLocaleLowerCase('en'))).size !== blanks.length) throw new AssessmentContractError('Fill-in-the-blank IDs must be unique.')
    return { type: questionType, blanks }
  }
  if (questionType === 'numerical_answer') {
    onlyKeys(source, ['type', 'value', 'tolerance', 'unit', 'requireUnit'], 'Numerical answer')
    const normalized: Row = { type: questionType, value: finiteNumber(source.value, 'Numerical value') }
    if (has(source, 'tolerance')) normalized.tolerance = finiteNumber(source.tolerance, 'Numerical tolerance', 0)
    if (has(source, 'unit')) normalized.unit = text(source.unit, 'Numerical unit', 80)
    if (has(source, 'requireUnit')) normalized.requireUnit = boolean(source.requireUnit, 'Numerical requireUnit')
    if (normalized.requireUnit === true && !normalized.unit) throw new AssessmentContractError('A required numerical unit must be supplied.')
    return normalized
  }
  if (questionType === 'problem_solving') {
    onlyKeys(source, ['type', 'finalAnswer', 'solutionOutline', 'subparts', 'scoringCriteria'], 'Problem-solving answer')
    const finalAnswer = typeof source.finalAnswer === 'number' ? finiteNumber(source.finalAnswer, 'Problem-solving final answer') : text(source.finalAnswer, 'Problem-solving final answer', 800)
    const normalized: Row = { type: questionType, finalAnswer, solutionOutline: text(source.solutionOutline, 'Problem-solving solution outline', 1600) }
    if (has(source, 'subparts')) {
      if (!Array.isArray(source.subparts) || source.subparts.length > 12) throw new AssessmentContractError('Problem-solving subparts must be bounded.')
      normalized.subparts = source.subparts.map((entry, index) => {
        const candidate = object(entry)
        if (!candidate) throw new AssessmentContractError('Problem-solving subpart shape is invalid.')
        onlyKeys(candidate, ['id', 'prompt', 'expectedAnswer', 'pointsPossible', 'scoringCriteria'], 'Problem-solving subpart')
        const part: Row = { id: id(candidate.id, `part-${index + 1}`, 'Subpart id'), prompt: text(candidate.prompt, 'Subpart prompt', 800), pointsPossible: finiteNumber(candidate.pointsPossible, 'Subpart points', 0.000001) }
        if (has(candidate, 'expectedAnswer')) part.expectedAnswer = typeof candidate.expectedAnswer === 'number' ? finiteNumber(candidate.expectedAnswer, 'Subpart expected answer') : text(candidate.expectedAnswer, 'Subpart expected answer', 500)
        if (has(candidate, 'scoringCriteria')) {
          part.scoringCriteria = criterionList(candidate.scoringCriteria, 'Subpart scoring criteria')
          if (Array.isArray(part.scoringCriteria) && part.scoringCriteria.length && Math.abs(part.scoringCriteria.reduce((total, criterion) => total + Number(criterion.pointsPossible), 0) - Number(part.pointsPossible)) > 0.000001) throw new AssessmentContractError('Subpart scoring criteria must equal its immutable subpart points.', 'IMMUTABLE_CONTEXT')
        }
        return part
      })
      if (new Set((normalized.subparts as Row[]).map((entry) => String(entry.id).toLocaleLowerCase('en'))).size !== (normalized.subparts as Row[]).length) throw new AssessmentContractError('Problem subpart IDs must be unique.')
    }
    if (has(source, 'scoringCriteria')) normalized.scoringCriteria = criterionList(source.scoringCriteria, 'Problem-solving scoring criteria')
    return normalized
  }
  if (questionType === 'matching') {
    onlyKeys(source, ['type', 'prompts', 'choices', 'mappings', 'reusableChoices', 'pointsPerMatch', 'groupPointsPossible'], 'Matching answer')
    if (!Array.isArray(source.prompts) || source.prompts.length < 2 || source.prompts.length > 30 || !Array.isArray(source.choices) || source.choices.length < 2 || source.choices.length > 30) throw new AssessmentContractError('Matching prompts and choices are invalid.')
    const prompts = source.prompts.map((entry, index) => {
      const candidate = object(entry); if (!candidate) throw new AssessmentContractError('Matching prompt shape is invalid.')
      onlyKeys(candidate, ['id', 'text'], 'Matching prompt'); return { id: id(candidate.id, `prompt-${index + 1}`, 'Matching prompt id'), text: text(candidate.text, 'Matching prompt text', 800) }
    })
    const choices = source.choices.map((entry, index) => {
      const candidate = object(entry); if (!candidate) throw new AssessmentContractError('Matching choice shape is invalid.')
      onlyKeys(candidate, ['id', 'text', 'label'], 'Matching choice')
      const normalized: Row = { id: id(candidate.id, String.fromCharCode(65 + index), 'Matching choice id'), text: text(candidate.text, 'Matching choice text', 500) }
      if (has(candidate, 'label')) normalized.label = text(candidate.label, 'Matching choice label', 80)
      return normalized
    })
    if (new Set(prompts.map((entry) => String(entry.id).toLocaleLowerCase('en'))).size !== prompts.length || new Set(choices.map((entry) => String(entry.id).toLocaleLowerCase('en'))).size !== choices.length) throw new AssessmentContractError('Matching IDs must be unique.')
    if (!Array.isArray(source.mappings) || source.mappings.length !== prompts.length) throw new AssessmentContractError('Matching mappings must map each prompt exactly once.')
    const mappings = source.mappings.map((entry) => {
      const candidate = object(entry); if (!candidate) throw new AssessmentContractError('Matching mapping shape is invalid.')
      onlyKeys(candidate, ['promptId', 'choiceId', 'pointsPossible'], 'Matching mapping')
      const normalized: Row = { promptId: text(candidate.promptId, 'Matching promptId', 80), choiceId: text(candidate.choiceId, 'Matching choiceId', 80) }
      if (has(candidate, 'pointsPossible')) normalized.pointsPossible = finiteNumber(candidate.pointsPossible, 'Matching mapping points', 0.000001)
      return normalized
    })
    if (mappings.some((entry) => !prompts.some((prompt) => prompt.id === entry.promptId) || !choices.some((choice) => choice.id === entry.choiceId)) || new Set(mappings.map((entry) => entry.promptId)).size !== mappings.length) throw new AssessmentContractError('Matching mappings must reference each prompt and choice.')
    const reusableChoices = source.reusableChoices === undefined ? false : boolean(source.reusableChoices, 'Matching reusableChoices')
    if (!reusableChoices && new Set(mappings.map((entry) => entry.choiceId)).size !== mappings.length) throw new AssessmentContractError('Matching choices cannot be reused unless enabled.')
    const normalized: Row = { type: questionType, prompts, choices, mappings, reusableChoices }
    if (has(source, 'pointsPerMatch')) normalized.pointsPerMatch = finiteNumber(source.pointsPerMatch, 'Matching pointsPerMatch', 0.000001)
    if (has(source, 'groupPointsPossible')) normalized.groupPointsPossible = finiteNumber(source.groupPointsPossible, 'Matching groupPointsPossible', 0.000001)
    return normalized
  }
  if (questionType === 'multiple_select') {
    onlyKeys(source, ['type', 'choices', 'choiceIds', 'scoringPolicy'], 'Multiple-select answer')
    const choices = normalizeChoices(source.choices, 'Multiple-select', 3, 6)
    const choiceIds = stringList(source.choiceIds, 'Multiple-select choiceIds', choices.length, 80, { minItems: 1 })
    if (choiceIds.some((choiceId) => !choices.some((choice) => choice.id === choiceId))) throw new AssessmentContractError('Multiple-select IDs must reference returned choices.')
    const scoringPolicy = source.scoringPolicy === undefined ? 'all_or_nothing' : source.scoringPolicy
    if (scoringPolicy !== 'all_or_nothing') throw new AssessmentContractError('Multiple-select scoring policy is unsupported.')
    return { type: questionType, choices, choiceIds, scoringPolicy }
  }
  if (questionType === 'constructed_response') {
    onlyKeys(source, ['type', 'expectedResponse', 'sampleResponse', 'rubricGuidance', 'expectedElements', 'rubric'], 'Constructed-response answer')
    const normalized: Row = { type: questionType, expectedResponse: text(source.expectedResponse, 'Expected response', 1600), sampleResponse: text(source.sampleResponse, 'Sample response', 1600) }
    if (has(source, 'rubricGuidance')) normalized.rubricGuidance = text(source.rubricGuidance, 'Rubric guidance', 1600)
    if (has(source, 'expectedElements')) normalized.expectedElements = stringList(source.expectedElements, 'Expected elements', 30, 400)
    if (has(source, 'rubric')) normalized.rubric = criterionList(source.rubric, 'Constructed-response rubric')
    return normalized
  }
  onlyKeys(source, ['type', 'keyPoints', 'rubric', 'expectedResponse', 'scoringNotes'], 'Essay answer')
  const normalized: Row = { type: questionType, keyPoints: stringList(source.keyPoints, 'Essay key points', 30, 500, { minItems: 1 }) }
  if (has(source, 'rubric')) normalized.rubric = criterionList(source.rubric, 'Essay rubric')
  if (has(source, 'expectedResponse')) normalized.expectedResponse = text(source.expectedResponse, 'Essay expected response', 1600)
  if (has(source, 'scoringNotes')) normalized.scoringNotes = text(source.scoringNotes, 'Essay scoring notes', 1600)
  return normalized
}

export type ImmutableAssessmentContext = {
  questionType?: QuestionType
  itemNumber?: number
  competencyText?: string
  cognitiveLabel?: string
  pointsPossible?: number
  gradeLevel?: string
  learningArea?: string
}

function checkImmutableContext(source: Row, questionType: QuestionType, context?: ImmutableAssessmentContext) {
  if (!context) return
  if (context.questionType && context.questionType !== questionType) throw new AssessmentContractError('The AI response changed the immutable question type.', 'IMMUTABLE_CONTEXT')
  if (context.itemNumber !== undefined && (!Number.isInteger(context.itemNumber) || context.itemNumber < 1)) throw new AssessmentContractError('The verified item number is invalid.', 'IMMUTABLE_CONTEXT')
  // The candidate protocol intentionally has no mutable copies of mapping or
  // identity fields. If one appears, onlyKeys below rejects it; this check
  // keeps the invariant explicit for callers that provide context.
  const immutableKeys = ['itemNumber', 'competency', 'competencyText', 'competencyCode', 'cognitiveCategory', 'cognitiveLabel', 'pointsPossible', 'gradeLevel', 'learningArea', 'id', 'mapping']
  if (immutableKeys.some((key) => has(source, key))) throw new AssessmentContractError('The AI response attempted to change immutable assessment context.', 'IMMUTABLE_CONTEXT')
}

function assertReconciledPoints(answer: Row, questionType: QuestionType, context?: ImmutableAssessmentContext) {
  const expected = context?.pointsPossible
  if (expected === undefined) return
  if (!Number.isFinite(expected) || expected <= 0) throw new AssessmentContractError('The verified points value is invalid.', 'IMMUTABLE_CONTEXT')
  const close = (actual: number) => Math.abs(actual - expected) <= 0.000001
  const sum = (entries: unknown[], field: string) => entries.reduce<number>((total, entry) => total + (typeof entry === 'object' && entry && typeof (entry as Row)[field] === 'number' ? Number((entry as Row)[field]) : 0), 0)
  const requireSum = (entries: unknown[], field: string, label: string) => {
    if (entries.length && !close(sum(entries, field))) throw new AssessmentContractError(`${label} points must equal the immutable item points.`, 'IMMUTABLE_CONTEXT')
  }
  if (questionType === 'fill_in_the_blank' && Array.isArray(answer.blanks)) {
    const blanks = answer.blanks as unknown[]
    const present = blanks.filter((entry) => entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'pointsPossible'))
    if (present.length && present.length !== blanks.length) throw new AssessmentContractError('All fill-in-the-blank points must be supplied when one is supplied.', 'IMMUTABLE_CONTEXT')
    if (present.length) requireSum(blanks, 'pointsPossible', 'Fill-in-the-blank')
  }
  if (questionType === 'problem_solving') {
    if (Array.isArray(answer.subparts)) requireSum(answer.subparts, 'pointsPossible', 'Problem subpart')
    if (Array.isArray(answer.scoringCriteria)) requireSum(answer.scoringCriteria, 'pointsPossible', 'Problem scoring')
  }
  if (questionType === 'matching') {
    if (typeof answer.groupPointsPossible === 'number' && !close(answer.groupPointsPossible)) throw new AssessmentContractError('Matching group points must equal immutable item points.', 'IMMUTABLE_CONTEXT')
    if (Array.isArray(answer.mappings) && answer.mappings.length) {
      const pointed = answer.mappings.filter((entry) => entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'pointsPossible'))
      if (pointed.length && pointed.length !== answer.mappings.length) throw new AssessmentContractError('Matching mapping points must be supplied for every mapping or none.', 'IMMUTABLE_CONTEXT')
      if (pointed.length) requireSum(answer.mappings, 'pointsPossible', 'Matching')
    }
    if (typeof answer.pointsPerMatch === 'number' && !close(answer.pointsPerMatch * (Array.isArray(answer.prompts) ? answer.prompts.length : 0))) throw new AssessmentContractError('Matching points per match must reconcile with immutable item points.', 'IMMUTABLE_CONTEXT')
  }
  if ((questionType === 'constructed_response' || questionType === 'essay') && Array.isArray(answer.rubric)) requireSum(answer.rubric, 'pointsPossible', 'Rubric')
}

export function validateAssessmentCandidate(
  value: unknown,
  questionType?: QuestionType,
  teacherResources: string[] = [],
  rationaleRequired = true,
  immutableContext?: ImmutableAssessmentContext,
) {
  const source = typeof value === 'string' ? parseJsonObject(value) : object(value)
  if (!source) throw new AssessmentContractError('The AI response did not match the required structured shape.')
  onlyKeys(source, ['questionType', 'prompt', 'answer', 'rationale', 'referencedResources', 'visualRequirement', 'visualIntent', 'visual'], 'The AI response')
  requiredKeys(source, ['questionType', 'prompt', 'answer', 'referencedResources'], 'The AI response')
  const candidateType = source.questionType
  if (typeof candidateType !== 'string' || !QUESTION_TYPES.has(candidateType as QuestionType) || (questionType && candidateType !== questionType)) throw new AssessmentContractError('The AI response question type does not match the verified item mapping.')
  const resolvedType = candidateType as QuestionType
  checkImmutableContext(source, resolvedType, immutableContext)
  let prompt = text(source.prompt, 'Assessment prompt', 2000)
  const rationale = source.rationale === undefined && !rationaleRequired ? '' : text(source.rationale, 'Assessment rationale', 1600, rationaleRequired)
  const references = stringList(source.referencedResources, 'Referenced resources', 10, 180, { unique: true })
  if (!references.every((entry) => teacherResources.includes(entry))) throw new AssessmentContractError('The AI response referenced an unlisted teacher resource.', 'RESOURCE_INVALID')
  const legacyVisualPresent = source.visual !== undefined && source.visual !== null
  const hasExplicitVisualRequirement = source.visualRequirement !== undefined
  const visualRequirement = hasExplicitVisualRequirement
    ? text(source.visualRequirement, 'Visual requirement', 20)
    // Pre-split generators could return a diagram without planning metadata.
    // Treat that historical visual as helpful rather than forcing a second
    // provider call. If the prompt truly depends on it and the visual is later
    // dropped as invalid, deterministic final QA will surface the missing figure.
    : (legacyVisualPresent ? 'helpful' : 'none')
  if (!['none', 'helpful', 'required'].includes(visualRequirement)) throw new AssessmentContractError('Visual requirement must be none, helpful, or required.', 'VISUAL_INVALID')
  const visualIntent = source.visualIntent === undefined
    ? (legacyVisualPresent ? 'Use the attached validated visual for this question.' : '')
    : text(source.visualIntent, 'Visual intent', 500, false)
  if (hasExplicitVisualRequirement && visualRequirement !== 'none' && !visualIntent) throw new AssessmentContractError('Helpful or required visuals need a concise visual intent.', 'VISUAL_INVALID')
  const rawVisual = source.visual === null || source.visual === undefined ? null : source.visual
  const visualResult = validateAssessmentVisual(rawVisual)
  // A malformed optional diagram must not waste an otherwise valid assessment
  // item. Drop only the visual and let deterministic browser QA flag a prompt
  // that still depends on a missing figure. This keeps batch generation moving
  // while preventing unsafe/invalid primitives from reaching any renderer.
  const safeRawVisual = visualResult.valid ? rawVisual : null
  const answer = normalizeAnswer(source.answer, resolvedType)
  assertReconciledPoints(answer, resolvedType, immutableContext)
  const answerTerms = directAnswerTerms(answer, resolvedType)
  // Models sometimes place the correct fill/identification answer inside a
  // parenthetical example. Remove that redundant hint deterministically, then
  // reject any remaining direct answer leak rather than showing it to learners.
  if (answerTerms.length && (resolvedType === 'fill_in_the_blank' || resolvedType === 'short_answer' || resolvedType === 'identification')) {
    prompt = stripAnswerLeakingParentheticals(prompt, answerTerms)
    if (containsAnswerTerm(prompt, answerTerms)) throw new AssessmentContractError('The AI response prompt revealed an accepted answer.', 'SEMANTIC_INVALID')
  }
  // A model-generated diagram is learner-facing just like the stem. Apply the
  // same brace-aware answer-label check to every supported concise answer type
  // at the Edge boundary and final client QA. Coordinates are never extracted
  // as labels; numerical units alone are not treated as final-answer terms.
  if (answerTerms.length && safeRawVisual !== null && visualTextRevealsAnswer(safeRawVisual, answerTerms)) {
    throw new AssessmentContractError('The AI response visual revealed an accepted answer in a text label.', 'VISUAL_INVALID')
  }
  const visual = safeRawVisual === null ? null : { ...(safeRawVisual as Row), altText: neutralVisualAltText(safeRawVisual) }
  if (resolvedType === 'fill_in_the_blank') {
    const markerCount = (prompt.match(/(?:_{3,}|…{3,}|\[\s*blank(?:[- ]?\d+)?\s*\])/giu) ?? []).length
    const blankCount = Array.isArray(answer.blanks) ? answer.blanks.length : 0
    if (markerCount !== blankCount) throw new AssessmentContractError('The fill-in-the-blank prompt markers must match its answer blanks.')
  }
  const piiPattern = /(?:\bLRN\b\s*[:#-]?\s*\d{6,}|\b(?:phone|mobile|contact|telephone)\b\D{0,16}\d{7,13}|(?:\+63|09)\d{9}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/iu
  if ([prompt, rationale, ...answerStrings(answer)].some((entry) => piiPattern.test(entry))) throw new AssessmentContractError('The AI response included learner personal information.', 'SEMANTIC_INVALID')
  if ([prompt, rationale, ...answerStrings(answer)].some((entry) => unverifiedResource(entry, teacherResources))) throw new AssessmentContractError('The AI response included an unverified resource, local fact, URL, page, device, or learner detail.', 'RESOURCE_INVALID')
  return { questionType: resolvedType, prompt, answer, rationale, referencedResources: references, visualRequirement, visualIntent, visual }
}

function parseJsonObject(value: string): Row {
  const stripped = value.trim().replace(/^```json\s*/iu, '').replace(/^```\s*/u, '').replace(/\s*```$/u, '').trim()
  try {
    const parsed = JSON.parse(stripped) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
    return parsed as Row
  } catch {
    throw new AssessmentContractError('The AI response was not valid JSON. Your draft remains unchanged.', 'MALFORMED_JSON')
  }
}
