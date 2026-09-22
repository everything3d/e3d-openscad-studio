import { describe, expect, it } from 'vitest'
import { BUILT_IN_CANONICALS, SYSTEM_CANONICAL_OWNER_ID } from './builtin-canonicals'

describe('built-in canonical catalog', () => {
  it('contains the launch starters with stable system ownership', () => {
    expect(SYSTEM_CANONICAL_OWNER_ID).toBe('system:e3d')
    expect(BUILT_IN_CANONICALS.map((starter) => starter.id)).toEqual([
      'builtin-name-sign-piggy-bank',
      'builtin-two-color-name-sign-piggy-bank',
      'builtin-two-name-illusion',
    ])
    expect(new Set(BUILT_IN_CANONICALS.map((starter) => starter.versionId)).size).toBe(3)
  })

  it('ships complete editable OpenSCAD programs and gallery artwork paths', () => {
    for (const starter of BUILT_IN_CANONICALS) {
      expect(starter.code.length).toBeGreaterThan(1_000)
      expect(starter.modificationGuide.length).toBeGreaterThan(200)
      expect(starter.thumbnail).toMatch(/^\/canonicals\/.+\.webp$/)
    }

    expect(BUILT_IN_CANONICALS[0].code).toContain('module coin_lid()')
    expect(BUILT_IN_CANONICALS[0].code).toContain('textmetrics(name')
    expect(BUILT_IN_CANONICALS[1].code).toContain('font = "Baby Donuts"')
    expect(BUILT_IN_CANONICALS[1].code).toContain('module coin_lid()')
    expect(BUILT_IN_CANONICALS[2].code).toContain('intersection()')
    expect(BUILT_IN_CANONICALS[2].code).toContain('frontName = "LOVE"')
    expect(BUILT_IN_CANONICALS[2].code).toContain('sideName = "HOME"')
  })
})
