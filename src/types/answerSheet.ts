import type { AssessmentRecord, QuestionType } from './assessment'
import type { ClassLearner } from './results'

export type AnswerSheetLayoutVersion = 'v1'

export type AnswerSheetMode = 'generic' | 'personalized'

export type AnswerSheetPaperSize = 'a4' | 'letter' | 'legal' | 'folio'

export type AnswerSheetDensity = 'auto' | '1-up' | '2-up' | '3-up' | '4-up'

export type AnswerSheetPoint = {
  xMm: number
  yMm: number
}

export type AnswerSheetRectMm = {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export type AnswerSheetFiducialMarker = {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  centerMm: AnswerSheetPoint
  sizeMm: number
}

export type AnswerSheetBubbleOption = {
  /** Internal choice/option ID (e.g. 'choice-1', 'T', 'F', 'prompt-1:choice-2') */
  id: string
  /** Learner-visible label printed inside the bubble ('A', 'B', 'C', 'D', 'E', 'T', 'F') */
  label: string
  /** Exact center position on the page in millimeters */
  centerMm: AnswerSheetPoint
  /** Radius of the bubble circle in millimeters (standard: 2.25mm -> 4.5mm diameter) */
  radiusMm: number
}

export type AnswerSheetMatchingPromptRow = {
  promptId: string
  promptNumber: number
  promptLabel: string
  bubbles: AnswerSheetBubbleOption[]
}

export type AnswerSheetItemRegion = {
  itemId: string
  itemNumber: number
  /** Point range label (e.g. '1-3' or '17') for V2 assessments */
  pointRangeLabel: string
  questionType: QuestionType
  isMachineCheckable: boolean
  /** Bounding box of the entire item row in millimeters on this page */
  boundsMm: AnswerSheetRectMm
  pageNumber: number
  /** Bubble options for multiple-choice, true/false, multiple-select */
  bubbles: AnswerSheetBubbleOption[]
  /** Sub-prompt rows for matching items */
  matchingPrompts?: AnswerSheetMatchingPromptRow[]
  /** Teacher scored / manual indicator box if question is not fully OMR-checkable */
  manualBox?: {
    boundsMm: AnswerSheetRectMm
    pointsPossible: number
  }
}

export type AnswerSheetPageLayout = {
  pageNumber: number
  totalPages: number
  paperSize: AnswerSheetPaperSize
  dimensionsMm: {
    widthMm: number
    heightMm: number
  }
  fiducialMarkers: {
    topLeft: AnswerSheetFiducialMarker
    topRight: AnswerSheetFiducialMarker
    bottomLeft: AnswerSheetFiducialMarker
    bottomRight: AnswerSheetFiducialMarker
  }
  qrCode: {
    boundsMm: AnswerSheetRectMm
    payload: string
    svgPath: string
  }
  headerBoundsMm: AnswerSheetRectMm
  learnerBoxBoundsMm: AnswerSheetRectMm
  items: AnswerSheetItemRegion[]
}

export type AnswerSheetDefinition = {
  layoutVersion: AnswerSheetLayoutVersion
  mode: AnswerSheetMode
  assessmentId: string
  assessmentVersionNumber: number
  assessmentTitle: string
  gradeLevel: string
  learningArea: string
  schoolYear: string
  gradingTermLabel: string
  assignmentId?: string
  sectionName?: string
  /** Learner identity if personalized mode */
  learner?: {
    id: string
    displayName: string
    localReference: string | null
  }
  paperSize: AnswerSheetPaperSize
  pages: AnswerSheetPageLayout[]
  compatibility: AnswerSheetCompatibilitySummary
  generatedAt: string
}

export type AnswerSheetQuestionTypeCompatibility = {
  questionType: QuestionType
  label: string
  count: number
  isMachineCheckable: boolean
  scoringHandling: 'automatic_omr' | 'manual_teacher_scoring'
}

export type AnswerSheetCompatibilitySummary = {
  totalQuestions: number
  totalPoints: number
  machineCheckableCount: number
  manualScoringCount: number
  machineCheckablePoints: number
  manualScoringPoints: number
  machineCheckablePercentage: number
  isFullyMachineCheckable: boolean
  isScanReady: boolean
  typesBreakdown: AnswerSheetQuestionTypeCompatibility[]
}

export type AnswerSheetQrPayload = {
  format: 'GD:AS:v1'
  assessmentId: string
  assessmentVersion: number
  layoutVersion: AnswerSheetLayoutVersion
  mode: AnswerSheetMode
  learnerId?: string
  checksum: string
}

export type AnswerSheetGenerateOptions = {
  mode?: AnswerSheetMode
  paperSize?: AnswerSheetPaperSize
  density?: AnswerSheetDensity
  slipsPerPage?: number
  learner?: ClassLearner | { id: string; displayName: string; localReference?: string | null }
  now?: string
}
