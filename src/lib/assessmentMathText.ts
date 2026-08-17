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
  [/\\triangle\s*/gu, '△'],
  [/\\times(?![A-Za-z])/gu, '×'],
  [/\\cdot(?![A-Za-z])/gu, '·'],
  [/\\div(?![A-Za-z])/gu, '÷'],
  [/\\pm(?![A-Za-z])/gu, '±'],
  [/\\mp(?![A-Za-z])/gu, '∓'],
  [/\\leq?(?![A-Za-z])/gu, '≤'],
  [/\\geq?(?![A-Za-z])/gu, '≥'],
  [/\\neq?(?![A-Za-z])/gu, '≠'],
  [/\\approx(?![A-Za-z])/gu, '≈'],
  [/\\equiv(?![A-Za-z])/gu, '≡'],
  [/\\infty(?![A-Za-z])/gu, '∞'],
  [/\\parallel(?![A-Za-z])/gu, '∥'],
  [/\\perp(?![A-Za-z])/gu, '⊥'],
  [/\\pi(?![A-Za-z])/gu, 'π'],
  [/\\theta(?![A-Za-z])/gu, 'θ'],
  [/\\alpha(?![A-Za-z])/gu, 'α'],
  [/\\beta(?![A-Za-z])/gu, 'β'],
  [/\\gamma(?![A-Za-z])/gu, 'γ'],
  [/\\delta(?![A-Za-z])/gu, 'δ'],
  [/\\mu(?![A-Za-z])/gu, 'µ'],
  [/\\sigma(?![A-Za-z])/gu, 'σ'],
  [/\\in(?![A-Za-z])/gu, '∈'],
  [/\\notin(?![A-Za-z])/gu, '∉'],
  [/\\subset(?![A-Za-z])/gu, '⊂'],
  [/\\subseteq(?![A-Za-z])/gu, '⊆'],
  [/\\cup(?![A-Za-z])/gu, '∪'],
  [/\\cap(?![A-Za-z])/gu, '∩'],
  [/\\(?:emptyset|varnothing)(?![A-Za-z])/gu, '∅'],
  [/\\(?:rightarrow|to)(?![A-Za-z])/gu, '→'],
  [/\\leftarrow(?![A-Za-z])/gu, '←'],
  [/\\leftrightarrow(?![A-Za-z])/gu, '↔'],
  [/\\Rightarrow(?![A-Za-z])/gu, '⇒'],
  [/\\Leftarrow(?![A-Za-z])/gu, '⇐'],
  [/\\Leftrightarrow(?![A-Za-z])/gu, '⇔'],
  [/\\(?:degree|circ)(?![A-Za-z])/gu, '°'],
]

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
}

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
}

function simpleFractions(value: string) {
  let next = value
  for (let pass = 0; pass < 3; pass += 1) next = next.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/gu, '($1)/($2)')
  return next
}

function simpleRoots(value: string) {
  return value
    .replace(/\\sqrt\s*\[\s*3\s*\]\s*\{([^{}]+)\}/gu, '∛($1)')
    .replace(/\\sqrt\s*\[\s*3\s*\]\s*([0-9a-zA-Z])/gu, '∛$1')
    .replace(/\\sqrt\s*\[\s*4\s*\]\s*\{([^{}]+)\}/gu, '∜($1)')
    .replace(/\\sqrt\s*\[\s*4\s*\]\s*([0-9a-zA-Z])/gu, '∜$1')
    .replace(/\\sqrt\s*\[\s*([^{}[\]]+)\s*\]\s*\{([^{}]+)\}/gu, '($1)√($2)')
    .replace(/\\sqrt\s*\[\s*([^{}[\]]+)\s*\]\s*([0-9a-zA-Z])/gu, '($1)√$2')
    .replace(/\\sqrt\s*\{([^{}]+)\}/gu, '√($1)')
    .replace(/\\sqrt\s+([0-9a-zA-Z]+)/gu, '√$1')
    .replace(/\\sqrt(?![a-zA-Z])/gu, '√')
}

function superscripts(value: string) {
  return value
    .replace(/\^\s*\{?\s*\\circ\s*\}?/gu, '°')
    .replace(/\^\s*\{([^{}]+)\}/gu, (_, content: string) => {
      return [...content].map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join('')
    })
    .replace(/\^\s*([0-9a-zA-Z+-])/gu, (_, ch: string) => SUPERSCRIPT_MAP[ch] ?? `^${ch}`)
    .replace(/\b([a-zA-Z])([23456789])\b/gu, (_, letter: string, power: string) => `${letter}${SUPERSCRIPT_MAP[power] ?? power}`)
    .replace(/(?<=\d|\b)(cm|mm|km|in|ft|yd|mi|m)([23])\b/gu, (_, unit: string, power: string) => `${unit}${SUPERSCRIPT_MAP[power] ?? power}`)
}

function subscripts(value: string) {
  return value
    .replace(/(?<!_)_{1}(?!_)\s*\{([^{}]+)\}/gu, (_, content: string) => {
      return [...content].map((ch) => SUBSCRIPT_MAP[ch] ?? ch).join('')
    })
    .replace(/([a-zA-Z0-9)\]])_(?!_)([0-9a-zA-Z+-])\b/gu, (_, base: string, ch: string) => {
      return `${base}${SUBSCRIPT_MAP[ch] ?? `_${ch}`}`
    })
}

export function normalizeAssessmentMathText(input: string | null | undefined) {
  let value = (input ?? '').normalize('NFKC')
  value = value.replace(/\\\(|\\\)|\\\[|\\\]/gu, '')
  value = simpleFractions(simpleRoots(superscripts(subscripts(value))))
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
