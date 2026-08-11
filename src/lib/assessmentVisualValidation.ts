import type {
  AssessmentVisual,
  AssessmentVisualColor,
  AssessmentVisualElement,
} from '../types/assessmentVisual'
import { ASSESSMENT_VISUAL_PALETTE, ASSESSMENT_VISUAL_TYPES } from '../types/assessmentVisual'
import { validateAssessmentTikzSource } from './assessmentTikzSafety'

export const ASSESSMENT_VISUAL_LIMITS = {
  minWidth: 64,
  maxWidth: 1600,
  minHeight: 64,
  maxHeight: 1200,
  maxElements: 80,
  maxIdLength: 80,
  maxAltTextLength: 240,
  maxLabelLength: 80,
  maxRadius: 800,
} as const

type UnknownRecord = Record<string, unknown>

function object(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function hasOwn(value: UnknownRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function keys(value: UnknownRecord) { return Object.keys(value) }

function unexpectedKeys(value: UnknownRecord, allowed: readonly string[], path: string, errors: string[]) {
  const allowedSet = new Set(allowed)
  keys(value).filter((key) => !allowedSet.has(key)).forEach((key) => errors.push(`${path}.${key} is not a supported visual property.`))
}

function plainText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return false
  const normalized = value.normalize('NFKC')
  if (!normalized.trim() || normalized.length > maxLength) return false
  // Labels and alternative text are intentionally plain text.  React escapes
  // them, but rejecting markup/control characters also keeps exports safe and
  // predictable across SVG, PDF, and text renderers.
  if (/[<>]/u.test(normalized) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) return false
  return true
}

function finite(value: unknown) { return typeof value === 'number' && Number.isFinite(value) }

function bounded(value: unknown, minimum: number, maximum: number) {
  return finite(value) && (value as number) >= minimum && (value as number) <= maximum
}

function color(value: unknown): value is AssessmentVisualColor {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ASSESSMENT_VISUAL_PALETTE, value)
}

function optionalColor(value: UnknownRecord, key: string, path: string, errors: string[]) {
  if (hasOwn(value, key) && !color(value[key])) errors.push(`${path}.${key} must use the fixed visual colour palette.`)
}

function optionalStrokeWidth(value: UnknownRecord, path: string, errors: string[]) {
  if (hasOwn(value, 'strokeWidth') && !(typeof value.strokeWidth === 'number' && Number.isInteger(value.strokeWidth) && [1, 2, 3].includes(value.strokeWidth))) errors.push(`${path}.strokeWidth must be the number 1, 2, or 3.`)
}

function optionalCount(value: UnknownRecord, path: string, errors: string[]) {
  if (hasOwn(value, 'count') && !(typeof value.count === 'number' && Number.isInteger(value.count) && [1, 2, 3].includes(value.count))) errors.push(`${path}.count must be the number 1, 2, or 3.`)
}

function point(value: unknown, width: number, height: number, path: string, errors: string[]) {
  const candidate = object(value)
  if (!candidate) { errors.push(`${path} must be an object.`); return }
  unexpectedKeys(candidate, ['x', 'y'], path, errors)
  if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height)) errors.push(`${path} coordinates must be finite and inside the visual canvas.`)
}

function coordinate(value: unknown, width: number, height: number, path: string, errors: string[]) {
  point(value, width, height, path, errors)
}

function line(value: UnknownRecord, width: number, height: number, path: string, errors: string[]) {
  if (!bounded(value.x1, 0, width) || !bounded(value.y1, 0, height) || !bounded(value.x2, 0, width) || !bounded(value.y2, 0, height)) errors.push(`${path} endpoints must be finite and inside the visual canvas.`)
  if (value.x1 === value.x2 && value.y1 === value.y2) errors.push(`${path} must have two distinct endpoints.`)
  optionalColor(value, 'color', path, errors)
  optionalStrokeWidth(value, path, errors)
}

