import type {
  AssessmentAnswer,
  AssessmentAuthorshipState,
  AssessmentBlueprint,
  AssessmentItem,
  AssessmentItemMapping,
  AssessmentTosSnapshot,
  AssessmentValidationIssue,
  AssessmentValidationResult,
  QuestionType,
  AssessmentScoringCriterion,
} from '../types/assessment'

function normalizeItemPoints(item: Partial<AssessmentItem>) {
  const raw: unknown = item.pointsPossible ?? item.points
  if (raw === null || raw === undefined || raw === '') return 1
  const value = Number(raw)
  return Number.isFinite(value) ? value : Number.NaN
}

function deriveAssessmentTotalPoints(items: readonly Partial<AssessmentItem>[]) {
  return Math.round(items.reduce((sum, item) => {
    const points = normalizeItemPoints(item)
    return sum + (Number.isFinite(points) && points > 0 ? points : 0)
  }, 0) * 100) / 100
}

// Keep this module usable by the project's lightweight data-URL validator
// harness, which intentionally erases type-only imports without resolving
// runtime modules.
const QUESTION_TYPES: QuestionType[] = [
  'multiple_choice', 'true_false', 'short_answer', 'constructed_response',
  'identification', 'fill_in_the_blank', 'numerical_answer',
  'problem_solving', 'matching', 'multiple_select', 'essay',
]
const AUTHORSHIP_STATES: AssessmentAuthorshipState[] = ['empty', 'ai_suggestion', 'teacher_accepted', 'teacher_edited', 'manual']
const QA_STATES = ['empty', 'generated', 'verified', 'needs_review', 'teacher_edited', 'answer_needs_recheck', 'locked', 'repair_needed'] as const

/** Central registry keeps question-type validation extensible as new structured unions are added. */
export const SUPPORTED_ASSESSMENT_QUESTION_TYPES = [...QUESTION_TYPES] as const
export function isSupportedAssessmentQuestionType(value: unknown): value is QuestionType {
  return typeof value === 'string' && QUESTION_TYPES.includes(value as QuestionType)
}

function issue(
  key: string,
  message: string,
  item: AssessmentItem | undefined,
  severity: 'error' | 'warning',
): AssessmentValidationIssue {
  return { key, message, severity, itemId: item?.id, itemNumber: item?.itemNumber }
}

function same(valueA: unknown, valueB: unknown) {
  return JSON.stringify(valueA) === JSON.stringify(valueB)
}

function expectedMappings(source: AssessmentTosSnapshot) {
  const result = new Map<number, { mapping: AssessmentItemMapping; competency: AssessmentItem['competencySnapshot']; category: AssessmentItem['cognitiveCategorySnapshot'] }>()
  const content = source.content
  const rows = [...content.rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, 'en'))
  rows.forEach((row) => {
    const allocations = [...row.cognitiveAllocations].sort((a, b) => (a.itemStart ?? Number.MAX_SAFE_INTEGER) - (b.itemStart ?? Number.MAX_SAFE_INTEGER) || a.categoryId.localeCompare(b.categoryId, 'en'))
    allocations.forEach((allocation) => {
      if (!allocation.itemCount || allocation.itemStart === null || allocation.itemEnd === null) return
      const category = content.cognitiveCategories.find((candidate) => candidate.id === allocation.categoryId) ?? {
        id: allocation.categoryId,
        label: allocation.label,
        shortLabel: allocation.shortLabel,
      }
      const competency = {
        id: row.competency.id,
        code: row.competency.code,
        text: row.competency.text,
        sourcePage: row.competency.sourcePage,
        academicPeriodId: row.competency.academicPeriodId,
        curriculumPeriodId: row.competency.academicPeriodId,
        curriculumPeriodLabel: row.competency.curriculumPeriodLabel,
      }
      for (let itemNumber = allocation.itemStart; itemNumber <= allocation.itemEnd; itemNumber += 1) {
        result.set(itemNumber, {
          mapping: {
            rowId: row.id,
            competencyId: row.competency.id,
            cognitiveCategoryId: category.id,
            allocationItemStart: allocation.itemStart,
            allocationItemEnd: allocation.itemEnd,
            allocationIndex: itemNumber - allocation.itemStart,
          },
          competency,
          category: { id: category.id, label: category.label, shortLabel: category.shortLabel },
        })
      }
    })
  })
  return result
}

function sourcePlacementStatus(source: AssessmentTosSnapshot) {
  const numbers = new Set<number>()
  let duplicate = false
  source.content.rows.forEach((row) => row.cognitiveAllocations.forEach((allocation) => {
    if (!allocation.itemCount || allocation.itemStart === null || allocation.itemEnd === null) return
    for (let itemNumber = allocation.itemStart; itemNumber <= allocation.itemEnd; itemNumber += 1) {
      if (numbers.has(itemNumber)) duplicate = true
      numbers.add(itemNumber)
    }
  }))
  return { numbers, duplicate }
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : ''
}

/**
 * Keep assessmentValidation self-contained for the project's data-URL
 * validator harness (which loads this module without resolving runtime
 * imports).  The dedicated assessmentVisualValidation module is the public,
 * detailed validator; this boundary check mirrors its safety contract so a
 * malformed visual can never pass assessment finalization.
 */
