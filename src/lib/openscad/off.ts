/**
 * Parser for OpenSCAD's OFF export (Manifold backend), which includes
 * per-face RGB colors for geometry wrapped in `color()`.
 *
 * OpenSCAD writes one record per line, so parsing is line-based:
 *   OFF [nv nf ne]          — counts may be on the OFF line or the next one
 *   x y z                   — nv vertex lines
 *   n i0 … in-1 [r g b [a]] — nf face lines; color 0–255 ints or 0–1 floats
 */

export interface ParsedMesh {
  /** x,y,z per vertex */
  vertices: Float32Array
  /** vertex indices, 3 per triangle */
  triangles: Uint32Array
  /** RGB (0–255) per triangle, or null if no face in the file is colored */
  faceColors: Uint8Array | null
}

/** Preview color for uncolored faces; matches the old single-material blue. */
export const DEFAULT_FACE_COLOR: [number, number, number] = [110, 168, 254]

export function parseOFF(data: ArrayBuffer | Uint8Array): ParsedMesh {
  const text = new TextDecoder().decode(data)
  const lines: string[] = []
  for (const raw of text.split('\n')) {
    const hash = raw.indexOf('#')
    const line = (hash === -1 ? raw : raw.slice(0, hash)).trim()
    if (line) lines.push(line)
  }

  let li = 0
  const header = lines[li++]
  if (!header?.startsWith('OFF')) throw new Error('Not an OFF file.')

  let counts = header.slice(3).trim()
  if (!counts) counts = lines[li++] ?? ''
  const [nv, nf] = counts.split(/\s+/).map((t) => parseInt(t, 10))
  if (!Number.isFinite(nv) || !Number.isFinite(nf)) {
    throw new Error('Malformed OFF header.')
  }

  const vertices = new Float32Array(nv * 3)
  for (let v = 0; v < nv; v++) {
    const parts = lines[li++].split(/\s+/)
    vertices[v * 3] = parseFloat(parts[0])
    vertices[v * 3 + 1] = parseFloat(parts[1])
    vertices[v * 3 + 2] = parseFloat(parts[2])
  }

  const tris: number[] = []
  const colors: number[] = []
  let sawColor = false

  for (let f = 0; f < nf; f++) {
    const parts = lines[li++].split(/\s+/)
    const n = parseInt(parts[0], 10)
    if (!Number.isInteger(n) || n < 3 || parts.length < 1 + n) {
      throw new Error(`Malformed OFF face at line ${li}.`)
    }
    const idx: number[] = []
    for (let k = 0; k < n; k++) idx.push(parseInt(parts[1 + k], 10))

    let [r, g, b] = DEFAULT_FACE_COLOR
    const extra = parts.length - 1 - n
    if (extra >= 3) {
      const rt = parts[1 + n]
      const gt = parts[2 + n]
      const bt = parts[3 + n]
      const isFloat = rt.includes('.') || gt.includes('.') || bt.includes('.')
      const scale = isFloat ? 255 : 1
      r = Math.round(parseFloat(rt) * scale)
      g = Math.round(parseFloat(gt) * scale)
      b = Math.round(parseFloat(bt) * scale)
      sawColor = true
    }

    // Fan-triangulate (Manifold output is already triangles).
    for (let k = 1; k + 1 < idx.length; k++) {
      tris.push(idx[0], idx[k], idx[k + 1])
      colors.push(r, g, b)
    }
  }

  return {
    vertices,
    triangles: new Uint32Array(tris),
    faceColors: sawColor ? new Uint8Array(colors) : null,
  }
}
