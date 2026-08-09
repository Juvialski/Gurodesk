import type { ReactNode } from 'react'
import { ASSESSMENT_VISUAL_FIXTURES } from '../lib/assessmentVisualFixtures'
import { validateAssessmentVisual } from '../lib/assessmentVisualValidation'
import type {
  AssessmentVisual,
  AssessmentVisualColor,
  AssessmentVisualElement,
} from '../types/assessmentVisual'
import { ASSESSMENT_VISUAL_PALETTE } from '../types/assessmentVisual'

const TEXT_SIZES = { small: 12, medium: 16, large: 22 } as const
const EMPTY_FILL = 'none'

function safeNumber(value: number) { return Number.isFinite(value) ? value : 0 }
function color(value: AssessmentVisualColor | undefined) { return ASSESSMENT_VISUAL_PALETTE[value ?? 'ink'] }
function fill(value: AssessmentVisualColor | undefined) { return value ? ASSESSMENT_VISUAL_PALETTE[value] : EMPTY_FILL }
function width(value: number | undefined) { return value ?? 2 }
function strokeWidthFor(element: AssessmentVisualElement) { return 'strokeWidth' in element ? width(element.strokeWidth) : 2 }
function pointString(point: { x: number; y: number }) { return `${safeNumber(point.x)},${safeNumber(point.y)}` }

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const span = endAngle - startAngle
  const direction = span >= 0 ? 1 : -1
  const amount = Math.abs(span)
  const start = polar(cx, cy, radius, startAngle)
  if (amount >= 359.5) {
    const midpoint = polar(cx, cy, radius, startAngle + direction * 180)
    const firstEnd = polar(cx, cy, radius, startAngle + direction * 179.75)
    const secondEnd = polar(cx, cy, radius, startAngle + direction * 359.5)
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 ${direction > 0 ? 1 : 0} ${firstEnd.x} ${firstEnd.y} A ${radius} ${radius} 0 1 ${direction > 0 ? 1 : 0} ${secondEnd.x} ${secondEnd.y} L ${midpoint.x} ${midpoint.y}`
  }
  const end = polar(cx, cy, radius, endAngle)
  const largeArc = amount > 180 ? 1 : 0
  const sweep = direction > 0 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`
}

function segmentBasis(element: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = element.x2 - element.x1
  const dy = element.y2 - element.y1
  const length = Math.hypot(dx, dy) || 1
  return { ux: dx / length, uy: dy / length, px: -dy / length, py: dx / length, length }
}

function markLines(element: { x1: number; y1: number; x2: number; y2: number; count?: 1 | 2 | 3 }, kind: 'tick' | 'equal' | 'parallel') {
  const basis = segmentBasis(element)
  const count = element.count ?? 1
  const midX = (element.x1 + element.x2) / 2
  const midY = (element.y1 + element.y2) / 2
  const gap = 11
  const half = 8
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * gap
    const cx = midX + basis.ux * offset
    const cy = midY + basis.uy * offset
    if (kind === 'parallel') {
      const tipX = cx + basis.ux * half
      const tipY = cy + basis.uy * half
      lines.push({ x1: tipX - basis.px * half, y1: tipY - basis.py * half, x2: cx, y2: cy })
      lines.push({ x1: cx, y1: cy, x2: tipX + basis.px * half, y2: tipY + basis.py * half })
    } else {
      lines.push({ x1: cx - basis.px * half, y1: cy - basis.py * half, x2: cx + basis.px * half, y2: cy + basis.py * half })
    }
  }
  return lines
}

function linesForElement(element: AssessmentVisualElement, index: number): ReactNode {
  const stroke = color(element.color)
  const strokeWidth = strokeWidthFor(element)
  if (element.type === 'tickMark' || element.type === 'equalSideMark' || element.type === 'parallelMark') {
    return <g key={index} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">{markLines(element, element.type === 'parallelMark' ? 'parallel' : element.type === 'equalSideMark' ? 'equal' : 'tick').map((line, lineIndex) => <line key={lineIndex} {...line} />)}</g>
  }
  return null
}

