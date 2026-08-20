import type { AnswerSheetDensity, AnswerSheetMode, AnswerSheetPaperSize, AnswerSheetQrPayload } from '../../types/answerSheet'

/**
 * Standard 16-bit CRC (CRC-16-CCITT) for lightweight, deterministic tamper/corruption detection.
 */
export function computeQrChecksum(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).padStart(4, '0')
}

export type EncodeQrPayloadOptions = {
  assessmentId: string
  assessmentVersion: number
  layoutVersion?: 'v1' | 'v2'
  paperSize?: AnswerSheetPaperSize
  density?: AnswerSheetDensity
  slipsPerPage?: number
  mode: AnswerSheetMode
  learnerId?: string
}

/**
 * Encodes an opaque, privacy-safe QR payload for GuroDesk Smart Answer Sheets.
 * Format v2: GD:AS:v2|a:<assessmentId>|v:<version>|l:<layout>|p:<paperSize>|d:<slips>|m:<G|P>[|s:<learnerId>]|c:<checksum>
 * Format v1: GD:AS:v1|a:<assessmentId>|v:<version>|l:<layout>|m:<G|P>[|s:<learnerId>]|c:<checksum>
 * NEVER includes student names, school names, or personal demographic data.
 */
export function encodeAnswerSheetQrPayload(options: EncodeQrPayloadOptions): string {
  const assessmentId = options.assessmentId.trim()
  if (!assessmentId) throw new Error('Assessment ID is required for answer sheet QR.')
  const version = Number(options.assessmentVersion)
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('Assessment version must be a positive integer.')
  }
  const layout = options.layoutVersion ?? 'v2'
  const modeCode = options.mode === 'personalized' ? 'P' : 'G'
  const learnerPart = options.mode === 'personalized' && options.learnerId?.trim()
    ? `|s:${options.learnerId.trim()}`
    : ''

  let base = `GD:AS:${layout}|a:${assessmentId}|v:${version}|l:${layout}`
  if (layout === 'v2') {
    if (options.paperSize) base += `|p:${options.paperSize}`
    if (options.slipsPerPage) base += `|d:${options.slipsPerPage}`
    else if (options.density) base += `|d:${options.density}`
  }
  base += `|m:${modeCode}${learnerPart}`

  const checksum = computeQrChecksum(base)
  return `${base}|c:${checksum}`
}

export type DecodeQrResult = {
  success: boolean
  payload?: AnswerSheetQrPayload
  error?: string
}

/**
 * Decodes and validates a raw QR code string.
 */
export function decodeAnswerSheetQrPayload(rawString: string): DecodeQrResult {
  if (typeof rawString !== 'string' || !rawString.trim()) {
    return { success: false, error: 'Empty or invalid QR code string.' }
  }
  const raw = rawString.trim()
  if (!raw.startsWith('GD:AS:')) {
    return { success: false, error: 'Not a GuroDesk Smart Answer Sheet QR code.' }
  }

  const parts = raw.split('|')
  const header = parts[0]
  if (header !== 'GD:AS:v1' && header !== 'GD:AS:v2') {
    return { success: false, error: `Unsupported answer sheet format or layout version: ${header}` }
  }

  const params = new Map<string, string>()
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const colonIndex = part.indexOf(':')
    if (colonIndex > 0) {
      const key = part.slice(0, colonIndex)
      const val = part.slice(colonIndex + 1)
      params.set(key, val)
    }
  }

  const checksumProvided = params.get('c')
  if (!checksumProvided) {
    return { success: false, error: 'Missing QR checksum.' }
  }

  const lastPipeIndex = raw.lastIndexOf('|c:')
  if (lastPipeIndex === -1) {
    return { success: false, error: 'Malformed QR payload checksum segment.' }
  }

  const baseForChecksum = raw.slice(0, lastPipeIndex)
  const expectedChecksum = computeQrChecksum(baseForChecksum)
  if (checksumProvided.toLowerCase() !== expectedChecksum.toLowerCase()) {
    return { success: false, error: 'QR code checksum mismatch (damaged or altered payload).' }
  }

  const assessmentId = params.get('a')
  if (!assessmentId) {
    return { success: false, error: 'QR code missing assessment ID.' }
  }

  const versionStr = params.get('v')
  const assessmentVersion = Number(versionStr)
  if (!Number.isSafeInteger(assessmentVersion) || assessmentVersion < 1) {
    return { success: false, error: 'QR code contains invalid assessment version number.' }
  }

  const layoutVersion = (params.get('l') ?? (header === 'GD:AS:v2' ? 'v2' : 'v1')) as 'v1' | 'v2'
  const modeCode = params.get('m')
  const mode: AnswerSheetMode = modeCode === 'P' ? 'personalized' : 'generic'
  const learnerId = params.get('s') || undefined

  if (mode === 'personalized' && !learnerId) {
    return { success: false, error: 'Personalized answer sheet QR missing student ID.' }
  }

  const rawPaper = params.get('p')
  const paperSize: AnswerSheetPaperSize | undefined =
    rawPaper === 'letter' || rawPaper === 'legal' || rawPaper === 'folio' || rawPaper === 'a4'
      ? rawPaper
      : undefined

  const rawDensity = params.get('d')
  let slipsPerPage: number | undefined
  let density: AnswerSheetDensity | undefined
  if (rawDensity) {
    if (rawDensity === '1' || rawDensity === '1-up') { slipsPerPage = 1; density = '1-up' }
    else if (rawDensity === '2' || rawDensity === '2-up') { slipsPerPage = 2; density = '2-up' }
    else if (rawDensity === '3' || rawDensity === '3-up') { slipsPerPage = 3; density = '3-up' }
    else if (rawDensity === '4' || rawDensity === '4-up') { slipsPerPage = 4; density = '4-up' }
  }

  return {
    success: true,
    payload: {
      format: header as 'GD:AS:v1' | 'GD:AS:v2',
      assessmentId,
      assessmentVersion,
      layoutVersion,
      paperSize,
      density,
      slipsPerPage,
      mode,
      learnerId,
      checksum: checksumProvided,
    },
  }
}

/**
 * Validates whether a scanned QR code matches the target assessment and version.
 */
export function validateQrMatchesAssessment(
  payload: AnswerSheetQrPayload,
  expectedAssessmentId: string,
  expectedVersionNumber: number,
): { valid: boolean; reason?: string } {
  if (payload.assessmentId !== expectedAssessmentId) {
    return {
      valid: false,
      reason: `Wrong Assessment: Scanned sheet is for assessment ID "${payload.assessmentId}", but active session is "${expectedAssessmentId}".`,
    }
  }
  if (payload.assessmentVersion !== expectedVersionNumber) {
    return {
      valid: false,
      reason: `Assessment Version Mismatch: Scanned sheet was generated for Assessment Version ${payload.assessmentVersion}, but active assessment is Version ${expectedVersionNumber}. Printed sheets must match the current finalized version.`,
    }
  }
  return { valid: true }
}
