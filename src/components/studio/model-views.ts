import * as THREE from 'three'
import { DEFAULT_FACE_COLOR, type ParsedMesh } from '@/lib/openscad/off'
import type { InspectModelOutput, InspectView } from '@/lib/tools/inspect-model'
import { addLights, meshToGeometry, PREVIEW_BACKGROUND } from './scene'

/**
 * What the agent sees when it inspects its work: measurements of the rendered
 * mesh, and a labeled sheet of fixed camera angles drawn offscreen. Fixed
 * angles in OpenSCAD's own axes (Z up) give the model the same reference every
 * time, whatever the user did to the preview camera or whether the preview is
 * even on screen.
 */

type Vec3 = [number, number, number]

const TILE = 448
const LABEL_HEIGHT = 26

/** Direction from the model toward the camera, and a short label, per view. */
const VIEW_SETUP: Record<InspectView, { dir: Vec3; up: Vec3; label: string }> = {
  iso: { dir: [1, -1.15, 0.85], up: [0, 0, 1], label: 'ISO (front-right-top)' },
  front: { dir: [0, -1, 0], up: [0, 0, 1], label: 'FRONT (from -Y)  X→  Z↑' },
  back: { dir: [0, 1, 0], up: [0, 0, 1], label: 'BACK (from +Y)  ←X  Z↑' },
  left: { dir: [-1, 0, 0], up: [0, 0, 1], label: 'LEFT (from -X)  ←Y  Z↑' },
  right: { dir: [1, 0, 0], up: [0, 0, 1], label: 'RIGHT (from +X)  Y→  Z↑' },
  top: { dir: [0, 0, 1], up: [0, 1, 0], label: 'TOP (from +Z)  X→  Y↑' },
  bottom: { dir: [0, 0, -1], up: [0, -1, 0], label: 'BOTTOM (from -Z)  X→  Y↓' },
}