function radius(value: unknown, path: string, errors: string[]) {
  if (!bounded(value, 0.5, ASSESSMENT_VISUAL_LIMITS.maxRadius)) errors.push(`${path} radius must be finite and between 0.5 and ${ASSESSMENT_VISUAL_LIMITS.maxRadius}.`)
}

function circleBounds(cx: number, cy: number, r: number, width: number, height: number, path: string, errors: string[]) {
  if (cx - r < 0 || cx + r > width || cy - r < 0 || cy + r > height) errors.push(`${path} must fit inside the visual canvas.`)
}

function angles(value: UnknownRecord, path: string, errors: string[]) {
  if (!bounded(value.startAngle, -720, 720) || !bounded(value.endAngle, -720, 720)) errors.push(`${path} angles must be finite and bounded.`)
  if (finite(value.startAngle) && finite(value.endAngle)) {
    const span = Math.abs((value.endAngle as number) - (value.startAngle as number))
    if (span < 0.001 || span > 360.001) errors.push(`${path} angle span must be greater than zero and no more than 360 degrees.`)
  }
}

function commonVisualElement(value: UnknownRecord, path: string, errors: string[]) {
  optionalColor(value, 'color', path, errors)
  optionalStrokeWidth(value, path, errors)
}

function finiteMathCoordinate(value: unknown) {
  return bounded(value, -10000, 10000)
}

function cartesianAxesElement(candidate: UnknownRecord, width: number, height: number, path: string, errors: string[]) {
  unexpectedKeys(candidate, ['type', 'axisId', 'x', 'y', 'width', 'height', 'xMin', 'xMax', 'yMin', 'yMax', 'xTick', 'yTick', 'showGrid', 'xLabel', 'yLabel', 'color', 'strokeWidth'], path, errors)
  if (!plainText(candidate.axisId, 80)) errors.push(`${path}.axisId must be bounded plain text.`)
  if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height) || !bounded(candidate.width, 80, width) || !bounded(candidate.height, 80, height)) errors.push(`${path} plot rectangle must be finite and inside the visual canvas.`)
  if (finite(candidate.x) && finite(candidate.y) && finite(candidate.width) && finite(candidate.height) && ((candidate.x as number) + (candidate.width as number) > width || (candidate.y as number) + (candidate.height as number) > height)) errors.push(`${path} plot rectangle must fit inside the visual canvas.`)
  if (![candidate.xMin, candidate.xMax, candidate.yMin, candidate.yMax].every(finiteMathCoordinate)) errors.push(`${path} mathematical bounds must be finite and between -10000 and 10000.`)
  if (finite(candidate.xMin) && finite(candidate.xMax) && !((candidate.xMin as number) < 0 && (candidate.xMax as number) > 0 && (candidate.xMin as number) < (candidate.xMax as number))) errors.push(`${path} x bounds must straddle zero and be increasing.`)
  if (finite(candidate.yMin) && finite(candidate.yMax) && !((candidate.yMin as number) < 0 && (candidate.yMax as number) > 0 && (candidate.yMin as number) < (candidate.yMax as number))) errors.push(`${path} y bounds must straddle zero and be increasing.`)
  for (const tickKey of ['xTick', 'yTick'] as const) if (hasOwn(candidate, tickKey) && !bounded(candidate[tickKey], 0.000001, 10000)) errors.push(`${path}.${tickKey} must be a positive finite number.`)
  if (hasOwn(candidate, 'showGrid') && typeof candidate.showGrid !== 'boolean') errors.push(`${path}.showGrid must be boolean.`)
  for (const labelKey of ['xLabel', 'yLabel'] as const) if (hasOwn(candidate, labelKey) && !plainText(candidate[labelKey], 40)) errors.push(`${path}.${labelKey} must be bounded plain text.`)
  commonVisualElement(candidate, path, errors)
}

