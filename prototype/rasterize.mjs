import sharp from 'sharp'
import { Vector3 } from 'three'

/** Orthographic, depth-buffered inspection images; no browser process or second CAD engine. */
export async function rasterize(mesh, view, filename, width = 900, height = 680) {
  const eyes = { top: [0, 0, 1], front: [0, -1, 0], right: [1, 0, 0], iso: [1, -1.4, 1.5] }
  const normal = new Vector3(...eyes[view]).normalize()
  const up = new Vector3(...(view === 'top' ? [0, 1, 0] : [0, 0, 1]))
  const right = up.clone().cross(normal).normalize()
  up.copy(normal).cross(right).normalize()
  const projected = []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    const v = new Vector3(...mesh.vertices.slice(i, i + 3))
    const x = v.dot(right), y = v.dot(up), z = v.dot(normal)
    projected.push([x, y, z]); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const scale = Math.min((width - 100) / Math.max(maxX - minX, .001), (height - 100) / Math.max(maxY - minY, .001))
  for (const v of projected) { v[0] = width / 2 + (v[0] - (minX + maxX) / 2) * scale; v[1] = height / 2 - (v[1] - (minY + maxY) / 2) * scale }
  const pixels = Buffer.alloc(width * height * 3)
  for (let i = 0; i < pixels.length; i += 3) { pixels[i] = 231; pixels[i + 1] = 237; pixels[i + 2] = 241 }
  const depth = new Float32Array(width * height).fill(-Infinity)
  const light = new Vector3(-.4, -.6, 1).normalize()
  const point = index => new Vector3(...mesh.vertices.slice(index * 3, index * 3 + 3))
  for (let t = 0; t < mesh.triangles.length; t += 3) {
    const ids = Array.from(mesh.triangles.slice(t, t + 3))
    const [a, b, c] = ids.map(i => projected[i])
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
    if (Math.abs(den) < 1e-8) continue
    const n = point(ids[1]).sub(point(ids[0])).cross(point(ids[2]).sub(point(ids[0]))).normalize()
    const shade = .67 + .33 * Math.abs(n.dot(light))
    const color = [0, 1, 2].map(i => Math.round((mesh.faceColors ? mesh.faceColors[t + i] : [110, 168, 254][i]) * shade))
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])))
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w0 = ((b[1] - c[1]) * (x + .5 - c[0]) + (c[0] - b[0]) * (y + .5 - c[1])) / den
      const w1 = ((c[1] - a[1]) * (x + .5 - c[0]) + (a[0] - c[0]) * (y + .5 - c[1])) / den
      const w2 = 1 - w0 - w1
      if (w0 < -1e-5 || w1 < -1e-5 || w2 < -1e-5) continue
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2], index = y * width + x
      if (z < depth[index]) continue
      depth[index] = z
      for (let channel = 0; channel < 3; channel++) pixels[index * 3 + channel] = color[channel]
    }
  }
  await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toFile(filename)
}