function assessmentVisualErrors(value: unknown): string[] {
  const errors: string[] = []
  const root = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  if (!root) return ['Visual must be an object.']
  const rootKeys = new Set(['id', 'kind', 'version', 'width', 'height', 'altText', 'primitives'])
  Object.keys(root).filter((key) => !rootKeys.has(key)).forEach((key) => errors.push(`Visual property ${key} is not supported.`))
  // Keep numeric fields strict at finalization too; coercing JSON strings here
  // would make the final validator disagree with the client/Edge renderers.
  const width = typeof root.width === 'number' ? root.width : Number.NaN
  const height = typeof root.height === 'number' ? root.height : Number.NaN
  const visualId = typeof root.id === 'string' ? root.id.normalize('NFKC').trim() : ''
  if (!visualId || visualId.length > 80 || /[<>]/u.test(visualId)) errors.push('Visual id must be bounded plain text.')
  if (root.kind !== 'geometry') errors.push("Visual kind must be 'geometry'.")
  if (root.version !== 1) errors.push('Visual version must be 1.')
  if (!Number.isFinite(width) || width < 64 || width > 1600 || !Number.isFinite(height) || height < 64 || height > 1200) errors.push('Visual dimensions must be finite and within the safe canvas bounds.')
  const alt = typeof root.altText === 'string' ? root.altText.normalize('NFKC').trim() : ''
  if (!alt || alt.length > 240 || /[<>]/u.test(alt) || /^(image|diagram)$/iu.test(alt)) errors.push('Visual alt text must be useful bounded plain text (not a generic image label).')
  if (!Array.isArray(root.primitives) || root.primitives.length < 1 || root.primitives.length > 80) errors.push('Visual primitives must contain between 1 and 80 supported primitives.')
  const types = new Set(['point', 'segment', 'polygon', 'circle', 'arc', 'angleArc', 'textLabel', 'tickMark', 'equalSideMark', 'parallelMark', 'perpendicularMark', 'arrow', 'dashedSegment', 'cartesianAxes', 'cartesianPlot'])
  const colors = new Set(['ink', 'blue', 'red', 'green', 'gold', 'purple', 'gray'])
  const primitiveKeys: Record<string, string[]> = {
    point: ['type', 'x', 'y', 'radius', 'color', 'strokeWidth'],
    segment: ['type', 'x1', 'y1', 'x2', 'y2', 'color', 'strokeWidth'],
    dashedSegment: ['type', 'x1', 'y1', 'x2', 'y2', 'color', 'strokeWidth'],
    arrow: ['type', 'x1', 'y1', 'x2', 'y2', 'color', 'strokeWidth'],
    polygon: ['type', 'points', 'color', 'fill', 'strokeWidth'],
    circle: ['type', 'cx', 'cy', 'radius', 'color', 'fill', 'strokeWidth'],
    arc: ['type', 'cx', 'cy', 'radius', 'startAngle', 'endAngle', 'color', 'strokeWidth'],
    angleArc: ['type', 'vertex', 'radius', 'startAngle', 'endAngle', 'color', 'strokeWidth'],
    textLabel: ['type', 'x', 'y', 'text', 'color', 'textSize', 'anchor'],
    tickMark: ['type', 'x1', 'y1', 'x2', 'y2', 'count', 'color', 'strokeWidth'],
    equalSideMark: ['type', 'x1', 'y1', 'x2', 'y2', 'count', 'color', 'strokeWidth'],
    parallelMark: ['type', 'x1', 'y1', 'x2', 'y2', 'count', 'color', 'strokeWidth'],
    perpendicularMark: ['type', 'x', 'y', 'angle', 'size', 'color', 'strokeWidth'],
    cartesianAxes: ['type', 'axisId', 'x', 'y', 'width', 'height', 'xMin', 'xMax', 'yMin', 'yMax', 'xTick', 'yTick', 'showGrid', 'xLabel', 'yLabel', 'color', 'strokeWidth'],
    cartesianPlot: ['type', 'axisId', 'points', 'showPoints', 'dashed', 'color', 'strokeWidth'],
  }
  const finiteInside = (number: unknown, limit: number) => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= limit
  const checkColor = (entry: Record<string, unknown>) => { if (entry.color !== undefined && !colors.has(String(entry.color))) errors.push('Visual elements must use the fixed colour palette.'); if (entry.fill !== undefined && !colors.has(String(entry.fill))) errors.push('Visual fills must use the fixed colour palette.') }
  const checkLine = (entry: Record<string, unknown>) => { if (!finiteInside(entry.x1, width) || !finiteInside(entry.y1, height) || !finiteInside(entry.x2, width) || !finiteInside(entry.y2, height)) errors.push('Visual line coordinates must be finite and inside the canvas.'); if (entry.x1 === entry.x2 && entry.y1 === entry.y2) errors.push('Visual line elements must have distinct endpoints.') }
  if (Array.isArray(root.primitives)) root.primitives.forEach((raw, index) => {
    const entry = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
    if (!entry) { errors.push(`Visual element ${index + 1} must be an object.`); return }
    const type = String(entry.type)
    if (!types.has(type)) { errors.push(`Visual element ${index + 1} type is unsupported.`); return }
    Object.keys(entry).filter((key) => !primitiveKeys[type].includes(key)).forEach((key) => errors.push(`Visual primitive property ${key} is not supported.`))
    checkColor(entry)
    if (entry.strokeWidth !== undefined && !(typeof entry.strokeWidth === 'number' && Number.isInteger(entry.strokeWidth) && [1, 2, 3].includes(entry.strokeWidth))) errors.push('Visual stroke widths must be the number 1, 2, or 3.')
    if (['segment', 'dashedSegment', 'arrow', 'tickMark', 'equalSideMark', 'parallelMark'].includes(type)) checkLine(entry)
    else if (type === 'point') { if (!finiteInside(entry.x, width) || !finiteInside(entry.y, height)) errors.push('Visual point coordinates must be finite and inside the canvas.'); if (entry.radius !== undefined && !(typeof entry.radius === 'number' && Number.isFinite(entry.radius) && entry.radius >= 0.5 && entry.radius <= 40)) errors.push('Visual point radius is outside the safe range.') }
    else if (type === 'polygon') { if (!Array.isArray(entry.points) || entry.points.length < 3 || entry.points.length > 12) errors.push('Visual polygons must contain 3–12 vertices.'); if (Array.isArray(entry.points)) entry.points.forEach((point) => { const candidate = point && typeof point === 'object' && !Array.isArray(point) ? point as Record<string, unknown> : {}; if (!finiteInside(candidate.x, width) || !finiteInside(candidate.y, height)) errors.push('Visual polygon coordinates must be finite and inside the canvas.') }) }
    else if (type === 'circle' || type === 'arc') { const cx = entry.cx as number; const cy = entry.cy as number; const radius = entry.radius as number; if (!finiteInside(cx, width) || !finiteInside(cy, height) || typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0.5 || radius > 800 || cx - radius < 0 || cx + radius > width || cy - radius < 0 || cy + radius > height) errors.push('Visual circle/arc geometry must be finite and fit inside the canvas.'); if (type === 'arc' && (typeof entry.startAngle !== 'number' || typeof entry.endAngle !== 'number' || !Number.isFinite(entry.startAngle) || !Number.isFinite(entry.endAngle) || Math.abs(entry.startAngle) > 720 || Math.abs(entry.endAngle) > 720 || Math.abs(entry.endAngle - entry.startAngle) <= 0 || Math.abs(entry.endAngle - entry.startAngle) > 360)) errors.push('Visual arc angles must define a bounded nonzero span.') }
    else if (type === 'angleArc') { const vertex = entry.vertex && typeof entry.vertex === 'object' && !Array.isArray(entry.vertex) ? entry.vertex as Record<string, unknown> : {}; const radius = entry.radius as number; if (!finiteInside(vertex.x, width) || !finiteInside(vertex.y, height) || typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0.5 || radius > 800 || Number(vertex.x) - radius < 0 || Number(vertex.x) + radius > width || Number(vertex.y) - radius < 0 || Number(vertex.y) + radius > height) errors.push('Visual angle arc geometry must be finite and fit inside the canvas.'); if (typeof entry.startAngle !== 'number' || typeof entry.endAngle !== 'number' || !Number.isFinite(entry.startAngle) || !Number.isFinite(entry.endAngle) || Math.abs(entry.startAngle) > 720 || Math.abs(entry.endAngle) > 720 || Math.abs(entry.endAngle - entry.startAngle) <= 0 || Math.abs(entry.endAngle - entry.startAngle) > 360) errors.push('Visual angle arc angles must define a bounded nonzero span.') }
    else if (type === 'textLabel') { const label = typeof entry.text === 'string' ? entry.text.normalize('NFKC').trim() : ''; if (!finiteInside(entry.x, width) || !finiteInside(entry.y, height) || !label || label.length > 80 || /[<>]/u.test(label)) errors.push('Visual labels must use bounded plain text and in-canvas coordinates.'); if (entry.textSize !== undefined && !['small', 'medium', 'large'].includes(String(entry.textSize))) errors.push('Visual textSize is unsupported.'); if (entry.anchor !== undefined && !['start', 'middle', 'end'].includes(String(entry.anchor))) errors.push('Visual text anchor is unsupported.') }
    else if (type === 'perpendicularMark') { if (!finiteInside(entry.x, width) || !finiteInside(entry.y, height) || typeof entry.angle !== 'number' || !Number.isFinite(entry.angle) || (typeof entry.angle === 'number' && Math.abs(entry.angle) > 720) || typeof entry.size !== 'number' || !Number.isFinite(entry.size) || entry.size < 2 || entry.size > 80) errors.push('Visual perpendicular marks must use bounded coordinates and dimensions.'); if (typeof entry.x === 'number' && typeof entry.y === 'number' && typeof entry.angle === 'number' && typeof entry.size === 'number') { const radians = entry.angle * Math.PI / 180; const ux = Math.cos(radians); const uy = Math.sin(radians); const px = -uy; const py = ux; const corners = [{ x: entry.x, y: entry.y }, { x: entry.x + ux * entry.size, y: entry.y + uy * entry.size }, { x: entry.x + (ux + px) * entry.size, y: entry.y + (uy + py) * entry.size }, { x: entry.x + px * entry.size, y: entry.y + py * entry.size }]; if (corners.some((corner) => !finiteInside(corner.x, width) || !finiteInside(corner.y, height))) errors.push('Visual perpendicular marks must fit inside the canvas.') } }
    else if (type === 'cartesianAxes') {
      const numeric = (value: unknown, min = -10000, max = 10000) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
      const axisId = typeof entry.axisId === 'string' ? entry.axisId.normalize('NFKC').trim() : ''
      if (!axisId || axisId.length > 80 || /[<>]/u.test(axisId)) errors.push('Cartesian axis IDs must be bounded plain text.')
      if (!finiteInside(entry.x, width) || !finiteInside(entry.y, height) || !numeric(entry.width, 80, width) || !numeric(entry.height, 80, height) || Number(entry.x) + Number(entry.width) > width || Number(entry.y) + Number(entry.height) > height) errors.push('Cartesian plot rectangles must fit inside the visual canvas.')
      if (![entry.xMin, entry.xMax, entry.yMin, entry.yMax].every((value) => numeric(value))) errors.push('Cartesian mathematical bounds must be finite and bounded.')
      if (typeof entry.xMin === 'number' && typeof entry.xMax === 'number' && !(entry.xMin < 0 && entry.xMax > 0 && entry.xMin < entry.xMax)) errors.push('Cartesian x bounds must straddle zero and increase.')
      if (typeof entry.yMin === 'number' && typeof entry.yMax === 'number' && !(entry.yMin < 0 && entry.yMax > 0 && entry.yMin < entry.yMax)) errors.push('Cartesian y bounds must straddle zero and increase.')
      if (entry.xTick !== undefined && !numeric(entry.xTick, 0.000001, 10000)) errors.push('Cartesian x tick spacing must be positive.')
      if (entry.yTick !== undefined && !numeric(entry.yTick, 0.000001, 10000)) errors.push('Cartesian y tick spacing must be positive.')
      if (entry.showGrid !== undefined && typeof entry.showGrid !== 'boolean') errors.push('Cartesian showGrid must be boolean.')
      for (const label of [entry.xLabel, entry.yLabel]) if (label !== undefined && (typeof label !== 'string' || !label.normalize('NFKC').trim() || label.length > 40 || /[<>]/u.test(label))) errors.push('Cartesian axis labels must be bounded plain text.')
    }
    else if (type === 'cartesianPlot') {
      const axisId = typeof entry.axisId === 'string' ? entry.axisId.normalize('NFKC').trim() : ''
      if (!axisId || axisId.length > 80 || /[<>]/u.test(axisId)) errors.push('Cartesian plots need a valid axis ID.')
      if (!Array.isArray(entry.points) || entry.points.length < 2 || entry.points.length > 160) errors.push('Cartesian plots must contain 2–160 sampled points.')
      if (Array.isArray(entry.points)) entry.points.forEach((point) => { const candidate = point && typeof point === 'object' && !Array.isArray(point) ? point as Record<string, unknown> : {}; if (Object.keys(candidate).some((key) => !['x', 'y'].includes(key)) || typeof candidate.x !== 'number' || !Number.isFinite(candidate.x) || Math.abs(candidate.x) > 10000 || typeof candidate.y !== 'number' || !Number.isFinite(candidate.y) || Math.abs(candidate.y) > 10000) errors.push('Cartesian sampled points must use finite bounded x/y coordinates only.') })
      if (entry.showPoints !== undefined && typeof entry.showPoints !== 'boolean') errors.push('Cartesian showPoints must be boolean.')
      if (entry.dashed !== undefined && typeof entry.dashed !== 'boolean') errors.push('Cartesian dashed must be boolean.')
    }
    if (['tickMark', 'equalSideMark', 'parallelMark'].includes(type) && entry.count !== undefined && !(typeof entry.count === 'number' && Number.isInteger(entry.count) && [1, 2, 3].includes(entry.count))) errors.push('Visual mark counts must be the number 1, 2, or 3.')
  })
  if (Array.isArray(root.primitives)) {
    const axes = new Map<string, Record<string, unknown>>()
    root.primitives.forEach((raw, index) => {
      const entry = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
      if (!entry || entry.type !== 'cartesianAxes' || typeof entry.axisId !== 'string') return
      const key = entry.axisId.normalize('NFKC').trim()
      if (axes.has(key)) errors.push(`Cartesian axis ID at element ${index + 1} must be unique.`)
      else axes.set(key, entry)
    })
    root.primitives.forEach((raw, index) => {
      const entry = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
      if (!entry || entry.type !== 'cartesianPlot' || typeof entry.axisId !== 'string') return
      const axis = axes.get(entry.axisId.normalize('NFKC').trim())
      if (!axis) { errors.push(`Cartesian plot at element ${index + 1} must reference existing axes.`); return }
      if (!Array.isArray(entry.points) || typeof axis.xMin !== 'number' || typeof axis.xMax !== 'number' || typeof axis.yMin !== 'number' || typeof axis.yMax !== 'number') return
      const xMin = axis.xMin; const xMax = axis.xMax; const yMin = axis.yMin; const yMax = axis.yMax
      if (entry.points.some((rawPoint) => { const point = rawPoint && typeof rawPoint === 'object' && !Array.isArray(rawPoint) ? rawPoint as Record<string, unknown> : {}; return typeof point.x === 'number' && typeof point.y === 'number' && (point.x < xMin || point.x > xMax || point.y < yMin || point.y > yMax) })) errors.push(`Cartesian plot at element ${index + 1} must stay inside the referenced bounds.`)
    })
  }
  return errors
}

