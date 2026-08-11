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

function normalizedPoint(value: unknown): Row | null {
  const candidate = object(value)
  if (candidate && keys(candidate).length === 2 && keys(candidate).every((key) => key === 'x' || key === 'y') && finite(candidate.x) && finite(candidate.y)) {
    return { x: candidate.x, y: candidate.y }
  }
  if (Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1])) {
    return { x: value[0], y: value[1] }
  }
  return null
}

function normalizedPointList(value: unknown) {
  if (!Array.isArray(value)) return value
  return value.map((entry) => normalizedPoint(entry) ?? entry)
}

function adoptEndpointAliases(candidate: Row, firstKey: 'start' | 'from', secondKey: 'end' | 'to') {
  if (!has(candidate, firstKey) && !has(candidate, secondKey)) return
  const first = normalizedPoint(candidate[firstKey])
  const second = normalizedPoint(candidate[secondKey])
  const lacksCanonicalEndpoints = !['x1', 'y1', 'x2', 'y2'].some((key) => has(candidate, key))
  if (!first || !second || !lacksCanonicalEndpoints) return
  candidate.x1 = first.x
  candidate.y1 = first.y
  candidate.x2 = second.x
  candidate.y2 = second.y
  delete candidate[firstKey]
  delete candidate[secondKey]
}

/**
 * Normalize a deliberately tiny set of harmless provider aliases before the
 * strict visual validator runs. This is not a permissive parser: conflicting
 * aliases, unknown properties, unknown primitive types, and invalid values are
 * retained so validation still rejects them.
 */
export function normalizeAssessmentVisualProviderOutput(value: unknown): unknown {
  const source = object(value)
  if (!source) return value
  const result: Row = { ...source }
  if (!Array.isArray(source.primitives)) return result
  result.primitives = source.primitives.map((rawPrimitive) => {
    const sourcePrimitive = object(rawPrimitive)
    if (!sourcePrimitive) return rawPrimitive
    const candidate: Row = { ...sourcePrimitive }
    const aliasTypes: Record<string, string> = {
      line: 'segment',
      dashedLine: 'dashedSegment',
      label: 'textLabel',
    }
    if (typeof candidate.type === 'string' && aliasTypes[candidate.type]) candidate.type = aliasTypes[candidate.type]

    if (candidate.type === 'polygon' && has(candidate, 'vertices') && !has(candidate, 'points')) {
      candidate.points = normalizedPointList(candidate.vertices)
      delete candidate.vertices
    } else if (has(candidate, 'points')) {
      candidate.points = normalizedPointList(candidate.points)
    }

    if (['segment', 'dashedSegment', 'arrow', 'tickMark', 'equalSideMark', 'parallelMark'].includes(String(candidate.type))) {
      adoptEndpointAliases(candidate, 'start', 'end')
      adoptEndpointAliases(candidate, 'from', 'to')
    }

    if (['circle', 'arc'].includes(String(candidate.type)) && has(candidate, 'center') && !has(candidate, 'cx') && !has(candidate, 'cy')) {
      const center = normalizedPoint(candidate.center)
      if (center) {
        candidate.cx = center.x
        candidate.cy = center.y
        delete candidate.center
      }
    }

    if (candidate.type === 'angleArc' && Array.isArray(candidate.vertex)) {
      candidate.vertex = normalizedPoint(candidate.vertex) ?? candidate.vertex
    }

    if (['point', 'textLabel', 'perpendicularMark'].includes(String(candidate.type)) && has(candidate, 'position') && !has(candidate, 'x') && !has(candidate, 'y')) {
      const position = normalizedPoint(candidate.position)
      if (position) {
        candidate.x = position.x
        candidate.y = position.y
        delete candidate.position
      }
    }
    return candidate
  })
  return result
}

type Coordinate = { x: number; y: number }

function coordinateValue(value: unknown): Coordinate | null {
  const candidate = object(value)
  return candidate && finite(candidate.x) && finite(candidate.y) ? { x: candidate.x, y: candidate.y } : null
}

function distance(first: Coordinate, second: Coordinate) {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function signedArea(points: Coordinate[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0) / 2
}

function orientation(first: Coordinate, second: Coordinate, third: Coordinate) {
  return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x)
}

function between(value: number, first: number, second: number) {
  return value >= Math.min(first, second) - 1e-7 && value <= Math.max(first, second) + 1e-7
}

function segmentsIntersect(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate) {
  const abC = orientation(a, b, c); const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a); const cdB = orientation(c, d, b)
  if ((abC > 1e-7 && abD < -1e-7 || abC < -1e-7 && abD > 1e-7)
    && (cdA > 1e-7 && cdB < -1e-7 || cdA < -1e-7 && cdB > 1e-7)) return true
  if (Math.abs(abC) <= 1e-7 && between(c.x, a.x, b.x) && between(c.y, a.y, b.y)) return true
  if (Math.abs(abD) <= 1e-7 && between(d.x, a.x, b.x) && between(d.y, a.y, b.y)) return true
  if (Math.abs(cdA) <= 1e-7 && between(a.x, c.x, d.x) && between(a.y, c.y, d.y)) return true
  if (Math.abs(cdB) <= 1e-7 && between(b.x, c.x, d.x) && between(b.y, c.y, d.y)) return true
  return false
}

function polygonSelfIntersects(points: Coordinate[]) {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length
      if (first === second || firstNext === second || secondNext === first) continue
      if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) return true
    }
  }
  return false
}