function renderElement(element: AssessmentVisualElement, index: number) {
  const stroke = color(element.color)
  const strokeWidth = strokeWidthFor(element)
  const common = { stroke, strokeWidth, vectorEffect: 'non-scaling-stroke' as const }
  switch (element.type) {
    case 'point':
      return <circle key={index} cx={element.x} cy={element.y} r={element.radius ?? 4} {...common} fill={stroke} />
    case 'segment':
      return <line key={index} x1={element.x1} y1={element.y1} x2={element.x2} y2={element.y2} {...common} fill="none" strokeLinecap="round" />
    case 'dashedSegment':
      return <line key={index} x1={element.x1} y1={element.y1} x2={element.x2} y2={element.y2} {...common} fill="none" strokeDasharray="7 5" strokeLinecap="round" />
    case 'arrow': { const radians = Math.atan2(element.y2 - element.y1, element.x2 - element.x1); const back = 11; const wing = 5; const a = { x: element.x2 - back * Math.cos(radians) + wing * Math.sin(radians), y: element.y2 - back * Math.sin(radians) - wing * Math.cos(radians) }; const b = { x: element.x2 - back * Math.cos(radians) - wing * Math.sin(radians), y: element.y2 - back * Math.sin(radians) + wing * Math.cos(radians) }; return <g key={index} {...common} fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1={element.x1} y1={element.y1} x2={element.x2} y2={element.y2} /><polyline points={`${pointString(a)} ${pointString({ x: element.x2, y: element.y2 })} ${pointString(b)}`} /></g> }
    case 'polygon':
      return <polygon key={index} points={element.points.map(pointString).join(' ')} {...common} fill={fill(element.fill)} fillOpacity={element.fill ? 0.12 : 1} strokeLinejoin="round" />
    case 'circle':
      return <circle key={index} cx={element.cx} cy={element.cy} r={element.radius} {...common} fill={fill(element.fill)} fillOpacity={element.fill ? 0.12 : 1} />
    case 'arc':
      return <path key={index} d={arcPath(element.cx, element.cy, element.radius, element.startAngle, element.endAngle)} {...common} fill="none" strokeLinecap="round" />
    case 'angleArc':
      return <path key={index} d={arcPath(element.vertex.x, element.vertex.y, element.radius, element.startAngle, element.endAngle)} {...common} fill="none" strokeLinecap="round" />
    case 'textLabel':
      return <text key={index} x={element.x} y={element.y} fill={stroke} fontFamily="Arial, Helvetica, sans-serif" fontSize={TEXT_SIZES[element.textSize ?? 'medium']} fontWeight="700" textAnchor={element.anchor ?? 'start'}>{element.text}</text>
    case 'perpendicularMark': {
      const radians = element.angle * Math.PI / 180
      const ux = Math.cos(radians); const uy = Math.sin(radians)
      const px = -uy; const py = ux
      const p0 = { x: element.x, y: element.y }
      const p1 = { x: p0.x + ux * element.size, y: p0.y + uy * element.size }
      const p2 = { x: p1.x + px * element.size, y: p1.y + py * element.size }
      const p3 = { x: p0.x + px * element.size, y: p0.y + py * element.size }
      return <polyline key={index} points={[p0, p1, p2, p3].map(pointString).join(' ')} {...common} fill="none" strokeLinejoin="round" />
    }
    case 'tickMark':
    case 'equalSideMark':
    case 'parallelMark':
      return linesForElement(element, index)
    default:
      return null
  }
}

export function AssessmentDiagram({ visual, className = '' }: { visual?: AssessmentVisual; className?: string }) {
  if (!visual || !validateAssessmentVisual(visual).valid) return null
  return <svg className={`assessment-diagram ${className}`.trim()} viewBox={`0 0 ${visual.width} ${visual.height}`} role="img" aria-label={visual.altText} preserveAspectRatio="xMidYMid meet">
    <title>{visual.altText}</title>
    {visual.primitives.map(renderElement)}
  </svg>
}

function appendElement(visual: AssessmentVisual, element: AssessmentVisualElement): AssessmentVisual {
  if (visual.primitives.length >= 80) return visual
  return { ...visual, primitives: [...visual.primitives, element] }
}

export function AssessmentVisualEditor({ visual, disabled = false, onChange }: { visual?: AssessmentVisual; disabled?: boolean; onChange: (visual: AssessmentVisual | undefined) => void }) {
  const validation = visual ? validateAssessmentVisual(visual) : null
  if (!visual) return <div className="assessment-visual-editor" data-testid="assessment-visual-editor"><div className="assessment-visual-editor-heading"><div><span className="assessment-field-label">Geometry visual</span><small>Add a safe, print-friendly diagram that is independent of the question type.</small></div><button className="button secondary" type="button" disabled={disabled} onClick={() => onChange(ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon)}>Add diagram</button></div></div>
  const addPoint = () => onChange(appendElement(visual, { type: 'point', x: visual.width / 2, y: visual.height / 2, color: 'red', radius: 4 }))
  const addLabel = () => onChange(appendElement(visual, { type: 'textLabel', x: visual.width / 2, y: Math.max(18, visual.height / 2 - 14), text: 'A', color: 'ink', textSize: 'medium', anchor: 'middle' }))
  const addPolygon = () => onChange(appendElement(visual, { type: 'polygon', points: [{ x: 70, y: 55 }, { x: visual.width - 70, y: 55 }, { x: visual.width / 2, y: visual.height / 2 }, { x: visual.width - 70, y: visual.height - 55 }, { x: 70, y: visual.height - 55 }], color: 'blue', fill: 'blue', strokeWidth: 2 }))
  return <fieldset className="assessment-visual-editor" data-testid="assessment-visual-editor">
    <legend>Geometry visual</legend>
    <AssessmentDiagram visual={visual} />
    <label className="assessment-visual-alt">Useful alt text<input disabled={disabled} value={visual.altText} onChange={(event) => onChange({ ...visual, altText: event.target.value })} maxLength={240} /></label>
    <div className="assessment-visual-editor-actions">
      <button className="button ghost" type="button" disabled={disabled || visual.primitives.length >= 80} onClick={addPolygon}>Add polygon</button>
      <button className="button ghost" type="button" disabled={disabled || visual.primitives.length >= 80} onClick={addPoint}>Add point</button>
      <button className="button ghost" type="button" disabled={disabled || visual.primitives.length >= 80} onClick={addLabel}>Add label</button>
      <button className="button ghost danger" type="button" disabled={disabled} onClick={() => onChange(undefined)}>Remove diagram</button>
    </div>
    {validation && !validation.valid && <small className="assessment-visual-error">{validation.errors.join(' ')}</small>}
    <small className="assessment-field-help">The canvas, colours, marks, and text are fixed to a safe print palette; diagrams never accept raw SVG, HTML, CSS, scripts, or TikZ.</small>
  </fieldset>
}
