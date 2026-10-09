const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const ts = require('typescript')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gurodesk-edge-types-'))
try {
  const shim = path.join(directory, 'deno-shim.d.ts')
  fs.writeFileSync(shim, 'declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void };')
  const root = path.resolve('supabase/functions')
  const files = fs.readdirSync(root).filter(name => !name.startsWith('_')).map(name => path.join(root, name, 'index.ts'))
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true, strictNullChecks: true }
  const host = ts.createCompilerHost(options)
  // Mirror the existing esm.sh Supabase import with the lockfile SDK types. This is a semantic
  // source gate; it does not claim to execute Deno or replace the local runtime preflight tests.
  host.resolveModuleNames = (names, containing) => names.map(name => ts.resolveModuleName(name.startsWith('https://esm.sh/@supabase/supabase-js') ? '@supabase/supabase-js' : name, containing, options, host).resolvedModule)
  const program = ts.createProgram([...files, shim], options, host)
  const errors = ts.getPreEmitDiagnostics(program)
  for (const error of errors) {
    const position = error.file && error.start !== undefined ? error.file.getLineAndCharacterOfPosition(error.start) : null
    console.error(`${error.file ? path.relative(process.cwd(), error.file.fileName) : 'Edge types'}${position ? ':' + (position.line + 1) : ''}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`)
  }
  if (errors.length) process.exitCode = 1
  else console.log(`Edge semantic source types passed (${files.length} functions, lockfile SDK types; runtime not executed).`)
} finally { fs.rmSync(directory, { recursive: true, force: true }) }
