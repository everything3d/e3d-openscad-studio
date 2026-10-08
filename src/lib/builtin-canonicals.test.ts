import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_CANONICALS,
  RETIRED_CANONICAL_IDS,
  SYSTEM_CANONICAL_OWNER_ID,
  builtInVersionId,
  builtInWorkspaceFiles,
} from './builtin-canonicals'
import { needsGoogleFetch, parseFontSpec } from './openscad/fonts'

const byId = (id: string) => {
  const starter = BUILT_IN_CANONICALS.find((s) => s.id === id)
  if (!starter) throw new Error(`missing starter ${id}`)
  return starter
}

describe('built-in canonical catalog', () => {
  it('ships the launch starters, hero first, under stable system ownership', () => {
    expect(SYSTEM_CANONICAL_OWNER_ID).toBe('system:e3d')
    // The order is the order the starter library presents them in, so it is
    // part of the product rather than an implementation detail.
    expect(BUILT_IN_CANONICALS.map((starter) => starter.id)).toEqual([
      'builtin-three-layer-name-piggy-bank',
      'builtin-two-layer-name-piggy-bank',
      'builtin-name-keychain',
      'builtin-desk-nameplate',
      'builtin-figurine-display-base',
      'builtin-award-plaque-base',
      'builtin-two-name-illusion',
      'builtin-letter-pen-stand',
    ])
  })

  it('ships complete editable OpenSCAD programs and guidance', () => {
    for (const starter of BUILT_IN_CANONICALS) {
      expect(starter.code.length).toBeGreaterThan(1_000)
      expect(starter.modificationGuide.length).toBeGreaterThan(200)
      expect(starter.title).not.toBe('')
      expect(starter.description).not.toBe('')
      expect(starter.category).not.toBe('')
    }
  })

  it('points every starter at gallery artwork that is actually published', () => {
    for (const starter of BUILT_IN_CANONICALS) {
      expect(starter.thumbnail).toMatch(/^\/canonicals\/.+\.webp$/)
      // A renamed or missing thumbnail leaves a hole in the starter library,
      // which is the first thing a new user sees.
      expect(existsSync(new URL(`../../public${starter.thumbnail}`, import.meta.url))).toBe(true)
    }
    const thumbnails = BUILT_IN_CANONICALS.map((s) => s.thumbnail)
    expect(new Set(thumbnails).size).toBe(thumbnails.length)
  })

  it('only uses bundled fonts, so a starter never depends on a network fetch', () => {
    // fontconfig falls back silently when a family is missing, so a typo or
    // an unbundled font would quietly change the design rather than fail.
    // The letter pen stand draws its name from embedded outlines, not text().
    for (const starter of BUILT_IN_CANONICALS.filter((s) => s.id !== 'builtin-letter-pen-stand')) {
      const fonts = [...starter.code.matchAll(/\b\w*[Ff]ont\d?\s*=\s*"([^"]+)"/g)].map((m) => m[1])
      expect(fonts.length, starter.id).toBeGreaterThan(0)
      for (const font of fonts) {
        const spec = parseFontSpec(font)
        expect(spec, `${starter.id}: ${font}`).not.toBeNull()
        expect(needsGoogleFetch(spec!), `${starter.id}: ${font}`).toBe(false)
      }
    }
  })

  it('ships generic sample text rather than real customer names', () => {
    for (const starter of BUILT_IN_CANONICALS) {
      expect(starter.code).not.toMatch(/Veera|everything3d\/openscad/)
    }
  })

  it('keeps each starter recognisably the design it claims to be', () => {
    const threeLayer = byId('builtin-three-layer-name-piggy-bank')
    const twoLayer = byId('builtin-two-layer-name-piggy-bank')
    // Both banks are hollow with a removable lid and metric-derived layout.
    for (const bank of [twoLayer, threeLayer]) {
      expect(bank.code).toContain('module coin_lid()')
      expect(bank.code).toContain('textmetrics(name')
    }
    // Only the three-layer bank splits the name into an outline and a face.
    expect(threeLayer.code).toContain('fontColor2')
    expect(twoLayer.code).not.toContain('fontColor2')
    expect(twoLayer.code).toContain('font = "Baby Donuts"')

    expect(byId('builtin-name-keychain').code).toContain('holeDiameter')
    expect(byId('builtin-desk-nameplate').code).toContain('module stand()')

    // Both bases are the same recessed-plaque program with different defaults.
    const figurine = byId('builtin-figurine-display-base')
    const award = byId('builtin-award-plaque-base')
    for (const base of [figurine, award]) {
      expect(base.code).toContain('module chamfered_recess_cutter()')
    }
    expect(figurine.code).toContain('show_heart = true')
    expect(award.code).toContain('line3 = "With heartfelt gratitude"')

    // The illusion is the intersection of two perpendicular words.
    const illusion = byId('builtin-two-name-illusion')
    expect(illusion.code).toContain('intersection()')
    expect(illusion.code).toContain('frontName = "LOVE"')
    expect(illusion.code).toContain('sideName = "HOME"')

    // The stand and the name's outlines live in workspace files the program uses.
    const penStand = byId('builtin-letter-pen-stand')
    expect(penStand.code).toContain('use <letter-stands.scad>')
    expect(penStand.code).toContain('use <pacifico-outlines.scad>')
    expect(penStand.files?.map((f) => f.name)).toEqual(['letter-stands.scad', 'pacifico-outlines.scad'])
  })

  it('keeps bulky geometry out of the program the agent rewrites', () => {
    // The agent sees and rewrites the whole program on every change.
    for (const starter of BUILT_IN_CANONICALS) {
      expect(starter.code.length, starter.id).toBeLessThan(20_000)
    }
  })

  it('ships workspace files that round-trip through base64', () => {
    const starter = byId('builtin-letter-pen-stand')
    const files = builtInWorkspaceFiles(starter)
    expect(files.map((f) => f.addedAt)).toEqual([0, 1])
    for (const [i, file] of files.entries()) {
      expect(Buffer.from(file.data, 'base64').toString('utf8')).toBe(starter.files![i].text)
      expect(file.size).toBe(Buffer.byteLength(starter.files![i].text))
    }
    expect(builtInWorkspaceFiles(byId('builtin-name-keychain'))).toEqual([])
  })
})

