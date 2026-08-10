/**
 * Edge-safe assessment visual contract.  This intentionally mirrors the
 * renderer-owned visual model without importing the browser bundle into an
 * Edge Function.
 */

export const ASSESSMENT_VISUAL_LIMITS = {
  maxIdLength: 80,
  minWidth: 64,
  maxWidth: 1600,
  minHeight: 64,
  maxHeight: 1200,
  maxPrimitives: 80,
  maxAltTextLength: 240,
  maxLabelLength: 80,
  maxRadius: 800,
} as const

type Row = Record<string, unknown>

function object(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null
}

function has(value: Row, key: string) { return Object.prototype.hasOwnProperty.call(value, key) }
function keys(value: Row) { return Object.keys(value) }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function bounded(value: unknown, min: number, max: number) { return finite(value) && value >= min && value <= max }
function plainText(value: unknown, max: number) {
  if (typeof value !== 'string') return false
  const normalized = value.normalize('NFKC')
  return normalized.trim().length > 0
    && normalized.length <= max
    && !/[<>]/u.test(normalized)
    && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)
}
function unexpected(value: Row, allowed: readonly string[], path: string, errors: string[]) {
  const allowedSet = new Set(allowed)
  for (const key of keys(value)) if (!allowedSet.has(key)) errors.push(`${path}.${key} is unsupported.`)
}
function color(value: unknown) { return typeof value === 'string' && ['ink', 'blue', 'red', 'green', 'gold', 'purple', 'gray'].includes(value) }
function common(value: Row, path: string, errors: string[]) {
  if (has(value, 'color') && !color(value.color)) errors.push(`${path}.color is unsupported.`)
  if (has(value, 'fill') && !color(value.fill)) errors.push(`${path}.fill is unsupported.`)
  if (has(value, 'strokeWidth') && ![1, 2, 3].includes(Number(value.strokeWidth))) errors.push(`${path}.strokeWidth is unsupported.`)
}
function point(value: unknown, width: number, height: number, path: string, errors: string[]) {
  const candidate = object(value)
  if (!candidate) { errors.push(`${path} must be an object.`); return }
  unexpected(candidate, ['x', 'y'], path, errors)
  if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height)) errors.push(`${path} is outside the visual canvas.`)
}
function line(value: Row, width: number, height: number, path: string, errors: string[]) {
  if (!bounded(value.x1, 0, width) || !bounded(value.y1, 0, height) || !bounded(value.x2, 0, width) || !bounded(value.y2, 0, height)) errors.push(`${path} endpoints are outside the visual canvas.`)
  if (value.x1 === value.x2 && value.y1 === value.y2) errors.push(`${path} endpoints must differ.`)
  common(value, path, errors)
}
function radius(value: unknown, path: string, errors: string[]) {
  if (!bounded(value, 0.5, ASSESSMENT_VISUAL_LIMITS.maxRadius)) errors.push(`${path} radius is invalid.`)
}
function bounds(cx: number, cy: number, r: number, width: number, height: number, path: string, errors: string[]) {
  if (cx - r < 0 || cx + r > width || cy - r < 0 || cy + r > height) errors.push(`${path} exceeds the visual canvas.`)
}
function angles(value: Row, path: string, errors: string[]) {
  if (!bounded(value.startAngle, -720, 720) || !bounded(value.endAngle, -720, 720)) errors.push(`${path} angles are invalid.`)
  if (finite(value.startAngle) && finite(value.endAngle)) {
    const span = Math.abs(value.endAngle - value.startAngle)
    if (span < 0.001 || span > 360.001) errors.push(`${path} angle span is invalid.`)
  }
}

