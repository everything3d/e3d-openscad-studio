/// <reference lib="webworker" />
import { createOpenSCAD } from 'openscad-wasm'

// The OpenSCAD wasm build runs `main()` exactly once per module instance
// (calling `callMain` a second time aborts the runtime). So we build a fresh
// instance for every render. The wasm bytes are already resident in the
// worker bundle, so this is decode+instantiate cost only, not a network fetch.
let logBuffer: string[] = []

interface RenderRequest {
  id: number
  code: string
}

interface RenderOk {
  id: number
  ok: true
  stl: ArrayBuffer
  log: string
}

interface RenderErr {
  id: number
  ok: false
  error: string
  log: string
}

async function render(code: string): Promise<{ stl: ArrayBuffer; log: string }> {
  logBuffer = []
  const openscad = await createOpenSCAD({
    print: (t: string) => logBuffer.push(t),
    printErr: (t: string) => logBuffer.push(t),
  })
  const instance = openscad.getInstance()
  const fs = instance.FS

  fs.writeFile('/input.scad', code)

  try {
    // Force binary STL so three's STLLoader can parse it reliably.
    instance.callMain(['/input.scad', '--export-format=binstl', '-o', '/output.stl'])
  } catch (e) {
    throw new Error(
      cleanLog() || String(e) || 'OpenSCAD failed to run.',
    )
  }

  let data: Uint8Array
  try {
    data = fs.readFile('/output.stl') as Uint8Array
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
  return { stl: buffer, log: logBuffer.join('\n') }
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
  const { id, code } = e.data
  try {
    const { stl, log } = await render(code)
    const msg: RenderOk = { id, ok: true, stl, log }
    ;(self as unknown as Worker).postMessage(msg, [stl])
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
