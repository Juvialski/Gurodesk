import { openOfficeArchive, parseOfficeXml } from './officeArchive'
import { replaceWordTextRange, replaceWordTokens, wordText } from './wordText'

export type MergeRecord = Record<string, string | number>
export type MergeData = { fields: MergeRecord; rows: Record<string, MergeRecord[]>; audience: 'teacher' | 'student' }
export type MergeField = { key: string; group: string | null; valueType?: 'text' | 'number' }
const TOKEN = /\{\{\s*([#/]?)([a-zA-Z][a-zA-Z0-9_.]*)\s*\}\}/g
const S_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const ANSWER = /answer|solution|rubric|scoring|choice_?ids?|expected_?response|key_?points/i
const elements = (parent: Element | Document, name: string) => Array.from(parent.getElementsByTagNameNS('*', name))
const children = (parent: Element) => Array.from(parent.childNodes).filter(node => node.nodeType === 1) as Element[]
const xText = (node: Element) => elements(node, 't').map(t => t.textContent ?? '').join('')
function tokens(text: string) { return [...text.matchAll(TOKEN)] }
function guard(data: MergeData) {
  if (JSON.stringify(data).length > 1024 * 1024) throw new Error('Merge values exceed the safe output limit. Split this document into smaller sections.')
  if (Object.values(data.rows).some(rows => rows.length > 500)) throw new Error('A repeating block supports at most 500 records.')
  if (data.audience === 'student') {
    const names = [...Object.keys(data.fields), ...Object.values(data.rows).flatMap(rows => rows.flatMap(row => Object.keys(row)))]
    if (names.some(name => ANSWER.test(name))) throw new Error('Student copies cannot receive answer, solution, rubric, or scoring fields.')
  }
}
function ensureFilled(text: string, audience: MergeData['audience']) {
  const remaining = tokens(text)
  if (remaining.length) throw new Error(`Unfilled template field: ${remaining[0][2]}. Map every field before downloading.`)
  if (audience === 'student' && /\{\{\s*(?:answer|solution)/i.test(text)) throw new Error('Answer fields are forbidden in student copies.')
}

export function inspectMailMerge(buffer: ArrayBuffer, type: 'docx' | 'xlsx'): MergeField[] {
  const zip = openOfficeArchive(buffer, type)
  const fields = new Map<string, MergeField>()
  let group: string | null = null
  const shared = zip.file('xl/sharedStrings.xml')
  const sharedStrings = shared ? elements(parseOfficeXml(shared.asText(), 'Shared strings'), 'si') : []
  const paths = Object.keys(zip.files).filter(name => type === 'docx' ? /^word\/(?:document|header\d*|footer\d*)\.xml$/.test(name) : /^xl\/worksheets\/[^/]+\.xml$/.test(name))
  for (const path of paths) {
    group = null
    const xml = parseOfficeXml(zip.file(path)!.asText(), path)
    if (type === 'xlsx') for (const cell of elements(xml, 'c')) {
      if (cell.getAttribute('t') !== 's') continue
      const source = sharedStrings[Number(elements(cell, 'v')[0]?.textContent)]
      if (source) cell.appendChild(xml.importNode(source, true))
    }
    const units = type === 'docx' ? elements(xml, 'p') : elements(xml, 'row')
    for (const unit of units) for (const token of tokens(type === 'docx' ? wordText(unit) : xText(unit))) {
      if (token[1] === '#') { if (group) throw new Error('Nested repeating blocks are not supported. Use a text field for options within a question.'); group = token[2]; continue }
      if (token[1] === '/') { group = null; continue }
      fields.set(`${group ?? ''}.${token[2]}`, { key: token[2], group })
    }
  }
  return [...fields.values()]
}

function removeWordMarker(node: Element, marker: string) {
  const text = wordText(node)
  for (const match of tokens(text).reverse().filter(match => match[1] && match[2] === marker)) replaceWordTextRange(node, match.index!, match.index! + match[0].length, '')
}
function fillWord(parent: Element, scope: MergeRecord, data: MergeData) {
  const nodes = children(parent)
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (node.localName === 'p' || node.localName === 'tr') {
      const start = tokens(wordText(node)).find(token => token[1] === '#')
      if (start) {
        const group = start[2]
        if (!Object.prototype.hasOwnProperty.call(data.rows, group)) throw new Error(`Map the repeating ${group} block before exporting.`)
        let end = index
        while (end < nodes.length && !tokens(wordText(nodes[end])).some(token => token[1] === '/' && token[2] === group)) end++
        if (end >= nodes.length) throw new Error(`Repeating ${group} block has no closing marker at the same table/paragraph level.`)
        const block = nodes.slice(index, end + 1)
        for (const record of data.rows[group]) for (const original of block) {
          const copy = original.cloneNode(true) as Element
          removeWordMarker(copy, group)
          if (!wordText(copy).trim() && original.localName === 'p' && tokens(wordText(original)).every(token => token[1])) continue
          parent.insertBefore(copy, node)
          fillWord(copy, { ...scope, ...record }, { ...data, rows: {} })
        }
        block.forEach(item => parent.removeChild(item)); index = end; continue
      }
    }
    fillWord(node, scope, data)
  }
  if (parent.localName === 'p') replaceWordTokens(parent, scope)
}

export function mergeWord(buffer: ArrayBuffer, data: MergeData): Blob {
  guard(data)
  const zip = openOfficeArchive(buffer, 'docx')
  for (const path of Object.keys(zip.files).filter(name => /^word\/(?:document|header\d*|footer\d*)\.xml$/.test(name))) {
    const xml = parseOfficeXml(zip.file(path)!.asText(), path)
    fillWord(xml.documentElement, data.fields, data)
    for (const p of elements(xml, 'p')) ensureFilled(wordText(p), data.audience)
    const output = new XMLSerializer().serializeToString(xml)
    if (output.length > 4 * 1024 * 1024) throw new Error('The merged Word document exceeds the safe output limit.')
    zip.file(path, output)
  }
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

function replaceXTokens(node: Element, scope: MergeRecord) {
  const textNodes = elements(node, 't')
  const full = xText(node)
  for (const match of tokens(full).reverse()) {
    const value = match[1] ? '' : scope[match[2]]
    if (value === undefined) continue
    let offset = 0; let inserted = false
    for (const text of textNodes) {
      const original = text.textContent ?? ''; const end = offset + original.length
      if (end > match.index! && offset < match.index! + match[0].length) {
        text.textContent = original.slice(0, Math.max(0, match.index! - offset)) + (inserted ? '' : String(value)) + original.slice(Math.max(0, match.index! + match[0].length - offset))
        text.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); inserted = true
      }
      offset = end
    }
  }
}

/** XLSX repeats populate existing styled rows; formulas, merged cells and named ranges never move. */
export function mergeWorkbook(buffer: ArrayBuffer, data: MergeData): Blob {
  guard(data)
  const zip = openOfficeArchive(buffer, 'xlsx')
  const shared = zip.file('xl/sharedStrings.xml')
  const sharedRows = shared ? elements(parseOfficeXml(shared.asText(), 'Shared strings'), 'si') : []
  for (const path of Object.keys(zip.files).filter(name => /^xl\/worksheets\/[^/]+\.xml$/.test(name))) {
    const xml = parseOfficeXml(zip.file(path)!.asText(), path)
    const rows = elements(xml, 'row')
    // Copy shared rich strings to inline strings only for cells that contain merge tokens.
    for (const cell of elements(xml, 'c')) {
      if (cell.getAttribute('t') !== 's') continue
      const index = Number(elements(cell, 'v')[0]?.textContent)
      const source = sharedRows[index]
      if (!source || !tokens(xText(source)).length) continue
      if (elements(cell, 'f').length) throw new Error('A formula cell cannot be mapped as a merge destination.')
      const value = elements(cell, 'v')[0]; if (value) cell.removeChild(value)
      const inline = xml.createElementNS(S_NS, 'is')
      for (const child of Array.from(source.childNodes)) inline.appendChild(xml.importNode(child, true))
      cell.appendChild(inline); cell.setAttribute('t', 'inlineStr')
    }
    let group: string | null = null; let scopes: MergeRecord[] = []; let position = 0
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      const start = tokens(xText(row)).find(token => token[1] === '#')
      const close = tokens(xText(row)).find(token => token[1] === '/')
      if (start) {
        if (group || close) throw new Error('Workbook block markers must occupy separate rows and cannot nest.')
        group = start[2]
        if (!Object.prototype.hasOwnProperty.call(data.rows, group)) throw new Error(`Map the repeating ${group} block before exporting.`)
        scopes = data.rows[group]; position = 0
        const end = rows.findIndex((candidate, candidateIndex) => candidateIndex > index && tokens(xText(candidate)).some(token => token[1] === '/' && token[2] === group))
        if (end < 0) throw new Error(`Workbook block ${group} has no closing row.`)
        if (scopes.length > end - index - 1) throw new Error(`Workbook block ${group} has ${end - index - 1} styled rows, but needs ${scopes.length}. Expand the master in Excel before importing it.`)
      }
      if (close && (!group || close[2] !== group)) throw new Error('Workbook repeating markers are mismatched.')
      const scope = group && !start && !close ? { ...data.fields, ...(scopes[position++] ?? Object.fromEntries(tokens(xText(row)).filter(token => !token[1]).map(token => [token[2], '']))) } : data.fields
      for (const cell of elements(row, 'c')) {
        if (!tokens(xText(cell)).length) continue
        if (elements(cell, 'f').length) throw new Error('Formula cells cannot receive merge values.')
        const single = tokens(xText(cell))
        const numeric = single.length === 1 && !single[0][1] && single[0][0] === xText(cell) ? scope[single[0][2]] : undefined
        if (typeof numeric === 'number') {
          if (!Number.isFinite(numeric)) throw new Error('Numeric workbook values must be finite.')
          for (const node of children(cell).filter(node => ['is', 'v'].includes(node.localName))) cell.removeChild(node)
          const value = xml.createElementNS(S_NS, 'v'); value.textContent = String(numeric)
          const extension = children(cell).find(node => node.localName === 'extLst') ?? null
          cell.insertBefore(value, extension); cell.setAttribute('t', 'n'); continue
        }
        replaceXTokens(cell, scope); ensureFilled(xText(cell), data.audience)
      }
      if (close) group = null
    }
    zip.file(path, new XMLSerializer().serializeToString(xml))
  }
  const workbook = parseOfficeXml(zip.file('xl/workbook.xml')!.asText(), 'Workbook')
  let calculation = elements(workbook, 'calcPr')[0]
  if (!calculation) { calculation = workbook.createElementNS(S_NS, 'calcPr'); workbook.documentElement.appendChild(calculation) }
  calculation.setAttribute('fullCalcOnLoad', '1'); calculation.setAttribute('forceFullCalc', '1'); calculation.setAttribute('calcMode', 'auto')
  zip.file('xl/workbook.xml', new XMLSerializer().serializeToString(workbook))
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