function cartesianPlotElement(candidate: UnknownRecord, path: string, errors: string[]) {
  unexpectedKeys(candidate, ['type', 'axisId', 'points', 'showPoints', 'dashed', 'color', 'strokeWidth'], path, errors)
  if (!plainText(candidate.axisId, 80)) errors.push(`${path}.axisId must be bounded plain text.`)
  if (!Array.isArray(candidate.points) || candidate.points.length < 2 || candidate.points.length > 160) errors.push(`${path}.points must contain 2–160 sampled coordinates.`)
  if (Array.isArray(candidate.points)) candidate.points.forEach((entry, pointIndex) => {
    const pointValue = object(entry)
    if (!pointValue) { errors.push(`${path}.points[${pointIndex}] must be an object.`); return }
    unexpectedKeys(pointValue, ['x', 'y'], `${path}.points[${pointIndex}]`, errors)
    if (!finiteMathCoordinate(pointValue.x) || !finiteMathCoordinate(pointValue.y)) errors.push(`${path}.points[${pointIndex}] must contain finite mathematical coordinates.`)
  })
  if (hasOwn(candidate, 'showPoints') && typeof candidate.showPoints !== 'boolean') errors.push(`${path}.showPoints must be boolean.`)
  if (hasOwn(candidate, 'dashed') && typeof candidate.dashed !== 'boolean') errors.push(`${path}.dashed must be boolean.`)
  commonVisualElement(candidate, path, errors)
}

