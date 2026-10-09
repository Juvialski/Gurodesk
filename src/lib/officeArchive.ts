import PizZip from 'pizzip'
import { Unzip, UnzipInflate } from 'fflate'

const MAX_INPUT = 10 * 1024 * 1024
const MAX_EXPANDED = 50 * 1024 * 1024
export function parseOfficeXml(raw: string, label: string): Document {
  if (raw.length > 4 * 1024 * 1024) throw new Error(`${label} is too large for safe template inspection.`)
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error(`${label} contains unsupported XML entity declarations.`)
  const xml = new DOMParser().parseFromString(raw, 'application/xml')
  if (xml.getElementsByTagName('parsererror').length || !xml.documentElement) throw new Error(`${label} XML could not be parsed.`)
  return xml
}

/** Inspect compressed metadata before reading content. Masters are never modified. */
export function openOfficeArchive(buffer: ArrayBuffer, type: 'docx' | 'xlsx'): PizZip {
  if (buffer.byteLength > MAX_INPUT) throw new Error('Office templates must be 10 MB or smaller.')
  let zip: PizZip
  try { zip = new PizZip(buffer) } catch { throw new Error('This is not a readable standard Office document.') }
  const parts = Object.entries(zip.files)
  if (parts.length > 3000) throw new Error('This document contains too many archive parts.')
  let expanded = 0
  for (const [name, file] of parts) {
    if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) throw new Error('The document contains an unsafe archive path.')
    if (/vbaProject|activeX|embeddings\/|customUI\//i.test(name)) throw new Error('Macros, active controls, and embedded executable objects are not supported.')
    const data = (file as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } })._data
    const size = data?.uncompressedSize ?? 0
    expanded += size
    if (size > MAX_EXPANDED || (size > 1024 * 1024 && size > (data?.compressedSize ?? 0) * 250)) throw new Error('This document has an unsafe archive expansion ratio.')
  }
  if (expanded > MAX_EXPANDED) throw new Error('This document expands beyond the safe template limit.')
  // Stream compressed input in small chunks and bound ACTUAL output, even if archive sizes lie.
  const decoded = new Map<string, Uint8Array>()
  let actualTotal = 0
  let fileCount = 0
  const unzip = new Unzip(file => {
    if (++fileCount > 3000 || decoded.has(file.name)) throw new Error('The archive contains too many or duplicate document parts.')
    const chunks: Uint8Array[] = []
    let size = 0
    file.ondata = (error, chunk, final) => {
      if (error) throw new Error('The document contains malformed compressed content.')
      size += chunk.length; actualTotal += chunk.length
      if (actualTotal > MAX_EXPANDED || (/\.xml$|\.rels$/i.test(file.name) && size > 4 * 1024 * 1024)) {
        file.terminate(); throw new Error('This document expands beyond the safe template limit.')
      }
      chunks.push(chunk)
      if (final) {
        const bytes = new Uint8Array(size); let offset = 0
        for (const part of chunks) { bytes.set(part, offset); offset += part.length }
        decoded.set(file.name, bytes)
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  const compressed = new Uint8Array(buffer)
  for (let offset = 0; offset < compressed.length; offset += 4096) unzip.push(compressed.subarray(offset, offset + 4096), offset + 4096 >= compressed.length)
  for (const [name, file] of parts) {
    if (file.dir) continue
    const bytes = decoded.get(name)
    if (!bytes) throw new Error('The archive is missing compressed document content.')
    zip.file(name, bytes)
  }
  const main = type === 'docx' ? 'word/document.xml' : 'xl/workbook.xml'
  if (!zip.file(main) || !zip.file('[Content_Types].xml')) throw new Error('Required Office document parts are missing.')
  const mainXml = parseOfficeXml(zip.file(main)!.asText(), main)
  const supportedNamespace = type === 'docx' ? 'http://schemas.openxmlformats.org/wordprocessingml/2006/main' : 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  if (mainXml.documentElement.namespaceURI !== supportedNamespace) throw new Error('Strict or unsupported OOXML is not supported. Save a standard DOCX/XLSX copy in Word or Excel before mapping.')
  for (const [name, file] of parts) {
    if (file.dir || !/\.xml$|\.rels$/i.test(name)) continue
    const size = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
    if (size > 4 * 1024 * 1024) throw new Error(`${name} is too large for template inspection.`)
    const raw = zip.file(name)!.asText()
    const xml = parseOfficeXml(raw, name)
    if (name === '[Content_Types].xml' && /macroEnabled|vbaProject|activeX/i.test(raw)) throw new Error('Macro-enabled content is not supported.')
    if (!name.endsWith('.rels')) continue
    const base = name.replace(/(?:^|\/)_rels\/[^/]*\.rels$/, '').split('/').filter(Boolean)
    for (const rel of Array.from(xml.getElementsByTagNameNS('*', 'Relationship'))) {
      let target = rel.getAttribute('Target') ?? ''
      if (rel.getAttribute('TargetMode') === 'External') {
        if (!/\/hyperlink$/.test(rel.getAttribute('Type') ?? '') || !/^(?:https?:|mailto:)/i.test(target)) throw new Error('External document content is not supported. Embed images in the master instead.')
        continue
      }
      try { target = decodeURIComponent(target) } catch { throw new Error('An Office relationship has an invalid encoded target.') }
      if (!target || /\\|:|[?#]/.test(target)) throw new Error('An Office relationship has an unsafe target.')
      const resolved = target.startsWith('/') ? [] : [...base]
      for (const segment of target.split('/')) {
        if (!segment || segment === '.') continue
        if (segment === '..') { if (!resolved.length) throw new Error('An Office relationship leaves the archive.'); resolved.pop() }
        else resolved.push(segment)
      }
      if (!zip.file(resolved.join('/'))) throw new Error(`A required Office relationship is broken: ${name}.`)
    }
  }
  return zip
}
