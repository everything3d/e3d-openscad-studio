import { zipSync, strToU8 } from 'fflate'
import type { ParsedMesh } from './off'

/**
 * Build a minimal, spec-compliant 3MF file from a parsed mesh.
 *
 * The vendored OpenSCAD wasm was compiled without lib3mf, so we write the
 * format ourselves: 3MF is a zip containing an OPC rels file and one XML
 * model. Per-face colors (from OpenSCAD `color()`) are preserved as
 * basematerials referenced per triangle, which slicers like PrusaSlicer,
 * Bambu Studio, and Cura understand for multi-material printing.
 */
export function meshTo3MF(mesh: ParsedMesh): Uint8Array {
  const triCount = mesh.triangles.length / 3

  // Collect unique face colors → material indices.
  const materials: string[] = []
  const materialIndex = new Map<string, number>()
  const triMaterial = new Uint32Array(triCount)
  if (mesh.faceColors) {
    for (let t = 0; t < triCount; t++) {
      const r = mesh.faceColors[t * 3]
      const g = mesh.faceColors[t * 3 + 1]
      const b = mesh.faceColors[t * 3 + 2]
      const hex =
        '#' +
        [r, g, b].map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')
      let mi = materialIndex.get(hex)
      if (mi === undefined) {
        mi = materials.length
        materials.push(hex)
        materialIndex.set(hex, mi)
      }
      triMaterial[t] = mi
    }
  }

  const xml: string[] = []
  xml.push('<?xml version="1.0" encoding="UTF-8"?>')
  xml.push(
    '<model unit="millimeter" xml:lang="en-US" ' +
      'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
  )
  xml.push(' <resources>')

  const hasColors = materials.length > 0
  if (hasColors) {
    xml.push('  <basematerials id="1">')
    for (let m = 0; m < materials.length; m++) {
      xml.push(`   <base name="Color ${m + 1}" displaycolor="${materials[m]}" />`)
    }
    xml.push('  </basematerials>')
  }

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
    xml.push(
      hasColors
        ? `     <triangle v1="${a}" v2="${b}" v3="${c}" pid="1" p1="${triMaterial[t]}" />`
        : `     <triangle v1="${a}" v2="${b}" v3="${c}" />`,
    )
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
