import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import type { AssessmentRecord } from '../../types/assessment'
import type { AnswerSheetDensity, AnswerSheetMode, AnswerSheetPaperSize } from '../../types/answerSheet'
import type { ClassLearner } from '../../types/results'
import { downloadBlob } from '../docxTemplate'
import { resolveSlipsPerPage } from './layoutPolicy'
import { generateAnswerSheetLayout } from './layoutEngine'
import { renderAnswerSheetPageSvg } from './printRenderer'

export { resolveSlipsPerPage }

export type AnswerSheetDocxOptions = {
  mode?: AnswerSheetMode
  paperSize?: AnswerSheetPaperSize
  density?: AnswerSheetDensity
  copies?: number
  learners?: ClassLearner[]
  sectionName?: string
  now?: string
}

const TRANSPARENT_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAA'

function pngFallbackBytes(): Uint8Array {
  if (typeof atob !== 'undefined') {
    const binary = atob(TRANSPARENT_PNG_BASE64)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'))
  }
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
}

async function svgPngFallback(svg: string, width: number, height: number): Promise<Uint8Array> {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined') {
    return pngFallbackBytes()
  }
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('SVG decode error'))
    })
    image.src = url
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * 2))
    canvas.height = Math.max(1, Math.round(height * 2))
    const context = canvas.getContext('2d')
    if (!context) return pngFallbackBytes()
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!pngBlob) return pngFallbackBytes()
    return new Uint8Array(await pngBlob.arrayBuffer())
  } catch {
    return pngFallbackBytes()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function docxText(
  text: string,
  options: { bold?: boolean; italics?: boolean; size?: number; color?: string; font?: string } = {},
) {
  return new TextRun({
    text,
    bold: options.bold,
    italics: options.italics,
    size: options.size ?? 14,
    color: options.color ?? '94a3b8',
    font: options.font ?? 'Arial',
  })
}

function docxPaperSizeTwips(paperSize: AnswerSheetPaperSize = 'a4') {
  switch (paperSize) {
    case 'letter':
      return { width: 12240, height: 15840 }
    case 'legal':
      return { width: 12240, height: 20160 }
    case 'folio':
      return { width: 12240, height: 18720 }
    case 'a4':
    default:
      return { width: 11906, height: 16838 }
  }
}

function buildCuttingGuideParagraph(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [
      docxText('✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂', {
        size: 13,
        color: '94a3b8',
      }),
    ],
  })
}

export async function buildAnswerSheetDocxBlob(
  assessment: AssessmentRecord,
  options: AnswerSheetDocxOptions = {},
): Promise<Blob> {
  const {
    mode = 'generic',
    paperSize = 'a4',
    density = 'auto',
    copies = 30,
    learners = [],
    sectionName = '',
    now = new Date().toISOString(),
  } = options

  const items = assessment.items || []
  const slipsPerPage = resolveSlipsPerPage(items.length, density, paperSize)
  const size = docxPaperSizeTwips(paperSize)

  const children: Paragraph[] = []

  const targetList: Array<ClassLearner | null> =
    mode === 'personalized' && learners.length > 0
      ? learners
      : Array.from({ length: Math.max(1, copies) }, () => null)

  for (let i = 0; i < targetList.length; i++) {
    const learner = targetList[i]
    const sheet = generateAnswerSheetLayout(assessment, {
      mode,
      paperSize,
      density,
      slipsPerPage,
      learner: learner || undefined,
      now,
    })

    const page = sheet.pages[0]
    const svg = renderAnswerSheetPageSvg(sheet, page)
    const svgBinary = new TextEncoder().encode(svg)

    // Convert mm to pixels at 96 DPI: 1 mm = 3.779527559 px
    const slipW = page.dimensionsMm.widthMm
    const slipH = page.dimensionsMm.heightMm

    // Slightly inset width to prevent Word margins from wrapping/clipping
    const pixelWidth = Math.round((slipW - 4) * (96 / 25.4))
    const pixelHeight = Math.round((slipH - (slipsPerPage > 1 ? 6 : 4)) * (96 / 25.4))

    const pngFallback = await svgPngFallback(svg, pixelWidth, pixelHeight)

    const slipParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      keepLines: true,
      keepNext: true,
      spacing: { before: 0, after: 0 },
      children: [
        new ImageRun({
          type: 'svg',
          data: svgBinary,
          fallback: { type: 'png', data: pngFallback },
          transformation: {
            width: pixelWidth,
            height: pixelHeight,
          },
          altText: {
            title: `${assessment.title || 'Assessment'} Answer Sheet`,
            description: `GuroDesk Smart Answer Sheet (${slipsPerPage}-Up, ${paperSize.toUpperCase()})`,
            name: `answersheet-slip-${i + 1}`,
          },
        }),
      ],
    })

    children.push(slipParagraph)

    const isLastSlipOnPage = (i + 1) % slipsPerPage === 0
    const isVeryLastSlip = i === targetList.length - 1

    if (!isVeryLastSlip) {
      if (isLastSlipOnPage) {
        children.push(new Paragraph({ pageBreakBefore: true, children: [] }))
      } else {
        children.push(buildCuttingGuideParagraph())
      }
    }
  }

  const doc = new Document({
    creator: 'GuroDesk Teacher Workspace',
    title: `${assessment.title || 'Assessment'} - Answer Sheet`,
    description: `DepEd Compliant Smart Answer Sheet (${slipsPerPage}-Up Graphic Layout)`,
    sections: [
      {
        properties: {
          page: {
            size,
            margin: {
              top: 280, // ~5mm margin
              bottom: 280,
              left: 280,
              right: 280,
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}

export async function downloadAnswerSheetDocx(
  assessment: AssessmentRecord,
  options: AnswerSheetDocxOptions = {},
) {
  const blob = await buildAnswerSheetDocxBlob(assessment, options)
  const filename = `${(assessment.title || 'Assessment').replace(/[\\/:*?"<>|]+/g, '_')} - Answer Sheet.docx`
  downloadBlob(blob, filename)
}
