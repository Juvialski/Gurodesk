export type TosTemplateMappingMode = 'replace' | 'table_column'
export type XlsxCellLocator = { kind: 'worksheet_cell'; sheetName: string; cellAddress: string }
export type XlsxColumnLocator = { kind: 'worksheet_column'; sheetName: string; columnAddress: string; firstDataRow: number; lastDataRow: number }
export type TosTemplateLocator = XlsxCellLocator | XlsxColumnLocator

export type TosTemplateFieldKey =
  | 'teacherName' | 'teacherPosition' | 'schoolName' | 'region' | 'division'
  | 'gradeLevel' | 'sections' | 'gradeSection' | 'learningArea' | 'schoolYear'
  | 'gradingTerm' | 'curriculumPeriod' | 'tosTitle' | 'assessmentTitle' | 'totalItems' | 'weightingMethod'
  | 'competencyRowNumber' | 'competencyCode' | 'competency' | 'rowCurriculumPeriod'
  | 'instructionalMinutes' | 'weightPercent'
  | 'cognitiveLabel1' | 'cognitiveLabel2' | 'cognitiveLabel3' | 'cognitiveLabel4'
  | 'cognitiveLabel5' | 'cognitiveLabel6' | 'cognitiveLabel7' | 'cognitiveLabel8'
  | 'cognitiveItems1' | 'cognitiveItems2' | 'cognitiveItems3' | 'cognitiveItems4'
  | 'cognitiveItems5' | 'cognitiveItems6' | 'cognitiveItems7' | 'cognitiveItems8'
  | 'itemCount' | 'itemPlacement' | 'rowNotes' | 'totalWeight'
  | 'preparedBy' | 'reviewedBy' | 'notedBy'

export type TosTemplateElement = {
  id: string
  locator: XlsxCellLocator
  kind: 'worksheet_cell'
  text: string
  context: string
  suggestedMode: 'replace'
  isFormula: boolean
  isMerged: boolean
  isMergedAnchor: boolean
  styleIndex: string | null
}

export type TosTemplateMapping = {
  fieldKey: TosTemplateFieldKey
  elementId: string
  locator: TosTemplateLocator
  mode: TosTemplateMappingMode
  confidence: number | null
}

export type TosDocumentTemplate = {
  id: string
  userId: string
  name: string
  documentType: 'tos'
  fileType: 'xlsx'
  originalFilename: string
  storagePath: string
  fileSizeBytes: number
  sourceHash: string
  elements: TosTemplateElement[]
  mappings: TosTemplateMapping[]
  isDefault: boolean
  analysisModel: string | null
  createdAt: string
  updatedAt: string
}

export type TosTemplateAnalysisResult = {
  mappings: Array<{ fieldKey: TosTemplateFieldKey; elementId: string; mode: TosTemplateMappingMode; confidence: number }>
  model: string
  fallbackUsed: boolean
}

export const TOS_TEMPLATE_FIELDS: Array<{
  key: TosTemplateFieldKey
  label: string
  group: 'Identity' | 'TOS details' | 'Competency table' | 'Cognitive headings' | 'Totals & signatures'
  tableColumn?: boolean
  important?: boolean
}> = [
  { key: 'teacherName', label: 'Teacher name', group: 'Identity', important: true },
  { key: 'teacherPosition', label: 'Teacher position/title', group: 'Identity' },
  { key: 'schoolName', label: 'School', group: 'Identity', important: true },
  { key: 'region', label: 'Region', group: 'Identity' },
  { key: 'division', label: 'Schools Division', group: 'Identity' },
  { key: 'gradeLevel', label: 'Grade level', group: 'TOS details', important: true },
  { key: 'sections', label: 'Section/s', group: 'TOS details' },
  { key: 'gradeSection', label: 'Grade level and section/s', group: 'TOS details' },
  { key: 'learningArea', label: 'Learning area / subject', group: 'TOS details', important: true },
  { key: 'schoolYear', label: 'School year', group: 'TOS details' },
  { key: 'gradingTerm', label: 'School grading term', group: 'TOS details', important: true },
  { key: 'curriculumPeriod', label: 'Curriculum-guide period', group: 'TOS details' },
  { key: 'tosTitle', label: 'TOS title', group: 'TOS details', important: true },
  { key: 'assessmentTitle', label: 'Assessment title', group: 'TOS details' },
  { key: 'totalItems', label: 'Total test items', group: 'TOS details', important: true },
  { key: 'weightingMethod', label: 'Weighting method', group: 'TOS details' },
  { key: 'competencyRowNumber', label: 'Row number column', group: 'Competency table', tableColumn: true },
  { key: 'competencyCode', label: 'Competency code column', group: 'Competency table', tableColumn: true },
  { key: 'competency', label: 'Competency text column', group: 'Competency table', tableColumn: true, important: true },
  { key: 'rowCurriculumPeriod', label: 'Curriculum period column', group: 'Competency table', tableColumn: true },
  { key: 'instructionalMinutes', label: 'Instructional minutes column', group: 'Competency table', tableColumn: true },
  { key: 'weightPercent', label: 'Weight percentage column', group: 'Competency table', tableColumn: true, important: true },
  ...Array.from({ length: 8 }, (_, index) => ({ key: `cognitiveLabel${index + 1}` as TosTemplateFieldKey, label: `Cognitive category ${index + 1} heading`, group: 'Cognitive headings' as const })),
  ...Array.from({ length: 8 }, (_, index) => ({ key: `cognitiveItems${index + 1}` as TosTemplateFieldKey, label: `Cognitive category ${index + 1} items column`, group: 'Competency table' as const, tableColumn: true })),
  { key: 'itemCount', label: 'Number of items column', group: 'Competency table', tableColumn: true, important: true },
  { key: 'itemPlacement', label: 'Item placement column', group: 'Competency table', tableColumn: true, important: true },
  { key: 'rowNotes', label: 'Notes column', group: 'Competency table', tableColumn: true },
  { key: 'totalWeight', label: 'Total weight', group: 'Totals & signatures' },
  { key: 'preparedBy', label: 'Prepared by', group: 'Totals & signatures' },
  { key: 'reviewedBy', label: 'Reviewed by', group: 'Totals & signatures' },
  { key: 'notedBy', label: 'Noted by', group: 'Totals & signatures' },
]
