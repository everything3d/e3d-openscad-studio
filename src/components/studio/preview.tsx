'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  ChevronDownIcon,
  DownloadIcon,
  MapPinIcon,
  PencilIcon,
  SendIcon,
  Undo2Icon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { RenderState } from '@/lib/openscad/useRenderer'
import { addLights, createModelMesh, faceColorHex, PREVIEW_BACKGROUND, toScadPoint } from './scene'

/** STL, or a 3MF laid out for the slicer that will open it. */
export type ExportFormat = 'stl' | '3mf-bambu' | '3mf-snapmaker-u1'

/** A marked-up view of the model, ready for the chat. */
export interface MarkupResult {
  /** The view with the pins and drawing burned in. */
  image: File
  /** One line per pin, with its position on the model, for the user to finish. */
  text: string
  pins: number
  drawing: boolean
}

/** A pin on the model's surface. */
interface Pin {
  world: THREE.Vector3
  /** The same point in the model's OpenSCAD coordinates (mm). */
  scad: [number, number, number]
  /** The color() of the part it sits on, when the model has colors. */
  color: string | null
}

/** A freehand stroke, as points normalized to the preview's size (0–1). */
type Stroke = { x: number; y: number }[]

const MARK_COLOR = '#f43f5e'
/** A press that moves less than this (px) is a click, not an orbit drag. */
const CLICK_SLOP = 5
/** Longest side of the image sent to the chat. */
const MARKUP_MAX_SIDE = 1280

const fmtMm = (n: number) => String(Math.round(n * 10) / 10)

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, w: number, h: number, width: number) {
  if (stroke.length === 0) return
  ctx.strokeStyle = MARK_COLOR
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(stroke[0].x * w, stroke[0].y * h)
  for (const p of stroke.slice(1)) ctx.lineTo(p.x * w, p.y * h)
  if (stroke.length === 1) ctx.lineTo(stroke[0].x * w + 0.1, stroke[0].y * h)
  ctx.stroke()
}

function drawPinBadge(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, scale: number) {
  const r = 11 * scale
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = MARK_COLOR
  ctx.fill()
  ctx.lineWidth = 2 * scale
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${12 * scale}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), x, y + 0.5 * scale)
}

interface Props {
  render: RenderState
  onExport: (format: ExportFormat) => void
  /** Opens the order dialog; omitted where ordering does not apply. */
  onOrder?: () => void
  onThumbnailReady?: (thumbnail: string | null) => void
  /** Receives a marked-up view for the chat; omitted where there is no chat. */
  onMarkup?: (markup: MarkupResult) => void
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

/**
 * Phones report a device pixel ratio of 3, which is 9× the fill of a 1×
 * screen per frame with nothing visibly gained for a solid-shaded model.
 */
const MAX_PIXEL_RATIO = 2

export function Preview({ render, onExport, onThumbnailReady, onOrder, onMarkup }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const gridRef = useRef<THREE.GridHelper | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  /** Draw the scene on the next frame (see the render loop below). */
  const requestFrameRef = useRef<() => void>(() => {})
  const [webglError, setWebglError] = useState(false)

  // ---- markup mode --------------------------------------------------------
  const [marking, setMarking] = useState(false)
  const [tool, setTool] = useState<'pin' | 'draw'>('pin')
  const [pins, setPins] = useState<Pin[]>([])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  /** What each undo removes, newest last. */
  const history = useRef<('pin' | 'stroke')[]>([])
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const pinEls = useRef<(HTMLDivElement | null)[]>([])
  const pinsRef = useRef<Pin[]>([])
  /** Re-place the pin badges over the model; runs after every frame. */
  const placePinsRef = useRef<() => void>(() => {})

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
    scene.background = new THREE.Color(PREVIEW_BACKGROUND)
    sceneRef.current = scene
    rendererRef.current = renderer

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000)
    camera.position.set(80, 60, 80)
    cameraRef.current = camera

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controlsRef.current = controls

