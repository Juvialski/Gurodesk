import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { AssessmentRecord, AssessmentItem, QuestionType } from '../../types/assessment'
import type { AnswerSheetDensity, AnswerSheetMode, AnswerSheetPaperSize } from '../../types/answerSheet'
import type { ClassLearner } from '../../types/results'
import { downloadBlob } from '../docxTemplate'

export type AnswerSheetDocxOptions = {
  mode?: AnswerSheetMode
  paperSize?: AnswerSheetPaperSize
  density?: AnswerSheetDensity
  copies?: number
  learners?: ClassLearner[]
  sectionName?: string
}

function docxText(
  text: string,
  options: { bold?: boolean; italics?: boolean; size?: number; color?: string; font?: string } = {},
) {
  return new TextRun({
    text,
    bold: options.bold,
    italics: options.italics,
    size: options.size ?? 16, // 16 half-pts = 8pt
    color: options.color ?? '000000',
    font: options.font ?? 'Arial',
  })
}

export function resolveSlipsPerPage(itemCount: number, density: AnswerSheetDensity = 'auto'): number {
  if (density === '1-up') return 1
  if (density === '2-up') return 2
  if (density === '3-up') return 3
  if (density === '4-up') return 4
  // Auto mode: optimize paper usage based on item count
  if (itemCount <= 12) return 3
  if (itemCount <= 28) return 2
  return 1
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

function formatBubbleText(item: AssessmentItem): string {
  const num = `${item.itemNumber}.`.padEnd(3, ' ')
  const type: QuestionType = item.questionType

  if (type === 'multiple_choice' || type === 'multiple_select') {
    const mcqAnswer = item.answer as { choices?: unknown[] } | undefined
    const choiceCount = Array.isArray(mcqAnswer?.choices) && mcqAnswer.choices.length > 0
      ? mcqAnswer.choices.length
      : 4
    const letters = Array.from({ length: choiceCount }, (_, i: number) => String.fromCharCode(65 + i))
    return `${num} ${letters.map((l: string) => `( ${l} )`).join(' ')}`
  }

  if (type === 'true_false') {
    return `${num} ( T ) ( F )`
  }

  if (type === 'matching') {
    return `${num} [ ____ ]`
  }

  if (type === 'identification' || type === 'fill_in_the_blank' || type === 'numerical_answer') {
    return `${num} [ _________________ ]`
  }

  const pts = item.pointsPossible || item.points || 1
  return `${num} [ Score: ___ / ${pts} ]`
}

function buildSlipElements(
  assessment: AssessmentRecord,
  items: AssessmentItem[],
  learner: ClassLearner | null,
  sectionName: string,
  slipsPerPage: number,
): Array<Paragraph | Table> {
  const isCompact = slipsPerPage >= 3
  const isMedium = slipsPerPage === 2
  const textSize = isCompact ? 14 : isMedium ? 15 : 16
  const titleSize = isCompact ? 18 : isMedium ? 20 : 22
  const totalPoints = items.reduce((acc, it) => acc + (it.pointsPossible || it.points || 1), 0)

  const elements: Array<Paragraph | Table> = []

  // 1. Slip Header
  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: isCompact ? 20 : 40, after: 15 },
      children: [
        docxText('DEPARTMENT OF EDUCATION', {
          bold: true,
          size: isCompact ? 13 : 15,
          color: '334155',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 15 },
      children: [
        docxText(`${assessment.title.toUpperCase()} — ANSWER SHEET`, {
          bold: true,
          size: titleSize,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: isCompact ? 40 : 60 },
      children: [
        docxText(
          `${assessment.learningArea || 'Subject'} · Grade ${assessment.gradeLevel || ''} · ${
            assessment.gradingTermLabel || assessment.gradingTermId || 'Assessment'
          }`,
          { italics: true, size: isCompact ? 13 : 14, color: '64748b' },
        ),
      ],
    }),
  )

  // 2. Student Info Box
  if (learner) {
    elements.push(
      new Paragraph({
        spacing: { after: isCompact ? 50 : 80 },
        children: [
          docxText('STUDENT: ', { bold: true, size: textSize }),
          docxText(learner.displayName, { bold: true, size: textSize + 1 }),
          docxText('     LRN: ', { bold: true, size: textSize }),
          docxText(learner.localReference || '________________', { size: textSize }),
          docxText('     SEC: ', { bold: true, size: textSize }),
          docxText(sectionName || '__________', { size: textSize }),
          docxText(`     SCORE: _____ / ${totalPoints}`, { bold: true, size: textSize }),
        ],
      }),
    )
  } else {
    elements.push(
      new Paragraph({
        spacing: { after: isCompact ? 50 : 80 },
        children: [
          docxText('NAME: ', { bold: true, size: textSize }),
          docxText('____________________________________________', { size: textSize }),
          docxText('   SEC: ', { bold: true, size: textSize }),
          docxText('______________', { size: textSize }),
          docxText('   DATE: ', { bold: true, size: textSize }),
          docxText('_________', { size: textSize }),
          docxText(`   SCORE: _____ / ${totalPoints}`, { bold: true, size: textSize }),
        ],
      }),
    )
  }

  // 3. Grid of Items (Arrange into columns)
  const numColumns = items.length <= 10 ? 2 : items.length <= 24 ? 3 : items.length <= 40 ? 4 : 5
  const rowsPerColumn = Math.ceil(items.length / numColumns)

  const tableRows: TableRow[] = []
  const borderNone = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const cellBorders = {
    top: borderNone,
    bottom: borderNone,
    left: borderNone,
    right: borderNone,
  }

  for (let r = 0; r < rowsPerColumn; r++) {
    const rowCells: TableCell[] = []
    for (let c = 0; c < numColumns; c++) {
      const itemIndex = c * rowsPerColumn + r
      const item = items[itemIndex]
      const cellParagraph = item
        ? new Paragraph({
            spacing: { before: isCompact ? 15 : 25, after: isCompact ? 15 : 25 },
            children: [
              docxText(formatBubbleText(item), {
                size: textSize,
                font: 'Consolas, Courier New, monospace',
              }),
            ],
          })
        : new Paragraph({ children: [] })

      rowCells.push(
        new TableCell({
          borders: cellBorders,
          margins: { top: 10, bottom: 10, left: 30, right: 30 },
          children: [cellParagraph],
        }),
      )
    }
    tableRows.push(
      new TableRow({
        cantSplit: true,
        children: rowCells,
      }),
    )
  }

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: borderNone,
        bottom: borderNone,
        left: borderNone,
        right: borderNone,
        insideHorizontal: borderNone,
        insideVertical: borderNone,
      },
      rows: tableRows,
    }),
  )

  return elements
}

