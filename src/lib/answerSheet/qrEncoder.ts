/**
 * Pure TypeScript QR Code Generator (ISO/IEC 18004)
 * Deterministic, zero-dependency SVG & matrix generator.
 */

// Galois Field GF(256) tables with primitive polynomial 0x11d
const EXP_TABLE = new Uint8Array(512)
const LOG_TABLE = new Uint8Array(256)

let x = 1
for (let i = 0; i < 255; i++) {
  EXP_TABLE[i] = x
  EXP_TABLE[i + 255] = x
  LOG_TABLE[x] = i
  x = (x << 1) ^ ((x & 0x80) ? 0x11d : 0)
}

function gmult(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]]
}

// Reed-Solomon Generator Polynomial
function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1)
    const factor = EXP_TABLE[i]
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gmult(poly[j], factor)
      next[j + 1] ^= poly[j]
    }
    poly = next
  }
  return poly
}

function rsComputeRemainder(data: Uint8Array, numEcBytes: number): Uint8Array {
  const gen = rsGeneratorPoly(numEcBytes)
  const remainder = new Uint8Array(numEcBytes)
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0]
    for (let j = 0; j < numEcBytes - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gmult(gen[j + 1], factor)
    }
    remainder[numEcBytes - 1] = gmult(gen[numEcBytes], factor)
  }
  return remainder
}

// QR Version table for ECC Level M
// [totalDataBytes, ecBytesPerBlock, numBlocksGroup1, dataBytesPerBlockG1, numBlocksG2, dataBytesPerBlockG2]
type QrVersionConfig = {
  version: number
  size: number
  totalDataCapacity: number
  ecBytesPerBlock: number
  group1Blocks: number
  group1DataBytes: number
  group2Blocks: number
  group2DataBytes: number
  alignmentPositions: number[]
}

const QR_CONFIGS_M: QrVersionConfig[] = [
  { version: 1, size: 21, totalDataCapacity: 16, ecBytesPerBlock: 10, group1Blocks: 1, group1DataBytes: 16, group2Blocks: 0, group2DataBytes: 0, alignmentPositions: [] },
  { version: 2, size: 25, totalDataCapacity: 28, ecBytesPerBlock: 16, group1Blocks: 1, group1DataBytes: 28, group2Blocks: 0, group2DataBytes: 0, alignmentPositions: [6, 18] },
  { version: 3, size: 29, totalDataCapacity: 44, ecBytesPerBlock: 26, group1Blocks: 1, group1DataBytes: 44, group2Blocks: 0, group2DataBytes: 0, alignmentPositions: [6, 22] },
  { version: 4, size: 33, totalDataCapacity: 64, ecBytesPerBlock: 18, group1Blocks: 2, group1DataBytes: 32, group2Blocks: 0, group2DataBytes: 0, alignmentPositions: [6, 26] },
  { version: 5, size: 37, totalDataCapacity: 86, ecBytesPerBlock: 24, group1Blocks: 2, group1DataBytes: 43, group2Blocks: 0, group2DataBytes: 0, alignmentPositions: [6, 30] },
  { version: 6, size: 41, totalDataCapacity: 108, ecBytesPerBlock: 16, group1Blocks: 4, group1DataBytes: 27, group2Blocks: 0, group2DataBytes: 0, alignmentPositions: [6, 34] },
  { version: 7, size: 45, totalDataCapacity: 124, ecBytesPerBlock: 18, group1Blocks: 4, group1DataBytes: 31, group2Blocks: 0, group2DataBytes: 0, alignmentPositions: [6, 22, 38] },
  { version: 8, size: 49, totalDataCapacity: 154, ecBytesPerBlock: 22, group1Blocks: 2, group1DataBytes: 38, group2Blocks: 2, group2DataBytes: 39, alignmentPositions: [6, 24, 42] },
  { version: 9, size: 53, totalDataCapacity: 182, ecBytesPerBlock: 22, group1Blocks: 3, group1DataBytes: 36, group2Blocks: 2, group2DataBytes: 37, alignmentPositions: [6, 26, 46] },
  { version: 10, size: 57, totalDataCapacity: 216, ecBytesPerBlock: 26, group1Blocks: 4, group1DataBytes: 43, group2Blocks: 1, group2DataBytes: 44, alignmentPositions: [6, 28, 50] },
]

