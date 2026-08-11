import type { AssessmentAnswer, AssessmentItem } from '../types/assessment'
import type { AssessmentVisual, AssessmentVisualPolygon, AssessmentVisualTextLabel } from '../types/assessmentVisual'
import { normalizeAssessmentMathText } from './assessmentMathText'
import { assessmentVisualPlanForItem, promptRequiresAssessmentVisual } from './assessmentVisualPlanning'
import { validateAssessmentVisual } from './assessmentVisualValidation'

type QaFinding = { code: string; message: string; severity: 'error' | 'warning' }

const STOPWORDS = new Set(['the','a','an','of','to','and','or','is','are','be','in','on','with','which','following','what','when','where','given','provided','shown','based','examine','consider','identify','determine','evaluate','analyze','analyse','state','describe','explain','calculate','find','select','all','that','apply','correctly','specific','measure','measures'])
const POLYGON_NAMES: Record<string, number> = { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10 }

function clean(value: unknown) { return typeof value === 'string' ? normalizeAssessmentMathText(value).trim() : '' }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function array(value: unknown) { return Array.isArray(value) ? value : [] }

export { promptRequiresAssessmentVisual }

function tokens(value: string) {
  return clean(value).toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/u).filter((token) => {
    if (!token || STOPWORDS.has(token)) return false
    // Single-digit values and single-letter variables carry real mathematical
    // evidence. Dropping them made questions such as 2+2 and 3+4 look
    // textually identical and caused the bounded auto-repair loop to regenerate
    // an already-different item again.
    return token.length > 1 || /^[\p{L}\p{N}]$/u.test(token)
  })
}

function tokenSimilarity(left: string, right: string) {
  const a = new Set(tokens(left)); const b = new Set(tokens(right))
  if (a.size < 2 || b.size < 2) return 0
  const intersection = [...a].filter((token) => b.has(token)).length
  return (2 * intersection) / (a.size + b.size)
}

function answerConcept(answer: AssessmentAnswer) {
  const value = record(answer)
  if (answer.type === 'multiple_choice') {
    const choices = array(value.choices).map(record); const choice = choices.find((entry) => clean(entry.id) === clean(answer.choiceId))
    return clean(choice?.text)
  }
  if (answer.type === 'true_false') return String(answer.value)
  if (answer.type === 'short_answer' || answer.type === 'identification') return array(value.acceptedAnswers).map(clean).filter(Boolean).sort().join('|')
  if (answer.type === 'fill_in_the_blank') return array(value.blanks).flatMap((blank) => array(record(blank).acceptedAnswers).map(clean)).filter(Boolean).sort().join('|')
  if (answer.type === 'numerical_answer') return `${String(value.value ?? '')}|${clean(value.unit)}`
  if (answer.type === 'multiple_select') {
    const choices = array(value.choices).map(record); const ids = new Set(array(value.choiceIds).map(String))
    return choices.filter((choice) => ids.has(String(choice.id))).map((choice) => clean(choice.text)).filter(Boolean).sort().join('|')
  }
  if (answer.type === 'constructed_response') return clean(value.expectedResponse).slice(0, 180)
  if (answer.type === 'essay') return array(value.keyPoints).map(clean).filter(Boolean).sort().join('|').slice(0, 180)
  if (answer.type === 'problem_solving') return clean(value.finalAnswer)
  return ''
}

export function assessmentPromptSimilarity(left: AssessmentItem, right: AssessmentItem) {
  return tokenSimilarity(left.prompt, right.prompt)
}

export function assessmentDuplicateLevel(left: AssessmentItem, right: AssessmentItem): 'none' | 'similar' | 'strong' | 'exact' {
  const normalizedLeft = clean(left.prompt).toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const normalizedRight = clean(right.prompt).toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  if (normalizedLeft && normalizedLeft === normalizedRight) return 'exact'
  if (left.questionType !== right.questionType || left.competencySnapshot.id !== right.competencySnapshot.id) return 'none'
  const similarity = assessmentPromptSimilarity(left, right)
  const sameAnswer = Boolean(answerConcept(left.answer)) && answerConcept(left.answer) === answerConcept(right.answer)
  if ((sameAnswer && similarity >= 0.72) || similarity >= 0.9) return 'strong'
  if (similarity >= 0.58) return 'similar'
  return 'none'
}

function polygon(visual: AssessmentVisual): AssessmentVisualPolygon | undefined {
  return visual.primitives.find((primitive): primitive is AssessmentVisualPolygon => primitive.type === 'polygon')
}

function polygonConvex(points: Array<{ x: number; y: number }>) {
  if (points.length < 4) return true
  let sign = 0
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]; const b = points[(index + 1) % points.length]; const c = points[(index + 2) % points.length]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-6) continue
    const next = Math.sign(cross)
    if (sign && next !== sign) return false
    sign = next
  }
  return true
}

