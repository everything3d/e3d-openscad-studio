import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { BUILT_IN_CANONICALS } from './builtin-canonicals'
import { openscadArgs } from './openscad/args'
import OpenSCAD from './openscad/vendor/openscad.js'

/**
 * Renders every starter with the same wasm build, font bundle and command line
 * the studio uses. A starter that only renders cleanly on desktop OpenSCAD
 * (where experimental features or extra fonts may be available) is broken for
 * every user, and OpenSCAD reports most such breakage as warnings rather than
 * errors, so any warning fails the test.
 */
const publicFile = (path: string) => readFileSync(new URL(`../../public/${path}`, import.meta.url))
const wasmBinary = publicFile('openscad/openscad.wasm')
const fonts = unzipSync(new Uint8Array(publicFile('openscad/fonts.zip')))

async function render(code: string, defines: Record<string, string | boolean> = {}) {
  const log: string[] = []
  const instance = await OpenSCAD({
    noInitialRun: true,
    wasmBinary,
    print: (line: string) => log.push(line),
    printErr: (line: string) => log.push(line),
    preRun: [
      (mod: { ENV: Record<string, string> }) => {
        mod.ENV.FONTCONFIG_PATH = '/fonts'
      },
    ],
  })
  instance.FS.mkdir('/fonts')
  for (const [name, data] of Object.entries(fonts)) instance.FS.writeFile(`/fonts/${name}`, data)
  instance.FS.writeFile('/input.scad', code)
  const [input, ...rest] = openscadArgs('off')
  const overrides = Object.entries(defines).flatMap(([key, value]) => ['-D', `${key}=${JSON.stringify(value)}`])
  instance.callMain([input, ...overrides, ...rest])
  let output: Uint8Array | null = null
  try {
    output = instance.FS.readFile('/output.dat')
  } catch {
    output = null
  }
  return { output, problems: log.filter((line) => /WARNING|ERROR/.test(line)) }
}

// Alternate layouts each starter exposes, which users reach by flipping one
// parameter and which would otherwise go unrendered.
const VARIANTS: Record<string, Record<string, string | boolean>[]> = {
  'builtin-three-layer-name-piggy-bank': [{ mode: 'preview' }, { backText: 'Love, Mom' }],
  'builtin-two-layer-name-piggy-bank': [{ mode: 'preview' }],
  'builtin-name-keychain': [{ name: 'Jo' }, { name: 'Alexandra Rose' }],
  'builtin-desk-nameplate': [{ showAssembled: true }, { title: '' }],
  'builtin-figurine-display-base': [{ show_assembled: true, two_sided: true }],
  'builtin-award-plaque-base': [{ show_assembled: true }, { line3: '' }],
  'builtin-two-name-illusion': [{ frontName: 'ANNA', sideName: 'LEO' }],
}

describe('built-in starters render in the studio', () => {
  for (const starter of BUILT_IN_CANONICALS) {
    for (const defines of [{}, ...(VARIANTS[starter.id] ?? [])]) {
      const label = Object.keys(defines).length ? JSON.stringify(defines) : 'defaults'
      it(`${starter.id} with ${label}`, { timeout: 60_000 }, async () => {
        const { output, problems } = await render(starter.code, defines)
        expect(problems).toEqual([])
        expect(output?.byteLength ?? 0).toBeGreaterThan(1_000)
      })
    }
  }
})
