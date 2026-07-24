import { zipSync, strToU8 } from 'fflate'
import type { ParsedMesh } from './off'

const MATERIAL_NS = 'http://schemas.microsoft.com/3dmanufacturing/material/2015/02'

/**
 * Build a minimal, spec-compliant 3MF file from a parsed mesh.
 *
 * The vendored OpenSCAD wasm was compiled without lib3mf, so we write the
 * format ourselves: 3MF is a zip containing an OPC rels file and one XML
 * model.
 *
 * Per-face colors (from OpenSCAD `color()`) are written with the 3MF Materials
 * extension as an `<m:colorgroup>` referenced per triangle. This is the "face
 * coloring" form that slicers actually read: Bambu Studio (2.5+) and Orca show
 * their color-mapping dialog for it and map each color to a filament slot.
 * `<basematerials>` — the other way to attach color — is only ever honoured at
 * the *object* level by those slicers, so a per-triangle `pid` into a
 * basematerials group silently collapses to a single-color model on import.
 *
 * Two details matter for Bambu Studio's importer:
 *  - every triangle must carry a color, or color parsing is skipped entirely.
 *    `parseOFF` guarantees this by filling uncolored faces with
 *    DEFAULT_FACE_COLOR whenever any face in the file is colored.
 *  - p1/p2/p3 are written equal so the face reads as flat, not as a gradient.
 */
export function meshTo3MF(mesh: ParsedMesh): Uint8Array {
  const triCount = mesh.triangles.length / 3

  // Collect unique face colors → color-group indices.
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
  const hasColors = colors.length > 0

  const xml: string[] = []
  xml.push('<?xml version="1.0" encoding="UTF-8"?>')
  xml.push(
    '<model unit="millimeter" xml:lang="en-US" ' +
      (hasColors ? `xmlns:m="${MATERIAL_NS}" ` : '') +
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
      xml.push(
        `     <triangle v1="${a}" v2="${b}" v3="${c}" ` +
          `pid="1" p1="${ci}" p2="${ci}" p3="${ci}" />`,
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

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />' +
    '</Types>'

  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel-1" ' +
    'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />' +
    '</Relationships>'

  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(xml.join('\n')),
  })
}
