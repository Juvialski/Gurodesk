import type {
  AssessmentVisual,
  AssessmentVisualCartesianAxes,
  AssessmentVisualCartesianPlot,
  AssessmentVisualColor,
  AssessmentVisualElement,
} from '../types/assessmentVisual'
import { validateAssessmentVisual } from './assessmentVisualValidation'
import { validateAssessmentTikzSource } from './assessmentTikzSafety'

const TIKZ_COLOR: Readonly<Record<AssessmentVisualColor, string>> = {
  ink: 'black',
  blue: 'blue!70!black',
  red: 'red!70!black',
  green: 'green!45!black',
  gold: 'orange!65!black',
  purple: 'violet!75!black',
  gray: 'black!55',
}

const TEXT_SIZE = { small: '\\scriptsize', medium: '\\small', large: '\\normalsize' } as const
const ANCHOR = { start: 'west', middle: 'center', end: 'east' } as const

function n(value: number) {
  if (!Number.isFinite(value)) return '0'
  const fixed = Math.round(value * 1000) / 1000
  return Number.isInteger(fixed) ? String(fixed) : String(fixed)
}

/** Escape every TeX-significant character so model labels can never become TeX code. */
export function escapeTikzText(value: string) {
  const escaped: Record<string, string> = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '#': '\\#',
    '$': '\\$',
    '%': '\\%',
    '&': '\\&',
    '_': '\\_',
    '^': '\\^{}',
    '~': '\\~{}',
  }
  return Array.from(value.normalize('NFKC'), (character) => escaped[character] ?? character).join('')
}


function color(value: AssessmentVisualColor | undefined) { return TIKZ_COLOR[value ?? 'ink'] }
function lineWidth(value: number | undefined) { return value === 3 ? '1.2pt' : value === 1 ? '0.45pt' : '0.8pt' }
function point(x: number, y: number) { return `(${n(x)},${n(y)})` }

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function segmentBasis(element: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = element.x2 - element.x1
  const dy = element.y2 - element.y1
  const length = Math.hypot(dx, dy) || 1
  return { ux: dx / length, uy: dy / length, px: -dy / length, py: dx / length }
}

