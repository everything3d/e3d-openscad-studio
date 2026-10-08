/// <reference lib="webworker" />
// Vendored OpenSCAD wasm (2025.03.25 snapshot, from openscad-playground).
// Unlike the old openscad-wasm npm build, this one includes the Manifold
// geometry backend, which handles meshes the legacy CGAL backend rejects
// ("mesh is not closed" etc.) and is much faster.
import { unzipSync } from 'fflate'
import OpenSCAD from './vendor/openscad.js'
import { openscadArgs } from './args'
import { parseOFF, type ParsedMesh } from './off'
import {
  BUNDLED_FAMILIES,
  extractCatalogFontSpecs,
  extractFontSpecs,
  needsGoogleFetch,
  specKey,
  type FontSpec,
} from './fonts'

/**
 * Bump when public/openscad/* changes. The files are served immutable (see
 * next.config.ts), so the version in the query string is what busts the cache.
 */
export const OPENSCAD_ASSET_VERSION = '2025.03.25-1'
const wasmUrl = `/openscad/openscad.wasm?v=${OPENSCAD_ASSET_VERSION}`
const fontsZipUrl = `/openscad/fonts.zip?v=${OPENSCAD_ASSET_VERSION}`

// The OpenSCAD wasm build runs `main()` exactly once per module instance
// (calling `callMain` a second time aborts the runtime). So we build a fresh
// instance for every render, but compile the 9.6 MB binary once and reuse
// the compiled `WebAssembly.Module` for every instance: instantiating a
// compiled module is cheap, compiling the bytes again is not, and a fresh
// compile also restarts from the baseline tier each time.
interface Assets {
  wasmModule: WebAssembly.Module
  fontFiles: Record<string, Uint8Array>
}
let assetsPromise: Promise<Assets> | null = null

