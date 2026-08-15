const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve('supabase/functions')

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

if (!fs.existsSync(root)) {
  console.error('Edge Function source validation failed: supabase/functions is missing.')
  process.exit(1)
}

const files = walk(root).filter((file) => file.endsWith('.ts')).sort()
if (!files.length) {
  console.error('Edge Function source validation failed: no TypeScript Edge Function files were found.')
  process.exit(1)
}

const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  noResolve: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
})

// Remote URL imports are resolved by the Supabase/Deno runtime, so this static
// gate intentionally does not pretend to be a full Deno typecheck. It catches
// parser failures and declaration collisions that can prevent an Edge Function
// from booting at all. The local preflight smoke test in CI then exercises the
// actual Supabase Edge Runtime for every configured function.
const declarationCollisionCodes = new Set([2300, 2393, 2395, 2440, 2451])
const diagnostics = [
  ...program.getSyntacticDiagnostics(),
  ...program.getSemanticDiagnostics().filter((diagnostic) => declarationCollisionCodes.has(diagnostic.code)),
].filter((diagnostic) => diagnostic.file && path.resolve(diagnostic.file.fileName).startsWith(root + path.sep))

if (diagnostics.length) {
  console.error('Edge Function source validation failed:')
  for (const diagnostic of diagnostics) {
    const file = diagnostic.file
    const position = file && diagnostic.start !== undefined
      ? file.getLineAndCharacterOfPosition(diagnostic.start)
      : null
    const location = file
      ? `${path.relative(process.cwd(), file.fileName)}${position ? `:${position.line + 1}:${position.character + 1}` : ''}`
      : 'unknown'
    console.error(`- TS${diagnostic.code} ${location}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
  }
  process.exit(1)
}

console.log(`Edge Function source validation passed (${files.length} TypeScript files).`)