function visualQuality(candidate: Row, width: number, height: number, errors: string[]) {
  if (!Array.isArray(candidate.primitives)) return
  const minimumLength = Math.max(10, Math.min(width, height) * 0.035)
  const minimumRadius = Math.max(8, Math.min(width, height) * 0.025)
  const footprint: Coordinate[] = []
  let structuralPrimitives = 0
  const axes = new Map<string, Row>()

  candidate.primitives.forEach((rawPrimitive, index) => {
    const value = object(rawPrimitive)
    if (!value) return
    const path = `visual.primitives[${index}]`
    if (['segment', 'dashedSegment', 'arrow'].includes(String(value.type)) && [value.x1, value.y1, value.x2, value.y2].every(finite)) {
      structuralPrimitives += 1
      const first = { x: value.x1 as number, y: value.y1 as number }; const second = { x: value.x2 as number, y: value.y2 as number }
      footprint.push(first, second)
      if (distance(first, second) < minimumLength) errors.push(`${path} is too short to remain readable in a printed test.`)
    } else if (value.type === 'polygon' && Array.isArray(value.points)) {
      const points = value.points.map(coordinateValue)
      if (points.every((entry): entry is Coordinate => entry !== null) && points.length >= 3) {
        structuralPrimitives += 1
        footprint.push(...points)
        if (points.some((point, pointIndex) => distance(point, points[(pointIndex + 1) % points.length]) < minimumLength)) errors.push(`${path} contains a tiny or repeated edge.`)
        if (Math.abs(signedArea(points)) < Math.max(100, width * height * 0.003)) errors.push(`${path} is degenerate or too small to read.`)
        if (polygonSelfIntersects(points)) errors.push(`${path} is self-crossing; use a simple polygon unless the question explicitly needs intersecting segments.`)
      }
    } else if ((value.type === 'circle' || value.type === 'arc') && finite(value.cx) && finite(value.cy) && finite(value.radius)) {
      structuralPrimitives += 1
      const radiusValue = value.radius as number
      footprint.push({ x: (value.cx as number) - radiusValue, y: (value.cy as number) - radiusValue }, { x: (value.cx as number) + radiusValue, y: (value.cy as number) + radiusValue })
      if (radiusValue < minimumRadius) errors.push(`${path} is too small to remain readable in a printed test.`)
    } else if (value.type === 'cartesianAxes' && finite(value.x) && finite(value.y) && finite(value.width) && finite(value.height)) {
      structuralPrimitives += 1
      footprint.push({ x: value.x as number, y: value.y as number }, { x: (value.x as number) + (value.width as number), y: (value.y as number) + (value.height as number) })
      if ((value.width as number) < width * 0.35 || (value.height as number) < height * 0.35) errors.push(`${path} is too small for readable axes, ticks, and labels.`)
      if (typeof value.axisId === 'string') axes.set(value.axisId.normalize('NFKC').trim(), value)
    } else if (value.type === 'cartesianPlot') {
      structuralPrimitives += 1
    }
  })

  candidate.primitives.forEach((rawPrimitive, index) => {
    const value = object(rawPrimitive)
    if (!value || value.type !== 'cartesianPlot' || !Array.isArray(value.points) || typeof value.axisId !== 'string') return
    const points = value.points.map(coordinateValue)
    const axis = axes.get(value.axisId.normalize('NFKC').trim())
    if (!axis || !points.every((entry): entry is Coordinate => entry !== null) || points.length < 2) return
    const xValues = points.map((point) => point.x); const yValues = points.map((point) => point.y)
    const xRange = finite(axis.xMin) && finite(axis.xMax) ? (axis.xMax as number) - (axis.xMin as number) : 0
    const yRange = finite(axis.yMin) && finite(axis.yMax) ? (axis.yMax as number) - (axis.yMin as number) : 0
    const xCoverage = xRange > 0 ? (Math.max(...xValues) - Math.min(...xValues)) / xRange : 0
    const yCoverage = yRange > 0 ? (Math.max(...yValues) - Math.min(...yValues)) / yRange : 0
    if (Math.max(xCoverage, yCoverage) < 0.08) errors.push(`visual.primitives[${index}] is degenerate or too small to read on its Cartesian axes.`)
  })

  if (structuralPrimitives === 0) errors.push('visual.primitives must include meaningful mathematical line work, a shape, or Cartesian axes; labels and marks alone are not a diagram.')
  if (footprint.length) {
    const xs = footprint.map((point) => point.x); const ys = footprint.map((point) => point.y)
    const contentDiagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    if (contentDiagonal < Math.max(48, Math.hypot(width, height) * 0.18)) errors.push('visual content is too small for the canvas and would print poorly.')
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
  if (!plainText(candidate.altText, ASSESSMENT_VISUAL_LIMITS.maxAltTextLength)
    || /^(?:image|diagram)$/iu.test(typeof candidate.altText === 'string' ? candidate.altText.normalize('NFKC').trim() : '')) errors.push('visual.altText must be useful observable plain text, not a generic image label.')
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
    visualQuality(candidate, candidate.width as number, candidate.height as number, errors)
  }
  return { valid: errors.length === 0, errors }
}

export function assertAssessmentVisual(value: unknown): asserts value is Record<string, unknown> | null {
  const result = validateAssessmentVisual(value)
  if (!result.valid) throw new Error(`The AI visual was invalid. ${result.errors.slice(0, 3).join(' ')}`)
}
