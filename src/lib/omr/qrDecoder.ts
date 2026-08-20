import type { OmrImageBuffer } from '../../types/omr'
import type { AnswerSheetRectMm } from '../../types/answerSheet'
import { decodeAnswerSheetQrPayload } from '../answerSheet/qrPayload'

/**
 * QR Code De-masking and bit unpacking utilities
 */
const FORMAT_INFO_MASK = 0x5412

function binarizeOtsu(data: Uint8Array, width: number, height: number): Uint8Array {
  const hist = new Int32Array(256)
  const total = width * height
  for (let i = 0; i < total; i++) {
    hist[data[i]]++
  }

  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]

  let sumB = 0
  let wB = 0
  let wF = 0
  let varMax = 0
  let threshold = 128

  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    wF = total - wB
    if (wF === 0) break

    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const varBetween = wB * wF * (mB - mF) * (mB - mF)

    if (varBetween > varMax) {
      varMax = varBetween
      threshold = t
    }
  }

  const binary = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    binary[i] = data[i] < threshold ? 1 : 0 // 1 = black, 0 = white
  }
  return binary
}

/**
 * Attempts to decode QR code using browser native BarcodeDetector if available.
 */
export async function decodeQrWithNativeDetector(image: OmrImageBuffer): Promise<string | null> {
  if (typeof window === 'undefined') return null

  // Check BarcodeDetector API availability
  const hasDetector = 'BarcodeDetector' in window
  if (!hasDetector) return null

  try {
    const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
    const detector = new BarcodeDetectorClass({ formats: ['qr_code'] })

    // Create ImageData from grayscale buffer
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const imgData = ctx.createImageData(image.width, image.height)
    for (let i = 0, j = 0; i < image.data.length; i++, j += 4) {
      const val = image.data[i]
      imgData.data[j] = val
      imgData.data[j + 1] = val
      imgData.data[j + 2] = val
      imgData.data[j + 3] = 255
    }
    ctx.putImageData(imgData, 0, 0)

    const barcodes = await detector.detect(canvas)
    for (const barcode of barcodes) {
      if (barcode.rawValue && barcode.rawValue.startsWith('GD:AS:')) {
        const decoded = decodeAnswerSheetQrPayload(barcode.rawValue)
        if (decoded.success) {
          return barcode.rawValue
        }
      }
    }
  } catch (e) {
    // Fall back gracefully
  }

  return null
}

/**
 * Reads QR modules grid from known rectified coordinates and decodes the byte payload.
 */
export function decodeQrFromRectifiedImage(
  image: OmrImageBuffer,
  qrBoundsMm: AnswerSheetRectMm,
  pageDimsMm: { widthMm: number; heightMm: number },
): string | null {
  const { width: imgW, height: imgH, data } = image

  const qx0 = Math.floor((qrBoundsMm.xMm / pageDimsMm.widthMm) * imgW)
  const qy0 = Math.floor((qrBoundsMm.yMm / pageDimsMm.heightMm) * imgH)
  const qw = Math.floor((qrBoundsMm.widthMm / pageDimsMm.widthMm) * imgW)
  const qh = Math.floor((qrBoundsMm.heightMm / pageDimsMm.heightMm) * imgH)

  if (qx0 < 0 || qy0 < 0 || qx0 + qw > imgW || qy0 + qh > imgH || qw < 20 || qh < 20) {
    return null
  }

  // Extract sub-region
  const subData = new Uint8Array(qw * qh)
  for (let r = 0; r < qh; r++) {
    for (let c = 0; c < qw; c++) {
      subData[r * qw + c] = data[(qy0 + r) * imgW + (qx0 + c)]
    }
  }

  const binary = binarizeOtsu(subData, qw, qh)

  // Try standard QR sizes (21, 25, 29, 33, 37, 41, 45, 49, 53, 57)
  const candidateSizes = [33, 37, 29, 25, 41, 45, 21, 49, 53, 57]

  for (const size of candidateSizes) {
    const moduleW = qw / size
    const moduleH = qh / size

    const matrix: boolean[][] = []
    for (let r = 0; r < size; r++) {
      const row: boolean[] = []
      for (let c = 0; c < size; c++) {
        // Sample center 50% of module
        const cx = Math.floor((c + 0.5) * moduleW)
        const cy = Math.floor((r + 0.5) * moduleH)
        const sample = binary[cy * qw + cx] === 1
        row.push(sample)
      }
      matrix.push(row)
    }

    // Verify Finder Pattern at (0,0): 7x7 outer border black, 5x5 inner white, 3x3 center black
    if (
      !matrix[0][0] || !matrix[0][6] || !matrix[6][0] || !matrix[6][6] ||
      matrix[1][1] || matrix[1][5] || matrix[5][1] || matrix[5][5] ||
      !matrix[2][2] || !matrix[3][3] || !matrix[4][4]
    ) {
      continue
    }

    // Decode QR Matrix
    const result = decodeQrMatrixData(matrix, size)
    if (result) {
      const decoded = decodeAnswerSheetQrPayload(result)
      if (decoded.success) {
        return result
      }
    }
  }

  return null
}

