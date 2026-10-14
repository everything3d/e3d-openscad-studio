import { zipSync, strToU8 } from 'fflate'
import { DEFAULT_FACE_COLOR, type ParsedMesh } from './off'
import u1Project from './snapmaker-u1-project.json'

const MATERIAL_NS = 'http://schemas.microsoft.com/3dmanufacturing/material/2015/02'
const SLIC3RPE_NS = 'http://schemas.slic3r.org/3mf/2017/06'

/**
 * Encode "whole triangle painted with filament `state`" in the TriangleSelector
 * serialization PrusaSlicer/Bambu/Orca use: a bitstream (2 bits split count =
 * 0, then the state: 2 bits if < 3, else `11` + 4 bits of state-3), written as
 * hex nibbles in reverse order. Gives "4", "8", "0C", "1C", … for 1, 2, 3, 4.
 */
function paintState(state: number): string {
  if (state < 3) return (state << 2).toString(16).toUpperCase()
  return (state - 3).toString(16).toUpperCase() + 'C'
}

/** Unique face colors (as #RRGGBBAA) and each triangle's index into them. */
function collectColors(mesh: ParsedMesh) {
  const triCount = mesh.triangles.length / 3
  const colors: string[] = []
  const colorIndex = new Map<string, number>()
  const triColor = new Uint32Array(triCount)
  if (mesh.faceColors) {
    for (let t = 0; t < triCount; t++) {
      const r = mesh.faceColors[t * 3]
      const g = mesh.faceColors[t * 3 + 1]
      const b = mesh.faceColors[t * 3 + 2]
      // sRGB with explicit opaque alpha, the form other exporters emit.
      const hex =
        '#' +
        [r, g, b, 255]
          .map((c) => c.toString(16).padStart(2, '0').toUpperCase())
          .join('')
      let ci = colorIndex.get(hex)
      if (ci === undefined) {
        ci = colors.length
        colors.push(hex)
        colorIndex.set(hex, ci)
      }
      triColor[t] = ci
    }
  }
  return { colors, triColor }
}

/**
 * Build a minimal, spec-compliant 3MF file from a parsed mesh.
 *
 * The vendored OpenSCAD wasm was compiled without lib3mf, so we write the
 * format ourselves: 3MF is a zip containing an OPC rels file and one XML
 * model.
 *
 * Per-face colors (from OpenSCAD `color()`) are written with the 3MF Materials
 * extension as an `<m:colorgroup>` referenced per triangle. This is the "face
 * coloring" form Bambu Studio (2.5+) reads: it shows its color-mapping dialog
 * with the file's colors and maps each one to a filament slot.
 * `<basematerials>` — the other way to attach color — is only ever honoured at
 * the *object* level by those slicers, so a per-triangle `pid` into a
 * basematerials group silently collapses to a single-color model on import.
 *
 * Two details matter for Bambu Studio's importer:
 *  - every triangle must carry a color, or color parsing is skipped entirely.
 *    `parseOFF` guarantees this by filling uncolored faces with
 *    DEFAULT_FACE_COLOR whenever any face in the file is colored.
 *  - p1/p2/p3 are written equal so the face reads as flat, not as a gradient.
 *
 * Orca forks (Snapmaker Orca for the U1, OrcaSlicer) ignore the color group on
 * import, so each triangle is also tagged with multi-material paint data: the
 * Nth distinct color is painted with filament N. Those slicers read it as
 * `paint_color`, PrusaSlicer as `slic3rpe:mmu_segmentation`. Paint data only
 * names filament slots, not colors, so those slots show whatever filaments the
 * slicer already has — `meshToSnapmakerU1Project` carries the colors too.
 */
