const TIKZ_MAX_LENGTH = 14000
const TIKZ_MAX_COMMANDS = 260
const TIKZ_MAX_NODES = 80
const TIKZ_MAX_PATHS = 140
const TIKZ_MAX_COORDINATES = 260
const TIKZ_MAX_NESTING = 18
const TIKZ_MAX_PATH_CHARS = 1800
const TIKZ_MAX_PATH_OPERATORS = 120
const TIKZ_MAX_NODE_TEXT = 500
const TIKZ_MAX_ABS_COORDINATE = 2000

const BLOCKED_COMMANDS = [
  'documentclass', 'usepackage', 'usetikzlibrary', 'tikzset', 'input', 'include', 'includegraphics', 'write', 'openout', 'read', 'immediate',
  'special', 'csname', 'catcode', 'def', 'gdef', 'edef', 'xdef', 'let', 'futurelet', 'newcommand', 'renewcommand',
  'providecommand', 'newenvironment', 'renewenvironment', 'endinput', 'href', 'url', 'write18', 'shellescape',
  'loop', 'repeat', 'foreach', 'pgfplotsset', 'addplot', 'directlua', 'pdfobj', 'pdfliteral', 'scantokens',
] as const

const DRAWING_COMMANDS = new Set(['draw', 'fill', 'filldraw', 'node', 'coordinate', 'path', 'clip'])
const TEXT_COMMANDS = new Set([
  'frac', 'dfrac', 'tfrac', 'sqrt', 'text', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'textbf', 'textit', 'emph', 'operatorname',
  'circ', 'angle', 'overline', 'underline', 'times', 'cdot', 'pm', 'mp', 'le', 'leq', 'ge', 'geq', 'neq', 'approx', 'parallel', 'perp', 'cong', 'sim',
  'left', 'right', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'theta', 'vartheta', 'lambda', 'mu', 'pi', 'rho', 'sigma', 'tau', 'phi', 'varphi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Pi', 'Sigma', 'Phi', 'Omega',
  'tiny', 'scriptsize', 'footnotesize', 'small', 'normalsize', 'large', 'Large',
])
const ALLOWED_COMMANDS = new Set([...DRAWING_COMMANDS, ...TEXT_COMMANDS, 'begin', 'end'])
const ALLOWED_ENVIRONMENTS = new Set(['tikzpicture', 'scope'])
const ALLOWED_BARE_OPTIONS = new Set([
  'thick', 'thin', 'semithick', 'very thick', 'ultra thick', 'dashed', 'densely dashed', 'loosely dashed', 'dotted', 'densely dotted', 'loosely dotted',
  'solid', 'blue', 'black', 'gray', 'grey', 'red', 'white', 'above', 'below', 'left', 'right', 'above left', 'above right', 'below left', 'below right',
  'midway', 'sloped', 'near start', 'near end', 'very near start', 'very near end', 'use as bounding box', 'smooth', 'cycle',
])
const ALLOWED_OPTION_KEYS = new Set([
  'draw', 'fill', 'color', 'text', 'opacity', 'draw opacity', 'fill opacity', 'text opacity', 'line width', 'line cap', 'line join',
  'rounded corners', 'x', 'y', 'radius', 'x radius', 'y radius', 'start angle', 'end angle', 'delta angle', 'rotate', 'scale', 'xscale', 'yscale', 'xshift', 'yshift', 'shift',
  'anchor', 'inner sep', 'outer sep', 'minimum size', 'minimum width', 'minimum height', 'align', 'font', 'pos', 'label', 'pin',
  'shorten >=', 'shorten <=', '>=', '<=', '->', '<-', '<->', 'stealth-', '-stealth', 'latex-', '-latex',
])

function stripFence(value: string) {
  return value.trim().replace(/^```(?:tikz|tex|latex)?\s*/iu, '').replace(/\s*```$/u, '').trim()
}

function balancedDepth(source: string) {
  let depth = 0
  let max = 0
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (char === '\\') { index += 1; continue }
    if (char === '{' || char === '[' || char === '(') { depth += 1; max = Math.max(max, depth) }
    else if (char === '}' || char === ']' || char === ')') depth = Math.max(0, depth - 1)
  }
  return max
}

