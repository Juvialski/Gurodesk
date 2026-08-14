import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { ExportPaperSize } from '../types/export'
import type { TosExportModel } from '../types/tosExport'
import { downloadBlob } from './docxTemplate'

const TEXT = '000000'
const GRID = '555555'
const LIGHT_GRID = '777777'

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'table-of-specifications'
}

function text(value: string | number, options: { bold?: boolean; size?: number } = {}) {
  return new TextRun({
    text: String(value ?? ''),
    bold: options.bold,
    size: options.size ?? 14,
    color: TEXT,
  })
}

function borders(color = GRID, size = 5) {
  const edge = { style: BorderStyle.SINGLE, size, color }
  return {
    top: edge,
    bottom: edge,
    left: edge,
    right: edge,
    insideHorizontal: edge,
    insideVertical: edge,
  }
}

function cell(
  value: string | number,
  options: {
    bold?: boolean
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    rowSpan?: number
    columnSpan?: number
    size?: number
    width?: number
  } = {},
) {
  return new TableCell({
    ...(options.rowSpan ? { rowSpan: options.rowSpan } : {}),
    ...(options.columnSpan ? { columnSpan: options.columnSpan } : {}),
    ...(options.width ? { width: { size: options.width, type: WidthType.PERCENTAGE } } : {}),
    borders: borders(),
    margins: { top: 55, bottom: 55, left: 65, right: 65 },
    children: [
      new Paragraph({
        alignment: options.align ?? AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [text(value || ' ', { bold: options.bold, size: options.size })],
      }),
    ],
  })
}

function metaCell(label: string, value: string | number) {
  return new TableCell({
    borders: borders(LIGHT_GRID, 4),
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        spacing: { after: 0 },
        children: [text(`${label}:`, { bold: true, size: 14 }), text(` ${value || ''}`, { size: 14 })],
      }),
    ],
  })
}

function paperSize(paper: ExportPaperSize) {
  if (paper === 'letter') return { width: 15840, height: 12240, orientation: PageOrientation.LANDSCAPE }
  if (paper === 'legal') return { width: 20160, height: 12240, orientation: PageOrientation.LANDSCAPE }
  return { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE }
}

function headerRows(model: TosExportModel) {
  const categorySpan = Math.max(1, model.categories.length)
  const cognitiveWidth = 26
  const categoryWidth = cognitiveWidth / categorySpan
  const first = new TableRow({
    cantSplit: true,
    children: [
      cell('#', { bold: true, rowSpan: 2, width: 3 }),
      cell('Code', { bold: true, rowSpan: 2, width: 6 }),
      cell('Learning Competency', { bold: true, rowSpan: 2, width: 24 }),
      cell('Curriculum Period', { bold: true, rowSpan: 2, width: 8 }),
      cell('Minutes', { bold: true, rowSpan: 2, width: 5 }),
      cell('Weight %', { bold: true, rowSpan: 2, width: 6 }),
      cell('Cognitive Process Allocation', { bold: true, columnSpan: categorySpan, width: cognitiveWidth }),
      cell('Items', { bold: true, rowSpan: 2, width: 5 }),
      cell('Placement', { bold: true, rowSpan: 2, width: 8 }),
      cell('Notes', { bold: true, rowSpan: 2, width: 9 }),
    ],
  })
  const second = new TableRow({
    cantSplit: true,
    children: model.categories.length
      ? model.categories.map((category) => cell(category.shortLabel || category.label, { bold: true, size: 12, width: categoryWidth }))
      : [cell('—', { bold: true, width: cognitiveWidth })],
  })
  return [first, second]
}

function bodyRows(model: TosExportModel) {
  const categorySpan = Math.max(1, model.categories.length)
  const categoryWidth = 26 / categorySpan
  return model.rows.map((row) => new TableRow({
    cantSplit: false,
    children: [
      cell(row.rowNumber, { width: 3 }),
      cell(row.competencyCode, { width: 6 }),
      cell([row.contentArea, row.competency].filter(Boolean).join(' — '), { align: AlignmentType.LEFT, width: 24 }),
      cell(row.curriculumPeriod, { width: 8 }),
      cell(row.instructionalMinutes ?? '', { width: 5 }),
      cell(row.weightPercent.toFixed(2), { width: 6 }),
      ...(model.categories.length
        ? model.categories.map((_category, index) => cell(row.cognitiveItems[index] ?? 0, { width: categoryWidth }))
        : [cell(' ', { width: 26 })]),
      cell(row.itemCount, { width: 5 }),
      cell(row.itemPlacement, { width: 8 }),
      cell(row.notes, { align: AlignmentType.LEFT, width: 9 }),
    ],
  }))
}

function totalRow(model: TosExportModel) {
  const categorySpan = Math.max(1, model.categories.length)
  const categoryWidth = 26 / categorySpan
  return new TableRow({
    cantSplit: true,
    children: [
      cell('TOTAL', { bold: true, columnSpan: 5, align: AlignmentType.RIGHT, width: 46 }),
      cell(model.rows.reduce((sum, row) => sum + row.weightPercent, 0).toFixed(2), { bold: true, width: 6 }),
      ...(model.categories.length
        ? model.categories.map((_category, index) => cell(
          model.rows.reduce((sum, row) => sum + (row.cognitiveItems[index] ?? 0), 0),
          { bold: true, width: categoryWidth },
        ))
        : [cell(' ', { width: 26 })]),
      cell(model.rows.reduce((sum, row) => sum + row.itemCount, 0), { bold: true, width: 5 }),
      cell(' ', { width: 8 }),
      cell(' ', { width: 9 }),
    ],
  })
}