function visualElement(value: unknown, width: number, height: number, index: number, errors: string[]) {
  const path = `primitives[${index}]`
  const candidate = object(value)
  if (!candidate) { errors.push(`${path} must be an object.`); return }
  const type = candidate.type
  if (!ASSESSMENT_VISUAL_TYPES.includes(type as AssessmentVisualElement['type'])) {
    errors.push(`${path}.type is not a supported visual element.`)
    return
  }

  switch (type) {
    case 'point':
      unexpectedKeys(candidate, ['type', 'x', 'y', 'radius', 'color', 'strokeWidth'], path, errors)
      if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height)) errors.push(`${path} coordinates must be finite and inside the visual canvas.`)
      if (hasOwn(candidate, 'radius') && !bounded(candidate.radius, 0.5, 40)) errors.push(`${path}.radius must be finite and between 0.5 and 40.`)
      commonVisualElement(candidate, path, errors)
      return
    case 'segment':
    case 'dashedSegment':
    case 'arrow':
      unexpectedKeys(candidate, ['type', 'x1', 'y1', 'x2', 'y2', 'color', 'strokeWidth'], path, errors)
      line(candidate, width, height, path, errors)
      return
    case 'polygon': {
      unexpectedKeys(candidate, ['type', 'points', 'color', 'fill', 'strokeWidth'], path, errors)
      if (!Array.isArray(candidate.points) || candidate.points.length < 3 || candidate.points.length > 12) errors.push(`${path}.points must contain 3–12 vertices.`)
      if (Array.isArray(candidate.points)) candidate.points.forEach((entry, pointIndex) => coordinate(entry, width, height, `${path}.points[${pointIndex}]`, errors))
      optionalColor(candidate, 'fill', path, errors)
      commonVisualElement(candidate, path, errors)
      return
    }
    case 'circle': {
      unexpectedKeys(candidate, ['type', 'cx', 'cy', 'radius', 'color', 'fill', 'strokeWidth'], path, errors)
      if (!bounded(candidate.cx, 0, width) || !bounded(candidate.cy, 0, height)) errors.push(`${path} center must be finite and inside the visual canvas.`)
      radius(candidate.radius, `${path}.radius`, errors)
      if (finite(candidate.cx) && finite(candidate.cy) && finite(candidate.radius)) circleBounds(candidate.cx as number, candidate.cy as number, candidate.radius as number, width, height, path, errors)
      optionalColor(candidate, 'fill', path, errors)
      commonVisualElement(candidate, path, errors)
      return
    }
    case 'arc': {
      unexpectedKeys(candidate, ['type', 'cx', 'cy', 'radius', 'startAngle', 'endAngle', 'color', 'strokeWidth'], path, errors)
      if (!bounded(candidate.cx, 0, width) || !bounded(candidate.cy, 0, height)) errors.push(`${path} center must be finite and inside the visual canvas.`)
      radius(candidate.radius, `${path}.radius`, errors)
      angles(candidate, path, errors)
      if (finite(candidate.cx) && finite(candidate.cy) && finite(candidate.radius)) circleBounds(candidate.cx as number, candidate.cy as number, candidate.radius as number, width, height, path, errors)
      commonVisualElement(candidate, path, errors)
      return
    }
    case 'angleArc': {
      unexpectedKeys(candidate, ['type', 'vertex', 'radius', 'startAngle', 'endAngle', 'color', 'strokeWidth'], path, errors)
      const vertex = object(candidate.vertex)
      if (!vertex) errors.push(`${path}.vertex must be an object.`)
      else { unexpectedKeys(vertex, ['x', 'y'], `${path}.vertex`, errors); if (!bounded(vertex.x, 0, width) || !bounded(vertex.y, 0, height)) errors.push(`${path}.vertex must be inside the visual canvas.`) }
      radius(candidate.radius, `${path}.radius`, errors)
      angles(candidate, path, errors)
      if (vertex && finite(vertex.x) && finite(vertex.y) && finite(candidate.radius)) circleBounds(vertex.x as number, vertex.y as number, candidate.radius as number, width, height, path, errors)
      commonVisualElement(candidate, path, errors)
      return
    }
    case 'textLabel':
      unexpectedKeys(candidate, ['type', 'x', 'y', 'text', 'color', 'textSize', 'anchor'], path, errors)
      if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height)) errors.push(`${path} coordinates must be finite and inside the visual canvas.`)
      if (!plainText(candidate.text, ASSESSMENT_VISUAL_LIMITS.maxLabelLength)) errors.push(`${path}.text must be bounded plain text.`)
      if (hasOwn(candidate, 'textSize') && !['small', 'medium', 'large'].includes(String(candidate.textSize))) errors.push(`${path}.textSize is not supported.`)
      if (hasOwn(candidate, 'anchor') && !['start', 'middle', 'end'].includes(String(candidate.anchor))) errors.push(`${path}.anchor is not supported.`)
      optionalColor(candidate, 'color', path, errors)
      return
    case 'tickMark':
    case 'equalSideMark':
    case 'parallelMark':
      unexpectedKeys(candidate, ['type', 'x1', 'y1', 'x2', 'y2', 'count', 'color', 'strokeWidth'], path, errors)
      line(candidate, width, height, path, errors)
      optionalCount(candidate, path, errors)
      return
    case 'perpendicularMark':
      unexpectedKeys(candidate, ['type', 'x', 'y', 'angle', 'size', 'color', 'strokeWidth'], path, errors)
      if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height)) errors.push(`${path} coordinates must be finite and inside the visual canvas.`)
      if (!bounded(candidate.angle, -720, 720)) errors.push(`${path}.angle must be finite and bounded.`)
      if (!bounded(candidate.size, 2, 80)) errors.push(`${path}.size must be finite and between 2 and 80.`)
      if (finite(candidate.x) && finite(candidate.y) && finite(candidate.angle) && finite(candidate.size)) {
        const radians = (candidate.angle as number) * Math.PI / 180
        const ux = Math.cos(radians); const uy = Math.sin(radians); const px = -uy; const py = ux; const corners = [{ x: candidate.x as number, y: candidate.y as number }, { x: (candidate.x as number) + ux * (candidate.size as number), y: (candidate.y as number) + uy * (candidate.size as number) }, { x: (candidate.x as number) + (ux + px) * (candidate.size as number), y: (candidate.y as number) + (uy + py) * (candidate.size as number) }, { x: (candidate.x as number) + px * (candidate.size as number), y: (candidate.y as number) + py * (candidate.size as number) }]
        if (corners.some((corner) => corner.x < 0 || corner.x > width || corner.y < 0 || corner.y > height)) errors.push(`${path} must fit inside the visual canvas.`)
      }
      commonVisualElement(candidate, path, errors)
      return
    case 'cartesianAxes':
      cartesianAxesElement(candidate, width, height, path, errors)
      return
    case 'cartesianPlot':
      cartesianPlotElement(candidate, path, errors)
      return
    default:
      return
  }
}

