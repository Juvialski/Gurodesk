import type { OmrImageBuffer } from '../../types/omr'

export type Point2D = { x: number; y: number }

export type QuadCorners = {
  topLeft: Point2D
  topRight: Point2D
  bottomLeft: Point2D
  bottomRight: Point2D
}

/**
 * Computes 3x3 projective transformation (Homography) matrix from 4 source points to 4 destination points.
 */
export function computeHomographyMatrix(src: QuadCorners, dst: QuadCorners): number[] {
  const ptsSrc = [src.topLeft, src.topRight, src.bottomLeft, src.bottomRight]
  const ptsDst = [dst.topLeft, dst.topRight, dst.bottomLeft, dst.bottomRight]

  // Inverse mapping so we can loop over destination pixels and sample source: H * P_dst = P_src
  const A: number[][] = []
  const B: number[] = []

  for (let i = 0; i < 4; i++) {
    const xd = ptsDst[i].x
    const yd = ptsDst[i].y
    const xs = ptsSrc[i].x
    const ys = ptsSrc[i].y

    A.push([xd, yd, 1, 0, 0, 0, -xd * xs, -yd * xs])
    B.push(xs)
    A.push([0, 0, 0, xd, yd, 1, -xd * ys, -yd * ys])
    B.push(ys)
  }

  // Gaussian elimination to solve 8x8 system
  const h = solveLinearSystem8x8(A, B)
  if (!h) {
    throw new Error('Degenerate quadrilateral: unable to compute homography matrix.')
  }
  return [...h, 1] // [h00, h01, h02, h10, h11, h12, h20, h21, h22=1]
}

function solveLinearSystem8x8(A: number[][], b: number[]): number[] | null {
  const n = 8
  const M = A.map((row, i) => [...row, b[i]])

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k
      }
    }
    if (Math.abs(M[maxRow][i]) < 1e-9) return null // Singular matrix

    // Swap rows
    const temp = M[i]
    M[i] = M[maxRow]
    M[maxRow] = temp

    // Normalize pivot row
    const pivot = M[i][i]
    for (let j = i; j <= n; j++) {
      M[i][j] /= pivot
    }

    // Eliminate other rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i]
        for (let j = i; j <= n; j++) {
          M[k][j] -= factor * M[i][j]
        }
      }
    }
  }

  return M.map((row) => row[n])
}

/**
 * Warps a distorted page image into a clean, rectified coordinate system using bilinear interpolation.
 */
export function warpPerspectiveGrayscale(
  srcImage: OmrImageBuffer,
  corners: QuadCorners,
  targetWidth: number,
  targetHeight: number,
  dstCorners?: QuadCorners,
): OmrImageBuffer {
  const defaultDst: QuadCorners = dstCorners ?? {
    topLeft: { x: 0, y: 0 },
    topRight: { x: targetWidth, y: 0 },
    bottomLeft: { x: 0, y: targetHeight },
    bottomRight: { x: targetWidth, y: targetHeight },
  }

  const H = computeHomographyMatrix(corners, defaultDst)
  const targetData = new Uint8Array(targetWidth * targetHeight)

  const h00 = H[0], h01 = H[1], h02 = H[2]
  const h10 = H[3], h11 = H[4], h12 = H[5]
  const h20 = H[6], h21 = H[7], h22 = H[8]

  const srcW = srcImage.width
  const srcH = srcImage.height
  const srcData = srcImage.data

  for (let dy = 0; dy < targetHeight; dy++) {
    for (let dx = 0; dx < targetWidth; dx++) {
      const w = h20 * dx + h21 * dy + h22
      if (Math.abs(w) < 1e-9) {
        targetData[dy * targetWidth + dx] = 255
        continue
      }

      const sx = (h00 * dx + h01 * dy + h02) / w
      const sy = (h10 * dx + h11 * dy + h12) / w

      // Bilinear interpolation
      if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
        const x0 = Math.floor(sx)
        const y0 = Math.floor(sy)
        const x1 = x0 + 1
        const y1 = y0 + 1

        const fx = sx - x0
        const fy = sy - y0

        const p00 = srcData[y0 * srcW + x0]
        const p10 = srcData[y0 * srcW + x1]
        const p01 = srcData[y1 * srcW + x0]
        const p11 = srcData[y1 * srcW + x1]

        const top = p00 * (1 - fx) + p10 * fx
        const bottom = p01 * (1 - fx) + p11 * fx
        const val = Math.round(top * (1 - fy) + bottom * fy)

        targetData[dy * targetWidth + dx] = Math.max(0, Math.min(255, val))
      } else if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        const x0 = Math.min(srcW - 1, Math.max(0, Math.round(sx)))
        const y0 = Math.min(srcH - 1, Math.max(0, Math.round(sy)))
        targetData[dy * targetWidth + dx] = srcData[y0 * srcW + x0]
      } else {
        targetData[dy * targetWidth + dx] = 255 // White background outside
      }
    }
  }

  return {
    width: targetWidth,
    height: targetHeight,
    data: targetData,
  }
}