function decodeQrMatrixData(matrix: boolean[][], size: number): string | null {
  // Read Format Info (Mask pattern 0-7)
  let formatBits = 0
  for (let i = 0; i < 6; i++) formatBits = (formatBits << 1) | (matrix[8][i] ? 1 : 0)
  formatBits = (formatBits << 1) | (matrix[8][7] ? 1 : 0)
  formatBits = (formatBits << 1) | (matrix[8][8] ? 1 : 0)
  formatBits = (formatBits << 1) | (matrix[7][8] ? 1 : 0)
  for (let i = 5; i >= 0; i--) formatBits = (formatBits << 1) | (matrix[i][8] ? 1 : 0)

  const unmaskedFormat = formatBits ^ FORMAT_INFO_MASK
  const mask = (unmaskedFormat >>> 10) & 0x07

  // Function modules mask
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  function markFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const curR = row + r
        const curC = col + c
        if (curR >= 0 && curR < size && curC >= 0 && curC < size) {
          isFunction[curR][curC] = true
        }
      }
    }
  }

  markFinder(0, 0)
  markFinder(0, size - 7)
  markFinder(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    isFunction[6][i] = true
    isFunction[i][6] = true
  }

  // Format info areas
  for (let i = 0; i <= 8; i++) {
    isFunction[8][i] = true
    isFunction[i][8] = true
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true
    isFunction[size - 1 - i][8] = true
  }

  // Dark module
  isFunction[size - 8][8] = true

  // Read data bits in zig-zag
  const bits: number[] = []
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--

    const upwards = ((right + 1) / 2) % 2 === 1
    for (let vert = 0; vert < size; vert++) {
      const r = upwards ? size - 1 - vert : vert
      for (let c = right; c >= right - 1; c--) {
        if (!isFunction[r][c]) {
          let val = matrix[r][c]
          const maskBit = (r + c) % 2 === 0
          if (mask === 0 ? maskBit : (r + c) % 2 === 0) {
            val = !val
          }
          bits.push(val ? 1 : 0)
        }
      }
    }
  }

  // Parse byte mode bitstream: Mode (4 bits: 0100) + Length (8 bits) + Data bytes
  if (bits.length < 12) return null

  let idx = 0
  function readBits(count: number): number {
    let val = 0
    for (let i = 0; i < count && idx < bits.length; i++) {
      val = (val << 1) | bits[idx++]
    }
    return val
  }

  const mode = readBits(4)
  if (mode !== 0b0100 && mode !== 0b0010 && mode !== 0b0001) {
    // Not standard byte or alphanumeric
  }

  const charCountBits = size <= 37 ? 8 : 16
  const charCount = readBits(charCountBits)

  if (charCount <= 0 || charCount > 500) return null

  const bytes: number[] = []
  for (let i = 0; i < charCount && idx + 8 <= bits.length; i++) {
    bytes.push(readBits(8))
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes))
    if (text && text.startsWith('GD:AS:')) {
      return text
    }
  } catch {
    // Decoding failed
  }

  return null
}