const round = (n: number) => Math.round(n * 100) / 100
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`

/** Bounding box and per-color extents, in OpenSCAD coordinates. */
export function measureMesh(mesh: ParsedMesh): Pick<InspectModelOutput, 'bounds' | 'parts' | 'triangles'> {
  const triCount = mesh.triangles.length / 3
  const all = { min: [Infinity, Infinity, Infinity] as Vec3, max: [-Infinity, -Infinity, -Infinity] as Vec3 }
  const byColor = new Map<string, { triangles: number; min: Vec3; max: Vec3 }>()

  for (let t = 0; t < triCount; t++) {
    const color = mesh.faceColors
      ? toHex(mesh.faceColors[t * 3], mesh.faceColors[t * 3 + 1], mesh.faceColors[t * 3 + 2])
      : toHex(...DEFAULT_FACE_COLOR)
    let part = byColor.get(color)
    if (!part) {
      part = { triangles: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
      byColor.set(color, part)
    }
    part.triangles++
    for (let k = 0; k < 3; k++) {
      const v = mesh.triangles[t * 3 + k] * 3
      for (let axis = 0; axis < 3; axis++) {
        const value = mesh.vertices[v + axis]
        if (value < part.min[axis]) part.min[axis] = value
        if (value > part.max[axis]) part.max[axis] = value
        if (value < all.min[axis]) all.min[axis] = value
        if (value > all.max[axis]) all.max[axis] = value
      }
    }
  }

  if (triCount === 0) return { triangles: 0, parts: [] }
  return {
    triangles: triCount,
    bounds: {
      min: all.min.map(round) as Vec3,
      max: all.max.map(round) as Vec3,
      size: all.max.map((v, i) => round(v - all.min[i])) as Vec3,
    },
    // A single uncolored model says nothing a bounding box doesn't.
    parts:
      byColor.size > 1 || mesh.faceColors
        ? [...byColor.entries()]
            .sort((a, b) => b[1].triangles - a[1].triangles)
            .slice(0, 12)
            .map(([color, part]) => ({
              color,
              triangles: part.triangles,
              min: part.min.map(round) as Vec3,
              max: part.max.map(round) as Vec3,
            }))
        : [],
  }
}

/** A grid step that gives roughly 4–20 lines across the model. */
function gridStep(span: number): number {
  for (const step of [1, 2, 5, 10, 20, 50, 100, 200, 500]) {
    if (span / step <= 20) return step
  }
  return 1000
}

/**
 * Draw the requested views of the mesh into one JPEG sheet (2 columns), each
 * tile labeled with its angle and the grid spacing. Returns null when WebGL is
 * unavailable.
 */
export function renderModelViews(mesh: ParsedMesh, views: InspectView[]): string | null {
  if (mesh.triangles.length === 0) return null
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  } catch {
    return null
  }

  const geometry = meshToGeometry(mesh)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const box = geometry.boundingBox!
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const radius = geometry.boundingSphere!.radius || 10

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.5 })
  const model = new THREE.Mesh(geometry, material)
  // Dark outlines keep edges readable where faces of one color meet.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 30),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  )

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(PREVIEW_BACKGROUND)
  scene.add(model, edges)
  // The shared lights are placed for the preview's Y-up scene; turned into
  // Z-up they light the front-right-top as they do there, not the back.
  const lights = new THREE.Scene()
  addLights(lights)
  const lightRig = new THREE.Group()
  lightRig.add(...lights.children)
  lightRig.rotation.x = Math.PI / 2
  scene.add(lightRig)

  // Grid on the model's floor (z = bottom), in round millimetres.
  const step = gridStep(Math.max(size.x, size.y) * 1.6)
  const gridSize = Math.ceil((Math.max(size.x, size.y) * 1.6) / step) * step
  const grid = new THREE.GridHelper(gridSize, gridSize / step, 0x475569, 0x273142)
  grid.rotation.x = Math.PI / 2
  grid.position.set(
    Math.round(center.x / step) * step,
    Math.round(center.y / step) * step,
    box.min.z,
  )
  scene.add(grid)

  const columns = views.length === 1 ? 1 : 2
  const rows = Math.ceil(views.length / columns)
  const sheet = document.createElement('canvas')
  sheet.width = columns * TILE
  sheet.height = rows * TILE
  const ctx = sheet.getContext('2d')
  if (!ctx) {
    renderer.dispose()
    return null
  }
  ctx.fillStyle = PREVIEW_BACKGROUND
  ctx.fillRect(0, 0, sheet.width, sheet.height)

  renderer.setPixelRatio(1)
  renderer.setSize(TILE, TILE - LABEL_HEIGHT)
  const aspect = TILE / (TILE - LABEL_HEIGHT)
  const extent = radius * 1.15

  views.forEach((view, i) => {
    const setup = VIEW_SETUP[view]
    const dir = new THREE.Vector3(...setup.dir).normalize()
    // Orthographic everywhere, so lengths in the axis views can be read
    // against the grid; the iso view keeps it for consistency.
    const camera = new THREE.OrthographicCamera(
      -extent * aspect,
      extent * aspect,
      extent,
      -extent,
      radius / 100,
      radius * 10,
    )
    camera.up.set(...setup.up)
    camera.position.copy(center).addScaledVector(dir, radius * 4)
    camera.lookAt(center)
    // The floor grid seen edge-on is just a line through the model.
    grid.visible = view !== 'front' && view !== 'back' && view !== 'left' && view !== 'right'
    renderer.render(scene, camera)

    const x = (i % columns) * TILE
    const y = Math.floor(i / columns) * TILE
    ctx.drawImage(renderer.domElement, x, y + LABEL_HEIGHT)
    ctx.fillStyle = '#1b2029'
    ctx.fillRect(x, y, TILE, LABEL_HEIGHT)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(setup.label, x + 8, y + LABEL_HEIGHT / 2)
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'right'
    ctx.fillText(grid.visible ? `grid ${step} mm` : '', x + TILE - 8, y + LABEL_HEIGHT / 2)
    ctx.textAlign = 'left'
    // Tile separators.
    ctx.strokeStyle = '#2a3140'
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1)
  })

  const url = sheet.toDataURL('image/jpeg', 0.8)
  geometry.dispose()
  edges.geometry.dispose()
  ;(edges.material as THREE.Material).dispose()
  material.dispose()
  grid.geometry.dispose()
  ;(grid.material as THREE.Material).dispose()
  renderer.dispose()
  renderer.forceContextLoss()
  return url
}

/** OpenSCAD log lines worth showing the model: warnings, errors and echo output. */
export function importantLogLines(log: string): string[] {
  return log
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(WARNING|ERROR|ECHO|TRACE|DEPRECATED)\b/.test(line))
    .slice(0, 30)
}