function buildCuttingGuideParagraph(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      docxText('- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -', {
        size: 11,
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
  } = options

  const items = assessment.items || []
  const slipsPerPage = resolveSlipsPerPage(items.length, density)
  const size = docxPaperSizeTwips(paperSize)

  const children: Array<Paragraph | Table> = []

  if (mode === 'personalized' && learners.length > 0) {
    // Generate slips for each learner
    for (let i = 0; i < learners.length; i++) {
      const learner = learners[i]
      const slipElements = buildSlipElements(assessment, items, learner, sectionName, slipsPerPage)
      children.push(...slipElements)

      const isLastSlipOnPage = (i + 1) % slipsPerPage === 0
      const isVeryLastSlip = i === learners.length - 1

      if (!isVeryLastSlip) {
        if (isLastSlipOnPage) {
          children.push(new Paragraph({ pageBreakBefore: true, children: [] }))
        } else {
          children.push(buildCuttingGuideParagraph())
        }
      }
    }
  } else {
    // Generic mode: generate requested number of copies
    const totalCopies = Math.max(1, copies)
    for (let i = 0; i < totalCopies; i++) {
      const slipElements = buildSlipElements(assessment, items, null, sectionName, slipsPerPage)
      children.push(...slipElements)

      const isLastSlipOnPage = (i + 1) % slipsPerPage === 0
      const isVeryLastSlip = i === totalCopies - 1

      if (!isVeryLastSlip) {
        if (isLastSlipOnPage) {
          children.push(new Paragraph({ pageBreakBefore: true, children: [] }))
        } else {
          children.push(buildCuttingGuideParagraph())
        }
      }
    }
  }

  const doc = new Document({
    creator: 'GuroDesk Teacher Workspace',
    title: `${assessment.title} - Answer Sheet`,
    description: `DepEd Compliant Answer Sheet (${slipsPerPage}-Up Multi-Layout)`,
    sections: [
      {
        properties: {
          page: {
            size,
            margin: {
              top: 540, // ~0.375 in / 9.5mm
              bottom: 540,
              left: 540,
              right: 540,
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
