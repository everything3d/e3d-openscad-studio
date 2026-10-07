import { describe, expect, it } from 'vitest'
import type { ParsedMesh } from './openscad/off'
import {
  DEFAULT_PRINT_PROFILE,
  estimatePrint,
  filamentVolumeMm3,
  meshBoundingBox,
  meshSurfaceAreaMm2,
  meshVolumeMm3,
} from './print-estimate'

/**
 * An axis-aligned box as a closed, outward-wound triangle mesh. Every figure
 * the estimator produces for a box can be checked by hand, which is the point.
 */
function box(width: number, depth: number, height: number, origin = 0): ParsedMesh {
  const x0 = origin
  const y0 = origin
  const z0 = origin
  const x1 = origin + width
  const y1 = origin + depth
  const z1 = origin + height

  const corners = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ]
  // Counter-clockwise seen from outside.
  const faces = [
    [0, 3, 2, 1], // bottom
    [4, 5, 6, 7], // top
    [0, 1, 5, 4], // front
    [1, 2, 6, 5], // right
    [2, 3, 7, 6], // back
    [3, 0, 4, 7], // left
  ]

  const triangles: number[] = []
  for (const [a, b, c, d] of faces) {
    triangles.push(a, b, c, a, c, d)
  }

  return {
    vertices: new Float32Array(corners.flat()),
    triangles: new Uint32Array(triangles),
    faceColors: null,
  }
}

describe('mesh measurement', () => {
  it('measures the volume of a known box', () => {
    expect(meshVolumeMm3(box(10, 10, 10))).toBeCloseTo(1000, 6)
    expect(meshVolumeMm3(box(20, 10, 5))).toBeCloseTo(1000, 6)
  })

  it('measures volume independent of where the mesh sits', () => {
    // The divergence theorem sums tetrahedra against the origin, so a mesh that
    // does not straddle the origin has to give the same answer.
    expect(meshVolumeMm3(box(10, 10, 10, 500))).toBeCloseTo(1000, 3)
    expect(meshVolumeMm3(box(10, 10, 10, -40))).toBeCloseTo(1000, 3)
  })

  it('measures the surface area of a known box', () => {
    // 6 faces of 10x10.
    expect(meshSurfaceAreaMm2(box(10, 10, 10))).toBeCloseTo(600, 6)
  })

  it('reports the bounding box and its size', () => {
    const bounds = meshBoundingBox(box(20, 10, 5, 3))
    expect(bounds.min).toEqual([3, 3, 3])
    expect(bounds.max).toEqual([23, 13, 8])
    expect(bounds.size).toEqual([20, 10, 5])
  })

  it('handles an empty mesh without producing infinities', () => {
    const empty: ParsedMesh = {
      vertices: new Float32Array(),
      triangles: new Uint32Array(),
      faceColors: null,
    }
    expect(meshVolumeMm3(empty)).toBe(0)
    expect(meshBoundingBox(empty).size).toEqual([0, 0, 0])
  })
})

describe('filament volume', () => {
  it('uses far less plastic than the solid volume for a chunky part', () => {
    const volume = 1000 // 10mm cube
    const area = 600
    const used = filamentVolumeMm3(volume, area)
    // Shell 600*1.2 = 720, interior 280 at 15% = 42.
    expect(used).toBeCloseTo(762, 6)
    expect(used).toBeLessThan(volume)
  })

  it('treats a part thinner than its own walls as solid', () => {
    // A 40x40x1 plate: shell estimate exceeds the volume, so it must be capped
    // rather than claiming more plastic than the part contains.
    const volume = 40 * 40 * 1
    const area = 2 * 40 * 40 + 4 * 40 * 1
    expect(filamentVolumeMm3(volume, area)).toBe(volume)
  })

  it('never returns more plastic than the part is made of', () => {
    for (const side of [1, 2, 5, 10, 50]) {
      const volume = side ** 3
      const area = 6 * side ** 2
      expect(filamentVolumeMm3(volume, area)).toBeLessThanOrEqual(volume + 1e-9)
    }
  })
})

describe('estimatePrint', () => {
  it('produces a plausible quote for a piggy-bank-sized part', () => {
    // 120 x 50 x 40 mm, roughly a name-sign bank's envelope.
    const estimate = estimatePrint(box(120, 50, 40))

    expect(estimate.boundingBox.size).toEqual([120, 50, 40])
    expect(estimate.filamentGrams).toBeGreaterThan(10)
    expect(estimate.filamentGrams).toBeLessThan(400)
    // Hours, not minutes and not days.
    expect(estimate.printMinutes).toBeGreaterThan(30)
    expect(estimate.printMinutes).toBeLessThan(60 * 24)
  })

  it('charges setup time even for a part of no size', () => {
    const empty: ParsedMesh = {
      vertices: new Float32Array(),
      triangles: new Uint32Array(),
      faceColors: null,
    }
    expect(estimatePrint(empty).printMinutes).toBe(DEFAULT_PRINT_PROFILE.setupMinutes)
  })

  it('scales with size', () => {
    const small = estimatePrint(box(20, 20, 20))
    const large = estimatePrint(box(40, 40, 40))
    expect(large.filamentGrams).toBeGreaterThan(small.filamentGrams)
    expect(large.printMinutes).toBeGreaterThan(small.printMinutes)
  })

  it('respects a different print profile', () => {
    const solid = estimatePrint(box(30, 30, 30), {
      ...DEFAULT_PRINT_PROFILE,
      infillDensity: 1,
    })
    const sparse = estimatePrint(box(30, 30, 30), {
      ...DEFAULT_PRINT_PROFILE,
      infillDensity: 0.1,
    })
    expect(solid.filamentGrams).toBeGreaterThan(sparse.filamentGrams)
  })
})
