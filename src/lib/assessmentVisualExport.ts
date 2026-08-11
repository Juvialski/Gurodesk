import { jsPDF } from 'jspdf'
import { ASSESSMENT_VISUAL_PALETTE } from '../types/assessmentVisual'
import type { AssessmentVisual, AssessmentVisualCartesianAxes, AssessmentVisualColor, AssessmentVisualElement } from '../types/assessmentVisual'
import { validateAssessmentVisual } from './assessmentVisualValidation'
import { getAssessmentTikzRenderedPng, getAssessmentTikzRenderedSvg } from './assessmentTikzRenderCache'

export type AssessmentVisualRenderTarget = {
  x: number
  y: number
  width: number
  height: number
}

const TEXT_SIZE = { small: 8, medium: 10, large: 14 } as const

function elementStrokeWidth(element: AssessmentVisualElement) {
  return 'strokeWidth' in element ? element.strokeWidth ?? 2 : 2
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function colorHex(value: AssessmentVisualColor | undefined) {
  return ASSESSMENT_VISUAL_PALETTE[value ?? 'ink']
}

function rgb(value: AssessmentVisualColor | undefined): [number, number, number] {
  const hex = colorHex(value).slice(1)
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)]
}

function lightRgb(value: AssessmentVisualColor | undefined): [number, number, number] {
  return rgb(value).map((channel) => Math.round(channel * 0.12 + 255 * 0.88)) as [number, number, number]
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const span = endAngle - startAngle
  const direction = span >= 0 ? 1 : -1
  const amount = Math.abs(span)
  const start = polar(cx, cy, radius, startAngle)
  const end = polar(cx, cy, radius, endAngle)
  const largeArc = amount > 180 ? 1 : 0
  const sweep = direction > 0 ? 1 : 0
  if (amount >= 359.5) {
    const midpoint = polar(cx, cy, radius, startAngle + direction * 180)
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 ${sweep} ${midpoint.x} ${midpoint.y} A ${radius} ${radius} 0 1 ${sweep} ${start.x} ${start.y}`
  }
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`
}

function segmentBasis(element: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = element.x2 - element.x1
  const dy = element.y2 - element.y1
  const length = Math.hypot(dx, dy) || 1
  return { ux: dx / length, uy: dy / length, px: -dy / length, py: dx / length }
}

function markLines(element: { x1: number; y1: number; x2: number; y2: number; count?: 1 | 2 | 3 }, kind: 'tick' | 'parallel') {
  const basis = segmentBasis(element)
  const count = element.count ?? 1
  const midX = (element.x1 + element.x2) / 2
  const midY = (element.y1 + element.y2) / 2
  const lines: Array<[number, number, number, number]> = []
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 11
    const cx = midX + basis.ux * offset
    const cy = midY + basis.uy * offset
    if (kind === 'parallel') {
      const tipX = cx + basis.ux * 8
      const tipY = cy + basis.uy * 8
      lines.push([tipX - basis.px * 8, tipY - basis.py * 8, cx, cy], [cx, cy, tipX + basis.px * 8, tipY + basis.py * 8])
    } else {
      lines.push([cx - basis.px * 8, cy - basis.py * 8, cx + basis.px * 8, cy + basis.py * 8])
    }
  }
  return lines
}


function cartesianMap(axis: AssessmentVisualCartesianAxes, x: number, y: number) {
  return {
    x: axis.x + ((x - axis.xMin) / (axis.xMax - axis.xMin)) * axis.width,
    y: axis.y + axis.height - ((y - axis.yMin) / (axis.yMax - axis.yMin)) * axis.height,
  }
}

function cartesianTicks(minimum: number, maximum: number, step: number) {
  const values: number[] = []
  const safeStep = Math.max(Math.abs(step), 1e-6)
  const start = Math.ceil(minimum / safeStep) * safeStep
  for (let value = start, count = 0; value <= maximum + safeStep * 1e-8 && count < 80; value += safeStep, count += 1) values.push(Math.abs(value) < safeStep * 1e-8 ? 0 : Math.round(value * 1e9) / 1e9)
  return values
}