function splitTopLevel(value: string, separator = ',') {
  const parts: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '\\') { index += 1; continue }
    if (char === '{' || char === '[' || char === '(') depth += 1
    else if (char === '}' || char === ']' || char === ')') depth = Math.max(0, depth - 1)
    else if (char === separator && depth === 0) { parts.push(value.slice(start, index)); start = index + 1 }
  }
  parts.push(value.slice(start))
  return parts
}

function optionAllowed(raw: string) {
  const option = raw.trim().replace(/\s+/gu, ' ')
  if (!option) return true
  if (ALLOWED_BARE_OPTIONS.has(option.toLocaleLowerCase('en'))) return true
  const equals = option.indexOf('=')
  if (equals < 0) return /^(?:[-<>]+|[a-z]+!?\d*(?:![a-z]+!?\d*)*)$/iu.test(option) && option.length <= 40
  const key = option.slice(0, equals).trim().toLocaleLowerCase('en')
  const value = option.slice(equals + 1).trim()
  if (!ALLOWED_OPTION_KEYS.has(key)) return false
  if (value.length > 160 || /(?:https?:|url\s*\(|data:|javascript:|\\(?:input|include|write|read|def|newcommand|foreach|pgf))/iu.test(value)) return false
  return /^[\p{L}\p{N}\s.!+\-*/:<>=_\\{}(),°]+$/u.test(value)
}

function optionLists(source: string) {
  const results: string[] = []
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '[') continue
    let depth = 1
    let cursor = index + 1
    for (; cursor < source.length && depth > 0; cursor += 1) {
      const char = source[cursor]
      if (char === '\\') { cursor += 1; continue }
      if (char === '[') depth += 1
      else if (char === ']') depth -= 1
    }
    if (depth === 0) { results.push(source.slice(index + 1, cursor - 1)); index = cursor - 1 }
  }
  return results
}

function readBalancedBraces(source: string, start: number, maxLength = TIKZ_MAX_NODE_TEXT) {
  if (source[start] !== '{') return null
  let depth = 0
  let maxDepth = 0
  for (let index = start; index < source.length && index - start <= maxLength; index += 1) {
    const char = source[index]
    if (char === '\\') { index += 1; continue }
    if (char === '{') { depth += 1; maxDepth = Math.max(maxDepth, depth); if (maxDepth > 12) return null }
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return { body: source.slice(start + 1, index), end: index + 1 }
      if (depth < 0) return null
    }
  }
  return null
}

/** Extract only learner-visible TikZ node bodies with bounded brace-aware parsing. */
export function extractAssessmentTikzNodeTexts(value: unknown) {
  if (typeof value !== 'string') return [] as string[]
  const source = value.slice(0, TIKZ_MAX_LENGTH)
  const results: string[] = []
  const nodePattern = /\\node\b|(^|[\s;])node\b/gu
  for (const match of source.matchAll(nodePattern)) {
    const tokenStart = match.index ?? 0
    const nodeStart = source.startsWith('\\node', tokenStart) ? tokenStart + 5 : tokenStart + String(match[1] ?? '').length + 4
    const stop = Math.min(source.length, nodeStart + 1800)
    let squareDepth = 0
    let parenDepth = 0
    for (let index = nodeStart; index < stop; index += 1) {
      const char = source[index]
      if (char === '\\') { index += 1; continue }
      if (char === '[') squareDepth += 1
      else if (char === ']') squareDepth = Math.max(0, squareDepth - 1)
      else if (char === '(') parenDepth += 1
      else if (char === ')') parenDepth = Math.max(0, parenDepth - 1)
      else if (char === ';' && squareDepth === 0 && parenDepth === 0) break
      else if (char === '{' && squareDepth === 0 && parenDepth === 0) {
        const body = readBalancedBraces(source, index)
        if (body) results.push(body.body)
        break
      }
    }
    if (results.length >= TIKZ_MAX_NODES) break
  }
  return results
}

