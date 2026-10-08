import * as THREE from 'three'
import { DEFAULT_FACE_COLOR, type ParsedMesh } from '@/lib/openscad/off'

/**
 * Scene pieces shared by the studio preview and the script that renders the
 * starter images, so the static renders match what people see in the studio.
 */

export const PREVIEW_BACKGROUND = '#0f1115'

/**
 * Expand the indexed mesh into non-indexed position + color attributes so
 * each face can carry its own flat `color()` value.
 *
 * OpenSCAD colors are sRGB, but three.js treats vertex colors as linear and
 * gamma-encodes them on output. Passing the raw values through washes every
 * color out toward pastel, so they are converted to linear here.
 */
export function meshToGeometry(mesh: ParsedMesh): THREE.BufferGeometry {
  const triCount = mesh.triangles.length / 3
  const positions = new Float32Array(triCount * 9)
  const colors = new Float32Array(triCount * 9)
  const color = new THREE.Color()

  for (let t = 0; t < triCount; t++) {
    const [dr, dg, db] = DEFAULT_FACE_COLOR
    const r = (mesh.faceColors ? mesh.faceColors[t * 3] : dr) / 255
    const g = (mesh.faceColors ? mesh.faceColors[t * 3 + 1] : dg) / 255
    const b = (mesh.faceColors ? mesh.faceColors[t * 3 + 2] : db) / 255
    color.setRGB(r, g, b, THREE.SRGBColorSpace)
    for (let k = 0; k < 3; k++) {
      const vi = mesh.triangles[t * 3 + k]
      const o = t * 9 + k * 3
      positions[o] = mesh.vertices[vi * 3]
      positions[o + 1] = mesh.vertices[vi * 3 + 1]
      positions[o + 2] = mesh.vertices[vi * 3 + 2]
      colors[o] = color.r
      colors[o + 1] = color.g
      colors[o + 2] = color.b
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/** Build the model mesh, centered and stood upright (OpenSCAD is Z-up). */
export function createModelMesh(parsed: ParsedMesh): THREE.Mesh {
  const geometry = meshToGeometry(parsed)
  geometry.computeVertexNormals()
  geometry.center()
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0,
    roughness: 0.5,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

/**
 * Neutral white lights only: a tinted light shifts every model color. A soft
 * sky/ground fill keeps shadowed sides readable without flattening the key.
 */
export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.4))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(1, 1.4, 0.8)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.6)
  fill.position.set(-1, 0.4, -0.6)
  scene.add(fill)
}
