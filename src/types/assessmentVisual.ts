/**
 * Safe, print-friendly assessment diagrams.
 *
 * The visual schema is intentionally small.  It is a data model, not an
 * SVG/HTML escape hatch: renderers choose every stroke, colour, marker, and
 * font themselves.  Coordinates are expressed in the visual's fixed logical
 * canvas and are validated before they reach a renderer.
 */

export type AssessmentVisualColor =
  | 'ink'
  | 'blue'
  | 'red'
  | 'green'
  | 'gold'
  | 'purple'
  | 'gray'

export type AssessmentVisualStrokeWidth = 1 | 2 | 3

export type AssessmentVisualRequirement = 'none' | 'helpful' | 'required'
export type AssessmentVisualStatus = 'not_required' | 'pending' | 'running' | 'succeeded' | 'failed' | 'stale'
export type AssessmentVisualTextSize = 'small' | 'medium' | 'large'
export type AssessmentVisualTextAnchor = 'start' | 'middle' | 'end'

export type AssessmentVisualPoint = {
  type: 'point'
  x: number
  y: number
  radius?: number
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualSegment = {
  type: 'segment'
  x1: number
  y1: number
  x2: number
  y2: number
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualDashedSegment = {
  type: 'dashedSegment'
  x1: number
  y1: number
  x2: number
  y2: number
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualPolygon = {
  type: 'polygon'
  points: Array<{ x: number; y: number }>
  color?: AssessmentVisualColor
  fill?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualCircle = {
  type: 'circle'
  cx: number
  cy: number
  radius: number
  color?: AssessmentVisualColor
  fill?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualArc = {
  type: 'arc'
  cx: number
  cy: number
  radius: number
  startAngle: number
  endAngle: number
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualAngleArc = {
  type: 'angleArc'
  vertex: { x: number; y: number }
  radius: number
  startAngle: number
  endAngle: number
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualTextLabel = {
  type: 'textLabel'
  x: number
  y: number
  text: string
  color?: AssessmentVisualColor
  textSize?: AssessmentVisualTextSize
  anchor?: AssessmentVisualTextAnchor
}

export type AssessmentVisualTickMark = {
  type: 'tickMark'
  x1: number
  y1: number
  x2: number
  y2: number
  count?: 1 | 2 | 3
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualEqualSideMark = {
  type: 'equalSideMark'
  x1: number
  y1: number
  x2: number
  y2: number
  count?: 1 | 2 | 3
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualParallelMark = {
  type: 'parallelMark'
  x1: number
  y1: number
  x2: number
  y2: number
  count?: 1 | 2 | 3
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualPerpendicularMark = {
  type: 'perpendicularMark'
  x: number
  y: number
  angle: number
  size: number
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualArrow = {
  type: 'arrow'
  x1: number
  y1: number
  x2: number
  y2: number
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}


export type AssessmentVisualCartesianAxes = {
  type: 'cartesianAxes'
  /** Stable identifier used by cartesianPlot primitives in the same visual. */
  axisId: string
  /** Plot rectangle in the visual canvas. */
  x: number
  y: number
  width: number
  height: number
  /** Mathematical bounds. Zero must lie inside both ranges. */
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  xTick?: number
  yTick?: number
  showGrid?: boolean
  xLabel?: string
  yLabel?: string
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualCartesianPlot = {
  type: 'cartesianPlot'
  axisId: string
  /** Sampled mathematical coordinates; GuroDesk never evaluates arbitrary formulas. */
  points: Array<{ x: number; y: number }>
  showPoints?: boolean
  dashed?: boolean
  color?: AssessmentVisualColor
  strokeWidth?: AssessmentVisualStrokeWidth
}

export type AssessmentVisualElement =
  | AssessmentVisualPoint
  | AssessmentVisualSegment
  | AssessmentVisualPolygon
  | AssessmentVisualCircle
  | AssessmentVisualArc
  | AssessmentVisualAngleArc
  | AssessmentVisualTextLabel
  | AssessmentVisualTickMark
  | AssessmentVisualEqualSideMark
  | AssessmentVisualParallelMark
  | AssessmentVisualPerpendicularMark
  | AssessmentVisualArrow
  | AssessmentVisualDashedSegment
  | AssessmentVisualCartesianAxes
  | AssessmentVisualCartesianPlot

export type AssessmentVisual = {
  /** Stable visual identity within the assessment item. */
  id: string
  kind: 'geometry'
  version: 1
  width: number
  height: number
  altText: string
  primitives: AssessmentVisualElement[]
}

export const ASSESSMENT_VISUAL_TYPES: readonly AssessmentVisualElement['type'][] = [
  'point',
  'segment',
  'polygon',
  'circle',
  'arc',
  'angleArc',
  'textLabel',
  'tickMark',
  'equalSideMark',
  'parallelMark',
  'perpendicularMark',
  'arrow',
  'dashedSegment',
  'cartesianAxes',
  'cartesianPlot',
] as const

/** The only colours a visual renderer may use. */
export const ASSESSMENT_VISUAL_PALETTE: Readonly<Record<AssessmentVisualColor, string>> = {
  ink: '#1f2937',
  blue: '#1d4ed8',
  red: '#b91c1c',
  green: '#166534',
  gold: '#92400e',
  purple: '#6b21a8',
  gray: '#64748b',
}
