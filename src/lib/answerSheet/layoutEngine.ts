import type {
  AssessmentBlueprint,
  AssessmentItem,
  AssessmentMatchingAnswer,
  AssessmentMultipleChoiceAnswer,
  AssessmentMultipleSelectAnswer,
  QuestionType,
} from '../../types/assessment'
import type {
  AnswerSheetBubbleOption,
  AnswerSheetDefinition,
  AnswerSheetFiducialMarker,
  AnswerSheetGenerateOptions,
  AnswerSheetItemRegion,
  AnswerSheetMatchingPromptRow,
  AnswerSheetPageLayout,
  AnswerSheetPaperSize,
  AnswerSheetPoint,
  AnswerSheetRectMm,
} from '../../types/answerSheet'
import { calculateAnswerSheetCompatibility, isQuestionTypeMachineCheckable } from './compatibility'
import { resolveSlipsPerPage } from './answerSheetDocxExport'
import { generateQrSvgPath } from './qrEncoder'
import { encodeAnswerSheetQrPayload } from './qrPayload'

export const PAPER_DIMENSIONS_MM: Record<AnswerSheetPaperSize, { widthMm: number; heightMm: number }> = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
  legal: { widthMm: 215.9, heightMm: 355.6 },
  folio: { widthMm: 215.9, heightMm: 330.2 },
}

const MARGIN_MM = 6
const FIDUCIAL_SIZE_MM = 5.5
const QR_SIZE_MM = 13
const BUBBLE_RADIUS_MM = 1.9
const BUBBLE_SPACING_MM = 5.2

function resolveItemPointRangeLabel(item: AssessmentItem): string {
  const start = Number(item.pointStart)
  const end = Number(item.pointEnd)
  if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start > 0 && end >= start) {
    return start === end ? `${start}` : `${start}–${end}`
  }
  return `${item.itemNumber}`
}

function resolveMcqChoices(item: AssessmentItem): { id: string; label: string }[] {
  if (item.questionType === 'multiple_choice' && item.answer.type === 'multiple_choice') {
    const mcqAnswer = item.answer as AssessmentMultipleChoiceAnswer
    if (Array.isArray(mcqAnswer.choices) && mcqAnswer.choices.length > 0) {
      return mcqAnswer.choices.map((choice, index) => ({
        id: choice.id || `choice-${index + 1}`,
        label: String.fromCharCode(65 + index), // 'A', 'B', 'C', 'D', 'E'
      }))
    }
  }
  // Default 4 choices A-D
  return [
    { id: 'choice-1', label: 'A' },
    { id: 'choice-2', label: 'B' },
    { id: 'choice-3', label: 'C' },
    { id: 'choice-4', label: 'D' },
  ]
}

function resolveMultiSelectChoices(item: AssessmentItem): { id: string; label: string }[] {
  if (item.questionType === 'multiple_select' && item.answer.type === 'multiple_select') {
    const msAnswer = item.answer as AssessmentMultipleSelectAnswer
    if (Array.isArray(msAnswer.choices) && msAnswer.choices.length > 0) {
      return msAnswer.choices.map((choice, index) => ({
        id: choice.id || `choice-${index + 1}`,
        label: String.fromCharCode(65 + index),
      }))
    }
  }
  return [
    { id: 'choice-1', label: 'A' },
    { id: 'choice-2', label: 'B' },
    { id: 'choice-3', label: 'C' },
    { id: 'choice-4', label: 'D' },
  ]
}

function resolveMatchingPrompts(item: AssessmentItem): {
  prompts: { id: string; label: string; number: number }[]
  choices: { id: string; label: string }[]
} {
  if (item.questionType === 'matching' && item.answer.type === 'matching') {
    const matchAnswer = item.answer as AssessmentMatchingAnswer
    const prompts = (matchAnswer.prompts || []).map((p, index) => ({
      id: p.id || `prompt-${index + 1}`,
      label: `${index + 1}`,
      number: index + 1,
    }))
    const choices = (matchAnswer.choices || []).map((c, index) => ({
      id: c.id || `choice-${index + 1}`,
      label: c.label || String.fromCharCode(65 + index),
    }))
    return { prompts, choices }
  }
  return {
    prompts: [
      { id: 'prompt-1', label: '1', number: 1 },
      { id: 'prompt-2', label: '2', number: 2 },
    ],
    choices: [
      { id: 'choice-1', label: 'A' },
      { id: 'choice-2', label: 'B' },
    ],
  }
}

/**
 * Deterministically generates layout geometry for a Smart Answer Sheet.
 */
