import type { AssessmentBlueprint } from '../../types/assessment'
import type { AnswerSheetDefinition } from '../../types/answerSheet'
import type { OmrImageBuffer, OmrScanResult, OmrScanSummary } from '../../types/omr'
import { generateAnswerSheetLayout, PAPER_DIMENSIONS_MM } from '../answerSheet/layoutEngine'
import { decodeAnswerSheetQrPayload, validateQrMatchesAssessment } from '../answerSheet/qrPayload'
import { detectFiducialCorners } from './cornerDetection'
import { detectMarksOnRectifiedSheet } from './markDetector'
import { warpPerspectiveGrayscale, type QuadCorners } from './perspectiveWarp'

export type ProcessOmrOptions = {
  /** Target assessment blueprint to validate against */
  expectedAssessment?: AssessmentBlueprint
  /** Layout definition if already generated */
  layoutDefinition?: AnswerSheetDefinition
  /** Expected version number */
  expectedVersionNumber?: number
  /** Expected assessment document ID */
  expectedAssessmentId?: string
  /** Provided QR payload if QR was decoded via camera hardware / scanner before OMR */
  scannedQrPayload?: string
  now?: string
}

/**
 * Computes a fast 32-character hexadecimal fingerprint from image pixels.
 */
export function computeImageFingerprint(image: OmrImageBuffer): string {
  let hash1 = 0x811c9dc5
  let hash2 = 0x9e3779b9
  const step = 32 // Fine-grained sampling to detect single bubble markings

  for (let i = 0; i < image.data.length; i += step) {
    const byte = image.data[i]
    hash1 = Math.imul(hash1 ^ byte, 0x01000193)
    hash2 = Math.imul(hash2 ^ (byte << 1), 0x85ebca6b)
  }

  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0')
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0')
  const len = image.data.length.toString(16).padStart(8, '0')
  const dim = `${image.width}x${image.height}`

  return `img-${h1}-${h2}-${len}-${dim}`
}

/**
 * Full deterministic OMR scanning engine for GuroDesk Smart Answer Sheets.
 */
