import type {
  AssessmentVisual,
  AssessmentVisualColor,
  AssessmentVisualElement,
} from '../types/assessmentVisual'
import { ASSESSMENT_VISUAL_PALETTE, ASSESSMENT_VISUAL_TYPES } from '../types/assessmentVisual'

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
  unexpectedKeys(candidate, ['id', 'kind', 'version', 'width', 'height', 'altText', 'primitives'], 'visual', errors)
  if (!plainText(candidate.id, ASSESSMENT_VISUAL_LIMITS.maxIdLength)) errors.push('visual.id must be bounded plain text.')
  if (candidate.kind !== 'geometry') errors.push("visual.kind must be 'geometry'.")
  if (candidate.version !== 1) errors.push('visual.version must be 1.')
  if (!bounded(candidate.width, ASSESSMENT_VISUAL_LIMITS.minWidth, ASSESSMENT_VISUAL_LIMITS.maxWidth)) errors.push(`visual.width must be between ${ASSESSMENT_VISUAL_LIMITS.minWidth} and ${ASSESSMENT_VISUAL_LIMITS.maxWidth}.`)
  if (!bounded(candidate.height, ASSESSMENT_VISUAL_LIMITS.minHeight, ASSESSMENT_VISUAL_LIMITS.maxHeight)) errors.push(`visual.height must be between ${ASSESSMENT_VISUAL_LIMITS.minHeight} and ${ASSESSMENT_VISUAL_LIMITS.maxHeight}.`)
  if (!plainText(candidate.altText, ASSESSMENT_VISUAL_LIMITS.maxAltTextLength) || /^(image|diagram)$/iu.test(typeof candidate.altText === 'string' ? candidate.altText.normalize('NFKC').trim() : '')) errors.push('visual.altText must be bounded, useful plain text (not a generic image label).')
  if (!Array.isArray(candidate.primitives) || candidate.primitives.length < 1 || candidate.primitives.length > ASSESSMENT_VISUAL_LIMITS.maxElements) errors.push(`visual.primitives must contain 1–${ASSESSMENT_VISUAL_LIMITS.maxElements} primitives.`)
  if (Array.isArray(candidate.primitives) && finite(candidate.width) && finite(candidate.height)) candidate.primitives.forEach((entry, index) => visualElement(entry, candidate.width as number, candidate.height as number, index, errors))
  return { valid: errors.length === 0, errors }
}

export function isAssessmentVisual(value: unknown): value is AssessmentVisual {
  return validateAssessmentVisual(value).valid
}

export function assertAssessmentVisual(value: unknown): asserts value is AssessmentVisual {
  const result = validateAssessmentVisual(value)
  if (!result.valid) throw new Error(`Invalid assessment visual: ${result.errors.join(' ')}`)
}
