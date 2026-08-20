import type { AnswerSheetMode, AnswerSheetPaperSize } from './answerSheet'
import type { QuestionType } from './assessment'

export type OmrMarkState = 'FILLED' | 'EMPTY' | 'MULTIPLE' | 'AMBIGUOUS' | 'UNREADABLE'

export type OmrBubbleState = 'FILLED' | 'EMPTY' | 'UNCERTAIN'

export type OmrBubbleMeasurement = {
  choiceId: string
  label: string
  centerMm: { xMm: number; yMm: number }
  centerNormalized: { x: number; y: number }
  radiusMm: number
  /** Darkness percentage of interior pixels (0 to 100) */
  fillPercentage: number
  /** Local paper background darkness (0 to 100) */
  backgroundDarkness: number
  /** Contrast = fillPercentage - backgroundDarkness */
  contrast: number
  state: OmrBubbleState
  isMarked: boolean
}

export type OmrItemRecognition = {
  itemId: string
  itemNumber: number
  questionType: QuestionType
  isMachineCheckable: boolean
  state: OmrMarkState
  /** Selected choice IDs for MCQ, Multi-select */
  selectedChoiceIds: string[]
  /** Selected labels ('A', 'B', 'T', etc.) */
  selectedLabels: string[]
  /** For True/False */
  trueFalseValue?: boolean
  /** For Matching: promptId -> choiceId */
  matchingMatches?: Record<string, string>
  /** Overall confidence for this item (0.0 to 1.0) */
  confidence: number
  /** If true, requires teacher review / confirmation */
  needsReview: boolean
  /** Descriptive reason for review if flagged */
  reviewReason?: string
  /** Individual measurements for each bubble in this item */
  bubbles: OmrBubbleMeasurement[]
  boundsMm: { xMm: number; yMm: number; widthMm: number; heightMm: number }
  /** Base64 JPEG crop of student's handwriting box for subjective items */
  writingCropBase64?: string
  /** Optional AI-assisted score suggestion (requires teacher consent) */
  aiGradingSuggestion?: {
    transcript: string
    suggestedPoints: number
    feedback: string
    confidence: number
  }
}

export type OmrScanStatus =
  | 'SUCCESS'
  | 'NEEDS_REVIEW'
  | 'MISMATCHED_ASSESSMENT'
  | 'MISMATCHED_VERSION'
  | 'UNREADABLE_QR'
  | 'MARKERS_NOT_FOUND'
  | 'WARP_FAILED'
  | 'CORRUPT_IMAGE'

export type OmrScanSummary = {
  totalQuestions: number
  machineScanned: number
  filledCount: number
  emptyCount: number
  multipleCount: number
  ambiguousCount: number
  manualScoringCount: number
  needsReviewCount: number
}

export type OmrScanResult = {
  status: OmrScanStatus
  success: boolean
  needsReview: boolean
  assessmentId?: string
  assessmentVersion?: number
  layoutVersion?: string
  mode?: AnswerSheetMode
  learnerId?: string
  recognizedItems: OmrItemRecognition[]
  summary: OmrScanSummary
  imageFingerprint: string
  processingTimeMs: number
  errorMessage?: string
  /** Normalized corner points detected in original image */
  detectedCorners?: {
    topLeft: { x: number; y: number }
    topRight: { x: number; y: number }
    bottomLeft: { x: number; y: number }
    bottomRight: { x: number; y: number }
  }
}

export type OmrImageBuffer = {
  width: number
  height: number
  /** Grayscale pixel array (0 = black, 255 = white), length = width * height */
  data: Uint8Array
}