export function processAnswerSheetImage(
  image: OmrImageBuffer,
  options: ProcessOmrOptions = {},
): OmrScanResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const fingerprint = computeImageFingerprint(image)

  const emptySummary: OmrScanSummary = {
    totalQuestions: 0,
    machineScanned: 0,
    filledCount: 0,
    emptyCount: 0,
    multipleCount: 0,
    ambiguousCount: 0,
    manualScoringCount: 0,
    needsReviewCount: 0,
  }

  // 1. Validate Image Resolution & Integrity
  if (!image || !image.data || image.width < 100 || image.height < 100) {
    return {
      status: 'CORRUPT_IMAGE',
      success: false,
      needsReview: true,
      recognizedItems: [],
      summary: emptySummary,
      imageFingerprint: fingerprint,
      processingTimeMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime),
      errorMessage: 'Invalid or corrupt image buffer.',
    }
  }

  // 2. Decode & Validate QR Code
  const rawQr = options.scannedQrPayload
  let qrDecoded = rawQr ? decodeAnswerSheetQrPayload(rawQr) : null

  if (rawQr && (!qrDecoded || !qrDecoded.success)) {
    return {
      status: 'UNREADABLE_QR',
      success: false,
      needsReview: true,
      recognizedItems: [],
      summary: emptySummary,
      imageFingerprint: fingerprint,
      processingTimeMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime),
      errorMessage: qrDecoded?.error || 'Unable to decode answer sheet QR code.',
    }
  }

  // Validate QR payload against expected assessment
  const expectedAsmId = options.expectedAssessmentId ?? options.expectedAssessment?.id
  const expectedVersion = options.expectedVersionNumber ?? options.expectedAssessment?.versionNumber ?? 1

  if (qrDecoded?.payload && expectedAsmId) {
    const qrMatch = validateQrMatchesAssessment(qrDecoded.payload, expectedAsmId, expectedVersion)
    if (!qrMatch.valid) {
      const isVerMismatch = qrDecoded.payload.assessmentId === expectedAsmId
      return {
        status: isVerMismatch ? 'MISMATCHED_VERSION' : 'MISMATCHED_ASSESSMENT',
        success: false,
        needsReview: true,
        assessmentId: qrDecoded.payload.assessmentId,
        assessmentVersion: qrDecoded.payload.assessmentVersion,
        layoutVersion: qrDecoded.payload.layoutVersion,
        mode: qrDecoded.payload.mode,
        learnerId: qrDecoded.payload.learnerId,
        recognizedItems: [],
        summary: emptySummary,
        imageFingerprint: fingerprint,
        processingTimeMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime),
        errorMessage: qrMatch.reason,
      }
    }
  }

  // 3. Build or use Answer Sheet Definition
  const sheetDefinition: AnswerSheetDefinition = options.layoutDefinition
    ?? (options.expectedAssessment
      ? generateAnswerSheetLayout(options.expectedAssessment, {
          mode: qrDecoded?.payload?.mode ?? 'generic',
        })
      : null as never)

  if (!sheetDefinition) {
    return {
      status: 'NEEDS_REVIEW',
      success: false,
      needsReview: true,
      recognizedItems: [],
      summary: emptySummary,
      imageFingerprint: fingerprint,
      processingTimeMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime),
      errorMessage: 'Assessment blueprint or layout definition is required to decode answer regions.',
    }
  }

  // 4. Detect 4 Corner Fiducials
  const cornerResult = detectFiducialCorners(image)
  if (!cornerResult.success || !cornerResult.corners) {
    return {
      status: 'MARKERS_NOT_FOUND',
      success: false,
      needsReview: true,
      recognizedItems: [],
      summary: emptySummary,
      imageFingerprint: fingerprint,
      processingTimeMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime),
      errorMessage: cornerResult.error || 'Corner markers could not be detected. Ensure all 4 black corner squares are clearly in frame.',
    }
  }

  // 5. Rectify Image using 4-point Homography Warp to whole page coordinates
  const targetWidth = 1050
  const page0 = sheetDefinition.pages[0]
  const pageW = page0.dimensionsMm.widthMm
  const pageH = page0.dimensionsMm.heightMm
  const targetHeight = Math.round(targetWidth * (pageH / pageW))

  const dstFiducials: QuadCorners = {
    topLeft: {
      x: (page0.fiducialMarkers.topLeft.centerMm.xMm / pageW) * targetWidth,
      y: (page0.fiducialMarkers.topLeft.centerMm.yMm / pageH) * targetHeight,
    },
    topRight: {
      x: (page0.fiducialMarkers.topRight.centerMm.xMm / pageW) * targetWidth,
      y: (page0.fiducialMarkers.topRight.centerMm.yMm / pageH) * targetHeight,
    },
    bottomLeft: {
      x: (page0.fiducialMarkers.bottomLeft.centerMm.xMm / pageW) * targetWidth,
      y: (page0.fiducialMarkers.bottomLeft.centerMm.yMm / pageH) * targetHeight,
    },
    bottomRight: {
      x: (page0.fiducialMarkers.bottomRight.centerMm.xMm / pageW) * targetWidth,
      y: (page0.fiducialMarkers.bottomRight.centerMm.yMm / pageH) * targetHeight,
    },
  }

  let rectifiedImage: OmrImageBuffer

  try {
    rectifiedImage = warpPerspectiveGrayscale(
      image,
      cornerResult.corners,
      targetWidth,
      targetHeight,
      dstFiducials,
    )
  } catch (warpError) {
    return {
      status: 'WARP_FAILED',
      success: false,
      needsReview: true,
      recognizedItems: [],
      summary: emptySummary,
      imageFingerprint: fingerprint,
      processingTimeMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime),
      errorMessage: warpError instanceof Error ? warpError.message : 'Perspective rectification failed.',
    }
  }

  // 6. Photometric Mark Detection
  const recognizedItems = detectMarksOnRectifiedSheet(rectifiedImage, sheetDefinition, 0)

  // 7. Aggregate Summary
  let filledCount = 0
  let emptyCount = 0
  let multipleCount = 0
  let ambiguousCount = 0
  let manualScoringCount = 0
  let needsReviewCount = 0

  for (const item of recognizedItems) {
    if (!item.isMachineCheckable) {
      manualScoringCount++
    } else {
      if (item.state === 'FILLED') filledCount++
      else if (item.state === 'EMPTY') emptyCount++
      else if (item.state === 'MULTIPLE') multipleCount++
      else if (item.state === 'AMBIGUOUS') ambiguousCount++
    }

    if (item.needsReview) {
      needsReviewCount++
    }
  }

  const summary: OmrScanSummary = {
    totalQuestions: recognizedItems.length,
    machineScanned: recognizedItems.length - manualScoringCount,
    filledCount,
    emptyCount,
    multipleCount,
    ambiguousCount,
    manualScoringCount,
    needsReviewCount,
  }

  const overallNeedsReview = needsReviewCount > 0
  const processingTimeMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime)

  return {
    status: overallNeedsReview ? 'NEEDS_REVIEW' : 'SUCCESS',
    success: true,
    needsReview: overallNeedsReview,
    assessmentId: qrDecoded?.payload?.assessmentId ?? sheetDefinition.assessmentId,
    assessmentVersion: qrDecoded?.payload?.assessmentVersion ?? sheetDefinition.assessmentVersionNumber,
    layoutVersion: qrDecoded?.payload?.layoutVersion ?? sheetDefinition.layoutVersion,
    mode: qrDecoded?.payload?.mode ?? sheetDefinition.mode,
    learnerId: qrDecoded?.payload?.learnerId ?? sheetDefinition.learner?.id,
    recognizedItems,
    summary,
    imageFingerprint: fingerprint,
    processingTimeMs,
    detectedCorners: cornerResult.corners
      ? {
          topLeft: { x: cornerResult.corners.topLeft.x / image.width, y: cornerResult.corners.topLeft.y / image.height },
          topRight: { x: cornerResult.corners.topRight.x / image.width, y: cornerResult.corners.topRight.y / image.height },
          bottomLeft: { x: cornerResult.corners.bottomLeft.x / image.width, y: cornerResult.corners.bottomLeft.y / image.height },
          bottomRight: { x: cornerResult.corners.bottomRight.x / image.width, y: cornerResult.corners.bottomRight.y / image.height },
        }
      : undefined,
  }
}