function polygonSideVariation(points: Array<{ x: number; y: number }>) {
  const lengths = points.map((point, index) => { const next = points[(index + 1) % points.length]; return Math.hypot(next.x - point.x, next.y - point.y) })
  if (!lengths.length) return 1
  const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length
  return mean > 0 ? Math.max(...lengths.map((value) => Math.abs(value - mean) / mean)) : 1
}

function polygonAngleVariation(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) return 1
  const angles = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]
    const ax = previous.x - point.x; const ay = previous.y - point.y
    const bx = next.x - point.x; const by = next.y - point.y
    const aLength = Math.hypot(ax, ay); const bLength = Math.hypot(bx, by)
    if (aLength <= 1e-9 || bLength <= 1e-9) return Number.NaN
    const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (aLength * bLength)))
    return Math.acos(cosine)
  })
  if (angles.some((angle) => !Number.isFinite(angle))) return 1
  const mean = angles.reduce((sum, value) => sum + value, 0) / angles.length
  return mean > 0 ? Math.max(...angles.map((value) => Math.abs(value - mean) / mean)) : 1
}

function claimedSideCount(prompt: string) {
  const lower = clean(prompt).toLocaleLowerCase('en')
  const numeric = lower.match(/\b(3|4|5|6|7|8|9|10)[ -]sided\b/u)
  if (numeric) return Number(numeric[1])
  for (const [name, count] of Object.entries(POLYGON_NAMES)) if (new RegExp(`\\b${name}\\b`, 'u').test(lower)) return count
  return undefined
}

function labelTexts(visual: AssessmentVisual) {
  return visual.primitives.filter((primitive): primitive is AssessmentVisualTextLabel => primitive.type === 'textLabel').map((label) => clean(label.text).toLocaleLowerCase('en'))
}

function semanticAnswerText(value: string) {
  return clean(value).toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/gu, ' ').trim()
}

function conciseAcceptedAnswerTerms(item: AssessmentItem) {
  const answer = record(item.answer)
  const values: string[] = []
  if (item.questionType === 'multiple_choice') {
    const choices = array(answer.choices).map(record)
    const selected = choices.find((choice) => String(choice.id) === String(answer.choiceId))
    if (selected) values.push(clean(selected.text))
  } else if (item.questionType === 'multiple_select') {
    const selected = new Set(array(answer.choiceIds).map(String))
    values.push(...array(answer.choices).map(record).filter((choice) => selected.has(String(choice.id))).map((choice) => clean(choice.text)))
  } else if (item.questionType === 'short_answer' || item.questionType === 'identification') {
    values.push(...array(answer.acceptedAnswers).filter((entry): entry is string => typeof entry === 'string'))
  } else if (item.questionType === 'fill_in_the_blank') {
    for (const rawBlank of array(answer.blanks)) values.push(...array(record(rawBlank).acceptedAnswers).filter((entry): entry is string => typeof entry === 'string'))
  } else if (item.questionType === 'numerical_answer') {
    if (answer.value !== undefined) values.push(String(answer.value))
    if (answer.unit) values.push(String(answer.unit))
  } else if (item.questionType === 'problem_solving') {
    if (answer.finalAnswer !== undefined) values.push(String(answer.finalAnswer))
  }
  return [...new Set(values.map(semanticAnswerText).filter((value) => value.length >= 1 && value.length <= 120))]
}

function learnerVisualContainsAnswer(item: AssessmentItem, visual: AssessmentVisual) {
  const terms = conciseAcceptedAnswerTerms(item)
  if (!terms.length) return false
  const learnerFacing = [visual.altText, ...labelTexts(visual)].map((value) => ` ${semanticAnswerText(value)} `)
  return terms.some((term) => learnerFacing.some((value) => value.includes(` ${term} `)))
}