describe('built-in version ids', () => {
  it('are unique and scoped to their starter', () => {
    const ids = BUILT_IN_CANONICALS.map(builtInVersionId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const starter of BUILT_IN_CANONICALS) {
      expect(builtInVersionId(starter)).toMatch(new RegExp(`^${starter.id}-[0-9a-f]{12}$`))
    }
  })

  it('change whenever published content changes, so edits reach seeded databases', () => {
    const starter = BUILT_IN_CANONICALS[0]
    const original = builtInVersionId(starter)
    expect(builtInVersionId({ ...starter })).toBe(original)
    expect(builtInVersionId({ ...starter, code: `${starter.code}\n` })).not.toBe(original)
    expect(builtInVersionId({ ...starter, modificationGuide: `${starter.modificationGuide}.` })).not.toBe(
      original,
    )
    expect(builtInVersionId({ ...starter, thumbnail: '/canonicals/other.webp' })).not.toBe(original)
    const withFile = { ...starter, files: [{ name: 'lib.scad', text: 'x = 1;' }] }
    expect(builtInVersionId(withFile)).not.toBe(original)
    expect(builtInVersionId({ ...starter, files: [{ name: 'lib.scad', text: 'x = 2;' }] })).not.toBe(
      builtInVersionId(withFile),
    )
  })

  it('ignore metadata, which is refreshed in place rather than versioned', () => {
    const starter = BUILT_IN_CANONICALS[0]
    expect(builtInVersionId({ ...starter, title: 'Renamed' })).toBe(builtInVersionId(starter))
  })
})

describe('retired ids', () => {
  const live = new Set(BUILT_IN_CANONICALS.map((s) => s.id))
  const superseded = BUILT_IN_CANONICALS.flatMap((s) => s.supersedes ?? [])

  it('retires the ids these starters were renamed from or merged out of', () => {
    expect(superseded).toEqual(
      expect.arrayContaining([
        'builtin-two-color-name-sign-piggy-bank',
        'builtin-name-sign-piggy-bank',
        // The single-sided, heart and two-sided bases became the figurine base.
        'Sc2BhycGQvLVxSgo',
        'ha4MQVRHMIDMBMuz',
        'V6SvgzkUL6k0mEM8',
        // The two- and three-line bases became the award plaque base.
        '6TLOjLkIkM3Iv7kp',
        'MuJyqR8R7BMdK2eP',
      ]),
    )
  })

  it('never lists a live starter id as retired', () => {
    // Claiming a current id is retired would archive the starter on seed.
    for (const old of [...superseded, ...RETIRED_CANONICAL_IDS]) {
      expect(live.has(old)).toBe(false)
    }
  })

  it('does not retire the same id twice', () => {
    const all = [...superseded, ...RETIRED_CANONICAL_IDS]
    expect(new Set(all).size).toBe(all.length)
  })
})
