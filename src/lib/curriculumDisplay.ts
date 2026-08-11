/**
 * Return a teacher-friendly heading for a curriculum domain without changing
 * the source record. PDF extraction occasionally leaves list bullets or
 * bullet-like `o` markers in headings; those are presentation noise only.
 */
export function normalizeDomainHeading(raw: string): { raw: string; display: string } {
  const source = raw ?? ''
  const display = source
    .replace(/[•●▪◦·]/g, ' ')
    .replace(/(^|\s)[oO](?=\s)/g, ' ')
    .replace(/(^|\s)-(?=\s)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { raw: source, display: display || source.trim() }
}