    addLights(scene)

    const grid = new THREE.GridHelper(200, 20, 0x334155, 0x1e2633)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.6
    gridRef.current = grid
    scene.add(grid)

    // Render on demand rather than every frame forever. The loop runs while
    // something is changing (a drag, damping easing out, a resize, a new
    // mesh) and stops as soon as a frame leaves the camera where it was, so
    // an idle preview, or one hidden behind the Code tab, costs nothing.
    let raf = 0
    let frameWanted = false
    const frame = () => {
      raf = 0
      // Hidden hosts (the Code/Files tabs) have no size; skip until shown.
      if (host.clientWidth === 0 || host.clientHeight === 0) {
        frameWanted = false
        return
      }
      const moving = controls.update()
      renderer.render(scene, camera)
      placePinsRef.current()
      frameWanted = false
      if (moving) requestFrame()
    }
    const requestFrame = () => {
      if (frameWanted) return
      frameWanted = true
      raf = requestAnimationFrame(frame)
    }
    requestFrameRef.current = requestFrame
    controls.addEventListener('change', requestFrame)
    controls.addEventListener('start', requestFrame)

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      requestFrame()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      requestFrameRef.current = () => {}
      ro.disconnect()
      controls.removeEventListener('change', requestFrame)
      controls.removeEventListener('start', requestFrame)
      controls.dispose()
      renderer.dispose()
      rendererRef.current = null
      host.removeChild(renderer.domElement)
    }
  }, [])

  // Swap in the new mesh whenever the render result changes.
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!scene || !camera || !controls || !render.mesh) return

    if (meshRef.current) {
      scene.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      ;(meshRef.current.material as THREE.Material).dispose()
    }

    const mesh = createModelMesh(render.mesh)
    const geometry = mesh.geometry
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

    const renderer = rendererRef.current
    if (renderer && onThumbnailReady && renderer.domElement.width > 0) {
      // Draw and read back in the same task: the WebGL buffer is only
      // guaranteed to hold the frame until the browser composites it, which
      // is what let us drop preserveDrawingBuffer (and its per-frame copy).
      renderer.render(scene, camera)
      const source = renderer.domElement
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 400
      const context = canvas.getContext('2d')
      if (context) {
        context.fillStyle = PREVIEW_BACKGROUND
        context.fillRect(0, 0, canvas.width, canvas.height)
        const scale = Math.min(canvas.width / source.width, canvas.height / source.height)
        const width = source.width * scale
        const height = source.height * scale
        context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
        onThumbnailReady(canvas.toDataURL('image/jpeg', 0.72))
      } else {
        onThumbnailReady(null)
      }
    }
    requestFrameRef.current()
  }, [render.mesh, onThumbnailReady])

  // ---- markup mode --------------------------------------------------------
  // Markup belongs to the mesh it was started on: a new render reframes the
  // camera and moves the model, so the marks would point at the wrong place.
  const [markedMesh, setMarkedMesh] = useState<RenderState['mesh']>(null)
  const markingActive = marking && markedMesh !== null && markedMesh === render.mesh
  const hasColorsRef = useRef(false)
  useEffect(() => {
    hasColorsRef.current = render.mesh?.faceColors != null
  }, [render.mesh])

  const startMarkup = () => {
    setPins([])
    setStrokes([])
    history.current = []
    setTool('pin')
    setMarkedMesh(render.mesh)
    setMarking(true)
  }
  const stopMarkup = useCallback(() => {
    setMarking(false)
    setPins([])
    setStrokes([])
    history.current = []
  }, [])

  const undo = () => {
    const last = history.current.pop()
    if (last === 'pin') setPins((p) => p.slice(0, -1))
    else if (last === 'stroke') setStrokes((s) => s.slice(0, -1))
  }

  // Pins follow the model as the camera moves: re-projected after each frame.
  useEffect(() => {
    placePinsRef.current = () => {
      const camera = cameraRef.current
      const host = hostRef.current
      if (!camera || !host) return
      const w = host.clientWidth
      const h = host.clientHeight
      pinsRef.current.forEach((pin, i) => {
        const el = pinEls.current[i]
        if (!el) return
        const v = pin.world.clone().project(camera)
        el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`
        el.style.visibility = v.z > 1 ? 'hidden' : 'visible'
      })
    }
    return () => {
      placePinsRef.current = () => {}
    }
  }, [])
  useLayoutEffect(() => {
    pinsRef.current = pins
    placePinsRef.current()
  }, [pins, markingActive])

  // A drawing is flat on the screen, so the camera holds still while one
  // exists (or while the pen is out); pins are on the model and can orbit.
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.enabled = !(markingActive && (tool === 'draw' || strokes.length > 0))
  }, [markingActive, tool, strokes.length])

  // Pin tool: a click (not an orbit drag) on the model drops a pin there.
  useEffect(() => {
    const canvas = rendererRef.current?.domElement
    if (!markingActive || tool !== 'pin' || !canvas) return
    let down: { x: number; y: number } | null = null
    const raycaster = new THREE.Raycaster()
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      const start = down
      down = null
      const mesh = meshRef.current
      const camera = cameraRef.current
      if (!start || !mesh || !camera) return
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP) return
      const rect = canvas.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(mesh)[0]
      if (!hit || hit.faceIndex == null) return
      history.current.push('pin')
      setPins((p) => [
        ...p,
        {
          world: hit.point.clone(),
          scad: toScadPoint(mesh, hit.point),
          color: hasColorsRef.current ? faceColorHex(mesh, hit.faceIndex!) : null,
        },
      ])
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
    }
  }, [markingActive, tool])

  // Pen tool: freehand strokes on an overlay the size of the preview.
  const liveStroke = useRef<Stroke | null>(null)
  const redrawStrokes = useCallback(() => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const stroke of liveStroke.current ? [...strokes, liveStroke.current] : strokes) {
      drawStroke(ctx, stroke, canvas.width, canvas.height, 4 * dpr)
    }
  }, [strokes])
  useEffect(() => {
    if (!markingActive) return
    redrawStrokes()
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(redrawStrokes)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [markingActive, redrawStrokes])

  const strokePoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  /** Burn the marks into the current view and hand it, with the pin list, to the chat. */
  const sendMarkup = async () => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    const host = hostRef.current
    if (!renderer || !scene || !camera || !host || !onMarkup) return
    // Draw and read back in the same task (no preserveDrawingBuffer).
    renderer.render(scene, camera)
    const source = renderer.domElement
    const fit = Math.min(1, MARKUP_MAX_SIDE / Math.max(source.width, source.height))
    const out = document.createElement('canvas')
    out.width = Math.round(source.width * fit)
    out.height = Math.round(source.height * fit)
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.drawImage(source, 0, 0, out.width, out.height)
    const scale = out.width / host.clientWidth
    for (const stroke of strokes) drawStroke(ctx, stroke, out.width, out.height, 4 * scale)
    pins.forEach((pin, i) => {
      const v = pin.world.clone().project(camera)
      drawPinBadge(ctx, ((v.x + 1) / 2) * out.width, ((1 - v.y) / 2) * out.height, i + 1, scale)
    })
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) return
    onMarkup({
      image: new File([blob], `markup-${Date.now()}.jpg`, { type: 'image/jpeg' }),
      text: pins
        .map(
          (pin, i) =>
            `[${i + 1}] (${pin.scad.map(fmtMm).join(', ')}) mm${pin.color ? ` on the ${pin.color} part` : ''}: `,
        )
        .join('\n'),
      pins: pins.length,
      drawing: strokes.length > 0,
    })
    stopMarkup()
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0" ref={hostRef} />
      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          3D preview unavailable: this browser does not support WebGL.
        </div>
      )}
      {markingActive && (
        <>
          <canvas
            ref={drawCanvasRef}
            className={cn(
              'absolute inset-0 h-full w-full touch-none',
              tool === 'draw' ? 'cursor-crosshair' : 'pointer-events-none',
            )}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              liveStroke.current = [strokePoint(e)]
              redrawStrokes()
            }}
            onPointerMove={(e) => {
              if (!liveStroke.current) return
              liveStroke.current.push(strokePoint(e))
              redrawStrokes()
            }}
            onPointerUp={() => {
              const stroke = liveStroke.current
              liveStroke.current = null
              if (!stroke) return
              history.current.push('stroke')
              setStrokes((s) => [...s, stroke])
            }}
          />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {pins.map((_, i) => (
              <div
                key={i}
                ref={(el) => {
                  pinEls.current[i] = el
                }}
                className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-xs font-bold text-white shadow-md"
              >
                {i + 1}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-center justify-end gap-1.5 md:inset-x-3 md:top-3 md:gap-2 [&>*]:pointer-events-auto">
        {onMarkup && !markingActive && (
          <Button
            variant="secondary"
            size="sm"
            disabled={!render.mesh}
            onClick={startMarkup}
            title="Mark up the model and send it to the AI"
          >
            <PencilIcon className="size-3.5" /> Mark up
          </Button>
        )}
        {onOrder && (
          <Button size="sm" disabled={!render.mesh} onClick={onOrder} title="Order this print">
            Order<span className="max-sm:hidden"> this print</span>
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={!render.mesh}
          onClick={() => onExport('stl')}
          title="Download as binary STL"
        >
          <DownloadIcon className="size-3.5" /> STL
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!render.mesh}
            title="Download as 3MF (keeps colors)"
            render={<Button variant="secondary" size="sm" />}
          >
            <DownloadIcon className="size-3.5" /> 3MF
            <ChevronDownIcon className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            {/* Base UI throws if a group label renders outside a group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>Open in</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onExport('3mf-bambu')}>Bambu Studio</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('3mf-snapmaker-u1')}>
                Snapmaker U1
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
      {markingActive && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-col items-center gap-1.5 md:bottom-3">
          <p className="rounded-md bg-background/80 px-2 py-1 text-center text-xs text-muted-foreground backdrop-blur">
            {tool === 'pin'
              ? strokes.length > 0
                ? 'Click the model to drop a pin. Undo the drawing to rotate.'
                : 'Click the model to drop a pin. Drag to rotate.'
              : 'Draw on the view to circle or point at things.'}
          </p>
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur">
            <Button
              size="sm"
              variant={tool === 'pin' ? 'default' : 'ghost'}
              onClick={() => setTool('pin')}
              aria-pressed={tool === 'pin'}
            >
              <MapPinIcon className="size-3.5" /> Pin
            </Button>
            <Button
              size="sm"
              variant={tool === 'draw' ? 'default' : 'ghost'}
              onClick={() => setTool('draw')}
              aria-pressed={tool === 'draw'}
            >
              <PencilIcon className="size-3.5" /> Draw
            </Button>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={undo}
              disabled={pins.length === 0 && strokes.length === 0}
              aria-label="Undo last mark"
              title="Undo"
            >
              <Undo2Icon />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={stopMarkup} aria-label="Cancel markup" title="Cancel">
              <XIcon />
            </Button>
            <Button
              size="sm"
              onClick={() => void sendMarkup()}
              disabled={pins.length === 0 && strokes.length === 0}
            >
              <SendIcon className="size-3.5" /> Add to chat
            </Button>
          </div>
        </div>
      )}
      {render.status === 'error' && render.error && !markingActive && (
        <div className="absolute inset-x-0 bottom-0 max-h-[40%] overflow-auto md:max-h-40 border-t border-destructive/30 bg-background/90 p-3 backdrop-blur">
          <pre className="whitespace-pre-wrap font-mono text-xs text-destructive">
            {render.error}
          </pre>
        </div>
      )}
    </div>
  )
}