function markLines(element: { x1: number; y1: number; x2: number; y2: number; count?: 1 | 2 | 3 }, parallel: boolean) {
  const basis = segmentBasis(element)
  const count = element.count ?? 1
  const midX = (element.x1 + element.x2) / 2
  const midY = (element.y1 + element.y2) / 2
  const gap = 10
  const half = 7
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * gap
    const cx = midX + basis.ux * offset
    const cy = midY + basis.uy * offset
    if (parallel) {
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

function axisMap(axis: AssessmentVisualCartesianAxes, x: number, y: number) {
  const px = axis.x + ((x - axis.xMin) / (axis.xMax - axis.xMin)) * axis.width
  const py = axis.y + axis.height - ((y - axis.yMin) / (axis.yMax - axis.yMin)) * axis.height
  return { x: px, y: py }
}

function tickValues(min: number, max: number, step: number) {
  const result: number[] = []
  const safeStep = Math.max(Math.abs(step), 1e-6)
  const start = Math.ceil(min / safeStep) * safeStep
  for (let value = start, count = 0; value <= max + safeStep * 1e-8 && count < 80; value += safeStep, count += 1) {
    const rounded = Math.abs(value) < safeStep * 1e-8 ? 0 : Math.round(value * 1e9) / 1e9
    result.push(rounded)
  }
  return result
}

function cartesianAxesTikz(axis: AssessmentVisualCartesianAxes) {
  const lines: string[] = []
  const stroke = color(axis.color)
  const lw = lineWidth(axis.strokeWidth)
  const origin = axisMap(axis, 0, 0)
  const left = axisMap(axis, axis.xMin, 0)
  const right = axisMap(axis, axis.xMax, 0)
  const bottom = axisMap(axis, 0, axis.yMin)
  const top = axisMap(axis, 0, axis.yMax)
  const xTick = axis.xTick ?? 1
  const yTick = axis.yTick ?? 1

  if (axis.showGrid) {
    for (const x of tickValues(axis.xMin, axis.xMax, xTick)) {
      if (x === 0) continue
      const a = axisMap(axis, x, axis.yMin); const b = axisMap(axis, x, axis.yMax)
      lines.push(`\\draw[draw=black!15,line width=0.35pt] ${point(a.x, a.y)} -- ${point(b.x, b.y)};`)
    }
    for (const y of tickValues(axis.yMin, axis.yMax, yTick)) {
      if (y === 0) continue
      const a = axisMap(axis, axis.xMin, y); const b = axisMap(axis, axis.xMax, y)
      lines.push(`\\draw[draw=black!15,line width=0.35pt] ${point(a.x, a.y)} -- ${point(b.x, b.y)};`)
    }
  }

  lines.push(`\\draw[->,draw=${stroke},line width=${lw}] ${point(left.x, left.y)} -- ${point(right.x, right.y)};`)
  lines.push(`\\draw[->,draw=${stroke},line width=${lw}] ${point(bottom.x, bottom.y)} -- ${point(top.x, top.y)};`)

  for (const x of tickValues(axis.xMin, axis.xMax, xTick)) {
    if (x === 0) continue
    const p = axisMap(axis, x, 0)
    lines.push(`\\draw[draw=${stroke},line width=0.45pt] (${n(p.x)},${n(p.y - 3)}) -- (${n(p.x)},${n(p.y + 3)});`)
    lines.push(`\\node[anchor=north,font=\\scriptsize,text=${stroke}] at (${n(p.x)},${n(p.y + 4)}) {${escapeTikzText(String(x))}};`)
  }
  for (const y of tickValues(axis.yMin, axis.yMax, yTick)) {
    if (y === 0) continue
    const p = axisMap(axis, 0, y)
    lines.push(`\\draw[draw=${stroke},line width=0.45pt] (${n(p.x - 3)},${n(p.y)}) -- (${n(p.x + 3)},${n(p.y)});`)
    lines.push(`\\node[anchor=east,font=\\scriptsize,text=${stroke}] at (${n(p.x - 4)},${n(p.y)}) {${escapeTikzText(String(y))}};`)
  }
  lines.push(`\\node[anchor=north east,font=\\scriptsize,text=${stroke}] at (${n(origin.x - 3)},${n(origin.y + 3)}) {0};`)
  if (axis.xLabel) lines.push(`\\node[anchor=west,font=\\small,text=${stroke}] at (${n(right.x - 2)},${n(right.y - 8)}) {${escapeTikzText(axis.xLabel)}};`)
  if (axis.yLabel) lines.push(`\\node[anchor=south,font=\\small,text=${stroke}] at (${n(top.x + 8)},${n(top.y + 2)}) {${escapeTikzText(axis.yLabel)}};`)
  return lines
}

function cartesianPlotTikz(plot: AssessmentVisualCartesianPlot, axes: Map<string, AssessmentVisualCartesianAxes>) {
  const axis = axes.get(plot.axisId)
  if (!axis) return []
  const mapped = plot.points.map((entry) => axisMap(axis, entry.x, entry.y))
  const style = [`draw=${color(plot.color)}`, `line width=${lineWidth(plot.strokeWidth)}`, plot.dashed ? 'dashed' : '', 'line cap=round', 'line join=round'].filter(Boolean).join(',')
  const lines = [`\\draw[${style}] ${mapped.map((entry) => point(entry.x, entry.y)).join(' -- ')};`]
  if (plot.showPoints) for (const entry of mapped) lines.push(`\\fill[${color(plot.color)}] ${point(entry.x, entry.y)} circle (1.8pt);`)
  return lines
}

function primitiveTikz(element: AssessmentVisualElement, axes: Map<string, AssessmentVisualCartesianAxes>): string[] {
  const stroke = 'color' in element ? color(element.color) : 'black'
  const lw = 'strokeWidth' in element ? lineWidth(element.strokeWidth) : '0.8pt'
  switch (element.type) {
    case 'point': return [`\\fill[${stroke}] ${point(element.x, element.y)} circle (${n(element.radius ?? 3)}pt);`]
    case 'segment': return [`\\draw[draw=${stroke},line width=${lw},line cap=round] ${point(element.x1, element.y1)} -- ${point(element.x2, element.y2)};`]
    case 'dashedSegment': return [`\\draw[draw=${stroke},line width=${lw},dashed,line cap=round] ${point(element.x1, element.y1)} -- ${point(element.x2, element.y2)};`]
    case 'arrow': return [`\\draw[->,draw=${stroke},line width=${lw},line cap=round] ${point(element.x1, element.y1)} -- ${point(element.x2, element.y2)};`]
    case 'polygon': {
      const style = [`draw=${stroke}`, `line width=${lw}`, 'line join=round', element.fill ? `fill=${color(element.fill)}!8` : 'fill=none'].join(',')
      return [`\\draw[${style}] ${element.points.map((entry) => point(entry.x, entry.y)).join(' -- ')} -- cycle;`]
    }
    case 'circle': {
      const style = [`draw=${stroke}`, `line width=${lw}`, element.fill ? `fill=${color(element.fill)}!8` : 'fill=none'].join(',')
      return [`\\draw[${style}] ${point(element.cx, element.cy)} circle (${n(element.radius)}pt);`]
    }
    case 'arc': {
      const start = polar(element.cx, element.cy, element.radius, element.startAngle)
      return [`\\draw[draw=${stroke},line width=${lw},line cap=round] ${point(start.x, start.y)} arc[start angle=${n(element.startAngle)},end angle=${n(element.endAngle)},radius=${n(element.radius)}pt];`]
    }
    case 'angleArc': {
      const start = polar(element.vertex.x, element.vertex.y, element.radius, element.startAngle)
      return [`\\draw[draw=${stroke},line width=${lw},line cap=round] ${point(start.x, start.y)} arc[start angle=${n(element.startAngle)},end angle=${n(element.endAngle)},radius=${n(element.radius)}pt];`]
    }
    case 'textLabel': return [`\\node[anchor=${ANCHOR[element.anchor ?? 'start']},font=${TEXT_SIZE[element.textSize ?? 'medium']},text=${stroke},fill=white,fill opacity=.94,text opacity=1,inner sep=1.2pt] at ${point(element.x, element.y)} {${escapeTikzText(element.text)}};`]
    case 'perpendicularMark': {
      const radians = element.angle * Math.PI / 180
      const ux = Math.cos(radians); const uy = Math.sin(radians); const px = -uy; const py = ux
      const p0 = { x: element.x, y: element.y }
      const p1 = { x: p0.x + ux * element.size, y: p0.y + uy * element.size }
      const p2 = { x: p1.x + px * element.size, y: p1.y + py * element.size }
      const p3 = { x: p0.x + px * element.size, y: p0.y + py * element.size }
      return [`\\draw[draw=${stroke},line width=${lw}] ${[p0, p1, p2, p3].map((entry) => point(entry.x, entry.y)).join(' -- ')};`]
    }
    case 'tickMark':
    case 'equalSideMark':
    case 'parallelMark': return markLines(element, element.type === 'parallelMark').map((entry) => `\\draw[draw=${stroke},line width=${lw},line cap=round] ${point(entry.x1, entry.y1)} -- ${point(entry.x2, entry.y2)};`)
    case 'cartesianAxes': return cartesianAxesTikz(element)
    case 'cartesianPlot': return cartesianPlotTikz(element, axes)
    default: return []
  }
}

/**
 * New assessment visuals use the validated TikZ produced by Gemini's dedicated
 * visual call. Legacy structured visuals still compile through the old
 * deterministic serializer so previously saved assessments remain compatible.
 */
export function assessmentVisualTikzSource(visual: AssessmentVisual): string {
  if (!validateAssessmentVisual(visual).valid) return ''
  if (visual.tikzCode) {
    const direct = validateAssessmentTikzSource(visual.tikzCode)
    return direct.valid ? direct.source : ''
  }
  const axes = new Map<string, AssessmentVisualCartesianAxes>()
  for (const element of visual.primitives) if (element.type === 'cartesianAxes') axes.set(element.axisId, element)
  const bodyLines = visual.primitives.flatMap((element) => primitiveTikz(element, axes)).filter(Boolean)
  if (!bodyLines.length) return ''
  const source = [
    '\\begin{tikzpicture}[x=1pt,y=-1pt,line cap=round,line join=round]',
    `\\path[use as bounding box] (0,0) rectangle (${n(visual.width)},${n(visual.height)});`,
    ...bodyLines,
    '\\end{tikzpicture}',
  ].join('\n')
  // This final invariant is intentionally redundant with visual validation:
  // never hand TikZJax a blank/partial source if a future primitive serializer
  // is changed without a matching compiler update.
  if (!source.includes('\\begin{tikzpicture}') || !source.includes('\\end{tikzpicture}') || !/\\(?:draw|fill|node)\[/u.test(source)) return ''
  return source
}
