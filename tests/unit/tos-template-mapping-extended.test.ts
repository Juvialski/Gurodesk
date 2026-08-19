import { describe, expect, it } from 'vitest'
import {
  detectTosCandidates,
  inferTosTableRange,
  prioritizeTosTemplateElements,
  validateXlsxTemplateMappings,
} from '../../src/lib/xlsxTemplate'
import type { TosTemplateElement, TosTemplateMapping } from '../../src/types/tosTemplate'

describe('Phase 5 — Custom TOS XLSX Template Mapping', () => {
  const mockElements: TosTemplateElement[] = [
    {
      id: 'TOS!A1',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'A1' },
      kind: 'worksheet_cell',
      text: 'Department of Education - Region IV-A',
      context: 'TOS · A1: Department of Education',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '1',
    },
    {
      id: 'TOS!B3',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'B3' },
      kind: 'worksheet_cell',
      text: 'School Name:',
      context: 'TOS · B3: School Name:',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '1',
    },
    {
      id: 'TOS!B4',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'B4' },
      kind: 'worksheet_cell',
      text: 'Teacher Name:',
      context: 'TOS · B4: Teacher Name:',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '1',
    },
    {
      id: 'TOS!B8',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'B8' },
      kind: 'worksheet_cell',
      text: 'Learning Competencies',
      context: 'TOS · B8: Learning Competencies',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '2',
    },
    {
      id: 'TOS!C8',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'C8' },
      kind: 'worksheet_cell',
      text: 'Instructional Minutes',
      context: 'TOS · C8: Instructional Minutes',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '2',
    },
    {
      id: 'TOS!D8',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'D8' },
      kind: 'worksheet_cell',
      text: 'Weight %',
      context: 'TOS · D8: Weight %',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '2',
    },
    {
      id: 'TOS!E8',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'E8' },
      kind: 'worksheet_cell',
      text: 'No. of Items',
      context: 'TOS · E8: No. of Items',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '2',
    },
    {
      id: 'TOS!F8',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'F8' },
      kind: 'worksheet_cell',
      text: 'Item Placement',
      context: 'TOS · F8: Item Placement',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '2',
    },
    // Row 9 styled blank cells
    {
      id: 'TOS!B9',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'B9' },
      kind: 'worksheet_cell',
      text: '',
      context: 'TOS · B9: [blank]',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '2',
    },
    {
      id: 'TOS!E9',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'E9' },
      kind: 'worksheet_cell',
      text: '',
      context: 'TOS · E9: [blank]',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '2',
    },
    {
      id: 'TOS!F9',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'F9' },
      kind: 'worksheet_cell',
      text: '',
      context: 'TOS · F9: [blank]',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '2',
    },
    {
      id: 'TOS!B35',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'B35' },
      kind: 'worksheet_cell',
      text: 'TOTAL',
      context: 'TOS · B35: TOTAL',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '3',
    },
    {
      id: 'TOS!B38',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'B38' },
      kind: 'worksheet_cell',
      text: 'Prepared by:',
      context: 'TOS · B38: Prepared by:',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '1',
    },
  ]

  it('prioritizes candidate elements and excludes formula / merged non-anchor cells', () => {
    const formulaCell: TosTemplateElement = {
      id: 'TOS!E35',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'E35' },
      kind: 'worksheet_cell',
      text: '=SUM(E9:E34)',
      context: 'TOS · E35: =SUM(E9:E34)',
      suggestedMode: 'replace',
      isFormula: true,
      isMerged: false,
      isMergedAnchor: false,
      styleIndex: '3',
    }

    const mergedChildCell: TosTemplateElement = {
      id: 'TOS!C1',
      locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'C1' },
      kind: 'worksheet_cell',
      text: '',
      context: 'TOS · C1: [blank]',
      suggestedMode: 'replace',
      isFormula: false,
      isMerged: true,
      isMergedAnchor: false,
      styleIndex: '1',
    }

    const prioritized = prioritizeTosTemplateElements([...mockElements, formulaCell, mergedChildCell], 100)
    expect(prioritized.some((el) => el.id === 'TOS!E35')).toBe(false)
    expect(prioritized.some((el) => el.id === 'TOS!C1')).toBe(false)
    expect(prioritized.some((el) => el.id === 'TOS!B8')).toBe(true)
    expect(prioritized.some((el) => el.id === 'TOS!E8')).toBe(true)
  })

  it('detects candidate fields deterministically from keywords and synonyms', () => {
    const candidates = detectTosCandidates(mockElements)
    const fieldKeys = new Set(candidates.map((c) => c.fieldKey))

    expect(fieldKeys.has('schoolName')).toBe(true)
    expect(fieldKeys.has('teacherName')).toBe(true)
    expect(fieldKeys.has('competency')).toBe(true)
    expect(fieldKeys.has('instructionalMinutes')).toBe(true)
    expect(fieldKeys.has('weightPercent')).toBe(true)
    expect(fieldKeys.has('itemCount')).toBe(true)
    expect(fieldKeys.has('itemPlacement')).toBe(true)
    expect(fieldKeys.has('preparedBy')).toBe(true)
  })

  it('infers table data range accurately from header row and stop markers (e.g. TOTAL row)', () => {
    const headerRow = 8
    const { firstDataRow, lastDataRow } = inferTosTableRange(mockElements, headerRow, 'TOS')

    expect(firstDataRow).toBe(9)
    // Row 35 is 'TOTAL', so last data row should be 34
    expect(lastDataRow).toBe(34)
  })

  it('validates template mappings ensuring consistent table column ranges and no collisions', () => {
    const validMappings: TosTemplateMapping[] = [
      {
        fieldKey: 'schoolName',
        elementId: 'TOS!B3',
        locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'B3' },
        mode: 'replace',
        confidence: 0.9,
      },
      {
        fieldKey: 'competency',
        elementId: 'TOS!B8',
        locator: { kind: 'worksheet_column', sheetName: 'TOS', columnAddress: 'B', firstDataRow: 9, lastDataRow: 9 },
        mode: 'table_column',
        confidence: 0.95,
      },
      {
        fieldKey: 'itemCount',
        elementId: 'TOS!E8',
        locator: { kind: 'worksheet_column', sheetName: 'TOS', columnAddress: 'E', firstDataRow: 9, lastDataRow: 9 },
        mode: 'table_column',
        confidence: 0.95,
      },
      {
        fieldKey: 'itemPlacement',
        elementId: 'TOS!F8',
        locator: { kind: 'worksheet_column', sheetName: 'TOS', columnAddress: 'F', firstDataRow: 9, lastDataRow: 9 },
        mode: 'table_column',
        confidence: 0.95,
      },
    ]

    const errors = validateXlsxTemplateMappings(mockElements, validMappings)
    expect(errors).toEqual([])
  })
})
