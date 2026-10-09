const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'
export function wordTextNodes(element: Element) { return Array.from(element.getElementsByTagNameNS(W_NS, 't')) }
export function wordText(element: Element) { return wordTextNodes(element).map(node => node.textContent ?? '').join('') }

function setText(node: Element, value: string) {
  // Word line breaks are native elements rather than literal newlines inside w:t.
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  node.textContent = lines[0]
  node.setAttributeNS(XML_NS, 'xml:space', 'preserve')
  let after: Node = node
  for (const line of lines.slice(1)) {
    const br = node.ownerDocument.createElementNS(W_NS, 'w:br')
    const text = node.cloneNode(false) as Element
    text.textContent = line
    after.parentNode!.insertBefore(br, after.nextSibling)
    br.parentNode!.insertBefore(text, br.nextSibling)
    after = text
  }
}

/** Replace only matching text, retaining run properties, drawings, math, bookmarks and section properties. */
export function replaceWordTextRange(element: Element, start: number, end: number, value: string) {
  const nodes = wordTextNodes(element)
  let offset = 0
  let inserted = false
  for (const node of nodes) {
    const current = node.textContent ?? ''
    const next = offset + current.length
    const startsHere = !inserted && (start < next || (start === offset && !current.length) || (node === nodes.at(-1) && start === next))
    if (startsHere || (end > offset && start < next)) {
      const from = Math.max(0, start - offset)
      const to = Math.min(current.length, Math.max(0, end - offset))
      setText(node, current.slice(0, from) + (inserted ? '' : value) + current.slice(to))
      inserted = true
    }
    offset = next
  }
  if (!inserted) {
    const run = element.ownerDocument.createElementNS(W_NS, 'w:r')
    const node = element.ownerDocument.createElementNS(W_NS, 'w:t')
    run.appendChild(node); element.appendChild(run); setText(node, value)
  }
}

export function replaceWordTokens(element: Element, values: Record<string, unknown>) {
  const text = wordText(element)
  const matches = [...text.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}\}/g)]
  for (const match of matches.reverse()) {
    if (!Object.prototype.hasOwnProperty.call(values, match[1])) continue
    const value = values[match[1]]
    if (typeof value !== 'string' && typeof value !== 'number') continue
    replaceWordTextRange(element, match.index!, match.index! + match[0].length, String(value))
  }
}

/** Whole mapped values retain each run's formatting; placeholders give exact semantic formatting boundaries. */
export function replaceMappedWordText(element: Element, value: string) {
  const nodes = wordTextNodes(element)
  if (!nodes.length) { replaceWordTextRange(element, 0, 0, value); return }
  let cursor = 0
  nodes.forEach((node, index) => {
    const length = node.textContent?.length ?? 0
    const part = index === nodes.length - 1 ? value.slice(cursor) : value.slice(cursor, cursor + length)
    setText(node, part)
    cursor += length
  })
}