export function generateAnswerSheetLayout(
  assessment: AssessmentBlueprint,
  options: AnswerSheetGenerateOptions = {},
): AnswerSheetDefinition {
  const paperSize = options.paperSize ?? 'a4'
  const mode = options.mode ?? 'generic'
  const dims = PAPER_DIMENSIONS_MM[paperSize] || PAPER_DIMENSIONS_MM.a4
  const W = dims.widthMm

  const sortedItems = [...(assessment.items || [])].sort((a, b) => a.itemNumber - b.itemNumber)
  const totalItems = sortedItems.length

  const slipsPerPage = options.slipsPerPage || resolveSlipsPerPage(totalItems, options.density)
  const H = dims.heightMm / slipsPerPage
  const now = options.now ?? new Date().toISOString()

  const learner = mode === 'personalized' && options.learner
    ? {
        id: options.learner.id,
        displayName: options.learner.displayName,
        localReference: options.learner.localReference ?? null,
      }
    : undefined

  const compatibility = calculateAnswerSheetCompatibility(assessment)

  // 1. Fiducial Markers at 4 corners of this slip
  const fiducials: AnswerSheetPageLayout['fiducialMarkers'] = {
    topLeft: {
      corner: 'top-left',
      centerMm: { xMm: MARGIN_MM + FIDUCIAL_SIZE_MM / 2, yMm: MARGIN_MM + FIDUCIAL_SIZE_MM / 2 },
      sizeMm: FIDUCIAL_SIZE_MM,
    },
    topRight: {
      corner: 'top-right',
      centerMm: { xMm: W - MARGIN_MM - FIDUCIAL_SIZE_MM / 2, yMm: MARGIN_MM + FIDUCIAL_SIZE_MM / 2 },
      sizeMm: FIDUCIAL_SIZE_MM,
    },
    bottomLeft: {
      corner: 'bottom-left',
      centerMm: { xMm: MARGIN_MM + FIDUCIAL_SIZE_MM / 2, yMm: H - MARGIN_MM - FIDUCIAL_SIZE_MM / 2 },
      sizeMm: FIDUCIAL_SIZE_MM,
    },
    bottomRight: {
      corner: 'bottom-right',
      centerMm: { xMm: W - MARGIN_MM - FIDUCIAL_SIZE_MM / 2, yMm: H - MARGIN_MM - FIDUCIAL_SIZE_MM / 2 },
      sizeMm: FIDUCIAL_SIZE_MM,
    },
  }

  // 2. QR Code Payload & SVG (Compact 13mm size)
  const qrPayload = encodeAnswerSheetQrPayload({
    assessmentId: assessment.id,
    assessmentVersion: assessment.versionNumber || 1,
    layoutVersion: 'v1',
    mode,
    learnerId: learner?.id,
  })

  const qrBoundsMm: AnswerSheetRectMm = {
    xMm: W - MARGIN_MM - FIDUCIAL_SIZE_MM - QR_SIZE_MM - 2,
    yMm: MARGIN_MM,
    widthMm: QR_SIZE_MM,
    heightMm: QR_SIZE_MM,
  }

  const { svgPath } = generateQrSvgPath(qrPayload, QR_SIZE_MM)

  // 3. Header & Learner Block Bounds (Clean, Space-Saving)
  const headerBoundsMm: AnswerSheetRectMm = {
    xMm: MARGIN_MM + FIDUCIAL_SIZE_MM + 3,
    yMm: MARGIN_MM,
    widthMm: qrBoundsMm.xMm - (MARGIN_MM + FIDUCIAL_SIZE_MM + 5),
    heightMm: 7.5,
  }

  const learnerBoxBoundsMm: AnswerSheetRectMm = {
    xMm: MARGIN_MM + FIDUCIAL_SIZE_MM + 3,
    yMm: headerBoundsMm.yMm + headerBoundsMm.heightMm + 1,
    widthMm: qrBoundsMm.xMm - (MARGIN_MM + FIDUCIAL_SIZE_MM + 5),
    heightMm: 5.5,
  }

  // 4. Grid Geometry Planning
  const contentTopY = learnerBoxBoundsMm.yMm + learnerBoxBoundsMm.heightMm + 3.5
  const contentBottomY = H - MARGIN_MM - FIDUCIAL_SIZE_MM - 1.5
  const availableHeightMm = Math.max(20, contentBottomY - contentTopY)
  const contentLeftX = MARGIN_MM + FIDUCIAL_SIZE_MM + 2
  const contentRightX = W - MARGIN_MM - FIDUCIAL_SIZE_MM - 2
  const contentWidthMm = contentRightX - contentLeftX

  // Determine column count based on item count:
  let numColumns = 2
  if (totalItems > 45) numColumns = 5
  else if (totalItems > 24) numColumns = 4
  else if (totalItems > 10 && slipsPerPage >= 2) numColumns = 3
  else if (totalItems > 15) numColumns = 3

  const columnGapMm = 4
  const columnWidthMm = (contentWidthMm - (numColumns - 1) * columnGapMm) / numColumns
  const itemsPerColumn = Math.ceil(totalItems / numColumns) || 1

  const rowHeightMm = Math.min(6.5, Math.max(4.6, availableHeightMm / itemsPerColumn))

  const itemRegions: AnswerSheetItemRegion[] = []

  sortedItems.forEach((item, index) => {
    const colIndex = Math.floor(index / itemsPerColumn)
    const rowIndex = index % itemsPerColumn

    const colX = contentLeftX + colIndex * (columnWidthMm + columnGapMm)
    const itemY = contentTopY + rowIndex * rowHeightMm

    const pointRangeLabel = resolveItemPointRangeLabel(item)
    const isMachine = isQuestionTypeMachineCheckable(item.questionType)
    const pointsPossible = Number(item.pointsPossible ?? item.points ?? 1)

    const itemBounds: AnswerSheetRectMm = {
      xMm: colX,
      yMm: itemY,
      widthMm: columnWidthMm,
      heightMm: rowHeightMm,
    }

    const bubbles: AnswerSheetBubbleOption[] = []
    let matchingPrompts: AnswerSheetMatchingPromptRow[] | undefined
    let manualBox: AnswerSheetItemRegion['manualBox']

    // Horizontal layout within column:
    // [Number: 7mm] [Bubbles or Manual area: remaining]
    const numberWidthMm = 7
    const bubbleAreaStartX = colX + numberWidthMm + 1.5

    if (item.questionType === 'multiple_choice') {
      const choices = resolveMcqChoices(item)
      choices.forEach((choice, cIdx) => {
        bubbles.push({
          id: choice.id,
          label: choice.label,
          centerMm: {
            xMm: bubbleAreaStartX + cIdx * BUBBLE_SPACING_MM + BUBBLE_RADIUS_MM,
            yMm: itemY + rowHeightMm / 2,
          },
          radiusMm: BUBBLE_RADIUS_MM,
        })
      })
    } else if (item.questionType === 'true_false') {
      const tfOptions = [
        { id: 'T', label: 'T' },
        { id: 'F', label: 'F' },
      ]
      tfOptions.forEach((option, oIdx) => {
        bubbles.push({
          id: option.id,
          label: option.label,
          centerMm: {
            xMm: bubbleAreaStartX + oIdx * (BUBBLE_SPACING_MM * 1.2) + BUBBLE_RADIUS_MM,
            yMm: itemY + rowHeightMm / 2,
          },
          radiusMm: BUBBLE_RADIUS_MM,
        })
      })
    } else if (item.questionType === 'multiple_select') {
      const choices = resolveMultiSelectChoices(item)
      choices.forEach((choice, cIdx) => {
        bubbles.push({
          id: choice.id,
          label: choice.label,
          centerMm: {
            xMm: bubbleAreaStartX + cIdx * BUBBLE_SPACING_MM + BUBBLE_RADIUS_MM,
            yMm: itemY + rowHeightMm / 2,
          },
          radiusMm: BUBBLE_RADIUS_MM,
        })
      })
    } else if (item.questionType === 'matching') {
      const { prompts, choices } = resolveMatchingPrompts(item)
      matchingPrompts = prompts.map((prompt, pIdx) => {
        const promptRowBubbles: AnswerSheetBubbleOption[] = choices.map((choice, cIdx) => ({
          id: `${prompt.id}:${choice.id}`,
          label: choice.label,
          centerMm: {
            xMm: bubbleAreaStartX + 5 + cIdx * (BUBBLE_SPACING_MM * 0.9) + BUBBLE_RADIUS_MM,
            yMm: itemY + rowHeightMm / 2,
          },
          radiusMm: BUBBLE_RADIUS_MM,
        }))
        return {
          promptId: prompt.id,
          promptNumber: prompt.number,
          promptLabel: `${prompt.number}.`,
          bubbles: promptRowBubbles,
        }
      })
    } else {
      // Manual / Teacher-Scored Question
      manualBox = {
        boundsMm: {
          xMm: bubbleAreaStartX,
          yMm: itemY + 0.8,
          widthMm: columnWidthMm - numberWidthMm - 3,
          heightMm: rowHeightMm - 1.6,
        },
        pointsPossible,
      }
    }

    itemRegions.push({
      itemId: item.id,
      itemNumber: item.itemNumber,
      pointRangeLabel,
      questionType: item.questionType,
      isMachineCheckable: isMachine,
      boundsMm: itemBounds,
      pageNumber: 1,
      bubbles,
      matchingPrompts,
      manualBox,
    })
  })

  const pageLayout: AnswerSheetPageLayout = {
    pageNumber: 1,
    totalPages: 1,
    paperSize,
    dimensionsMm: { widthMm: W, heightMm: H },
    fiducialMarkers: fiducials,
    qrCode: {
      boundsMm: qrBoundsMm,
      payload: qrPayload,
      svgPath,
    },
    headerBoundsMm,
    learnerBoxBoundsMm,
    items: itemRegions,
  }

  return {
    layoutVersion: 'v1',
    mode,
    assessmentId: assessment.id,
    assessmentVersionNumber: assessment.versionNumber || 1,
    assessmentTitle: assessment.title || 'Assessment',
    gradeLevel: assessment.gradeLevel || '',
    learningArea: assessment.learningArea || '',
    schoolYear: assessment.schoolYear || '',
    gradingTermLabel: assessment.gradingTermLabel || '',
    assignmentId: assessment.assignmentId || undefined,
    learner,
    paperSize,
    pages: [pageLayout],
    compatibility,
    generatedAt: now,
  }
}