class BitBuffer {
  private buffer: number[] = []
  private length = 0

  put(num: number, count: number) {
    for (let i = count - 1; i >= 0; i--) {
      const bit = ((num >>> i) & 1) === 1
      this.putBit(bit)
    }
  }

  putBit(bit: boolean) {
    const byteIndex = this.length >>> 3
    if (this.buffer.length <= byteIndex) {
      this.buffer.push(0)
    }
    if (bit) {
      this.buffer[byteIndex] |= 0x80 >>> (this.length % 8)
    }
    this.length++
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer)
  }

  get bitLength(): number {
    return this.length
  }
}

function encodeQrData(text: string, config: QrVersionConfig): Uint8Array {
  const encoder = new TextEncoder()
  const textBytes = encoder.encode(text)
  const buffer = new BitBuffer()

  // Mode: 8-bit Byte (0100)
  buffer.put(0b0100, 4)

  // Character Count Indicator
  const charCountBits = config.version <= 9 ? 8 : 16
  buffer.put(textBytes.length, charCountBits)

  // Data bytes
  for (let i = 0; i < textBytes.length; i++) {
    buffer.put(textBytes[i], 8)
  }

  // Terminator (up to 4 zeroes)
  const remainingBits = config.totalDataCapacity * 8 - buffer.bitLength
  const terminatorBits = Math.min(4, Math.max(0, remainingBits))
  buffer.put(0, terminatorBits)

  // Pad to byte boundary
  while (buffer.bitLength % 8 !== 0) {
    buffer.putBit(false)
  }

  // Pad bytes: alternating 0xEC, 0x11
  let padByte = 0xec
  while (buffer.bitLength < config.totalDataCapacity * 8) {
    buffer.put(padByte, 8)
    padByte = padByte === 0xec ? 0x11 : 0xec
  }

  const rawBytes = buffer.getBytes()

  // Divide into blocks and compute Reed-Solomon EC
  const totalBlocks = config.group1Blocks + config.group2Blocks
  const dataBlocks: Uint8Array[] = []
  const ecBlocks: Uint8Array[] = []

  let offset = 0
  for (let b = 0; b < config.group1Blocks; b++) {
    const blockData = rawBytes.slice(offset, offset + config.group1DataBytes)
    dataBlocks.push(blockData)
    ecBlocks.push(rsComputeRemainder(blockData, config.ecBytesPerBlock))
    offset += config.group1DataBytes
  }
  for (let b = 0; b < config.group2Blocks; b++) {
    const blockData = rawBytes.slice(offset, offset + config.group2DataBytes)
    dataBlocks.push(blockData)
    ecBlocks.push(rsComputeRemainder(blockData, config.ecBytesPerBlock))
    offset += config.group2DataBytes
  }

  // Interleave data bytes
  const finalInterleaved: number[] = []
  const maxDataLen = Math.max(config.group1DataBytes, config.group2DataBytes || 0)
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < dataBlocks[b].length) {
        finalInterleaved.push(dataBlocks[b][i])
      }
    }
  }

  // Interleave EC bytes
  for (let i = 0; i < config.ecBytesPerBlock; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      finalInterleaved.push(ecBlocks[b][i])
    }
  }

  return new Uint8Array(finalInterleaved)
}

const FORMAT_INFO_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
]

export type QrMatrix = {
  size: number
  modules: boolean[][]
}