function curriculumContextTable(model: TosExportModel) {
  if (!model.curriculumGroups.length) return null
  const rows = model.curriculumGroups.map((group) => {
    const detail = [
      ...group.contentStandards.map((value) => `Content Standard: ${value}`),
      ...group.performanceStandards.map((value) => `Performance Standard: ${value}`),
    ].join('\n') || 'No separately verified standard is stored for this curriculum group.'
    return new TableRow({
      cantSplit: false,
      children: [
        cell(`${group.curriculumPeriod}\n${group.contentArea}\nRows ${group.competencyRowNumbers.join(', ')}`, { bold: true, align: AlignmentType.LEFT, width: 28 }),
        cell(detail, { align: AlignmentType.LEFT, width: 72 }),
      ],
    })
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: borders(LIGHT_GRID, 4),
    rows,
  })
}

export async function buildTosDocxBlob(model: TosExportModel, paper: ExportPaperSize = 'a4') {
  const metadata = [
    ['Teacher', model.identity.teacherName, 'School', model.identity.schoolName],
    ['Schools Division', model.identity.division, 'District', model.identity.district],
    ['Grade / Section', [model.gradeLevel, model.sections].filter(Boolean).join(' – '), 'Learning Area', model.learningArea],
    ['School Year', model.schoolYear, 'School Grading Term', model.gradingTerm],
    ['Curriculum-Guide Period', model.curriculumPeriod, 'Total Items', model.totalItems],
    ['TOS Title', model.title, 'Assessment Title', model.assessmentTitle],
  ] as const

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: borders(LIGHT_GRID, 4),
    rows: metadata.map(([leftLabel, leftValue, rightLabel, rightValue]) => new TableRow({
      cantSplit: true,
      children: [metaCell(leftLabel, leftValue), metaCell(rightLabel, rightValue)],
    })),
  })

  const tosTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: borders(),
    rows: [...headerRows(model), ...bodyRows(model), totalRow(model)],
  })

  const children: Array<Paragraph | Table> = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 15 }, children: [text('Republic of the Philippines', { size: 13 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 15 }, children: [text('Department of Education', { bold: true, size: 16 })] }),
  ]
  if (model.identity.region) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [text(model.identity.region, { size: 13 })] }))
  if (model.identity.division) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [text(model.identity.division, { size: 13 })] }))
  if (model.identity.district) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [text(model.identity.district, { size: 13 })] }))
  if (model.identity.schoolName) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 35 }, children: [text(model.identity.schoolName, { bold: true, size: 15 })] }))

  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 25, after: 70 }, children: [text(model.documentTitle, { bold: true, size: 25 })] }),
  )
  if (model.status !== 'final') {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [text(model.status === 'archived' ? 'ARCHIVED COPY' : 'DRAFT COPY', { bold: true, size: 14 })],
    }))
  }
  children.push(metaTable)
  const curriculumTable = curriculumContextTable(model)
  if (curriculumTable) {
    children.push(
      new Paragraph({ keepNext: true, spacing: { before: 90, after: 30 }, children: [text('Curriculum Content and Standards', { bold: true, size: 16 })] }),
      curriculumTable,
    )
  }
  children.push(new Paragraph({ spacing: { after: 90 }, children: [] }), tosTable)

  if (model.notes) {
    children.push(
      new Paragraph({ keepNext: true, spacing: { before: 110, after: 25 }, children: [text('Notes', { bold: true, size: 15 })] }),
      new Paragraph({ spacing: { after: 100 }, children: [text(model.notes, { size: 14 })] }),
    )
  }

  if (model.signatories.length) {
    children.push(new Paragraph({ spacing: { before: 140, after: 30 }, children: [] }))
    const signatoryTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          cantSplit: true,
          children: model.signatories.map((item) => new TableCell({
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [text(item.role, { size: 13 })] }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRID, space: 1 } },
                spacing: { after: 20 },
                children: [text(item.name || ' ', { bold: true, size: 14 })],
              }),
              ...(item.title ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [text(item.title, { size: 12 })] })] : []),
            ],
          })),
        }),
      ],
    })
    children.push(signatoryTable)
  }

  const size = paperSize(paper)
  const document = new Document({
    creator: model.identity.teacherName || undefined,
    title: model.title || model.documentTitle,
    sections: [{
      properties: {
        page: {
          size,
          margin: { top: 500, right: 420, bottom: 500, left: 420 },
        },
      },
      children,
    }],
  })
  return Packer.toBlob(document)
}

export async function downloadTosDocx(model: TosExportModel, paper: ExportPaperSize = 'a4') {
  const blob = await buildTosDocxBlob(model, paper)
  downloadBlob(blob, `${safeFilename(`${model.gradeLevel} ${model.learningArea} - ${model.title || 'TOS'}`)}.docx`)
}