function unwrapFormatting(value: string) {
  let result = value
  const wrappers = ['textbf', 'textit', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'text', 'emph', 'operatorname', 'overline', 'underline']
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false
    for (const command of wrappers) {
      const pattern = new RegExp(`\\\\${command}\\s*\\{`, 'gu')
      let match: RegExpExecArray | null
      while ((match = pattern.exec(result))) {
        const open = (match.index ?? 0) + match[0].length - 1
        const body = readBalancedBraces(result, open, 1000)
        if (!body) break
        result = result.slice(0, match.index) + body.body + result.slice(body.end)
        pattern.lastIndex = match.index + body.body.length
        changed = true
      }
    }
    if (!changed) break
  }
  return result
}

/** Normalize harmless TeX label formatting before answer-leak comparison. */
export function normalizeAssessmentTikzLearnerText(value: unknown) {
  if (typeof value !== 'string') return ''
  let text = value.normalize('NFKC').slice(0, 1200)
  // Convert simple/nested fractions first so 1/2 compares to numerical answers.
  for (let pass = 0; pass < 6; pass += 1) {
    const marker = /\\(?:d?frac|tfrac)\s*\{/gu.exec(text)
    if (!marker || marker.index === undefined) break
    const firstOpen = marker.index + marker[0].length - 1
    const numerator = readBalancedBraces(text, firstOpen, 700)
    if (!numerator) break
    let cursor = numerator.end
    while (/\s/u.test(text[cursor] ?? '')) cursor += 1
    if (text[cursor] !== '{') { text = text.slice(0, marker.index) + text.slice(marker.index + 1); continue }
    const denominator = readBalancedBraces(text, cursor, 700)
    if (!denominator) break
    text = text.slice(0, marker.index) + ` ${numerator.body} / ${denominator.body} ` + text.slice(denominator.end)
  }
  text = unwrapFormatting(text)
  text = text
    .replace(/\$(.*?)\$/gsu, '$1')
    .replace(/\\\(|\\\)|\\\[|\\\]/gu, ' ')
    .replace(/\\(?:circ|degree)\b/gu, '°')
    .replace(/\\(?:times|cdot)\b/gu, ' × ')
    .replace(/\\(?:parallel)\b/gu, ' parallel ')
    .replace(/\\(?:perp)\b/gu, ' perpendicular ')
    .replace(/\\(?:angle)\b/gu, ' angle ')
    .replace(/\\[A-Za-z@]+\b/gu, ' ')
    .replace(/[{}]/gu, ' ')
    .replace(/\\([%_#&])/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim()
  return text
}

export type TikzSafetyResult = { valid: boolean; source: string; errors: string[] }

export function validateAssessmentTikzSource(value: unknown): TikzSafetyResult {
  const errors: string[] = []
  if (typeof value !== 'string') return { valid: false, source: '', errors: ['TikZ source must be text.'] }
  const source = stripFence(value).normalize('NFKC')
  if (source.length < 30) errors.push('TikZ source is too short to contain a useful diagram.')
  if (source.length > TIKZ_MAX_LENGTH) errors.push(`TikZ source exceeds ${TIKZ_MAX_LENGTH} characters.`)
  if (/\u0000|[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(source)) errors.push('TikZ source contains unsupported control characters.')
  if (balancedDepth(source) > TIKZ_MAX_NESTING) errors.push(`TikZ source nesting exceeds ${TIKZ_MAX_NESTING} levels.`)

  const environmentMatches = [...source.matchAll(/\\(begin|end)\s*\{([^{}]+)\}/gu)]
  const begins = environmentMatches.filter((match) => match[1] === 'begin' && match[2] === 'tikzpicture')
  const ends = environmentMatches.filter((match) => match[1] === 'end' && match[2] === 'tikzpicture')
  if (begins.length !== 1 || ends.length !== 1) errors.push('TikZ source must contain exactly one tikzpicture environment.')
  for (const match of environmentMatches) if (!ALLOWED_ENVIRONMENTS.has(String(match[2]).trim())) errors.push(`TikZ environment ${String(match[2]).trim()} is not allowed.`)
  if (source && !(source.trimStart().startsWith('\\begin{tikzpicture}') || /^\\begin\s*\{tikzpicture\}/u.test(source.trimStart()))) errors.push('TikZ source must start with the tikzpicture environment.')
  if (source && !/\\end\s*\{tikzpicture\}\s*$/u.test(source)) errors.push('TikZ source must end with the tikzpicture environment.')

  for (const command of BLOCKED_COMMANDS) if (new RegExp(`\\\\${command}\\b`, 'iu').test(source)) errors.push(`TikZ command \\${command} is not allowed.`)
  if (/\\pgf[a-z@]+/iu.test(source)) errors.push('Low-level PGF commands are not allowed in TikZ source.')
  if (/<\/?(?:script|iframe|object|embed|foreignObject|style|link|meta)\b/iu.test(source)) errors.push('HTML/script markup is not allowed in TikZ source.')
  if (/(?:https?:\/\/|data:|javascript:)/iu.test(source)) errors.push('External URLs or data references are not allowed in TikZ source.')
  if (/\b(?:plot\s*\[|samples\s*=|domain\s*=)/iu.test(source)) errors.push('Unbounded plotting/sampling syntax is not allowed; use explicit drawing paths and coordinates.')

  const commands = [...source.matchAll(/\\([A-Za-z@]+)\b/gu)].map((match) => match[1])
  if (commands.length > TIKZ_MAX_COMMANDS) errors.push(`TikZ source exceeds ${TIKZ_MAX_COMMANDS} commands.`)
  for (const command of commands) if (!ALLOWED_COMMANDS.has(command)) errors.push(`TikZ command \\${command} is outside the supported subset.`)

  const nodeCount = commands.filter((command) => command === 'node').length + [...source.matchAll(/(^|[\s;])node\b/gu)].length
  if (nodeCount > TIKZ_MAX_NODES) errors.push(`TikZ source exceeds ${TIKZ_MAX_NODES} learner-visible nodes.`)
  const pathCommands = [...source.matchAll(/\\(?:draw|fill|filldraw|path|clip)\b[^;]*;/gu)]
  if (pathCommands.length > TIKZ_MAX_PATHS) errors.push(`TikZ source exceeds ${TIKZ_MAX_PATHS} paths.`)
  for (const match of pathCommands) {
    const path = match[0]
    if (path.length > TIKZ_MAX_PATH_CHARS) errors.push(`A TikZ path exceeds ${TIKZ_MAX_PATH_CHARS} characters.`)
    const operators = (path.match(/--|\.\.|\b(?:arc|rectangle|circle|ellipse|to)\b/gu) ?? []).length
    if (operators > TIKZ_MAX_PATH_OPERATORS) errors.push(`A TikZ path exceeds ${TIKZ_MAX_PATH_OPERATORS} path operations.`)
  }

  const coordinates = [...source.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gu)]
  if (coordinates.length > TIKZ_MAX_COORDINATES) errors.push(`TikZ source exceeds ${TIKZ_MAX_COORDINATES} explicit coordinates.`)
  for (const match of coordinates) {
    const x = Number(match[1]); const y = Number(match[2])
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > TIKZ_MAX_ABS_COORDINATE || Math.abs(y) > TIKZ_MAX_ABS_COORDINATE) { errors.push(`TikZ coordinates must remain within the supported -${TIKZ_MAX_ABS_COORDINATE}..${TIKZ_MAX_ABS_COORDINATE} range.`); break }
  }

  for (const list of optionLists(source)) for (const option of splitTopLevel(list)) if (!optionAllowed(option)) errors.push(`Unsupported TikZ option: ${option.trim().slice(0, 80) || '(empty)'}.`)
  if (!/\\(?:draw|fill|filldraw|path)\b/u.test(source)) errors.push('TikZ source must contain visible drawing commands.')

  return { valid: errors.length === 0, source, errors: [...new Set(errors)].slice(0, 24) }
}