function acceptedAnswersError(accepted: unknown, caseSensitive: unknown, label: string) {
  const errors: string[] = []
  if (!Array.isArray(accepted) || accepted.length < 1) errors.push(`${label} questions require at least one accepted answer.`)
  const values = (Array.isArray(accepted) ? accepted : []).map((value: unknown) => cleanText(value))
  if (values.some((value: string) => !value)) errors.push(`${label} accepted answers must be nonblank.`)
  if (caseSensitive !== undefined && typeof caseSensitive !== 'boolean') errors.push(`${label} case sensitivity must be boolean when provided.`)
  const unique = new Set(values.map((value: string) => caseSensitive === true ? value : value.toLocaleLowerCase('en')))
  if (unique.size !== values.length) errors.push(`${label} accepted answers must be unique.`)
  return errors
}

function criteriaErrors(criteria: unknown, expectedTotal: number, label: string) {
  const errors: string[] = []
  if (criteria === undefined) return errors
  if (!Array.isArray(criteria)) return [`${label} rubric criteria must be an array.`]
  const ids = new Set<string>()
  let total = 0
  for (const criterion of criteria as unknown[]) {
    const value = criterion && typeof criterion === 'object' ? criterion as Partial<AssessmentScoringCriterion> : {}
    const id = cleanText(value.id)
    const criterionLabel = cleanText(value.label)
    const points = Number(value.pointsPossible)
    if (!id || ids.has(id)) errors.push(`${label} rubric criterion IDs must be unique and nonblank.`)
    if (!criterionLabel) errors.push(`${label} rubric criterion labels must be nonblank.`)
    if (!Number.isFinite(points) || points <= 0) errors.push(`${label} rubric criterion points must be positive.`)
    ids.add(id)
    if (Number.isFinite(points)) total += points
  }
  if (Number.isFinite(expectedTotal) && Math.abs(total - expectedTotal) > 0.000001) errors.push(`${label} rubric points must total ${expectedTotal}.`)
  return errors
}

