import type { ParsedMesh } from './openscad/off'

/**
 * Estimating what a design costs to print, from the mesh the preview already
 * has in memory.
 *
 * This is an estimate, not a slicer. A slicer knows the toolpath; we know the
 * shape. The numbers here are good enough to quote from and to sanity-check an
 * order, and every figure is labelled as an estimate wherever it is shown. The
 * shop confirms before anything is printed.
 *
 * Everything is in millimetres, matching OpenSCAD's unit.
 */

export interface BoundingBox {
  min: [number, number, number]
  max: [number, number, number]
  /** Width, depth, height. */
  size: [number, number, number]
}

export interface PrintEstimate {
  /** Enclosed volume of the solid. */
  volumeMm3: number
  /** Outer surface area, which sets how much of the print is shell. */
  surfaceAreaMm2: number
  boundingBox: BoundingBox
  /** Plastic actually extruded, once walls and sparse infill are accounted for. */
  filamentVolumeMm3: number
  filamentGrams: number
  /** Estimated time on the machine. */
  printMinutes: number
}

/** How the shop prints. Defaults describe a 0.4 mm nozzle at everyday settings. */
export interface PrintProfile {
  /** Combined thickness of the perimeters, top and bottom skins. */
  wallThicknessMm: number
  /** Sparse infill density inside the shell, 0–1. */
  infillDensity: number
  /**
   * Sustained volumetric throughput, mm³/s, averaged over a whole job. This is
   * well below a nozzle's peak: it has to absorb acceleration, travel moves,
   * layer changes, and slowdowns on small layers.
   */
  flowRateMm3PerSecond: number
  /** Fixed per-job time: heat-up, purge, bed levelling, removal. */
  setupMinutes: number
  /** Filament density, g/cm³. PLA is about 1.24. */
  filamentDensityGPerCm3: number
}

export const DEFAULT_PRINT_PROFILE: PrintProfile = {
  wallThicknessMm: 1.2,
  infillDensity: 0.15,
  flowRateMm3PerSecond: 9,
  setupMinutes: 8,
  filamentDensityGPerCm3: 1.24,
}

/**
 * Enclosed volume, via the divergence theorem: each triangle contributes the
 * signed volume of the tetrahedron it forms with the origin, and for a closed
 * surface the outside contributions cancel.
 *
 * OpenSCAD's Manifold backend only exports closed, consistently wound meshes,
 * which is exactly the condition this relies on. The result is made positive
 * so a mesh wound the other way still reports a sensible volume.
 */
export function meshVolumeMm3(mesh: ParsedMesh): number {
  const { vertices, triangles } = mesh
  let sixVolume = 0
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] * 3
    const b = triangles[i + 1] * 3
    const c = triangles[i + 2] * 3
    const ax = vertices[a]
    const ay = vertices[a + 1]
    const az = vertices[a + 2]
    const bx = vertices[b]
    const by = vertices[b + 1]
    const bz = vertices[b + 2]
    const cx = vertices[c]
    const cy = vertices[c + 1]
    const cz = vertices[c + 2]
    // a · (b × c)
    sixVolume +=
      ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)
  }
  return Math.abs(sixVolume) / 6
}

/** Total area of every triangle, i.e. the outer skin of the print. */
export function meshSurfaceAreaMm2(mesh: ParsedMesh): number {
  const { vertices, triangles } = mesh
  let area = 0
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] * 3
    const b = triangles[i + 1] * 3
    const c = triangles[i + 2] * 3
    const ux = vertices[b] - vertices[a]
    const uy = vertices[b + 1] - vertices[a + 1]
    const uz = vertices[b + 2] - vertices[a + 2]
    const vx = vertices[c] - vertices[a]
    const vy = vertices[c + 1] - vertices[a + 1]
    const vz = vertices[c + 2] - vertices[a + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    // A triangle's area is half the magnitude of the cross product.
    area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2
  }
  return area
}

export function meshBoundingBox(mesh: ParsedMesh): BoundingBox {
  const { vertices } = mesh
  if (vertices.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] }
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < vertices.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = vertices[i + axis]
      if (value < min[axis]) min[axis] = value
      if (value > max[axis]) max[axis] = value
    }
  }
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  }
}

/**
 * How much plastic actually gets extruded.
 *
 * A print is a solid shell around sparse infill, so it uses far less material
 * than its volume suggests. The shell is approximated as the surface area times
 * the wall thickness; whatever volume is left inside is filled at the infill
 * density. Thin parts — a 1 mm plate, a letter face — have no interior left, so
 * the shell estimate is capped at the total volume and they come out solid,
 * which is what a slicer does too.
 */
export function filamentVolumeMm3(
  volumeMm3: number,
  surfaceAreaMm2: number,
  profile: PrintProfile = DEFAULT_PRINT_PROFILE,
): number {
  const shell = Math.min(surfaceAreaMm2 * profile.wallThicknessMm, volumeMm3)
  const interior = Math.max(volumeMm3 - shell, 0)
  return shell + interior * profile.infillDensity
}

export function estimatePrint(
  mesh: ParsedMesh,
  profile: PrintProfile = DEFAULT_PRINT_PROFILE,
): PrintEstimate {
  const volumeMm3 = meshVolumeMm3(mesh)
  const surfaceAreaMm2 = meshSurfaceAreaMm2(mesh)
  const filament = filamentVolumeMm3(volumeMm3, surfaceAreaMm2, profile)
  const printSeconds = filament / profile.flowRateMm3PerSecond

  return {
    volumeMm3,
    surfaceAreaMm2,
    boundingBox: meshBoundingBox(mesh),
    filamentVolumeMm3: filament,
    // mm³ → cm³ is /1000, then × density.
    filamentGrams: (filament / 1000) * profile.filamentDensityGPerCm3,
    printMinutes: printSeconds / 60 + profile.setupMinutes,
  }
}
