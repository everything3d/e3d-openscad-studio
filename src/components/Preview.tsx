import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { RenderState } from '../openscad/useRenderer'

interface Props {
  render: RenderState
}

export default function Preview({ render }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const gridRef = useRef<THREE.GridHelper | null>(null)

  // Set up the scene once.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f1115')
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000)
    camera.position.set(80, 60, 80)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    host.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controlsRef.current = controls

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(1, 1.4, 0.8)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4)
    fill.position.set(-1, -0.3, -0.6)
    scene.add(fill)

    const grid = new THREE.GridHelper(200, 20, 0x334155, 0x1e2633)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.6
    gridRef.current = grid
    scene.add(grid)

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [])

  // Load a new STL whenever the render result changes.
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!scene || !camera || !controls || !render.stl) return

    const loader = new STLLoader()
    let geometry: THREE.BufferGeometry
    try {
      geometry = loader.parse(render.stl)
    } catch {
      return
    }
    geometry.computeVertexNormals()
    geometry.center()

    if (meshRef.current) {
      scene.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      ;(meshRef.current.material as THREE.Material).dispose()
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0x6ea8fe,
      metalness: 0.1,
      roughness: 0.55,
      flatShading: false,
    })
    const mesh = new THREE.Mesh(geometry, material)
    // OpenSCAD is Z-up; three is Y-up. Rotate so models stand correctly.
    mesh.rotation.x = -Math.PI / 2
    scene.add(mesh)
    meshRef.current = mesh

    // Frame the model.
    geometry.computeBoundingSphere()
    const sphere = geometry.boundingSphere
    if (sphere) {
      const r = sphere.radius || 20
      const dist = r * 2.6
      camera.position.set(dist, dist * 0.8, dist)
      camera.near = Math.max(0.1, r / 100)
      camera.far = r * 100
      camera.updateProjectionMatrix()
      controls.target.set(0, 0, 0)
      controls.update()
      const grid = gridRef.current
      if (grid) grid.position.y = -r
    }
  }, [render.stl])

  return (
    <div className="preview-wrap">
      <div className="preview-canvas" ref={hostRef} />
      <div className="preview-status">
        {render.status === 'rendering' && (
          <span className="badge badge-busy">Rendering…</span>
        )}
        {render.status === 'error' && (
          <span className="badge badge-error" title={render.error ?? ''}>
            Error
          </span>
        )}
        {render.status === 'done' && (
          <span className="badge badge-ok">Rendered</span>
        )}
        {render.status === 'idle' && (
          <span className="badge">Ready</span>
        )}
      </div>
      {render.status === 'error' && render.error && (
        <div className="preview-error">
          <pre>{render.error}</pre>
        </div>
      )}
    </div>
  )
}