function primitive(value: unknown, width: number, height: number, index: number, errors: string[]) {
  const path = `visual.primitives[${index}]`
  const candidate = object(value)
  if (!candidate) { errors.push(`${path} must be an object.`); return }
  const type = candidate.type
  const allowedTypes = ['point', 'segment', 'dashedSegment', 'polygon', 'circle', 'arc', 'angleArc', 'textLabel', 'tickMark', 'equalSideMark', 'parallelMark', 'perpendicularMark', 'arrow', 'cartesianAxes', 'cartesianPlot']
  if (typeof type !== 'string' || !allowedTypes.includes(type)) { errors.push(`${path}.type is unsupported.`); return }
  switch (type) {
    case 'point':
      unexpected(candidate, ['type', 'x', 'y', 'radius', 'color', 'strokeWidth'], path, errors)
      if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height)) errors.push(`${path} coordinates are invalid.`)
      if (has(candidate, 'radius') && !bounded(candidate.radius, 0.5, 40)) errors.push(`${path}.radius is invalid.`)
      common(candidate, path, errors); return
    case 'segment':
    case 'dashedSegment':
    case 'arrow':
      unexpected(candidate, ['type', 'x1', 'y1', 'x2', 'y2', 'color', 'strokeWidth'], path, errors)
      line(candidate, width, height, path, errors); return
    case 'polygon':
      unexpected(candidate, ['type', 'points', 'color', 'fill', 'strokeWidth'], path, errors)
      if (!Array.isArray(candidate.points) || candidate.points.length < 3 || candidate.points.length > 12) errors.push(`${path}.points must contain 3–12 points.`)
      if (Array.isArray(candidate.points)) candidate.points.forEach((entry, pointIndex) => point(entry, width, height, `${path}.points[${pointIndex}]`, errors))
      common(candidate, path, errors); return
    case 'circle':
      unexpected(candidate, ['type', 'cx', 'cy', 'radius', 'color', 'fill', 'strokeWidth'], path, errors)
      if (!bounded(candidate.cx, 0, width) || !bounded(candidate.cy, 0, height)) errors.push(`${path}.center is invalid.`)
      radius(candidate.radius, `${path}.radius`, errors)
      if (finite(candidate.cx) && finite(candidate.cy) && finite(candidate.radius)) bounds(candidate.cx, candidate.cy, candidate.radius, width, height, path, errors)
      common(candidate, path, errors); return
    case 'arc':
      unexpected(candidate, ['type', 'cx', 'cy', 'radius', 'startAngle', 'endAngle', 'color', 'strokeWidth'], path, errors)
      if (!bounded(candidate.cx, 0, width) || !bounded(candidate.cy, 0, height)) errors.push(`${path}.center is invalid.`)
      radius(candidate.radius, `${path}.radius`, errors); angles(candidate, path, errors)
      if (finite(candidate.cx) && finite(candidate.cy) && finite(candidate.radius)) bounds(candidate.cx, candidate.cy, candidate.radius, width, height, path, errors)
      common(candidate, path, errors); return
    case 'angleArc': {
      unexpected(candidate, ['type', 'vertex', 'radius', 'startAngle', 'endAngle', 'color', 'strokeWidth'], path, errors)
      const vertex = object(candidate.vertex)
      if (!vertex) errors.push(`${path}.vertex is invalid.`)
      else point(vertex, width, height, `${path}.vertex`, errors)
      radius(candidate.radius, `${path}.radius`, errors); angles(candidate, path, errors)
      if (vertex && finite(vertex.x) && finite(vertex.y) && finite(candidate.radius)) bounds(vertex.x, vertex.y, candidate.radius, width, height, path, errors)
      common(candidate, path, errors); return
    }
    case 'textLabel':
      unexpected(candidate, ['type', 'x', 'y', 'text', 'color', 'textSize', 'anchor'], path, errors)
      if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height)) errors.push(`${path} coordinates are invalid.`)
      if (!plainText(candidate.text, ASSESSMENT_VISUAL_LIMITS.maxLabelLength)) errors.push(`${path}.text is invalid.`)
      if (has(candidate, 'textSize') && !['small', 'medium', 'large'].includes(String(candidate.textSize))) errors.push(`${path}.textSize is unsupported.`)
      if (has(candidate, 'anchor') && !['start', 'middle', 'end'].includes(String(candidate.anchor))) errors.push(`${path}.anchor is unsupported.`)
      common(candidate, path, errors); return
    case 'tickMark':
    case 'equalSideMark':
    case 'parallelMark':
      unexpected(candidate, ['type', 'x1', 'y1', 'x2', 'y2', 'count', 'color', 'strokeWidth'], path, errors)
      line(candidate, width, height, path, errors)
      if (has(candidate, 'count') && ![1, 2, 3].includes(Number(candidate.count))) errors.push(`${path}.count is unsupported.`)
      return
    case 'perpendicularMark':
      unexpected(candidate, ['type', 'x', 'y', 'angle', 'size', 'color', 'strokeWidth'], path, errors)
      if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height)) errors.push(`${path}.coordinates are invalid.`)
      if (!bounded(candidate.angle, -720, 720) || !bounded(candidate.size, 2, 80)) errors.push(`${path} dimensions are invalid.`)
      common(candidate, path, errors); return
    case 'cartesianAxes':
      unexpected(candidate, ['type', 'axisId', 'x', 'y', 'width', 'height', 'xMin', 'xMax', 'yMin', 'yMax', 'xTick', 'yTick', 'showGrid', 'xLabel', 'yLabel', 'color', 'strokeWidth'], path, errors)
      if (!plainText(candidate.axisId, 80)) errors.push(`${path}.axisId is invalid.`)
      if (!bounded(candidate.x, 0, width) || !bounded(candidate.y, 0, height) || !bounded(candidate.width, 80, width) || !bounded(candidate.height, 80, height)) errors.push(`${path} plot rectangle is invalid.`)
      if (finite(candidate.x) && finite(candidate.y) && finite(candidate.width) && finite(candidate.height) && (candidate.x + candidate.width > width || candidate.y + candidate.height > height)) errors.push(`${path} plot rectangle exceeds the visual canvas.`)
      if (![candidate.xMin, candidate.xMax, candidate.yMin, candidate.yMax].every((entry) => bounded(entry, -10000, 10000))) errors.push(`${path} mathematical bounds are invalid.`)
      if (finite(candidate.xMin) && finite(candidate.xMax) && !(candidate.xMin < 0 && candidate.xMax > 0 && candidate.xMin < candidate.xMax)) errors.push(`${path} x bounds must straddle zero.`)
      if (finite(candidate.yMin) && finite(candidate.yMax) && !(candidate.yMin < 0 && candidate.yMax > 0 && candidate.yMin < candidate.yMax)) errors.push(`${path} y bounds must straddle zero.`)
      if (has(candidate, 'xTick') && !bounded(candidate.xTick, 0.000001, 10000)) errors.push(`${path}.xTick is invalid.`)
      if (has(candidate, 'yTick') && !bounded(candidate.yTick, 0.000001, 10000)) errors.push(`${path}.yTick is invalid.`)
      if (has(candidate, 'showGrid') && typeof candidate.showGrid !== 'boolean') errors.push(`${path}.showGrid must be boolean.`)
      if (has(candidate, 'xLabel') && !plainText(candidate.xLabel, 40)) errors.push(`${path}.xLabel is invalid.`)
      if (has(candidate, 'yLabel') && !plainText(candidate.yLabel, 40)) errors.push(`${path}.yLabel is invalid.`)
      common(candidate, path, errors); return
    case 'cartesianPlot':
      unexpected(candidate, ['type', 'axisId', 'points', 'showPoints', 'dashed', 'color', 'strokeWidth'], path, errors)
      if (!plainText(candidate.axisId, 80)) errors.push(`${path}.axisId is invalid.`)
      if (!Array.isArray(candidate.points) || candidate.points.length < 2 || candidate.points.length > 160) errors.push(`${path}.points count is invalid.`)
      if (Array.isArray(candidate.points)) candidate.points.forEach((entry, pointIndex) => {
        const plotPoint = object(entry)
        if (!plotPoint) { errors.push(`${path}.points[${pointIndex}] must be an object.`); return }
        unexpected(plotPoint, ['x', 'y'], `${path}.points[${pointIndex}]`, errors)
        if (!bounded(plotPoint.x, -10000, 10000) || !bounded(plotPoint.y, -10000, 10000)) errors.push(`${path}.points[${pointIndex}] coordinates are invalid.`)
      })
      if (has(candidate, 'showPoints') && typeof candidate.showPoints !== 'boolean') errors.push(`${path}.showPoints must be boolean.`)
      if (has(candidate, 'dashed') && typeof candidate.dashed !== 'boolean') errors.push(`${path}.dashed must be boolean.`)
      common(candidate, path, errors); return
    default: return
  }
}

