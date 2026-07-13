/// <reference lib="webworker" />
// Vendored OpenSCAD wasm (2025.03.25 snapshot, from openscad-playground).
// Unlike the old openscad-wasm npm build, this one includes the Manifold
// geometry backend, which handles meshes the legacy CGAL backend rejects
// ("mesh is not closed" etc.) and is much faster.
import { unzipSync } from 'fflate'
import OpenSCAD from './vendor/openscad.js'

// Served as static assets from public/openscad (fetched once per worker,
// then cached in module scope for subsequent renders).
const wasmUrl = '/openscad/openscad.wasm'
const fontsZipUrl = '/openscad/fonts.zip'

// The OpenSCAD wasm build runs `main()` exactly once per module instance
// (calling `callMain` a second time aborts the runtime). So we build a fresh
// instance for every render, reusing the fetched wasm bytes and fonts.
let wasmBytes: ArrayBuffer | null = null
let fontFiles: Record<string, Uint8Array> | null = null
let logBuffer: string[] = []

interface RenderFile {
  name: string
  data: ArrayBuffer
}

/**
 * `off` (colored, for the preview) and `binstl` (for STL download) are the
 * two formats this build supports that we use. OFF is the only one that
 * carries per-face `color()` data.
 */
export type ExportFormat = 'off' | 'binstl'

interface RenderRequest {
  id: number
  code: string
  files?: RenderFile[]
  format?: ExportFormat
}

interface RenderOk {
  id: number
  ok: true
  data: ArrayBuffer
  format: ExportFormat
  log: string
}

interface RenderErr {
  id: number
  ok: false
  error: string
  log: string
}

async function fetchBinary(url: string, what: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${what} (${res.status}).`)
  return res.arrayBuffer()
}

async function render(
  code: string,
  files: RenderFile[],
  format: ExportFormat,
): Promise<{ data: ArrayBuffer; log: string }> {
  logBuffer = []
  if (!wasmBytes || !fontFiles) {
    const [wasm, fontsZip] = await Promise.all([
      fetchBinary(wasmUrl, 'OpenSCAD wasm'),
      fetchBinary(fontsZipUrl, 'font bundle'),
    ])
    wasmBytes = wasm
    fontFiles = unzipSync(new Uint8Array(fontsZip))
  }
  const instance = await OpenSCAD({
    noInitialRun: true,
    wasmBinary: wasmBytes,
    print: (t: string) => logBuffer.push(t),
    printErr: (t: string) => logBuffer.push(t),
    // Point fontconfig at /fonts (which holds fonts.conf + all the ttfs)
    // before main() runs, so text() can find its fonts.
    preRun: [(mod: { ENV: Record<string, string> }) => {
      mod.ENV.FONTCONFIG_PATH = '/fonts'
    }],
  })
  const fs = instance.FS

  fs.mkdir('/fonts')
  for (const [name, data] of Object.entries(fontFiles)) {
    fs.writeFile(`/fonts/${name}`, data)
  }

  // Workspace files live next to input.scad so `import("name.svg")` and
  // `use <lib.scad>` resolve naturally.
  for (const f of files) {
    fs.writeFile(`/${f.name}`, new Uint8Array(f.data))
  }

  fs.writeFile('/input.scad', code)

  try {
    // Manifold backend: robust against the almost-degenerate geometry CGAL
    // rejects, and the only one that emits per-face colors in OFF output.
    instance.callMain([
      '/input.scad',
      '--backend=manifold',
      `--export-format=${format}`,
      '-o',
      '/output.dat',
    ])
  } catch (e) {
    throw new Error(
      cleanLog() || String(e) || 'OpenSCAD failed to run.',
    )
  }

  let data: Uint8Array
  try {
    data = fs.readFile('/output.dat')
  } catch {
    throw new Error(
      cleanLog() ||
        'OpenSCAD produced no output (the model may be empty or contain errors).',
    )
  }

  if (data.byteLength === 0) {
    throw new Error(cleanLog() || 'OpenSCAD produced an empty model.')
  }

  // Copy into a fresh ArrayBuffer we can transfer to the main thread.
  const buffer = data.slice().buffer
  return { data: buffer, log: logBuffer.join('\n') }
}

/** Keep only meaningful lines from OpenSCAD's log (drop the geometry chatter). */
function cleanLog(): string {
  return logBuffer
    .filter((l) => {
      const s = l.toLowerCase()
      return (
        s.includes('error') ||
        s.includes('warning') ||
        s.includes('assert') ||
        s.includes('unknown') ||
        s.includes('undefined')
      )
    })
    .join('\n')
    .trim()
}

self.onmessage = async (e: MessageEvent<RenderRequest>) => {
  const { id, code, files, format = 'off' } = e.data
  try {
    const { data, log } = await render(code, files ?? [], format)
    const msg: RenderOk = { id, ok: true, data, format, log }
    ;(self as unknown as Worker).postMessage(msg, [data])
  } catch (err) {
    const msg: RenderErr = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      log: logBuffer.join('\n'),
    }
    ;(self as unknown as Worker).postMessage(msg)
  }
}
