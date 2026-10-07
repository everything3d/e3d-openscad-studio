import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILT_IN_CANONICALS, SYSTEM_CANONICAL_OWNER_ID } from './builtin-canonicals'

describe('built-in canonical catalog', () => {
  it('ships the launch starters, simplest first, under stable system ownership', () => {
    expect(SYSTEM_CANONICAL_OWNER_ID).toBe('system:e3d')
    // The order is the order the starter library presents them in, so it is
    // part of the product rather than an implementation detail.
    expect(BUILT_IN_CANONICALS.map((starter) => starter.id)).toEqual([
      'builtin-two-layer-name-piggy-bank',
      'builtin-three-layer-name-piggy-bank',
      'builtin-two-name-illusion',
    ])
    expect(new Set(BUILT_IN_CANONICALS.map((starter) => starter.versionId)).size).toBe(3)
  })

  it('ships complete editable OpenSCAD programs and guidance', () => {
    for (const starter of BUILT_IN_CANONICALS) {
      expect(starter.code.length).toBeGreaterThan(1_000)
      expect(starter.modificationGuide.length).toBeGreaterThan(200)
      expect(starter.title).not.toBe('')
      expect(starter.description).not.toBe('')
    }
  })

  it('points every starter at gallery artwork that is actually published', () => {
    for (const starter of BUILT_IN_CANONICALS) {
      expect(starter.thumbnail).toMatch(/^\/canonicals\/.+\.webp$/)
      // A renamed or missing thumbnail leaves a hole in the starter library,
      // which is the first thing a new user sees.
      expect(existsSync(new URL(`../../public${starter.thumbnail}`, import.meta.url))).toBe(true)
    }
  })

  it('keeps each starter recognisably the design it claims to be', () => {
    const [twoLayer, threeLayer, illusion] = BUILT_IN_CANONICALS

    // Both banks are hollow with a removable lid and metric-derived layout.
    for (const bank of [twoLayer, threeLayer]) {
      expect(bank.code).toContain('module coin_lid()')
      expect(bank.code).toContain('textmetrics(name')
    }
    // Only the three-layer bank splits the name into an outline and a face.
    expect(threeLayer.code).toContain('fontColor2')
    expect(twoLayer.code).not.toContain('fontColor2')
    expect(twoLayer.code).toContain('font = "Baby Donuts"')

    // The illusion is the intersection of two perpendicular words.
    expect(illusion.code).toContain('intersection()')
    expect(illusion.code).toContain('frontName = "LOVE"')
    expect(illusion.code).toContain('sideName = "HOME"')
  })
})

describe('superseded ids', () => {
  it('retires the ids these starters were renamed from', () => {
    const superseded = BUILT_IN_CANONICALS.flatMap((s) => s.supersedes ?? [])
    expect(superseded).toEqual(
      expect.arrayContaining([
        'builtin-two-color-name-sign-piggy-bank',
        'builtin-name-sign-piggy-bank',
      ]),
    )
  })

  it('never lists a live starter id as superseded', () => {
    // Claiming a current id is superseded would archive the starter on seed.
    const live = new Set(BUILT_IN_CANONICALS.map((s) => s.id))
    for (const old of BUILT_IN_CANONICALS.flatMap((s) => s.supersedes ?? [])) {
      expect(live.has(old)).toBe(false)
    }
  })

  it('does not let two starters claim the same old id', () => {
    const superseded = BUILT_IN_CANONICALS.flatMap((s) => s.supersedes ?? [])
    expect(new Set(superseded).size).toBe(superseded.length)
  })
})
