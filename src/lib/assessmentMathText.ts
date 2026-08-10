/**
 * Deterministic learner-facing math text normalization.
 *
 * Assessment prompts are stored exactly as authored. Export renderers call this
 * helper to convert the small TeX subset historically produced by GuroDesk into
 * Unicode text that jsPDF/HTML/DOCX can render consistently. This is deliberately
 * not a TeX interpreter and never executes arbitrary commands.
 */

const SIMPLE_COMMANDS: Array<[RegExp, string]> = [
  [/\\angle\s*/gu, '∠'],
  [/\\times\b/gu, '×'],
  [/\\cdot\b/gu, '·'],
  [/\\div\b/gu, '÷'],
  [/\\pm\b/gu, '±'],
  [/\\leq?\b/gu, '≤'],
  [/\\geq?\b/gu, '≥'],
  [/\\neq\b/gu, '≠'],
  [/\\approx\b/gu, '≈'],
  [/\\infty\b/gu, '∞'],
  [/\\parallel\b/gu, '∥'],
  [/\\perp\b/gu, '⊥'],
  [/\\pi\b/gu, 'π'],
]

function simpleFractions(value: string) {
  // Keep fractions readable in plain export text without pretending to be a
  // full TeX layout engine. Run a few passes for small nested content.
  let next = value
  for (let pass = 0; pass < 3; pass += 1) next = next.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/gu, '($1)/($2)')
  return next
}

function simpleSquareRoots(value: string) {
  return value.replace(/\\sqrt\s*\{([^{}]+)\}/gu, '√($1)')
}

function superscripts(value: string) {
  return value
    .replace(/\^\s*\{?\s*\\circ\s*\}?/gu, '°')
    .replace(/\^\s*\{?\s*2\s*\}?/gu, '²')
    .replace(/\^\s*\{?\s*3\s*\}?/gu, '³')
}

export function normalizeAssessmentMathText(input: string | null | undefined) {
  let value = (input ?? '').normalize('NFKC')
  value = value.replace(/\\\(|\\\)|\\\[|\\\]/gu, '')
  value = simpleFractions(simpleSquareRoots(superscripts(value)))
  SIMPLE_COMMANDS.forEach(([pattern, replacement]) => { value = value.replace(pattern, replacement) })
  value = value
    .replace(/\\text\s*\{([^{}]*)\}/gu, '$1')
    .replace(/\\mathrm\s*\{([^{}]*)\}/gu, '$1')
    .replace(/\\mathbf\s*\{([^{}]*)\}/gu, '$1')
    .replace(/\$+/gu, '')
    .replace(/\{([^{}]*)\}/gu, '$1')
    .replace(/[ \t]+/gu, ' ')
  return value.trim()
}

/** True when export normalization cannot safely consume all TeX-like markup. */
export function hasUnsupportedAssessmentMathMarkup(input: string | null | undefined) {
  const normalized = normalizeAssessmentMathText(input)
  return /\\[A-Za-z]+|\$|\^\s*\{|_\s*\{/u.test(normalized)
}

export function normalizeAssessmentMathList(values: string[]) {
  return values.map((value) => normalizeAssessmentMathText(value))
}
