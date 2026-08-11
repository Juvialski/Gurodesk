const TIKZ_MAX_LENGTH = 14000

const BLOCKED_COMMANDS = [
  'documentclass', 'usepackage', 'usetikzlibrary', 'tikzset', 'input', 'include', 'includegraphics', 'write', 'openout', 'read', 'immediate',
  'special', 'csname', 'catcode', 'def', 'gdef', 'edef', 'xdef', 'let', 'futurelet', 'newcommand', 'renewcommand',
  'providecommand', 'newenvironment', 'renewenvironment', 'endinput', 'href', 'url', 'write18', 'shellescape',
  'loop', 'repeat', 'foreach', 'pgfplotsset', 'addplot', 'directlua', 'pdfobj', 'pdfliteral', 'scantokens',
] as const

function stripFence(value: string) {
  return value.trim()
    .replace(/^```(?:tikz|tex|latex)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim()
}

export type AssessmentTikzSafetyResult = { valid: boolean; source: string; errors: string[] }

/**
 * Bound Gemini-authored TikZ before it reaches TikZJax.  The iframe is also
 * sandboxed without same-origin access; this validator blocks TeX features
 * that can define macros, read/write files, loop indefinitely, or escape the
 * small one-picture contract used by assessment diagrams.
 */
export function validateAssessmentTikzSource(value: unknown): AssessmentTikzSafetyResult {
  const errors: string[] = []
  if (typeof value !== 'string') return { valid: false, source: '', errors: ['TikZ source must be text.'] }
  const source = stripFence(value).normalize('NFKC')
  if (source.length < 30) errors.push('TikZ source is too short to contain a useful diagram.')
  if (source.length > TIKZ_MAX_LENGTH) errors.push(`TikZ source exceeds ${TIKZ_MAX_LENGTH} characters.`)
  if (/\u0000|[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(source)) errors.push('TikZ source contains unsupported control characters.')

  const begins = source.match(/\\begin\s*\{tikzpicture\}/giu) ?? []
  const ends = source.match(/\\end\s*\{tikzpicture\}/giu) ?? []
  if (begins.length !== 1 || ends.length !== 1) errors.push('TikZ source must contain exactly one tikzpicture environment.')
  if (source && !(source.trimStart().startsWith('\\begin{tikzpicture}') || /^\\begin\s*\{tikzpicture\}/u.test(source.trimStart()))) errors.push('TikZ source must start with the tikzpicture environment.')
  if (source && !/\\end\s*\{tikzpicture\}\s*$/u.test(source)) errors.push('TikZ source must end with the tikzpicture environment.')

  for (const command of BLOCKED_COMMANDS) {
    const pattern = new RegExp(`\\\\${command}\\b`, 'iu')
    if (pattern.test(source)) errors.push(`TikZ command \\${command} is not allowed.`)
  }

  if (/\\pgf[a-z@]+/iu.test(source)) errors.push('Low-level PGF commands are not allowed in TikZ source.')
  if (/<\/?(?:script|iframe|object|embed|foreignObject)\b/iu.test(source)) errors.push('HTML/script markup is not allowed in TikZ source.')
  if (/https?:\/\//iu.test(source)) errors.push('External URLs are not allowed in TikZ source.')
  if (!/\\(?:draw|fill|filldraw|shade)\b/u.test(source)) errors.push('TikZ source must contain visible drawing commands.')

  return { valid: errors.length === 0, source, errors }
}

export function assessmentTikzIsDirect(value: unknown): value is string {
  return validateAssessmentTikzSource(value).valid
}
