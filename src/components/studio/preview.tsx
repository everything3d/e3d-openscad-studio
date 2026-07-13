'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DownloadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RenderState } from '@/lib/openscad/useRenderer'
import { DEFAULT_FACE_COLOR, type ParsedMesh } from '@/lib/openscad/off'

interface Props {
  render: RenderState
  onExport: (format: 'stl' | '3mf') => void
}

/**
 * Expand the indexed mesh into non-indexed position + color attributes so
 * each face can carry its own flat `color()` value.
 */
function meshToGeometry(mesh: ParsedMesh): THREE.BufferGeometry {
  const triCount = mesh.triangles.length / 3
  const positions = new Float32Array(triCount * 9)
  const colors = new Float32Array(triCount * 9)

  for (let t = 0; t < triCount; t++) {
    const [dr, dg, db] = DEFAULT_FACE_COLOR
    const r = (mesh.faceColors ? mesh.faceColors[t * 3] : dr) / 255
    const g = (mesh.faceColors ? mesh.faceColors[t * 3 + 1] : dg) / 255
    const b = (mesh.faceColors ? mesh.faceColors[t * 3 + 2] : db) / 255
    for (let k = 0; k < 3; k++) {
      const vi = mesh.triangles[t * 3 + k]
      const o = t * 9 + k * 3
      positions[o] = mesh.vertices[vi * 3]
      positions[o + 1] = mesh.vertices[vi * 3 + 1]
      positions[o + 2] = mesh.vertices[vi * 3 + 2]
      colors[o] = r
      colors[o + 1] = g
      colors[o + 2] = b
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

const badgeStyles: Record<RenderState['status'], string> = {
  idle: 'bg-muted text-muted-foreground',
  rendering: 'bg-amber-500/15 text-amber-400',
  done: 'bg-emerald-500/15 text-emerald-400',
  error: 'bg-destructive/15 text-destructive',
}

const badgeLabels: Record<RenderState['status'], string> = {
  idle: 'Ready',
  rendering: 'Rendering…',
  done: 'Rendered',
  error: 'Error',
}

export function Preview({ render, onExport }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const gridRef = useRef<THREE.GridHelper | null>(null)
  const [webglError, setWebglError] = useState(false)

  // Set up the scene once.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // WebGL can be unavailable (headless browsers, old GPUs, disabled by
    // policy). Fail soft with a message instead of crashing the app.
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setWebglError(true)
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f1115')
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000)
    camera.position.set(80, 60, 80)
    cameraRef.current = camera

    renderer.setPixelRatio(window.devicePixelRatio)
    host.appendChild(renderer.domElement)

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
      renderer.setSize(w, h)
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

  // Swap in the new mesh whenever the render result changes.
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!scene || !camera || !controls || !render.mesh) return

    const geometry = meshToGeometry(render.mesh)
    geometry.computeVertexNormals()
    geometry.center()

    if (meshRef.current) {
      scene.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      ;(meshRef.current.material as THREE.Material).dispose()
    }

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
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
  }, [render.mesh])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0" ref={hostRef} />
      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          3D preview unavailable: this browser does not support WebGL.
        </div>
      )}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!render.mesh}
          onClick={() => onExport('stl')}
          title="Download as binary STL"
        >
          <DownloadIcon className="size-3.5" /> STL
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!render.mesh}
          onClick={() => onExport('3mf')}
          title="Download as 3MF (keeps colors)"
        >
          <DownloadIcon className="size-3.5" /> 3MF
        </Button>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium',
            badgeStyles[render.status],
          )}
          title={render.status === 'error' ? (render.error ?? '') : undefined}
        >
          {badgeLabels[render.status]}
        </span>
      </div>
      {render.status === 'error' && render.error && (
        <div className="absolute inset-x-0 bottom-0 max-h-40 overflow-auto border-t border-destructive/30 bg-background/90 p-3 backdrop-blur">
          <pre className="whitespace-pre-wrap font-mono text-xs text-destructive">
            {render.error}
          </pre>
        </div>
      )}
    </div>
  )
}