function answerError(answer: AssessmentAnswer | undefined, questionType: QuestionType, item: AssessmentItem) {
  const errors: string[] = []
  if (!answer || answer.type !== questionType) return [`The structured answer must match ${questionType}.`]
  if (answer.type === 'multiple_choice') {
    const choices = Array.isArray(answer.choices) ? answer.choices : []
    // 2–6 choices is a product safety range/good practice for this exporter,
    // not a claim about a nationwide DepEd requirement.
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 6) errors.push('Multiple-choice questions require 2–6 choices.')
    const choiceIds = new Set<string>()
    const choiceTexts = new Set<string>()
    for (const choice of choices ?? []) {
      const id = typeof choice?.id === 'string' ? choice.id.trim() : ''
      const text = typeof choice?.text === 'string' ? choice.text.trim() : ''
      if (!id || !text) errors.push('Every multiple-choice option needs a nonblank ID and text.')
      if (choiceIds.has(id)) errors.push('Multiple-choice option IDs must be unique.')
      if (choiceTexts.has(text.toLocaleLowerCase('en'))) errors.push('Multiple-choice option text must be unique without case differences.')
      choiceIds.add(id); choiceTexts.add(text.toLocaleLowerCase('en'))
    }
    const correct = typeof answer.choiceId === 'string' ? answer.choiceId.trim() : ''
    if (!correct || !choiceIds.has(correct)) errors.push('The correct multiple-choice option must reference an existing choice ID.')
  } else if (answer.type === 'true_false') {
    if (typeof answer.value !== 'boolean') errors.push('A true/false answer must be a boolean.')
  } else if (answer.type === 'short_answer' || answer.type === 'identification') {
    errors.push(...acceptedAnswersError(answer.acceptedAnswers, answer.caseSensitive, answer.type === 'short_answer' ? 'Short-answer' : 'Identification'))
  } else if (answer.type === 'fill_in_the_blank') {
    const blanks = Array.isArray(answer.blanks) ? answer.blanks : []
    if (!Array.isArray(answer.blanks) || blanks.length < 1) errors.push('Fill-in-the-blank questions require at least one blank.')
    const ids = new Set<string>()
    let explicitTotal = 0
    let hasExplicitPoints = false
    let explicitPointCount = 0
    for (const blank of blanks) {
      const id = cleanText(blank?.id)
      if (!id || ids.has(id)) errors.push('Fill-in-the-blank IDs must be unique and nonblank.')
      ids.add(id)
      errors.push(...acceptedAnswersError(blank?.acceptedAnswers, blank?.caseSensitive, 'Fill-in-the-blank'))
      if (blank?.pointsPossible !== undefined) {
        hasExplicitPoints = true
        explicitPointCount += 1
        const points = Number(blank.pointsPossible)
        if (!Number.isFinite(points) || points <= 0) errors.push('Fill-in-the-blank blank points must be positive.')
        else explicitTotal += points
      }
    }
    if (hasExplicitPoints && explicitPointCount !== blanks.length) errors.push('Fill-in-the-blank points must be provided for every blank or omitted for every blank.')
    if (hasExplicitPoints && Math.abs(explicitTotal - normalizeItemPoints(item)) > 0.000001) errors.push(`Fill-in-the-blank blank points must total ${normalizeItemPoints(item)}.`)
  } else if (answer.type === 'numerical_answer') {
    if (!Number.isFinite(answer.value)) errors.push('Numerical answers require a finite expected number.')
    if (answer.tolerance !== undefined && (!Number.isFinite(answer.tolerance) || answer.tolerance < 0)) errors.push('Numerical tolerance must be zero or greater.')
    if (answer.unit !== undefined && typeof answer.unit !== 'string') errors.push('Numerical units must be text when provided.')
    if (answer.requireUnit !== undefined && typeof answer.requireUnit !== 'boolean') errors.push('Numerical requireUnit must be boolean when provided.')
    if (answer.requireUnit && !cleanText(answer.unit)) errors.push('A required numerical unit cannot be blank.')
  } else if (answer.type === 'problem_solving') {
    if ((typeof answer.finalAnswer !== 'string' && typeof answer.finalAnswer !== 'number') || (typeof answer.finalAnswer === 'string' && !cleanText(answer.finalAnswer))) errors.push('Problem-solving questions require a final answer.')
    if (!cleanText(answer.solutionOutline)) errors.push('Problem-solving questions require a solution outline.')
    if (answer.subparts !== undefined) {
      const subparts = Array.isArray(answer.subparts) ? answer.subparts : []
      if (!Array.isArray(answer.subparts)) errors.push('Problem-solving subparts must be an array.')
      const ids = new Set<string>()
      let total = 0
      for (const subpart of subparts) {
        const id = cleanText(subpart?.id)
        const points = Number(subpart?.pointsPossible)
        if (!id || ids.has(id)) errors.push('Problem-solving subpart IDs must be unique and nonblank.')
        if (!cleanText(subpart?.prompt)) errors.push('Problem-solving subparts require a prompt.')
        if (!Number.isFinite(points) || points <= 0) errors.push('Problem-solving subpart points must be positive.')
        ids.add(id); if (Number.isFinite(points)) total += points
        errors.push(...criteriaErrors(subpart?.scoringCriteria, points, 'Problem-solving subpart'))
      }
      if (subparts.length && Math.abs(total - normalizeItemPoints(item)) > 0.000001) errors.push(`Problem-solving subpart points must total ${normalizeItemPoints(item)}.`)
    }
    errors.push(...criteriaErrors(answer.scoringCriteria, normalizeItemPoints(item), 'Problem-solving'))
  } else if (answer.type === 'matching') {
    const prompts = Array.isArray(answer.prompts) ? answer.prompts : []
    const choices = Array.isArray(answer.choices) ? answer.choices : []
    const mappings = Array.isArray(answer.mappings) ? answer.mappings : []
    if (!Array.isArray(answer.prompts) || prompts.length < 1) errors.push('Matching questions require Column A prompts.')
    if (!Array.isArray(answer.choices) || choices.length < prompts.length) errors.push('Matching questions require enough Column B choices.')
    const promptIds = new Set<string>(); const choiceIds = new Set<string>(); const choiceTexts = new Set<string>()
    for (const prompt of prompts) {
      const id = cleanText(prompt?.id)
      if (!id || promptIds.has(id) || !cleanText(prompt?.text)) errors.push('Matching prompt IDs and text must be unique and nonblank.')
      promptIds.add(id)
    }
    for (const choice of choices) {
      const id = cleanText(choice?.id); const text = cleanText(choice?.text)
      if (!id || choiceIds.has(id) || !text || choiceTexts.has(text.toLocaleLowerCase('en'))) errors.push('Matching choice IDs and text must be unique and nonblank.')
      choiceIds.add(id); choiceTexts.add(text.toLocaleLowerCase('en'))
    }
    if (!Array.isArray(answer.mappings) || mappings.length !== prompts.length) errors.push('Matching mappings must contain exactly one response for every Column A prompt.')
    const mappedPrompts = new Set<string>(); const mappedChoices = new Set<string>(); let explicitTotal = 0; let hasExplicitPoints = false; let explicitPointCount = 0
    for (const mapping of mappings) {
      const promptId = cleanText(mapping?.promptId); const choiceId = cleanText(mapping?.choiceId)
      if (!promptIds.has(promptId) || !choiceIds.has(choiceId) || mappedPrompts.has(promptId)) errors.push('Matching mappings must reference each valid prompt exactly once.')
      if (!answer.reusableChoices && mappedChoices.has(choiceId)) errors.push('Matching choices cannot be reused unless reusableChoices is enabled.')
      mappedPrompts.add(promptId); mappedChoices.add(choiceId)
      if (mapping?.pointsPossible !== undefined) { hasExplicitPoints = true; explicitPointCount += 1; const points = Number(mapping.pointsPossible); if (!Number.isFinite(points) || points <= 0) errors.push('Matching points must be positive.'); else explicitTotal += points }
    }
    if (answer.reusableChoices !== undefined && typeof answer.reusableChoices !== 'boolean') errors.push('Matching reusableChoices must be boolean.')
    if (answer.pointsPerMatch !== undefined && (!Number.isFinite(answer.pointsPerMatch) || answer.pointsPerMatch <= 0)) errors.push('Matching pointsPerMatch must be positive.')
    if (answer.groupPointsPossible !== undefined && (!Number.isFinite(answer.groupPointsPossible) || answer.groupPointsPossible <= 0)) errors.push('Matching group points must be positive.')
    if (hasExplicitPoints && explicitPointCount !== mappings.length) errors.push('Matching points must be provided for every scored match or omitted for every match.')
    if (hasExplicitPoints && Math.abs(explicitTotal - normalizeItemPoints(item)) > 0.000001) errors.push(`Matching response points must total ${normalizeItemPoints(item)}.`)
    if (answer.pointsPerMatch !== undefined && Number.isFinite(answer.pointsPerMatch) && answer.pointsPerMatch > 0 && Math.abs(answer.pointsPerMatch * mappings.length - normalizeItemPoints(item)) > 0.000001) errors.push(`Matching pointsPerMatch must total ${normalizeItemPoints(item)} across all responses.`)
    if (answer.groupPointsPossible !== undefined && Math.abs(answer.groupPointsPossible - normalizeItemPoints(item)) > 0.000001) errors.push(`Matching group points must equal ${normalizeItemPoints(item)}.`)
  } else if (answer.type === 'multiple_select') {
    const ids = new Set<string>(); const texts = new Set<string>()
    if (!Array.isArray(answer.choices) || answer.choices.length < 2) errors.push('Multiple-select questions require at least two choices.')
    for (const choice of answer.choices ?? []) {
      const id = cleanText(choice?.id); const text = cleanText(choice?.text)
      if (!id || ids.has(id) || !text || texts.has(text.toLocaleLowerCase('en'))) errors.push('Multiple-select choice IDs and text must be unique and nonblank.')
      ids.add(id); texts.add(text.toLocaleLowerCase('en'))
    }
    if (!Array.isArray(answer.choiceIds) || answer.choiceIds.length < 1 || new Set(answer.choiceIds).size !== answer.choiceIds.length || answer.choiceIds.some((id) => !ids.has(id))) errors.push('Multiple-select answers must contain one or more existing unique choice IDs.')
    if (answer.scoringPolicy !== undefined && answer.scoringPolicy !== 'all_or_nothing') errors.push('Multiple-select scoring must use all-or-nothing.')
  } else if (answer.type === 'essay') {
    if (!Array.isArray(answer.keyPoints) || answer.keyPoints.length < 1 || answer.keyPoints.some((point) => !cleanText(point))) errors.push('Essay questions require one or more nonblank key points.')
    if (answer.scoringNotes !== undefined && typeof answer.scoringNotes !== 'string') errors.push('Essay scoring notes must be text when provided.')
    errors.push(...criteriaErrors(answer.rubric, normalizeItemPoints(item), 'Essay'))
  } else {
    if (typeof answer.expectedResponse !== 'string' || !answer.expectedResponse.trim()) errors.push('Constructed-response questions require a nonblank expected response.')
    if (typeof answer.sampleResponse !== 'string' || !answer.sampleResponse.trim()) errors.push('Constructed-response questions require a nonblank sample response.')
    if (answer.rubricGuidance !== undefined && typeof answer.rubricGuidance !== 'string') errors.push('Constructed-response rubric guidance must be text when provided.')
    if (answer.expectedElements !== undefined && (!Array.isArray(answer.expectedElements) || answer.expectedElements.some((element) => !cleanText(element)))) errors.push('Constructed-response expected elements must be nonblank text.')
    errors.push(...criteriaErrors(answer.rubric, normalizeItemPoints(item), 'Constructed-response'))
  }
  return errors
}