export function meshTo3MF(mesh: ParsedMesh): Uint8Array {
  const triCount = mesh.triangles.length / 3

  const { colors, triColor } = collectColors(mesh)
  const hasColors = colors.length > 0

  const xml: string[] = []
  xml.push('<?xml version="1.0" encoding="UTF-8"?>')
  xml.push(
    '<model unit="millimeter" xml:lang="en-US" ' +
      (hasColors ? `xmlns:m="${MATERIAL_NS}" xmlns:slic3rpe="${SLIC3RPE_NS}" ` : '') +
      'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
  )
  xml.push(' <resources>')

  if (hasColors) {
    xml.push('  <m:colorgroup id="1">')
    for (const hex of colors) {
      xml.push(`   <m:color color="${hex}" />`)
    }
    xml.push('  </m:colorgroup>')
  }

  // An object holding triangles with properties must declare pid/pindex as the
  // fallback for any triangle that omits them.
  xml.push(
    hasColors
      ? '  <object id="2" type="model" pid="1" pindex="0">'
      : '  <object id="2" type="model">',
  )
  xml.push('   <mesh>')

  xml.push('    <vertices>')
  const v = mesh.vertices
  for (let p = 0; p < v.length; p += 3) {
    xml.push(`     <vertex x="${v[p]}" y="${v[p + 1]}" z="${v[p + 2]}" />`)
  }
  xml.push('    </vertices>')

  xml.push('    <triangles>')
  const tr = mesh.triangles
  for (let t = 0; t < triCount; t++) {
    const a = tr[t * 3]
    const b = tr[t * 3 + 1]
    const c = tr[t * 3 + 2]
    if (hasColors) {
      const ci = triColor[t]
      const paint = paintState(ci + 1)
      xml.push(
        `     <triangle v1="${a}" v2="${b}" v3="${c}" ` +
          `pid="1" p1="${ci}" p2="${ci}" p3="${ci}" ` +
          `paint_color="${paint}" slic3rpe:mmu_segmentation="${paint}" />`,
      )
    } else {
      xml.push(`     <triangle v1="${a}" v2="${b}" v3="${c}" />`)
    }
  }
  xml.push('    </triangles>')

  xml.push('   </mesh>')
  xml.push('  </object>')
  xml.push(' </resources>')
  xml.push(' <build>')
  xml.push('  <item objectid="2" />')
  xml.push(' </build>')
  xml.push('</model>')

  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(ROOT_RELS),
    '3D/3dmodel.model': strToU8(xml.join('\n')),
  })
}

const CORE_NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
const PRODUCTION_NS = 'http://schemas.microsoft.com/3dmanufacturing/production/2015/06'
const BAMBU_NS = 'http://schemas.bambulab.com/package/2021'
const MODEL_REL_TYPE = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel'

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />' +
  '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />' +
  '</Types>'

