import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import type { AssessmentVisual } from '../types/assessmentVisual'
import { validateAssessmentVisual } from './assessmentVisualValidation'

const svgCache = new Map<string, string>()
const pngCache = new Map<string, string>()

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

const SVG_ELEMENTS = new Set([
  'svg', 'g', 'defs', 'title', 'desc', 'path', 'polyline', 'polygon', 'line', 'rect', 'circle', 'ellipse', 'text', 'tspan', 'clipPath', 'use',
])
const SVG_ATTRIBUTES = new Set([
  'xmlns', 'xmlns:xlink', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
  'opacity', 'transform', 'clip-path', 'clip-rule', 'id', 'class', 'role', 'aria-label', 'aria-hidden', 'text-anchor', 'dominant-baseline', 'font-family', 'font-size', 'font-style', 'font-weight',
  'href', 'xlink:href', 'style', 'preserveAspectRatio',
])
const SAFE_STYLE_PROPERTIES = new Set([
  'width', 'height', 'max-width', 'max-height', 'overflow', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'font-family', 'font-size', 'font-style', 'font-weight', 'text-anchor',
  'dominant-baseline', 'display', 'visibility',
])

function key(visual: AssessmentVisual) {
  const source = visual.tikzCode ?? ''
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${visual.id}:${(hash >>> 0).toString(36)}`
}

function safeStyle(value: string) {
  const declarations = value.split(';').map((entry) => entry.trim()).filter(Boolean)
  for (const declaration of declarations) {
    const separator = declaration.indexOf(':')
    if (separator <= 0) return false
    const property = declaration.slice(0, separator).trim().toLocaleLowerCase('en')
    const styleValue = declaration.slice(separator + 1).trim()
    if (!SAFE_STYLE_PROPERTIES.has(property)) return false
    if (/(?:url\s*\(|@import|expression\s*\(|javascript:|data:|https?:|\\)/iu.test(styleValue)) return false
  }
  return true
}

/** DOM-based SVG allowlist. Unsafe or unsupported renderer output is rejected wholesale. */
export function sanitizeAssessmentTikzSvg(markup: string) {
  const value = markup.trim()
  if (!value || value.length > 1_500_000) return ''
  if (/<!DOCTYPE|<\?xml-stylesheet|<\?[^>]+\?>/iu.test(value)) return ''
  let document: Document
  try {
    document = new DOMParser().parseFromString(value, 'image/svg+xml') as unknown as Document
  } catch {
    return ''
  }
  const root = document.documentElement
  if (!root || root.localName !== 'svg' || root.namespaceURI !== SVG_NAMESPACE) return ''
  if (document.getElementsByTagName('parsererror').length) return ''

  const pending: Element[] = [root]
  while (pending.length) {
    const element = pending.pop()!
    if (!SVG_ELEMENTS.has(element.localName)) return ''
    if (element.namespaceURI !== SVG_NAMESPACE) return ''

    for (let index = 0; index < element.attributes.length; index += 1) {
      const attribute = element.attributes.item(index)
      if (!attribute) continue
      const name = attribute.name
      const lower = name.toLocaleLowerCase('en')
      const attributeValue = attribute.value.trim()
      if (lower.startsWith('on') || !SVG_ATTRIBUTES.has(name)) return ''
      // Namespace declarations are required XML metadata. They contain an
      // http:// identifier, but they do not fetch a remote resource. Permit
      // only the exact SVG / XLink namespace URIs and reject every other
      // namespace through the attribute allowlist.
      if (name === 'xmlns') {
        if (attributeValue !== SVG_NAMESPACE) return ''
        continue
      }
      if (name === 'xmlns:xlink') {
        if (attributeValue !== XLINK_NAMESPACE) return ''
        continue
      }
      if (name === 'href' || name === 'xlink:href') {
        if (!/^#[A-Za-z_][\w:.-]*$/u.test(attributeValue)) return ''
      }
      if ((name === 'fill' || name === 'stroke' || name === 'clip-path') && /url\s*\(/iu.test(attributeValue) && !/^url\(#[A-Za-z_][\w:.-]*\)$/u.test(attributeValue)) return ''
      if (name === 'style' && !safeStyle(attributeValue)) return ''
      if (/(?:javascript:|data:|https?:\/\/|@import)/iu.test(attributeValue)) return ''
    }

    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) pending.push(child as Element)
      else if (child.nodeType !== 3 && child.nodeType !== 4 && child.nodeType !== 8) return ''
    }
  }
  return new XMLSerializer().serializeToString(root)
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
  if (!visual.tikzCode || !validateAssessmentVisual(visual).valid) return false
  const sanitized = sanitizeAssessmentTikzSvg(markup)
  if (!sanitized) return false
  const cacheKey = key(visual)
  svgCache.set(cacheKey, sanitized)
  void rasterize(sanitized, Math.max(1, visual.width), Math.max(1, visual.height)).then((png) => { if (png) pngCache.set(cacheKey, png) })
  return true
}

export function getAssessmentTikzRenderedSvg(visual: AssessmentVisual) { return visual.tikzCode ? svgCache.get(key(visual)) ?? '' : '' }
export function getAssessmentTikzRenderedPng(visual: AssessmentVisual) { return visual.tikzCode ? pngCache.get(key(visual)) ?? '' : '' }

export type AssessmentTikzRenderTarget = 'print' | 'docx' | 'pdf'

function hasValidatedPrimitiveFallback(visual: AssessmentVisual) {
  if (!visual.primitives.length) return false
  // V2 visuals intentionally persist both the app-owned TikZ source and the
  // bounded primitives that produced it. Validate the primitive-only form so a
  // renderer/CDN failure cannot make an otherwise safe diagram unexportable.
  return validateAssessmentVisual({ ...visual, tikzCode: undefined }).valid
}

function renderedForTarget(visual: AssessmentVisual, target: AssessmentTikzRenderTarget) {
  if (!visual.tikzCode) return true
  if (target === 'pdf') return Boolean(getAssessmentTikzRenderedPng(visual))
  return Boolean(getAssessmentTikzRenderedSvg(visual))
}

function requiredForTarget(visual: AssessmentVisual) {
  return Boolean(visual.tikzCode) && !hasValidatedPrimitiveFallback(visual)
}

export async function waitForAssessmentTikzRenders(visuals: readonly AssessmentVisual[], target: AssessmentTikzRenderTarget = 'print', timeoutMs = 12000) {
  const tikzVisuals = visuals.filter((visual) => Boolean(visual.tikzCode))
  if (!tikzVisuals.length) return true

  const required = tikzVisuals.filter(requiredForTarget)
  const start = Date.now()
  // Give TikZJax a short grace period so exports still prefer its rendered
  // output when it is available. Structured V2 visuals then fall back to their
  // already-validated primitives instead of blocking the whole download.
  const preferredWaitMs = Math.min(timeoutMs, 2500)
  while (Date.now() - start < timeoutMs) {
    if (tikzVisuals.every((visual) => renderedForTarget(visual, target))) return true
    if (Date.now() - start >= preferredWaitMs && required.every((visual) => renderedForTarget(visual, target))) return true
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  return required.every((visual) => renderedForTarget(visual, target))
}
