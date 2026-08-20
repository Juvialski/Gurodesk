import type { AssessmentBlueprint } from '../../types/assessment'
import type { AnswerSheetDefinition, AnswerSheetRectMm } from '../../types/answerSheet'
import type { OmrImageBuffer, OmrScanResult, OmrScanSummary } from '../../types/omr'
import type { ResultAssessmentSnapshot } from '../../types/results'
import { generateAnswerSheetLayout } from '../answerSheet/layoutEngine'
import { decodeAnswerSheetQrPayload, validateQrMatchesAssessment } from '../answerSheet/qrPayload'
import { detectFiducialCorners } from './cornerDetection'
import { detectMarksOnRectifiedSheet } from './markDetector'
import { warpPerspectiveGrayscale, type QuadCorners } from './perspectiveWarp'
import { decodeQrFromRectifiedImage } from './qrDecoder'
import { assessmentSnapshotToBlueprint } from './omrResultsAdapter'

export type ProcessOmrOptions = {
  /** Target assessment blueprint to validate against */
  expectedAssessment?: AssessmentBlueprint
  /** Result assessment snapshot from active session */
  expectedAssessmentSnapshot?: ResultAssessmentSnapshot
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

  // 2. Detect 4 Corner Fiducials
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

  // Determine candidate blueprint
  const candidateBlueprint = options.expectedAssessment
    || (options.expectedAssessmentSnapshot ? assessmentSnapshotToBlueprint(options.expectedAssessmentSnapshot) : undefined)

  // 3. Temporary layout geometry for homography (default A4 or from provided layout/snapshot)
  const defaultPaperSize = options.layoutDefinition?.paperSize || 'a4'
  const defaultPaperDims = defaultPaperSize === 'letter' ? { widthMm: 215.9, heightMm: 279.4 } : { widthMm: 210, heightMm: 297 }
  const tempSheet = options.layoutDefinition
    || (candidateBlueprint ? generateAnswerSheetLayout(candidateBlueprint, { paperSize: defaultPaperSize }) : null)

  const page0 = tempSheet?.pages[0] || {
    dimensionsMm: defaultPaperDims,
    fiducialMarkers: {
      topLeft: { centerMm: { xMm: 8.75, yMm: 8.75 }, sizeMm: 5.5 },
      topRight: { centerMm: { xMm: defaultPaperDims.widthMm - 8.75, yMm: 8.75 }, sizeMm: 5.5 },
      bottomLeft: { centerMm: { xMm: 8.75, yMm: defaultPaperDims.heightMm - 8.75 }, sizeMm: 5.5 },
      bottomRight: { centerMm: { xMm: defaultPaperDims.widthMm - 8.75, yMm: defaultPaperDims.heightMm - 8.75 }, sizeMm: 5.5 },
    },
    qrCode: {
      boundsMm: {
        xMm: defaultPaperDims.widthMm - 6 - 5.5 - 13 - 2,
        yMm: 6,
        widthMm: 13,
        heightMm: 13,
      },
    },
  }

  const pageW = page0.dimensionsMm.widthMm
  const pageH = page0.dimensionsMm.heightMm
  const targetWidth = 1050
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

  // 4. Rectify Image using 4-point Homography Warp to whole page coordinates
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

  // 5. Decode QR Code from rectified image if not provided
  let rawQr = options.scannedQrPayload
  if (!rawQr) {
    const qrBoundsMm: AnswerSheetRectMm = page0.qrCode?.boundsMm || {
      xMm: pageW - 6 - 5.5 - 13 - 2,
      yMm: 6,
      widthMm: 13,
      heightMm: 13,
    }
    const detectedQr = decodeQrFromRectifiedImage(rectifiedImage, qrBoundsMm, { widthMm: pageW, heightMm: pageH })
    if (detectedQr) {
      rawQr = detectedQr
    }
  }

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
  const expectedAsmId = options.expectedAssessmentId
    ?? options.expectedAssessment?.id
    ?? options.expectedAssessmentSnapshot?.assessmentId

  const expectedVersion = options.expectedVersionNumber
    ?? options.expectedAssessment?.versionNumber
    ?? options.expectedAssessmentSnapshot?.assessmentVersionNumber
    ?? 1

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

  // 6. Build final authoritative Answer Sheet Definition
  let sheetDefinition: AnswerSheetDefinition | null = options.layoutDefinition || null

  if (!sheetDefinition && candidateBlueprint) {
    sheetDefinition = generateAnswerSheetLayout(candidateBlueprint, {
      mode: qrDecoded?.payload?.mode ?? 'generic',
      paperSize: qrDecoded?.payload?.paperSize ?? 'a4',
      slipsPerPage: qrDecoded?.payload?.slipsPerPage,
      density: qrDecoded?.payload?.density,
    })
  }

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

  // 7. Photometric Mark Detection
  const recognizedItems = detectMarksOnRectifiedSheet(rectifiedImage, sheetDefinition, 0)

  // 8. Aggregate Summary
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