export type AssessmentVisualValidationResult = {
  valid: boolean
  errors: string[]
}

/** Validate both the shape and the safe rendering bounds of a visual. */
export function validateAssessmentVisual(value: unknown): AssessmentVisualValidationResult {
  const errors: string[] = []
  const candidate = object(value)
  if (!candidate) return { valid: false, errors: ['A visual must be an object.'] }
  unexpectedKeys(candidate, ['id', 'kind', 'version', 'width', 'height', 'altText', 'tikzCode', 'primitives'], 'visual', errors)
  if (!plainText(candidate.id, ASSESSMENT_VISUAL_LIMITS.maxIdLength)) errors.push('visual.id must be bounded plain text.')
  if (candidate.kind !== 'geometry') errors.push("visual.kind must be 'geometry'.")
  if (candidate.version !== 1) errors.push('visual.version must be 1.')
  if (!bounded(candidate.width, ASSESSMENT_VISUAL_LIMITS.minWidth, ASSESSMENT_VISUAL_LIMITS.maxWidth)) errors.push(`visual.width must be between ${ASSESSMENT_VISUAL_LIMITS.minWidth} and ${ASSESSMENT_VISUAL_LIMITS.maxWidth}.`)
  if (!bounded(candidate.height, ASSESSMENT_VISUAL_LIMITS.minHeight, ASSESSMENT_VISUAL_LIMITS.maxHeight)) errors.push(`visual.height must be between ${ASSESSMENT_VISUAL_LIMITS.minHeight} and ${ASSESSMENT_VISUAL_LIMITS.maxHeight}.`)
  if (!plainText(candidate.altText, ASSESSMENT_VISUAL_LIMITS.maxAltTextLength) || /^(image|diagram)$/iu.test(typeof candidate.altText === 'string' ? candidate.altText.normalize('NFKC').trim() : '')) errors.push('visual.altText must be bounded, useful plain text (not a generic image label).')
  const directTikz = candidate.tikzCode === undefined ? null : validateAssessmentTikzSource(candidate.tikzCode)
  if (directTikz && !directTikz.valid) errors.push(`visual.tikzCode is invalid. ${directTikz.errors.slice(0, 2).join(' ')}`)
  if (!Array.isArray(candidate.primitives) || candidate.primitives.length > ASSESSMENT_VISUAL_LIMITS.maxElements || (!directTikz && candidate.primitives.length < 1)) errors.push(`visual.primitives must contain ${directTikz ? `0–${ASSESSMENT_VISUAL_LIMITS.maxElements}` : `1–${ASSESSMENT_VISUAL_LIMITS.maxElements}`} primitives.`)
  if (Array.isArray(candidate.primitives) && candidate.primitives.length && finite(candidate.width) && finite(candidate.height)) {
    candidate.primitives.forEach((entry, index) => visualElement(entry, candidate.width as number, candidate.height as number, index, errors))
    const axes = new Map<string, UnknownRecord>()
    candidate.primitives.forEach((entry, index) => {
      const primitive = object(entry)
      if (!primitive || primitive.type !== 'cartesianAxes' || typeof primitive.axisId !== 'string') return
      const key = primitive.axisId.normalize('NFKC').trim()
      if (axes.has(key)) errors.push(`primitives[${index}].axisId must be unique.`)
      else axes.set(key, primitive)
    })
    candidate.primitives.forEach((entry, index) => {
      const primitive = object(entry)
      if (!primitive || primitive.type !== 'cartesianPlot' || typeof primitive.axisId !== 'string') return
      const axis = axes.get(primitive.axisId.normalize('NFKC').trim())
      if (!axis) { errors.push(`primitives[${index}].axisId must reference a cartesianAxes primitive.`); return }
      if (!Array.isArray(primitive.points) || !finite(axis.xMin) || !finite(axis.xMax) || !finite(axis.yMin) || !finite(axis.yMax)) return
      for (const rawPoint of primitive.points) {
        const pointValue = object(rawPoint)
        if (!pointValue || !finite(pointValue.x) || !finite(pointValue.y)) continue
        if ((pointValue.x as number) < (axis.xMin as number) || (pointValue.x as number) > (axis.xMax as number) || (pointValue.y as number) < (axis.yMin as number) || (pointValue.y as number) > (axis.yMax as number)) {
          errors.push(`primitives[${index}] sampled points must stay inside the referenced Cartesian bounds.`)
          break
        }
      }
    })
  }
  return { valid: errors.length === 0, errors }
}