export function assessmentVisualSemanticFindings(item: AssessmentItem): QaFinding[] {
  const findings: QaFinding[] = []
  const visual = item.visual
  const plan = assessmentVisualPlanForItem(item)
  if (!visual && plan.requirement === 'required') findings.push({ code: 'required-visual-missing', message: 'This question requires a diagram/figure/graph, but no exportable visual is attached.', severity: 'error' })
  else if (!visual && plan.requirement === 'helpful') findings.push({ code: 'helpful-visual-missing', message: 'A diagram would improve this item, but visual enrichment has not produced one yet.', severity: 'warning' })
  if (!visual) return findings
  if (!plan.current) findings.push({ code: 'stale-visual', message: 'The attached visual was generated for an older prompt or answer and must be regenerated or reviewed.', severity: plan.requirement === 'required' ? 'error' : 'warning' })
  const validation = validateAssessmentVisual(visual)
  if (!validation.valid) {
    findings.push({ code: 'invalid-export-visual', message: 'The attached visual is invalid and cannot be trusted in student export.', severity: plan.requirement === 'required' ? 'error' : 'warning' })
    return findings
  }
  if (learnerVisualContainsAnswer(item, visual)) {
    findings.push({ code: 'visual-answer-leak', message: 'The learner-facing diagram label or accessibility text reveals an accepted answer.', severity: 'error' })
  }
  const poly = polygon(visual)
  if (poly) {
    const expectedSides = claimedSideCount(item.prompt)
    if (expectedSides && poly.points.length !== expectedSides) findings.push({ code: 'visual-side-count-mismatch', message: `The prompt describes a ${expectedSides}-sided polygon but the attached polygon has ${poly.points.length} vertices.`, severity: 'error' })
    const lower = clean(item.prompt).toLocaleLowerCase('en')
    const convex = polygonConvex(poly.points)
    if (/\bnon[- ]?convex\b/u.test(lower) && convex) findings.push({ code: 'visual-convexity-mismatch', message: 'The prompt says the polygon is non-convex, but the structured visual is convex.', severity: 'error' })
    else if (/\bconvex\b/u.test(lower) && !/\bnon[- ]?convex\b/u.test(lower) && !convex) findings.push({ code: 'visual-convexity-mismatch', message: 'The prompt says the polygon is convex, but the structured visual is non-convex.', severity: 'error' })
    const sideVariation = polygonSideVariation(poly.points)
    const angleVariation = polygonAngleVariation(poly.points)
    if (/\bregular\b/u.test(lower) && !/\birregular\b/u.test(lower) && (!convex || sideVariation > 0.12 || angleVariation > 0.12)) findings.push({ code: 'visual-regularity-mismatch', message: 'The prompt describes a regular polygon, but the structured polygon does not have the expected equal-side/equal-angle geometry.', severity: 'error' })
    // Equal sides alone do not prove regularity (for example, a rhombus). Only
    // contradict an "irregular" claim when both side lengths and vertex angles
    // are essentially equal in a convex structured polygon.
    if (/\birregular\b/u.test(lower) && convex && sideVariation < 0.025 && angleVariation < 0.025) findings.push({ code: 'visual-regularity-mismatch', message: 'The prompt describes an irregular polygon, but the structured polygon is essentially regular.', severity: 'error' })
  }
  const normalized = clean(item.prompt)
  const labels = labelTexts(visual)
  const angleLabels = [...normalized.matchAll(/(?:∠|\bangle\s+)([A-Z]{3})\b/gu)].map((match) => match[1].toLocaleLowerCase('en'))
  const requiredPointLabels = [...new Set(angleLabels.flatMap((angle) => angle.split('')))]
  const explicitLabels = [...normalized.matchAll(/\blabel(?:ed|led)\s+(?:with\s+)?(?:the\s+)?(?:variables?\s+)?([A-Za-z0-9]+)(?:\s+and\s+([A-Za-z0-9]+))?/giu)]
    .flatMap((match) => [match[1], match[2]]).filter(Boolean).map((value) => value.toLocaleLowerCase('en'))
  const requiredLabels = [...new Set([...requiredPointLabels, ...explicitLabels])]
  const labelPresent = (required: string) => labels.some((label) => label === required || label.startsWith(`${required}°`))
  const missing = requiredLabels.filter((required) => !labelPresent(required))
  if (missing.length) findings.push({ code: 'visual-label-mismatch', message: `The prompt references labels that are missing from the structured visual: ${missing.map((value) => value.toUpperCase()).join(', ')}.`, severity: plan.requirement === 'required' ? 'error' : 'warning' })
  return findings
}

export function assessmentSimilarityConcentration(items: AssessmentItem[]) {
  const totalPoints = items.reduce((sum, item) => sum + Math.max(0, Number(item.pointsPossible) || 0), 0)
  if (totalPoints <= 0) return null
  let best: { itemNumbers: number[]; points: number } | null = null
  for (const anchor of items) {
    const cluster = items.filter((candidate) => candidate.competencySnapshot.id === anchor.competencySnapshot.id && assessmentPromptSimilarity(anchor, candidate) >= 0.5)
    const unique = [...new Map(cluster.map((item) => [item.id, item])).values()]
    const points = unique.reduce((sum, item) => sum + Math.max(0, Number(item.pointsPossible) || 0), 0)
    if (unique.length >= 3 && points / totalPoints >= 0.25 && (!best || points > best.points)) best = { itemNumbers: unique.map((item) => item.itemNumber).sort((a, b) => a - b), points }
  }
  if (!best) return null
  return { itemNumbers: best.itemNumbers, points: best.points, share: best.points / totalPoints }
}
