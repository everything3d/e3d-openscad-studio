import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerResponse } from './render.worker'

const hooks = vi.hoisted(() => ({ state: null as any, cleanup: null as (() => void) | null }))
vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    hooks.state = initial
    return [initial, (next: any) => { hooks.state = typeof next === 'function' ? next(hooks.state) : next }]
  },
  useEffect: (effect: () => () => void) => { hooks.cleanup = effect() },
}))
const analytics = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@vercel/analytics', () => analytics)
import { useRenderer } from './useRenderer'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: { data: WorkerResponse }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
  emit(data: WorkerResponse) { this.onmessage?.({ data }) }
}
const mesh = { vertices: new Float32Array(), triangles: new Uint32Array(), faceColors: null }

describe('renderer worker lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
    analytics.track.mockClear()
  })
  afterEach(() => {
    hooks.cleanup?.()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it('does not time out after coalescing queued previews and finishing the latest', () => {
    const renderer = useRenderer()
    renderer.render('cube(1);')
    renderer.render('cube(2);')
    renderer.render('cube(3);')
    const worker = FakeWorker.instances[0]
    worker.emit({ type: 'cancelled', id: 2 })
    worker.emit({ type: 'render', id: 1, ok: true, mesh, log: '' })
    expect(hooks.state.status).toBe('rendering')
    worker.emit({ type: 'render', id: 3, ok: true, mesh, log: '' })
    vi.advanceTimersByTime(90_001)
    expect(hooks.state.status).toBe('done')
    expect(worker.terminate).not.toHaveBeenCalled()
    // Superseded and cancelled previews are not results anyone saw.
    expect(analytics.track).toHaveBeenCalledOnce()
    expect(analytics.track).toHaveBeenCalledWith('render_succeeded', { seconds: '<1s', first: true })
  })
  it('terminates a stuck render and creates a fresh worker for the next edit', () => {
    const renderer = useRenderer()
    renderer.render('cube(1);')
    vi.advanceTimersByTime(90_001)
    expect(hooks.state.status).toBe('error')
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce()
    expect(analytics.track).toHaveBeenCalledWith('render_failed', { reason: 'timeout', first: true })
    renderer.render('cube(2);')
    expect(FakeWorker.instances).toHaveLength(2)
  })
  it('rejects exports immediately on worker failure and allows recovery', async () => {
    const renderer = useRenderer()
    const exported = renderer.exportModel('cube(1);', [], 'binstl')
    const rejected = expect(exported).rejects.toThrow('Worker crashed')
    FakeWorker.instances[0].onerror?.({ message: 'Worker crashed' })
    await rejected
    expect(analytics.track).toHaveBeenCalledWith('render_failed', { reason: 'crash', first: true })
    expect(vi.getTimerCount()).toBe(0)
    renderer.render('cube(2);')
    expect(FakeWorker.instances).toHaveLength(2)
  })
  it('reports preview results, marking the first one since the workspace opened', () => {
    const renderer = useRenderer()
    renderer.render('cube(1);')
    const worker = FakeWorker.instances[0]
    vi.advanceTimersByTime(4_000)
    worker.emit({ type: 'render', id: 1, ok: true, mesh, log: '' })
    expect(analytics.track).toHaveBeenLastCalledWith('render_succeeded', { seconds: '3-10s', first: true })
    renderer.render('cube(;')
    worker.emit({ type: 'render', id: 2, ok: false, error: 'Parser error', log: '' })
    expect(analytics.track).toHaveBeenLastCalledWith('render_failed', { reason: 'openscad', first: false })
    renderer.reset()
    renderer.render('cube(3);')
    worker.emit({ type: 'render', id: 4, ok: true, mesh, log: '' })
    expect(analytics.track).toHaveBeenLastCalledWith('render_succeeded', { seconds: '<1s', first: true })
  })
  it('does not count exports as preview renders', async () => {
    const renderer = useRenderer()
    const exported = renderer.exportModel('cube(1);', [], 'binstl')
    FakeWorker.instances[0].emit({ type: 'export', id: 1, ok: true, data: new ArrayBuffer(8), format: 'binstl', log: '' })
    await exported
    expect(analytics.track).not.toHaveBeenCalled()
  })

  it('resolves an inspection with its render and does not render the same source twice', async () => {
    const renderer = useRenderer()
    const files: never[] = []
    const pending = renderer.whenRendered('cube(1);', files)
    // The studio's debounced preview of the same source is the same job.
    renderer.render('cube(1);', files)
    const worker = FakeWorker.instances[0]
    expect(worker.postMessage).toHaveBeenCalledOnce()
    worker.emit({ type: 'render', id: 1, ok: true, mesh, log: 'ECHO: 1' })
    await expect(pending).resolves.toMatchObject({ status: 'done', log: 'ECHO: 1' })
    // Already shown: answered at once, no new job.
    await expect(renderer.whenRendered('cube(1);', files)).resolves.toMatchObject({ status: 'done' })
    expect(worker.postMessage).toHaveBeenCalledOnce()
  })
  it('answers an inspection with the failure when the source does not compile', async () => {
    const renderer = useRenderer()
    const pending = renderer.whenRendered('cube(;')
    FakeWorker.instances[0].emit({ type: 'render', id: 1, ok: false, error: 'Parser error', log: '' })
    await expect(pending).resolves.toMatchObject({ status: 'error', error: 'Parser error', mesh: null })
  })
})