export function isAssessmentVisual(value: unknown): value is AssessmentVisual {
  return validateAssessmentVisual(value).valid
}

export function assertAssessmentVisual(value: unknown): asserts value is AssessmentVisual {
  const result = validateAssessmentVisual(value)
  if (!result.valid) throw new Error(`Invalid assessment visual: ${result.errors.join(' ')}`)
}


/**
 * Build learner-safe accessibility text from validated visual structure only.
 * This intentionally ignores author/model supplied classification language so
 * student preview, SVG, and DOCX accessibility metadata cannot reveal answers.
 */
export function neutralAssessmentVisualAltText(visual: AssessmentVisual) {
  if (visual.tikzCode && visual.primitives.length === 0) return 'A mathematical diagram accompanying the question.'
  const axes = visual.primitives.filter((entry) => entry.type === 'cartesianAxes').length
  const plots = visual.primitives.filter((entry) => entry.type === 'cartesianPlot').length
  if (axes) return plots ? 'A Cartesian coordinate graph with plotted data and labeled axes.' : 'A Cartesian coordinate plane with labeled axes.'
  const polygons = visual.primitives.filter((entry) => entry.type === 'polygon')
  const circles = visual.primitives.filter((entry) => entry.type === 'circle').length
  const segments = visual.primitives.filter((entry) => entry.type === 'segment' || entry.type === 'dashedSegment').length
  const angleMarks = visual.primitives.filter((entry) => entry.type === 'angleArc').length
  const congruenceMarks = visual.primitives.filter((entry) => entry.type === 'equalSideMark' || entry.type === 'tickMark').length
  const relationMarks = visual.primitives.filter((entry) => entry.type === 'parallelMark' || entry.type === 'perpendicularMark').length
  const parts: string[] = []
  if (polygons.length === 1) parts.push(polygons[0].points.length >= 3 ? `A polygon outline with ${polygons[0].points.length} vertices.` : 'A polygon outline.')
  else if (polygons.length > 1) parts.push(`A geometry diagram with ${polygons.length} polygon outlines.`)
  else if (circles) parts.push(circles === 1 ? 'A geometry diagram containing a circle.' : `A geometry diagram containing ${circles} circles.`)
  else parts.push('A geometry diagram with mathematical line work and labels.')
  if (segments) parts.push('Line segments are shown.')
  if (angleMarks) parts.push('Angle markings are shown.')
  if (congruenceMarks) parts.push('Congruence markings are shown.')
  if (relationMarks) parts.push('Parallel or perpendicular markings are shown.')
  return parts.join(' ').slice(0, ASSESSMENT_VISUAL_LIMITS.maxAltTextLength)
}