function relsTo(target: string) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Target="${target}" Id="rel-1" Type="${MODEL_REL_TYPE}" />` +
    '</Relationships>'
  )
}

const ROOT_RELS = relsTo('/3D/3dmodel.model')

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Center of the U1's 270×270 bed, where the model is placed. */
const U1_BED_CENTER = 135

/**
 * Build a Snapmaker Orca project for the Snapmaker U1 that opens with the
 * model's colors already loaded as filaments 1..N.
 *
 * Paint data alone (see `meshTo3MF`) only says which filament slot each face
 * uses; the colors of those slots come from `Metadata/project_settings.config`.
 * Snapmaker Orca reads that file on both "Open as project" (the whole config,
 * so it must be a complete, valid U1 project or the printer gets replaced by
 * defaults) and "Import geometry only" (just `filament_colour`).
 *
 * `snapmaker-u1-project.json` is a real Snapmaker Orca 2.4.0 project config
 * (Snapmaker U1 (0.4 nozzle), 0.20mm Standard, Generic PLA) reduced to one
 * filament; every key in `perFilamentKeys` holds one value per filament and is
 * expanded to the palette size here.
 */
export function meshToSnapmakerU1Project(mesh: ParsedMesh, name: string): Uint8Array {
  const triCount = mesh.triangles.length / 3
  const { colors, triColor } = collectColors(mesh)
  const palette = colors.length
    ? colors.map((c) => c.slice(0, 7))
    : [
        '#' +
          DEFAULT_FACE_COLOR.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join(''),
      ]
  const n = palette.length

  // --- project_settings.config: the U1 template, sized to n filaments.
  const settings: Record<string, unknown> = { ...u1Project.settings }
  for (const key of u1Project.perFilamentKeys) {
    const value = settings[key]
    if (Array.isArray(value)) settings[key] = Array.from({ length: n }, () => value[0])
  }
  settings.filament_colour = palette
  settings.filament_multi_colors = palette
  // Purge volume (mm³) between each pair of filaments, row-major n×n.
  settings.flush_volumes_matrix = Array.from({ length: n * n }, (_, i) =>
    Math.floor(i / n) === i % n ? '0' : '280',
  )
  settings.flush_volumes_vector = Array.from({ length: n * 2 }, () => '140')
  // One entry for the process, one per filament, one for the printer.
  settings.inherits_group = Array.from({ length: n + 2 }, () => '')
  settings.different_settings_to_system = Array.from({ length: n + 2 }, () => '')

  // --- Mesh, centered on its bounding box; the build item lifts it onto the bed.
  const v = mesh.vertices
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let p = 0; p < v.length; p += 3) {
    for (let k = 0; k < 3; k++) {
      if (v[p + k] < min[k]) min[k] = v[p + k]
      if (v[p + k] > max[k]) max[k] = v[p + k]
    }
  }
  const center = [0, 1, 2].map((k) => (v.length ? (min[k] + max[k]) / 2 : 0))
  const halfHeight = v.length ? (max[2] - min[2]) / 2 : 0

  const obj: string[] = []
  obj.push('<?xml version="1.0" encoding="UTF-8"?>')
  obj.push(
    `<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}" ` +
      `xmlns:BambuStudio="${BAMBU_NS}" xmlns:p="${PRODUCTION_NS}" requiredextensions="p">`,
  )
  obj.push(' <metadata name="BambuStudio:3mfVersion">1</metadata>')
  obj.push(' <resources>')
  obj.push('  <object id="1" p:UUID="00010000-81cb-4c03-9d28-80fed5dfa1dc" type="model">')
  obj.push('   <mesh>')
  obj.push('    <vertices>')
  for (let p = 0; p < v.length; p += 3) {
    obj.push(
      `     <vertex x="${v[p] - center[0]}" y="${v[p + 1] - center[1]}" z="${v[p + 2] - center[2]}" />`,
    )
  }
  obj.push('    </vertices>')
  obj.push('    <triangles>')
  const tr = mesh.triangles
  for (let t = 0; t < triCount; t++) {
    obj.push(
      `     <triangle v1="${tr[t * 3]}" v2="${tr[t * 3 + 1]}" v3="${tr[t * 3 + 2]}" ` +
        `paint_color="${paintState(triColor[t] + 1)}" />`,
    )
  }
  obj.push('    </triangles>')
  obj.push('   </mesh>')
  obj.push('  </object>')
  obj.push(' </resources>')
  obj.push(' <build/>')
  obj.push('</model>')

  const placement = `1 0 0 0 1 0 0 0 1 ${U1_BED_CENTER} ${U1_BED_CENTER}`
  const root = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}" ` +
      `xmlns:BambuStudio="${BAMBU_NS}" xmlns:p="${PRODUCTION_NS}" requiredextensions="p">`,
    // Marks the file as a Snapmaker Orca project, so plates and per-object
    // settings in model_settings.config are honoured.
    ` <metadata name="Application">Snapmaker_Orca-${u1Project.settings.version}</metadata>`,
    ' <metadata name="BambuStudio:3mfVersion">1</metadata>',
    ` <metadata name="Title">${escapeXml(name)}</metadata>`,
    ' <resources>',
    '  <object id="2" p:UUID="00000001-61cb-4c03-9d28-80fed5dfa1dc" type="model">',
    '   <components>',
    '    <component p:path="/3D/Objects/object_1.model" objectid="1" ' +
      'p:UUID="00010000-b206-40ff-9872-83e8017abed1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>',
    '   </components>',
    '  </object>',
    ' </resources>',
    ' <build p:UUID="2c7c17d8-22b5-4d84-8835-1976022ea369">',
    '  <item objectid="2" p:UUID="00000002-b1ec-4553-aec9-835e5b724bb4" ' +
      `transform="${placement} ${halfHeight}" printable="1"/>`,
    ' </build>',
    '</model>',
  ].join('\n')

  const safeName = escapeXml(name)
  const modelSettings = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<config>',
    '  <object id="2">',
    `    <metadata key="name" value="${safeName}"/>`,
    '    <metadata key="extruder" value="1"/>',
    '    <part id="1" subtype="normal_part">',
    `      <metadata key="name" value="${safeName}"/>`,
    '      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>',
    '    </part>',
    '  </object>',
    '  <plate>',
    '    <metadata key="plater_id" value="1"/>',
    '    <metadata key="plater_name" value=""/>',
    '    <metadata key="locked" value="false"/>',
    '    <metadata key="filament_map_mode" value="Auto For Flush"/>',
    `    <metadata key="filament_maps" value="${Array(n).fill('1').join(' ')}"/>`,
    '    <model_instance>',
    '      <metadata key="object_id" value="2"/>',
    '      <metadata key="instance_id" value="0"/>',
    '    </model_instance>',
    '  </plate>',
    '  <assemble>',
    `   <assemble_item object_id="2" instance_id="0" transform="${placement} 0" offset="0 0 0" />`,
    '  </assemble>',
    '</config>',
  ].join('\n')

  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(ROOT_RELS),
    '3D/3dmodel.model': strToU8(root),
    '3D/_rels/3dmodel.model.rels': strToU8(relsTo('/3D/Objects/object_1.model')),
    '3D/Objects/object_1.model': strToU8(obj.join('\n')),
    'Metadata/model_settings.config': strToU8(modelSettings),
    'Metadata/project_settings.config': strToU8(JSON.stringify(settings, null, 4)),
  })
}