async function fetchBinary(url: string, what: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${what} (${res.status}).`)
  return res.arrayBuffer()
}

function loadAssets(): Promise<Assets> {
  assetsPromise ??= (async () => {
    const [wasmModule, fontsZip] = await Promise.all([
      WebAssembly.compileStreaming(fetch(wasmUrl)).catch(async () =>
        // Older browsers, or a server that does not send application/wasm.
        WebAssembly.compile(await fetchBinary(wasmUrl, 'OpenSCAD wasm')),
      ),
      fetchBinary(fontsZipUrl, 'font bundle'),
    ])
    return { wasmModule, fontFiles: unzipSync(new Uint8Array(fontsZip)) }
  })()
  // A failed download must not poison every later render.
  assetsPromise.catch(() => {
    assetsPromise = null
  })
  return assetsPromise
}

// Google Fonts fetched on demand, keyed by "family|style" (lowercased).
// `null` marks a family the API said doesn't exist, so we don't re-ask
// every render; transient network errors are NOT cached and will retry.
const googleFonts = new Map<string, Uint8Array | null>()

// Lowercased Google Fonts family names, for scanning code string literals.
let catalogPromise: Promise<Set<string>> | null = null

function loadFontCatalog(): Promise<Set<string>> {
  catalogPromise ??= (async () => {
    const res = await fetch(`${self.location.origin}/api/fonts/catalog`)
    if (!res.ok) throw new Error(`Font catalog unavailable (${res.status})`)
    const names = (await res.json()) as string[]
    return new Set(names.map((n) => n.toLowerCase()))
  })()
  catalogPromise.catch(() => {
    catalogPromise = null
  })
  return catalogPromise
}

async function loadGoogleFonts(
  code: string,
  log: string[],
): Promise<{ name: string; data: Uint8Array }[]> {
  // Explicit `font = "..."` specs always count; the catalog scan also finds
  // font names that reach text() through variables or module parameters.
  const specs = new Map<string, FontSpec>()
  for (const spec of extractFontSpecs(code)) specs.set(specKey(spec), spec)
  try {
    const catalog = await loadFontCatalog()
    for (const spec of extractCatalogFontSpecs(code, catalog)) {
      specs.set(specKey(spec), spec)
    }
  } catch {
    // Catalog fetch failed — explicit font= specs still resolve.
  }
  const wanted = [...specs.values()].filter(needsGoogleFetch)
  const loaded: { name: string; data: Uint8Array }[] = []
  await Promise.all(
    wanted.map(async (spec: FontSpec) => {
      const key = specKey(spec)
      if (!googleFonts.has(key)) {
        try {
          const params = new URLSearchParams({ family: spec.family })
          if (spec.style) params.set('style', spec.style)
          // Absolute URL: a root-relative path would break if the bundler
          // ever serves this worker from a blob: URL.
          const res = await fetch(`${self.location.origin}/api/fonts?${params}`)
          if (res.ok) {
            googleFonts.set(key, new Uint8Array(await res.arrayBuffer()))
          } else if (res.status === 400 || res.status === 404) {
            googleFonts.set(key, null)
          }
        } catch {
          // Network hiccup — leave uncached so the next render retries.
        }
      }
      const data = googleFonts.get(key)
      if (data) {
        loaded.push({ name: `gf-${key.replace(/[^a-z0-9]+/g, '-')}.ttf`, data })
      } else if (!BUNDLED_FAMILIES.has(spec.family.toLowerCase())) {
        // A bundled family missing only a style still renders (regular
        // weight); an unknown family is worth a visible warning.
        log.push(
          `WARNING: Could not load font "${spec.family}" from Google Fonts; falling back to the default font.`,
        )
      }
    }),
  )
  return loaded
}

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

/** Messages from the main thread. */
export type WorkerRequest =
  | { type: 'warmup' }
  | {
      type: 'render' | 'export'
      id: number
      code: string
      files?: RenderFile[]
      format?: ExportFormat
    }

/** Messages to the main thread. */
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'render'; id: number; ok: true; mesh: ParsedMesh; log: string }
  | { type: 'render'; id: number; ok: false; error: string; log: string }
  | { type: 'export'; id: number; ok: true; data: ArrayBuffer; format: ExportFormat; log: string }
  | { type: 'export'; id: number; ok: false; error: string; log: string }

// A `font =` assignment counts too, in case a font reaches text() through a
// path the call scan misses: mounting fonts needlessly costs time, missing
// them costs the render.
const TEXT_CALL = /\b(?:text|textmetrics)\s*\(|\bfont\s*=/

/**
 * Whether this render can use text(). Mounting the font bundle means writing
 * 97 files (14 MB) into the wasm FS and letting fontconfig scan them, which
 * costs as much as rendering a simple model, so it is skipped for programs
 * that never call text(). Workspace .scad libraries are scanned too, since the
 * main program may only call a module that does.
 */
function usesText(code: string, files: RenderFile[]): boolean {
  if (TEXT_CALL.test(code)) return true
  const decoder = new TextDecoder()
  return files.some(
    (f) => f.name.toLowerCase().endsWith('.scad') && TEXT_CALL.test(decoder.decode(f.data)),
  )
}

async function render(
  code: string,
  files: RenderFile[],
  format: ExportFormat,
  log: string[],
): Promise<Uint8Array> {
  const withText = usesText(code, files)
  const [assets, extraFonts] = await Promise.all([
    loadAssets(),
    withText ? loadGoogleFonts(code, log) : Promise.resolve([]),
  ])
  const { wasmModule, fontFiles } = assets
  const instance = await OpenSCAD({
    noInitialRun: true,
    instantiateWasm: (imports, onInstantiated) => {
      WebAssembly.instantiate(wasmModule, imports).then((wasmInstance) =>
        onInstantiated(wasmInstance, wasmModule),
      )
      return {}
    },
    print: (t: string) => log.push(t),
    printErr: (t: string) => log.push(t),
    // Point fontconfig at /fonts (which holds fonts.conf + all the ttfs)
    // before main() runs, so text() can find its fonts.
    preRun: [(mod: { ENV: Record<string, string> }) => {
      mod.ENV.FONTCONFIG_PATH = '/fonts'
    }],
  })
  const fs = instance.FS

  fs.mkdir('/fonts')
  if (withText) {
    for (const [name, data] of Object.entries(fontFiles)) {
      fs.writeFile(`/fonts/${name}`, data)
    }
    // On-demand Google Fonts land in the same fontconfig dir; fontconfig
    // registers them by the family name embedded in the file.
    for (const f of extraFonts) {
      fs.writeFile(`/fonts/${f.name}`, f.data)
    }
  }

  // Workspace files live next to input.scad so `import("name.svg")` and
  // `use <lib.scad>` resolve naturally.
  for (const f of files) {
    fs.writeFile(`/${f.name}`, new Uint8Array(f.data))
  }

  fs.writeFile('/input.scad', code)

  try {
    instance.callMain(openscadArgs(format))
  } catch (e) {
    throw new Error(cleanLog(log) || String(e) || 'OpenSCAD failed to run.')
  }

  let data: Uint8Array
  try {
    data = fs.readFile('/output.dat')
  } catch {
    throw new Error(
      cleanLog(log) ||
        'OpenSCAD produced no output (the model may be empty or contain errors).',
    )
  }

  if (data.byteLength === 0) {
    throw new Error(cleanLog(log) || 'OpenSCAD produced an empty model.')
  }
  return data
}

/** Keep only meaningful lines from OpenSCAD's log (drop the geometry chatter). */
function cleanLog(log: string[]): string {
  return log
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

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  ;(self as unknown as Worker).postMessage(msg, transfer)
}

type Job = Extract<WorkerRequest, { type: 'render' | 'export' }>

// Jobs run one at a time (callMain is synchronous and the FS is per instance).
// A newer preview request replaces any preview still waiting in the queue:
// only the latest source matters, and the main thread drops stale results
// anyway, so rendering them would just delay the one the user is looking at.
// Exports are never dropped; each resolves its own promise.
const queue: Job[] = []
let running = false

async function runJob(job: Job) {
  const log: string[] = []
  const format = job.format ?? 'off'
  try {
    const output = await render(job.code, job.files ?? [], format, log)
    if (job.type === 'render') {
      // Parse the text OFF here rather than on the main thread, where a
      // detailed model's multi-megabyte parse would freeze the UI; the typed
      // arrays transfer without a copy.
      const mesh = parseOFF(output)
      const transfer: Transferable[] = [mesh.vertices.buffer, mesh.triangles.buffer]
      if (mesh.faceColors) transfer.push(mesh.faceColors.buffer)
      post({ type: 'render', id: job.id, ok: true, mesh, log: log.join('\n') }, transfer)
    } else {
      const data = output.slice().buffer
      post({ type: 'export', id: job.id, ok: true, data, format, log: log.join('\n') }, [data])
    }
  } catch (err) {
    post({
      type: job.type,
      id: job.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      log: log.join('\n'),
    })
  }
}

async function drain() {
  if (running) return
  running = true
  try {
    while (queue.length) {
      const job = queue.shift()!
      await runJob(job)
    }
  } finally {
    running = false
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'warmup') {
    loadAssets().then(
      () => post({ type: 'ready' }),
      () => {
        // Reported on the first render that needs the assets.
      },
    )
    return
  }
  if (msg.type === 'render') {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].type === 'render') queue.splice(i, 1)
    }
  }
  queue.push(msg)
  void drain()
}

// Start downloading and compiling as soon as the worker exists, so the first
// preview is not also waiting on 17 MB of wasm and fonts.
void loadAssets().catch(() => {})
