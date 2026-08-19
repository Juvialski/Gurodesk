import type { OmrImageBuffer } from '../../types/omr'
import type { Point2D, QuadCorners } from './perspectiveWarp'

export type CornerDetectionResult = {
  success: boolean
  corners?: QuadCorners
  orientationAngleDegrees?: number
  error?: string
}

/**
 * Fast search for the 4 fiducial markers in the corners of an input image buffer.
 */
export function detectFiducialCorners(image: OmrImageBuffer): CornerDetectionResult {
  const { width: W, height: H, data } = image
  if (W < 200 || H < 200) {
    return { success: false, error: 'Image resolution too low for OMR scanning.' }
  }

  // 1. Estimate global background threshold
  let sum = 0
  const step = Math.max(1, Math.floor((W * H) / 5000))
  let sampleCount = 0
  for (let i = 0; i < data.length; i += step) {
    sum += data[i]
    sampleCount++
  }
  const meanBrightness = sum / (sampleCount || 1)
  const darkThreshold = Math.max(40, Math.min(160, meanBrightness * 0.55))

  // 2. Search quadrants for corner fiducial centers
  // Search window: within 25% of each image border
  const cornerRadiusX = Math.floor(W * 0.25)
  const cornerRadiusY = Math.floor(H * 0.25)

  const tl = findMarkerInRegion(data, W, H, 0, 0, cornerRadiusX, cornerRadiusY, darkThreshold)
  const tr = findMarkerInRegion(data, W, H, W - cornerRadiusX, 0, W, cornerRadiusY, darkThreshold)
  const bl = findMarkerInRegion(data, W, H, 0, H - cornerRadiusY, cornerRadiusX, H, darkThreshold)
  const br = findMarkerInRegion(data, W, H, W - cornerRadiusX, H - cornerRadiusY, W, H, darkThreshold)

  if (!tl || !tr || !bl || !br) {
    // If not all 4 found, attempt fallback with whole-border search
    return {
      success: false,
      error: 'Could not detect all 4 corner registration markers. Ensure the full paper is visible and unobstructed.',
    }
  }

  return {
    success: true,
    corners: {
      topLeft: tl,
      topRight: tr,
      bottomLeft: bl,
      bottomRight: br,
    },
    orientationAngleDegrees: 0,
  }
}

/**
 * Searches a rectangular region of the image for the centroid of the darkest coherent marker block.
 */
function findMarkerInRegion(
  data: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  threshold: number,
): Point2D | null {
  let bestScore = 0
  let bestX = 0
  let bestY = 0

  // Coarse scan
  const stride = Math.max(2, Math.floor(Math.min(maxX - minX, maxY - minY) / 40))
  const boxSize = Math.max(4, Math.floor(Math.min(imageWidth, imageHeight) * 0.025))

  for (let y = minY + boxSize; y < maxY - boxSize; y += stride) {
    for (let x = minX + boxSize; x < maxX - boxSize; x += stride) {
      // Evaluate darkness of box centered at (x, y)
      let darkPixels = 0
      let total = 0

      for (let by = -boxSize; by <= boxSize; by += 2) {
        for (let bx = -boxSize; bx <= boxSize; bx += 2) {
          const px = x + bx
          const py = y + by
          if (px >= 0 && px < imageWidth && py >= 0 && py < imageHeight) {
            const val = data[py * imageWidth + px]
            if (val < threshold) darkPixels++
            total++
          }
        }
      }

      const score = darkPixels / (total || 1)
      if (score > bestScore && score >= 0.45) {
        bestScore = score
        bestX = x
        bestY = y
      }
    }
  }

  if (bestScore < 0.45) return null

  // Refine center of mass around best candidate
  let sumX = 0
  let sumY = 0
  let count = 0
  const refineRadius = boxSize * 1.5

  const rx0 = Math.max(0, Math.floor(bestX - refineRadius))
  const rx1 = Math.min(imageWidth - 1, Math.floor(bestX + refineRadius))
  const ry0 = Math.max(0, Math.floor(bestY - refineRadius))
  const ry1 = Math.min(imageHeight - 1, Math.floor(bestY + refineRadius))

  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      const val = data[y * imageWidth + x]
      if (val < threshold) {
        sumX += x
        sumY += y
        count++
      }
    }
  }

  if (count < 10) return { x: bestX, y: bestY }
  return {
    x: sumX / count,
    y: sumY / count,
  }
}
