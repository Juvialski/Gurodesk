import type { AssessmentVisual } from '../types/assessmentVisual'

const svgCache = new Map<string, string>()
const pngCache = new Map<string, string>()

function key(visual: AssessmentVisual) {
  const source = visual.tikzCode ?? ''
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${visual.id}:${(hash >>> 0).toString(36)}`
}

function safeSvg(markup: string) {
  const value = markup.trim()
  if (!/^<svg\b/iu.test(value) || !/<\/svg>\s*$/iu.test(value)) return ''
  if (/<(?:script|iframe|object|embed|foreignObject)\b/iu.test(value)) return ''
  if (/\son[a-z]+\s*=/iu.test(value)) return ''
  if (/\b(?:href|xlink:href)\s*=\s*["'](?!#|data:image\/)/iu.test(value)) return ''
  return value
}

async function rasterize(svg: string, width: number, height: number) {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined') return ''
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to rasterize rendered TikZ.')); image.src = url })
    const scale = 4
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) return ''
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.scale(scale, scale)
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/png', 1)
  } catch {
    return ''
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function cacheAssessmentTikzRenderedSvg(visual: AssessmentVisual, markup: string) {
  const sanitized = safeSvg(markup)
  if (!sanitized || !visual.tikzCode) return
  const cacheKey = key(visual)
  svgCache.set(cacheKey, sanitized)
  void rasterize(sanitized, Math.max(1, visual.width), Math.max(1, visual.height)).then((png) => { if (png) pngCache.set(cacheKey, png) })
}

export function getAssessmentTikzRenderedSvg(visual: AssessmentVisual) { return visual.tikzCode ? svgCache.get(key(visual)) ?? '' : '' }
export function getAssessmentTikzRenderedPng(visual: AssessmentVisual) { return visual.tikzCode ? pngCache.get(key(visual)) ?? '' : '' }

export async function waitForAssessmentTikzRenders(visuals: readonly AssessmentVisual[], timeoutMs = 12000) {
  const direct = visuals.filter((visual) => Boolean(visual.tikzCode))
  if (!direct.length) return true
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (direct.every((visual) => Boolean(getAssessmentTikzRenderedSvg(visual)) && Boolean(getAssessmentTikzRenderedPng(visual)))) return true
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  return direct.every((visual) => Boolean(getAssessmentTikzRenderedSvg(visual)) && Boolean(getAssessmentTikzRenderedPng(visual)))
}