function cartesianAxesSvg(axis: AssessmentVisualCartesianAxes, index: number) {
  const stroke = colorHex(axis.color)
  const strokeWidth = axis.strokeWidth ?? 2
  const origin = cartesianMap(axis, 0, 0)
  const left = cartesianMap(axis, axis.xMin, 0); const right = cartesianMap(axis, axis.xMax, 0)
  const bottom = cartesianMap(axis, 0, axis.yMin); const top = cartesianMap(axis, 0, axis.yMax)
  const xTick = axis.xTick ?? 1; const yTick = axis.yTick ?? 1
  const body: string[] = []
  if (axis.showGrid) {
    for (const x of cartesianTicks(axis.xMin, axis.xMax, xTick)) if (x !== 0) { const a = cartesianMap(axis, x, axis.yMin); const b = cartesianMap(axis, x, axis.yMax); body.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#d7dde5" stroke-width="0.7"/>`) }
    for (const y of cartesianTicks(axis.yMin, axis.yMax, yTick)) if (y !== 0) { const a = cartesianMap(axis, axis.xMin, y); const b = cartesianMap(axis, axis.xMax, y); body.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#d7dde5" stroke-width="0.7"/>`) }
  }
  body.push(`<line x1="${left.x}" y1="${left.y}" x2="${right.x}" y2="${right.y}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
  body.push(`<polyline points="${right.x - 8},${right.y - 4} ${right.x},${right.y} ${right.x - 8},${right.y + 4}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
  body.push(`<line x1="${bottom.x}" y1="${bottom.y}" x2="${top.x}" y2="${top.y}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
  body.push(`<polyline points="${top.x - 4},${top.y + 8} ${top.x},${top.y} ${top.x + 4},${top.y + 8}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
  for (const x of cartesianTicks(axis.xMin, axis.xMax, xTick)) if (x !== 0) { const p = cartesianMap(axis, x, 0); body.push(`<line x1="${p.x}" y1="${p.y - 3}" x2="${p.x}" y2="${p.y + 3}" stroke="${stroke}" stroke-width="0.7"/><text x="${p.x}" y="${p.y + 15}" text-anchor="middle" font-size="10" fill="${stroke}">${escapeXml(String(x))}</text>`) }
  for (const y of cartesianTicks(axis.yMin, axis.yMax, yTick)) if (y !== 0) { const p = cartesianMap(axis, 0, y); body.push(`<line x1="${p.x - 3}" y1="${p.y}" x2="${p.x + 3}" y2="${p.y}" stroke="${stroke}" stroke-width="0.7"/><text x="${p.x - 7}" y="${p.y + 3}" text-anchor="end" font-size="10" fill="${stroke}">${escapeXml(String(y))}</text>`) }
  body.push(`<text x="${origin.x - 6}" y="${origin.y + 13}" text-anchor="end" font-size="10" fill="${stroke}">0</text>`)
  if (axis.xLabel) body.push(`<text x="${right.x - 2}" y="${right.y - 8}" font-size="12" fill="${stroke}">${escapeXml(axis.xLabel)}</text>`)
  if (axis.yLabel) body.push(`<text x="${top.x + 8}" y="${top.y + 4}" font-size="12" fill="${stroke}">${escapeXml(axis.yLabel)}</text>`)
  return `<g data-index="${index}" data-axis-id="${escapeXml(axis.axisId)}">${body.join('')}</g>`
}

function svgElement(element: AssessmentVisualElement, index: number, axes: Map<string, AssessmentVisualCartesianAxes>) {
  const stroke = colorHex(element.color)
  const strokeWidth = elementStrokeWidth(element)
  const common = `stroke="${stroke}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"`
  switch (element.type) {
    case 'point': return `<circle data-index="${index}" cx="${element.x}" cy="${element.y}" r="${element.radius ?? 4}" ${common} fill="${stroke}"/>`
    case 'segment': return `<line data-index="${index}" x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" ${common} fill="none"/>`
    case 'dashedSegment': return `<line data-index="${index}" x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" ${common} stroke-dasharray="7 5" fill="none"/>`
    case 'arrow': { const radians = Math.atan2(element.y2 - element.y1, element.x2 - element.x1); const back = 11; const wing = 5; const a = { x: element.x2 - back * Math.cos(radians) + wing * Math.sin(radians), y: element.y2 - back * Math.sin(radians) - wing * Math.cos(radians) }; const b = { x: element.x2 - back * Math.cos(radians) - wing * Math.sin(radians), y: element.y2 - back * Math.sin(radians) + wing * Math.cos(radians) }; return `<g data-index="${index}" ${common} fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}"/><polyline points="${a.x},${a.y} ${element.x2},${element.y2} ${b.x},${b.y}"/></g>` }
    case 'polygon': return `<polygon data-index="${index}" points="${element.points.map((point) => `${point.x},${point.y}`).join(' ')}" ${common} fill="${element.fill ? colorHex(element.fill) : 'none'}" fill-opacity="${element.fill ? '0.12' : '1'}"/>`
    case 'circle': return `<circle data-index="${index}" cx="${element.cx}" cy="${element.cy}" r="${element.radius}" ${common} fill="${element.fill ? colorHex(element.fill) : 'none'}" fill-opacity="${element.fill ? '0.12' : '1'}"/>`
    case 'arc': return `<path data-index="${index}" d="${arcPath(element.cx, element.cy, element.radius, element.startAngle, element.endAngle)}" ${common} fill="none"/>`
    case 'angleArc': return `<path data-index="${index}" d="${arcPath(element.vertex.x, element.vertex.y, element.radius, element.startAngle, element.endAngle)}" ${common} fill="none"/>`
    case 'textLabel': return `<text data-index="${index}" x="${element.x}" y="${element.y}" fill="${stroke}" font-family="Arial, Helvetica, sans-serif" font-size="${TEXT_SIZE[element.textSize ?? 'medium']}" font-weight="700" text-anchor="${element.anchor ?? 'start'}">${escapeXml(element.text)}</text>`
    case 'perpendicularMark': {
      const radians = element.angle * Math.PI / 180
      const ux = Math.cos(radians); const uy = Math.sin(radians); const px = -uy; const py = ux
      const p0 = { x: element.x, y: element.y }
      const p1 = { x: p0.x + ux * element.size, y: p0.y + uy * element.size }
      const p2 = { x: p1.x + px * element.size, y: p1.y + py * element.size }
      const p3 = { x: p0.x + px * element.size, y: p0.y + py * element.size }
      return `<polyline data-index="${index}" points="${[p0, p1, p2, p3].map((point) => `${point.x},${point.y}`).join(' ')}" ${common} fill="none"/>`
    }
    case 'tickMark':
    case 'equalSideMark':
    case 'parallelMark': return markLines(element, element.type === 'parallelMark' ? 'parallel' : 'tick').map((line) => `<line data-index="${index}" x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}" ${common} fill="none"/>`).join('')
    case 'cartesianAxes': return cartesianAxesSvg(element, index)
    case 'cartesianPlot': { const axis = axes.get(element.axisId); if (!axis) return ''; const points = element.points.map((entry) => cartesianMap(axis, entry.x, entry.y)); const circles = element.showPoints ? points.map((entry) => `<circle cx="${entry.x}" cy="${entry.y}" r="3" fill="${stroke}"/>`).join('') : ''; return `<g data-index="${index}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ${element.dashed ? 'stroke-dasharray="7 5"' : ''}><polyline points="${points.map((entry) => `${entry.x},${entry.y}`).join(' ')}"/>${circles}</g>` }
    default: return ''
  }
}

/**
 * Serialize only validated visual primitives. No caller-provided SVG, HTML,
 * style, marker, or attribute text is copied into the output.
 */
export function assessmentVisualSvgMarkup(visual: AssessmentVisual): string {
  if (!validateAssessmentVisual(visual).valid) return ''
  if (visual.tikzCode) return getAssessmentTikzRenderedSvg(visual)
  const axes = new Map<string, AssessmentVisualCartesianAxes>()
  visual.primitives.forEach((element) => { if (element.type === 'cartesianAxes') axes.set(element.axisId, element) })
  const body = visual.primitives.map((element, index) => svgElement(element, index, axes)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${visual.width} ${visual.height}" role="img" aria-label="${escapeXml(visual.altText)}"><title>${escapeXml(visual.altText)}</title>${body}</svg>`
}

function mapped(target: AssessmentVisualRenderTarget, visual: AssessmentVisual, x: number, y: number) {
  return { x: target.x + (x / visual.width) * target.width, y: target.y + (y / visual.height) * target.height }
}

function pdfLine(doc: jsPDF, visual: AssessmentVisual, target: AssessmentVisualRenderTarget, element: { x1: number; y1: number; x2: number; y2: number }, color: AssessmentVisualColor | undefined, strokeWidth: number | undefined) {
  const a = mapped(target, visual, element.x1, element.y1); const b = mapped(target, visual, element.x2, element.y2)
  doc.setDrawColor(...rgb(color)); doc.setLineWidth((strokeWidth ?? 2) * Math.min(target.width / visual.width, target.height / visual.height)); doc.line(a.x, a.y, b.x, b.y)
}

function pdfDash(doc: jsPDF, pattern: number[] | undefined, scale: number) {
  // jsPDF keeps the line-dash state on the document. Always reset it after
  // each primitive so a dashed segment cannot leak into later marks/arcs.
  doc.setLineDashPattern(pattern ? pattern.map((value) => value * scale) : [], 0)
}

function pdfArrow(doc: jsPDF, visual: AssessmentVisual, target: AssessmentVisualRenderTarget, element: Extract<AssessmentVisualElement, { type: 'arrow' }>, color: AssessmentVisualColor | undefined, strokeWidth: number | undefined) {
  const radians = Math.atan2(element.y2 - element.y1, element.x2 - element.x1)
  const back = 10
  const wing = 5
  const tip = { x: element.x2, y: element.y2 }
  const left = { x: tip.x - back * Math.cos(radians) + wing * Math.sin(radians), y: tip.y - back * Math.sin(radians) - wing * Math.cos(radians) }
  const right = { x: tip.x - back * Math.cos(radians) - wing * Math.sin(radians), y: tip.y - back * Math.sin(radians) + wing * Math.cos(radians) }
  pdfLine(doc, visual, target, element, color, strokeWidth)
  pdfLine(doc, visual, target, { x1: tip.x, y1: tip.y, x2: left.x, y2: left.y }, color, strokeWidth)
  pdfLine(doc, visual, target, { x1: tip.x, y1: tip.y, x2: right.x, y2: right.y }, color, strokeWidth)
}

function pdfPolyline(doc: jsPDF, points: Array<{ x: number; y: number }>, color: AssessmentVisualColor | undefined, strokeWidth: number | undefined) {
  doc.setDrawColor(...rgb(color)); doc.setLineWidth(strokeWidth ?? 2)
  for (let index = 1; index < points.length; index += 1) doc.line(points[index - 1].x, points[index - 1].y, points[index].x, points[index].y)
}


function drawCartesianAxesPdf(doc: jsPDF, visual: AssessmentVisual, target: AssessmentVisualRenderTarget, axis: AssessmentVisualCartesianAxes) {
  const scale = Math.min(target.width / visual.width, target.height / visual.height)
  const map = (x: number, y: number) => { const point = cartesianMap(axis, x, y); return mapped(target, visual, point.x, point.y) }
  const stroke = rgb(axis.color)
  const origin = map(0, 0); const left = map(axis.xMin, 0); const right = map(axis.xMax, 0); const bottom = map(0, axis.yMin); const top = map(0, axis.yMax)
  const xTick = axis.xTick ?? 1; const yTick = axis.yTick ?? 1
  if (axis.showGrid) {
    doc.setDrawColor(215, 221, 229); doc.setLineWidth(0.35 * scale)
    for (const x of cartesianTicks(axis.xMin, axis.xMax, xTick)) if (x !== 0) { const a = map(x, axis.yMin); const b = map(x, axis.yMax); doc.line(a.x, a.y, b.x, b.y) }
    for (const y of cartesianTicks(axis.yMin, axis.yMax, yTick)) if (y !== 0) { const a = map(axis.xMin, y); const b = map(axis.xMax, y); doc.line(a.x, a.y, b.x, b.y) }
  }
  doc.setDrawColor(...stroke); doc.setTextColor(...stroke); doc.setLineWidth((axis.strokeWidth ?? 2) * scale)
  doc.line(left.x, left.y, right.x, right.y); doc.line(bottom.x, bottom.y, top.x, top.y)
  doc.setFontSize(Math.max(6, 8 * scale))
  for (const x of cartesianTicks(axis.xMin, axis.xMax, xTick)) if (x !== 0) { const p = map(x, 0); doc.line(p.x, p.y - 2 * scale, p.x, p.y + 2 * scale); doc.text(String(x), p.x, p.y + 8 * scale, { align: 'center' }) }
  for (const y of cartesianTicks(axis.yMin, axis.yMax, yTick)) if (y !== 0) { const p = map(0, y); doc.line(p.x - 2 * scale, p.y, p.x + 2 * scale, p.y); doc.text(String(y), p.x - 4 * scale, p.y + 1.5 * scale, { align: 'right' }) }
  doc.text('0', origin.x - 4 * scale, origin.y + 7 * scale, { align: 'right' })
  if (axis.xLabel) doc.text(axis.xLabel, right.x - 1 * scale, right.y - 4 * scale)
  if (axis.yLabel) doc.text(axis.yLabel, top.x + 4 * scale, top.y + 2 * scale)
}

/** Draw validated primitives directly into the dedicated jsPDF document. */
export function drawAssessmentVisualPdf(doc: jsPDF, visual: AssessmentVisual, target: AssessmentVisualRenderTarget): boolean {
  if (!validateAssessmentVisual(visual).valid || target.width <= 0 || target.height <= 0) return false
  if (visual.tikzCode) {
    const png = getAssessmentTikzRenderedPng(visual)
    if (!png) return false
    doc.addImage(png, 'PNG', target.x, target.y, target.width, target.height, undefined, 'FAST')
    return true
  }
  const scale = Math.min(target.width / visual.width, target.height / visual.height)
  const axes = new Map<string, AssessmentVisualCartesianAxes>()
  visual.primitives.forEach((element) => { if (element.type === 'cartesianAxes') axes.set(element.axisId, element) })
  visual.primitives.forEach((element) => {
    pdfDash(doc, element.type === 'dashedSegment' ? [7, 5] : undefined, scale)
    if (element.type === 'textLabel') {
      const point = mapped(target, visual, element.x, element.y)
      const textAlign = element.anchor === 'middle' ? 'center' : element.anchor === 'end' ? 'right' : 'left'
      doc.setTextColor(...rgb(element.color)); doc.setFontSize((TEXT_SIZE[element.textSize ?? 'medium']) * scale); doc.text(element.text, point.x, point.y, { align: textAlign }); pdfDash(doc, undefined, scale)
      return
    }
    if (element.type === 'point') {
      const point = mapped(target, visual, element.x, element.y); const radius = (element.radius ?? 4) * scale
      doc.setDrawColor(...rgb(element.color)); doc.setFillColor(...rgb(element.color)); doc.setLineWidth((element.strokeWidth ?? 2) * scale); doc.circle(point.x, point.y, radius, 'F'); pdfDash(doc, undefined, scale); return
    }
    if (element.type === 'circle') {
      const point = mapped(target, visual, element.cx, element.cy); const radius = element.radius * scale
      doc.setDrawColor(...rgb(element.color)); doc.setLineWidth((element.strokeWidth ?? 2) * scale); if (element.fill) { doc.setFillColor(...lightRgb(element.fill)); doc.circle(point.x, point.y, radius, 'FD') } else doc.circle(point.x, point.y, radius, 'S'); pdfDash(doc, undefined, scale); return
    }
    if (element.type === 'polygon') {
      const points = element.points.map((point) => mapped(target, visual, point.x, point.y)); pdfPolyline(doc, [...points, points[0]], element.color, (element.strokeWidth ?? 2) * scale); pdfDash(doc, undefined, scale); return
    }
    if (element.type === 'arc' || element.type === 'angleArc') {
      const center = element.type === 'arc' ? element : { cx: element.vertex.x, cy: element.vertex.y, radius: element.radius, startAngle: element.startAngle, endAngle: element.endAngle }
      const steps = Math.max(8, Math.ceil(Math.abs(center.endAngle - center.startAngle) / 12)); const points = Array.from({ length: steps + 1 }, (_, index) => { const angle = center.startAngle + (center.endAngle - center.startAngle) * index / steps; const source = polar(center.cx, center.cy, center.radius, angle); return mapped(target, visual, source.x, source.y) }); pdfPolyline(doc, points, element.color, (element.strokeWidth ?? 2) * scale); pdfDash(doc, undefined, scale); return
    }
    if (element.type === 'perpendicularMark') {
      const radians = element.angle * Math.PI / 180; const ux = Math.cos(radians); const uy = Math.sin(radians); const px = -uy; const py = ux
      const p0 = mapped(target, visual, element.x, element.y); const p1 = mapped(target, visual, element.x + ux * element.size, element.y + uy * element.size); const p2 = mapped(target, visual, element.x + ux * element.size + px * element.size, element.y + uy * element.size + py * element.size); const p3 = mapped(target, visual, element.x + px * element.size, element.y + py * element.size); pdfPolyline(doc, [p0, p1, p2, p3], element.color, (element.strokeWidth ?? 2) * scale); pdfDash(doc, undefined, scale); return
    }
    if (element.type === 'tickMark' || element.type === 'equalSideMark' || element.type === 'parallelMark') {
      markLines(element, element.type === 'parallelMark' ? 'parallel' : 'tick').forEach((line) => pdfLine(doc, visual, target, { x1: line[0], y1: line[1], x2: line[2], y2: line[3] }, element.color, element.strokeWidth)); pdfDash(doc, undefined, scale); return
    }
    if (element.type === 'cartesianAxes') { drawCartesianAxesPdf(doc, visual, target, element); pdfDash(doc, undefined, scale); return }
    if (element.type === 'cartesianPlot') {
      const axis = axes.get(element.axisId); if (!axis) return
      const points = element.points.map((entry) => { const point = cartesianMap(axis, entry.x, entry.y); return mapped(target, visual, point.x, point.y) })
      pdfDash(doc, element.dashed ? [7, 5] : undefined, scale); pdfPolyline(doc, points, element.color, (element.strokeWidth ?? 2) * scale)
      if (element.showPoints) { doc.setFillColor(...rgb(element.color)); points.forEach((point) => doc.circle(point.x, point.y, 1.6 * scale, 'F')) }
      pdfDash(doc, undefined, scale); return
    }
    if (element.type === 'arrow') pdfArrow(doc, visual, target, element, element.color, element.strokeWidth)
    else pdfLine(doc, visual, target, element, element.color, element.strokeWidth)
    pdfDash(doc, undefined, scale)
  })
  pdfDash(doc, undefined, scale)
  return true
}