function validateCommon(assessment: AssessmentBlueprint, mode: 'draft' | 'final'): AssessmentValidationResult {
  const errors: AssessmentValidationIssue[] = []
  const warnings: AssessmentValidationIssue[] = []
  const add = (key: string, message: string, item?: AssessmentItem, incomplete = false) => {
    const severity = mode === 'draft' && incomplete ? 'warning' : 'error'
    const target = issue(key, message, item, severity)
    if (severity === 'warning') warnings.push(target)
    else errors.push(target)
  }

  if (!assessment.sourceTos || assessment.sourceTos.status !== 'final') add('source-tos', 'The assessment must retain a finalized source TOS snapshot.')
  const sourceTotal = Number(assessment.sourceTos?.content?.totalItems)
  if (!Number.isSafeInteger(sourceTotal) || sourceTotal < 1) add('source-total', 'The source TOS total must be a positive whole number.')
  if (assessment.totalItems !== sourceTotal) add('total-items', 'Assessment totalItems must exactly match the source TOS total.')
  if (assessment.items.length !== sourceTotal) add('item-count', `Assessment must contain exactly ${sourceTotal} item(s).`)
  const derivedTotal = deriveAssessmentTotalPoints(assessment.items)
  if (assessment.totalPoints !== undefined && (!Number.isFinite(assessment.totalPoints) || Math.abs(Number(assessment.totalPoints) - derivedTotal) > 0.000001)) {
    add('total-points', `Assessment totalPoints must equal the derived item-point sum (${derivedTotal}).`)
  }
  if (!assessment.title.trim()) add('title', 'Assessment title is required.', undefined, true)
  if (!assessment.learningArea.trim()) add('learning-area', 'Learning area is required.', undefined, true)

  const settings = assessment.settings
  const allowedTypes = new Set(settings?.allowedTypes ?? QUESTION_TYPES)
  if (settings) {
    if (!Array.isArray(settings.allowedTypes) || settings.allowedTypes.length < 1) add('allowed-question-types', 'At least one question type must be enabled.')
    if (!['auto_balanced', 'fixed_counts', 'percentages', 'manual_per_item'].includes(settings.mode)) add('distribution-mode', 'Question-type distribution mode is invalid.')
    if (settings.targetTotalPoints !== null && settings.targetTotalPoints !== undefined && (!Number.isFinite(Number(settings.targetTotalPoints)) || Number(settings.targetTotalPoints) < 0)) add('target-points', 'Target total points must be nonnegative.')
    for (const [type, value] of Object.entries(settings.defaultPoints ?? {})) {
      if (!QUESTION_TYPES.includes(type as QuestionType) || !Number.isFinite(Number(value)) || Number(value) <= 0) add('default-points', `Default points for ${type} must be positive.`)
    }
    for (const [type, count] of Object.entries(settings.counts ?? {})) {
      if (!QUESTION_TYPES.includes(type as QuestionType) || !allowedTypes.has(type as QuestionType)) add('distribution-disabled-type', `Disabled question type ${type} cannot receive a count.`)
      if (!Number.isSafeInteger(Number(count)) || Number(count) < 0) add('distribution-count', `Question type count for ${type} must be a nonnegative whole number.`)
    }
    for (const [type, percentage] of Object.entries(settings.percentages ?? {})) {
      if (!QUESTION_TYPES.includes(type as QuestionType) || !allowedTypes.has(type as QuestionType)) add('distribution-disabled-type', `Disabled question type ${type} cannot receive a percentage.`)
      if (!Number.isFinite(Number(percentage)) || Number(percentage) < 0) add('distribution-percentage', `Question type percentage for ${type} must be nonnegative.`)
    }
  }

  const numbers = new Set<number>()
  for (const item of assessment.items) {
    if (!Number.isSafeInteger(item.itemNumber) || item.itemNumber < 1 || item.itemNumber > sourceTotal) add('item-number', 'Item number must be a whole number within 1..N.', item)
    if (numbers.has(item.itemNumber)) add('duplicate-item-number', 'Item numbers must not be duplicated.', item)
    numbers.add(item.itemNumber)
  }
  for (let itemNumber = 1; itemNumber <= sourceTotal; itemNumber += 1) {
    if (!numbers.has(itemNumber)) add('item-number-gap', `Item number ${itemNumber} is missing.`)
  }

  const expected = expectedMappings(assessment.sourceTos)
  const sourcePlacement = sourcePlacementStatus(assessment.sourceTos)
  const sourceNumbers = [...sourcePlacement.numbers].sort((a, b) => a - b)
  if (sourcePlacement.duplicate || expected.size !== sourceTotal || sourceNumbers.length !== sourceTotal || sourceNumbers.some((number, index) => number !== index + 1)) add('source-blueprint', 'The source TOS ranges do not map exactly to 1..N.')
  const seenMappings = new Set<string>()
  for (const item of assessment.items) {
    const expectedItem = expected.get(item.itemNumber)
    if (!expectedItem) {
      add('unmapped-item', 'Every item must map to an allocated source TOS row and cognitive category.', item)
      continue
    }
    const mappingKey = `${item.mapping?.rowId ?? ''}|${item.mapping?.cognitiveCategoryId ?? ''}|${item.itemNumber}`
    if (seenMappings.has(mappingKey)) add('duplicate-mapping', 'Item mappings must not be duplicated.', item)
    seenMappings.add(mappingKey)
    if (!same(item.mapping, expectedItem.mapping)) add('mapping-mismatch', 'Item mapping must exactly match the immutable source TOS blueprint.', item)
    if (!same(item.competencySnapshot, expectedItem.competency)) add('competency-snapshot', 'The competency snapshot no longer matches the source TOS row.', item)
    if (!same(item.cognitiveCategorySnapshot, expectedItem.category)) add('cognitive-snapshot', 'The cognitive-category snapshot no longer matches the source TOS allocation.', item)

    if (!QUESTION_TYPES.includes(item.questionType)) add('question-type', 'Question type is not supported.', item)
    if (!allowedTypes.has(item.questionType)) add('disabled-question-type', 'This item uses a question type disabled for the assessment.', item)
    if (!AUTHORSHIP_STATES.includes(item.authorshipState)) add('authorship-state', 'Authorship state must be empty, ai_suggestion, teacher_accepted, teacher_edited, or manual.', item)
    if (item.qaState !== undefined && !QA_STATES.includes(item.qaState)) add('qa-state', 'Question QA state is invalid.', item)
    if (item.locked === true && item.qaState !== undefined && item.qaState !== 'locked') add('lock-state', 'Locked items must use the locked QA state.', item)
    if (mode === 'final' && (item.authorshipState === 'empty' || item.authorshipState === 'ai_suggestion')) add('teacher-review', 'Final assessments require teacher_accepted, teacher_edited, or manual authorship state.', item)
    if (!item.prompt.trim()) add('prompt', 'Question prompt is required.', item, true)
    const points = Number(item.pointsPossible ?? item.points)
    if (mode === 'final' && (!Number.isFinite(points) || points <= 0)) add('points', 'Final questions require positive points.', item)
    if (mode === 'draft' && (!Number.isFinite(points) || points <= 0)) add('points', 'Questions should have positive points before finalization.', item, true)
    answerError(item.answer, item.questionType, item).forEach((message) => add('structured-answer', message, item, mode === 'draft'))
    if (item.visual !== undefined) assessmentVisualErrors(item.visual).forEach((message) => add('visual', message, item, mode === 'draft'))
  }

  return { ready: errors.length === 0 && warnings.length === 0, errors, warnings }
}

export function validateAssessmentDraft(assessment: AssessmentBlueprint): AssessmentValidationResult {
  return validateCommon(assessment, 'draft')
}

export function validateAssessmentFinal(assessment: AssessmentBlueprint): AssessmentValidationResult {
  const result = validateCommon(assessment, 'final')
  if (assessment.status !== 'final') result.errors.push(issue('status', 'Only an assessment marked final can pass final validation.', undefined, 'error'))
  return { ...result, ready: result.errors.length === 0 && result.warnings.length === 0 }
}

export function validateAssessment(assessment: AssessmentBlueprint, mode: 'draft' | 'final' = assessment.status === 'final' ? 'final' : 'draft') {
  return mode === 'final' ? validateAssessmentFinal(assessment) : validateAssessmentDraft(assessment)
}

export function isAssessmentReadyForFinalization(assessment: AssessmentBlueprint) {
  const result = validateCommon({ ...assessment, status: 'final' }, 'final')
  return result.errors.length === 0 && result.warnings.length === 0
}
