import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { parseOFF } from './off'
import { meshTo3MF, meshToSnapmakerU1Project } from './threemf'
import u1Project from './snapmaker-u1-project.json'

// A 10×10×10 cube: bottom/sides red, top green, one side blue.
const OFF = `OFF
8 12 0
0 0 0
10 0 0
10 10 0
0 10 0
0 0 10
10 0 10
10 10 10
0 10 10
3 0 2 1 255 0 0
3 0 3 2 255 0 0
3 4 5 6 0 200 0
3 4 6 7 0 200 0
3 0 1 5 255 0 0
3 0 5 4 255 0 0
3 1 2 6 0 0 255
3 1 6 5 0 0 255
3 2 3 7 255 0 0
3 2 7 6 255 0 0
3 3 0 4 255 0 0
3 3 4 7 255 0 0
`
const mesh = parseOFF(new TextEncoder().encode(OFF))

function paintCodes(model: string) {
  return [...model.matchAll(/paint_color="([0-9A-F]+)"/g)].map((m) => m[1])
}

describe('meshTo3MF', () => {
  it('writes the color group and paints the Nth color with filament N', () => {
    const files = unzipSync(meshTo3MF(mesh))
    const model = strFromU8(files['3D/3dmodel.model'])
    expect([...model.matchAll(/<m:color color="([^"]+)"/g)].map((m) => m[1])).toEqual([
      '#FF0000FF',
      '#00C800FF',
      '#0000FFFF',
    ])
    expect(paintCodes(model)).toEqual(['4', '4', '8', '8', '4', '4', '0C', '0C', '4', '4', '4', '4'])
  })
})

describe('meshToSnapmakerU1Project', () => {
  const files = unzipSync(meshToSnapmakerU1Project(mesh, 'Cube & co'))
  const settings = JSON.parse(strFromU8(files['Metadata/project_settings.config']))

  it('loads the U1 printer with one filament per model color', () => {
    expect(settings.printer_settings_id).toBe('Snapmaker U1 (0.4 nozzle)')
    expect(settings.filament_colour).toEqual(['#FF0000', '#00C800', '#0000FF'])
    for (const key of u1Project.perFilamentKeys) {
      if (Array.isArray(settings[key])) expect(settings[key], key).toHaveLength(3)
    }
    expect(settings.flush_volumes_matrix).toHaveLength(9)
    expect(settings.inherits_group).toHaveLength(5)
  })

  it('paints faces and centers the mesh on the bed', () => {
    const object = strFromU8(files['3D/Objects/object_1.model'])
    expect(paintCodes(object)).toEqual(['4', '4', '8', '8', '4', '4', '0C', '0C', '4', '4', '4', '4'])
    expect(object).toContain('<vertex x="-5" y="-5" z="-5" />')
    const root = strFromU8(files['3D/3dmodel.model'])
    expect(root).toContain('<metadata name="Application">Snapmaker_Orca-')
    expect(root).toContain('transform="1 0 0 0 1 0 0 0 1 135 135 5"')
    expect(strFromU8(files['Metadata/model_settings.config'])).toContain('value="Cube &amp; co"')
  })
})