export function generateQrMatrix(text: string): QrMatrix {
  const encoder = new TextEncoder()
  const byteLen = encoder.encode(text).length

  // Select smallest version with sufficient capacity for Byte mode (header 4 bits + len 8/16 bits + data + term)
  const config = QR_CONFIGS_M.find((c) => {
    const headerBits = 4 + (c.version <= 9 ? 8 : 16)
    return (c.totalDataCapacity * 8 - headerBits) >= byteLen * 8
  })

  if (!config) {
    throw new Error(`Data too large for GuroDesk Smart Answer Sheet QR matrix (length: ${byteLen} bytes).`)
  }

  const data = encodeQrData(text, config)
  const size = config.size
  const modules: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null))
  const isFunctionModule: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  function setModule(r: number, c: number, val: boolean, isFunc = true) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = val
      if (isFunc) isFunctionModule[r][c] = true
    }
  }

  // 1. Finder Patterns (Top-Left, Top-Right, Bottom-Left)
  function placeFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const curR = row + r
        const curC = col + c
        if (curR >= 0 && curR < size && curC >= 0 && curC < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
            setModule(curR, curC, isBlack)
          } else {
            setModule(curR, curC, false) // Separator
          }
        }
      }
    }
  }

  placeFinder(0, 0)
  placeFinder(0, size - 7)
  placeFinder(size - 7, 0)

  // 2. Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0)
    setModule(i, 6, i % 2 === 0)
  }

  // 3. Alignment Patterns
  const alignPos = config.alignmentPositions
  for (let i = 0; i < alignPos.length; i++) {
    for (let j = 0; j < alignPos.length; j++) {
      const r = alignPos[i]
      const c = alignPos[j]
      if (modules[r][c] !== null) continue // Skip if overlaps finder/timing

      for (let ar = -2; ar <= 2; ar++) {
        for (let ac = -2; ac <= 2; ac++) {
          const isBlack = (Math.abs(ar) === 2 || Math.abs(ac) === 2 || (ar === 0 && ac === 0))
          setModule(r + ar, c + ac, isBlack)
        }
      }
    }
  }

  // 4. Dark Module
  setModule(size - 8, 8, true)

  // 5. Reserve Format Info areas
  for (let i = 0; i <= 8; i++) {
    if (modules[8][i] === null) setModule(8, i, false)
    if (modules[i][8] === null) setModule(i, 8, false)
  }
  for (let i = 0; i < 8; i++) {
    if (modules[8][size - 1 - i] === null) setModule(8, size - 1 - i, false)
    if (modules[size - 1 - i][8] === null) setModule(size - 1 - i, 8, false)
  }

  // 6. Place Data Bits with standard Zig-Zag
  let bitIndex = 0
  const totalBits = data.length * 8

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right-- // Skip vertical timing pattern column

    const upwards = ((right + 1) / 2) % 2 === 1
    for (let vert = 0; vert < size; vert++) {
      const r = upwards ? (size - 1 - vert) : vert
      for (let c = right; c >= right - 1; c--) {
        if (!isFunctionModule[r][c]) {
          let bit = false
          if (bitIndex < totalBits) {
            const byteIdx = bitIndex >>> 3
            const bitOffset = 7 - (bitIndex % 8)
            bit = ((data[byteIdx] >>> bitOffset) & 1) === 1
            bitIndex++
          }
          modules[r][c] = bit
        }
      }
    }
  }

  // 7. Evaluate Masks (0 to 7) and apply lowest penalty mask
  // Default to Mask 0 ((r + c) % 2 === 0) with standard format info
  const selectedMask = 0
  const formatInfo = FORMAT_INFO_M[selectedMask]

  // Apply mask to data modules
  const finalModules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let val = modules[r][c] ?? false
      if (!isFunctionModule[r][c]) {
        const maskBit = ((r + c) % 2 === 0)
        val = maskBit ? !val : val
      }
      finalModules[r][c] = val
    }
  }

  // Apply Format Bits
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >>> i) & 1) === 1
    // Top-left
    if (i < 6) finalModules[8][i] = bit
    else if (i === 6) finalModules[8][7] = bit
    else if (i === 7) finalModules[8][8] = bit
    else if (i === 8) finalModules[7][8] = bit
    else finalModules[14 - i][8] = bit

    // Split format info around edges
    if (i < 8) {
      finalModules[size - 1 - i][8] = bit
    } else {
      finalModules[8][size - 15 + i] = bit
    }
  }

  return {
    size,
    modules: finalModules,
  }
}

/**
 * Generates an SVG path string for the QR code modules.
 */
export function generateQrSvgPath(text: string, targetSizeMm: number): { svgPath: string; matrixSize: number; moduleSizeMm: number } {
  const { size, modules } = generateQrMatrix(text)
  const moduleSizeMm = targetSizeMm / size
  let path = ''

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        const x = (c * moduleSizeMm).toFixed(3)
        const y = (r * moduleSizeMm).toFixed(3)
        const w = moduleSizeMm.toFixed(3)
        const h = moduleSizeMm.toFixed(3)
        path += `M${x},${y}h${w}v${h}h-${w}z `
      }
    }
  }

  return {
    svgPath: path.trim(),
    matrixSize: size,
    moduleSizeMm,
  }
}
