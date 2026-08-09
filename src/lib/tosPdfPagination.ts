/**
 * Pure pagination primitives shared by the built-in TOS PDF renderer and its
 * regression checks.  A row is represented as already-wrapped cell lines;
 * this module never drops a line or imposes a row-count cap.
 */

export type TosPdfWrappedRow = {
  cells: string[][]
}

export type TosPdfPaginationOptions = {
  firstPageHeight: number
  subsequentPageHeight?: number
  lineHeight?: number
  rowPadding?: number
}

export type TosPdfRowSegment = {
  rowIndex: number
  cells: string[][]
  height: number
  continuesFromPrevious: boolean
  continuesOnNext: boolean
}

export type TosPdfTablePage = {
  rows: TosPdfRowSegment[]
  lineCount: number
  height: number
}

function normalizedLines(lines: string[]) {
  return lines.length ? lines.map((line) => String(line)) : ['']
}

/** Split one wrapped text block without clipping or changing line order. */
export function chunkTosLines(lines: string[], maxLines: number) {
  if (!Number.isSafeInteger(maxLines) || maxLines < 1) throw new Error('maxLines must be a positive whole number.')
  const source = normalizedLines(lines)
  const chunks: string[][] = []
  for (let start = 0; start < source.length; start += maxLines) chunks.push(source.slice(start, start + maxLines))
  return chunks
}

/**
 * Paginate wrapped TOS rows into point-height-budgeted pages.  Oversized rows are
 * emitted as continuation segments, while every cell is padded within a
 * segment so table borders remain rectangular.
 */
export function paginateTosRows(rows: TosPdfWrappedRow[], options: TosPdfPaginationOptions | number): TosPdfTablePage[] {
  const resolved: TosPdfPaginationOptions = typeof options === 'number'
    // Numeric calls retain the original line-budget convenience API. New
    // renderers should pass explicit point budgets so row padding is accounted
    // for exactly.
    ? { firstPageHeight: options * 14 }
    : options
  const lineHeight = resolved.lineHeight ?? 8
  const rowPadding = resolved.rowPadding ?? 6
  const subsequentPageHeight = resolved.subsequentPageHeight ?? resolved.firstPageHeight
  if (!Number.isFinite(resolved.firstPageHeight) || resolved.firstPageHeight < rowPadding + lineHeight) throw new Error('firstPageHeight is too small for one row.')
  if (!Number.isFinite(subsequentPageHeight) || subsequentPageHeight < rowPadding + lineHeight) throw new Error('subsequentPageHeight is too small for one row.')
  if (!Number.isFinite(lineHeight) || lineHeight <= 0 || !Number.isFinite(rowPadding) || rowPadding < 0) throw new Error('lineHeight and rowPadding must be positive dimensions.')
  const pages: TosPdfTablePage[] = []
  let page: TosPdfTablePage = { rows: [], lineCount: 0, height: 0 }

  const pushPage = () => {
    if (page.rows.length) pages.push(page)
    page = { rows: [], lineCount: 0, height: 0 }
  }

  const pageHeight = () => pages.length === 0 ? resolved.firstPageHeight : subsequentPageHeight

  rows.forEach((row, rowIndex) => {
    const sourceCells = row.cells.map(normalizedLines)
    const rowLineCount = Math.max(1, ...sourceCells.map((lines) => lines.length))
    let offset = 0
    while (offset < rowLineCount) {
      const availableHeight = pageHeight() - page.height
      if (availableHeight < rowPadding + lineHeight) {
        pushPage()
        continue
      }
      const availableLines = Math.max(1, Math.floor((availableHeight - rowPadding) / lineHeight))
      const count = Math.max(1, Math.min(availableLines, rowLineCount - offset))
      const cells = sourceCells.map((lines) => {
        const segment = lines.slice(offset, offset + count)
        while (segment.length < count) segment.push('')
        return segment
      })
      const continuesFromPrevious = offset > 0
      const continuesOnNext = offset + count < rowLineCount
      page.rows.push({ rowIndex, cells, height: count * lineHeight + rowPadding, continuesFromPrevious, continuesOnNext })
      page.lineCount += count
      page.height += count * lineHeight + rowPadding
      offset += count
    }
  })
  pushPage()
  return pages
}

/** Alias with a descriptive name for callers that paginate notes or prompts. */
export const paginateTosText = chunkTosLines