export type AssessmentVisualValidationResult = { valid: boolean; errors: string[] }

export function validateAssessmentVisual(value: unknown): AssessmentVisualValidationResult {
  const errors: string[] = []
  if (value === null) return { valid: true, errors }
  const candidate = object(value)
  if (!candidate) return { valid: false, errors: ['visual must be null or an object.'] }
  unexpected(candidate, ['id', 'kind', 'version', 'width', 'height', 'altText', 'primitives'], 'visual', errors)
  if (!plainText(candidate.id, ASSESSMENT_VISUAL_LIMITS.maxIdLength)) errors.push('visual.id is invalid.')
  if (candidate.kind !== 'geometry') errors.push('visual.kind must be geometry.')
  if (candidate.version !== 1) errors.push('visual.version must be 1.')
  if (!bounded(candidate.width, ASSESSMENT_VISUAL_LIMITS.minWidth, ASSESSMENT_VISUAL_LIMITS.maxWidth)) errors.push('visual.width is invalid.')
  if (!bounded(candidate.height, ASSESSMENT_VISUAL_LIMITS.minHeight, ASSESSMENT_VISUAL_LIMITS.maxHeight)) errors.push('visual.height is invalid.')
  if (!plainText(candidate.altText, ASSESSMENT_VISUAL_LIMITS.maxAltTextLength)) errors.push('visual.altText is invalid.')
  if (!Array.isArray(candidate.primitives) || candidate.primitives.length < 1 || candidate.primitives.length > ASSESSMENT_VISUAL_LIMITS.maxPrimitives) errors.push('visual.primitives count is invalid.')
  if (Array.isArray(candidate.primitives) && finite(candidate.width) && finite(candidate.height)) {
    candidate.primitives.forEach((entry, index) => primitive(entry, candidate.width as number, candidate.height as number, index, errors))
    const axes = new Map<string, Row>()
    candidate.primitives.forEach((entry, index) => {
      const value = object(entry)
      if (!value || value.type !== 'cartesianAxes' || typeof value.axisId !== 'string') return
      const key = value.axisId.normalize('NFKC').trim()
      if (axes.has(key)) errors.push(`visual.primitives[${index}].axisId must be unique.`)
      else axes.set(key, value)
    })
    candidate.primitives.forEach((entry, index) => {
      const value = object(entry)
      if (!value || value.type !== 'cartesianPlot' || typeof value.axisId !== 'string') return
      const axis = axes.get(value.axisId.normalize('NFKC').trim())
      if (!axis) { errors.push(`visual.primitives[${index}].axisId does not reference Cartesian axes.`); return }
      if (!Array.isArray(value.points) || !finite(axis.xMin) || !finite(axis.xMax) || !finite(axis.yMin) || !finite(axis.yMax)) return
      for (const rawPoint of value.points) {
        const pointValue = object(rawPoint)
        if (!pointValue || !finite(pointValue.x) || !finite(pointValue.y)) continue
        if (pointValue.x < axis.xMin || pointValue.x > axis.xMax || pointValue.y < axis.yMin || pointValue.y > axis.yMax) {
          errors.push(`visual.primitives[${index}] points exceed the referenced Cartesian bounds.`)
          break
        }
      }
    })
  }
  return { valid: errors.length === 0, errors }
}

export function assertAssessmentVisual(value: unknown): asserts value is Record<string, unknown> | null {
  const result = validateAssessmentVisual(value)
  if (!result.valid) throw new Error(`The AI visual was invalid. ${result.errors.slice(0, 3).join(' ')}`)
}
