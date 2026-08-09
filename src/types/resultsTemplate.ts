/**
 * Phase 5.3 keeps custom results/item-analysis XLSX templates as an honest
 * architecture boundary. The existing TOS filler is intentionally not reused
 * because result workbooks contain repeated, variable-length sheets.
 */
export type ResultsTemplateDocumentType = 'assessment_results' | 'item_analysis'

export type ResultsTemplateFieldKey =
  | 'reportTitle'
  | 'gradeLevel'
  | 'learningArea'
  | 'schoolYear'
  | 'gradingTerm'
  | 'section'
  | 'administrationDate'
  | 'learnerScoresTable'
  | 'itemAnalysisTable'
  | 'optionAnalysisTable'
  | 'competencyAnalysisTable'
  | 'cognitiveAnalysisTable'
  | 'remediationTable'

export type ResultsTemplateCellLocator = {
  kind: 'worksheet_cell'
  sheetName: string
  cellAddress: string
}

export type ResultsTemplateTableLocator = {
  kind: 'worksheet_table'
  sheetName: string
  headerAddress: string
  firstDataRow: number
  lastDataRow: number | null
}

export type ResultsTemplateMapping = {
  fieldKey: ResultsTemplateFieldKey
  locator: ResultsTemplateCellLocator | ResultsTemplateTableLocator
  confirmed: boolean
  confidence: number | null
}

export type ResultsTemplateField = {
  key: ResultsTemplateFieldKey
  label: string
  kind: 'scalar' | 'repeating_table'
  required: boolean
}

export type ResultsTemplateArchitecture = {
  status: 'architecture_only'
  supportedDocumentTypes: ResultsTemplateDocumentType[]
  fields: ResultsTemplateField[]
  mappings: ResultsTemplateMapping[]
  limitations: string[]
}

export const RESULTS_TEMPLATE_FIELDS: ResultsTemplateField[] = [
  { key: 'reportTitle', label: 'Report title', kind: 'scalar', required: true },
  { key: 'gradeLevel', label: 'Grade level', kind: 'scalar', required: false },
  { key: 'learningArea', label: 'Learning area', kind: 'scalar', required: false },
  { key: 'schoolYear', label: 'School year', kind: 'scalar', required: false },
  { key: 'gradingTerm', label: 'Grading term', kind: 'scalar', required: false },
  { key: 'section', label: 'Section', kind: 'scalar', required: false },
  { key: 'administrationDate', label: 'Administration date', kind: 'scalar', required: false },
  { key: 'learnerScoresTable', label: 'Learner scores table', kind: 'repeating_table', required: false },
  { key: 'itemAnalysisTable', label: 'Item analysis table', kind: 'repeating_table', required: false },
  { key: 'optionAnalysisTable', label: 'Option analysis table', kind: 'repeating_table', required: false },
  { key: 'competencyAnalysisTable', label: 'Competency analysis table', kind: 'repeating_table', required: false },
  { key: 'cognitiveAnalysisTable', label: 'Cognitive analysis table', kind: 'repeating_table', required: false },
  { key: 'remediationTable', label: 'Remediation table', kind: 'repeating_table', required: false },
]

export const RESULTS_TEMPLATE_ARCHITECTURE: ResultsTemplateArchitecture = {
  status: 'architecture_only',
  supportedDocumentTypes: ['assessment_results', 'item_analysis'],
  fields: RESULTS_TEMPLATE_FIELDS,
  mappings: [],
  limitations: [
    'Upload, workbook inspection, teacher mapping confirmation, storage, and deterministic future filling are not enabled in Phase 5.3.',
    'The built-in combined XLSX exporter is the supported first-class output and does not require a custom template.',
    'The existing TOS template filler only supports fixed scalar/column mappings and cannot safely fill these variable-length report sheets without a separate table-mapping workflow.',
  ],
}
