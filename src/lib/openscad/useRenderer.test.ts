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
  })
  it('terminates a stuck render and creates a fresh worker for the next edit', () => {
    const renderer = useRenderer()
    renderer.render('cube(1);')
    vi.advanceTimersByTime(90_001)
    expect(hooks.state.status).toBe('error')
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce()
    renderer.render('cube(2);')
    expect(FakeWorker.instances).toHaveLength(2)
  })
  it('rejects exports immediately on worker failure and allows recovery', async () => {
    const renderer = useRenderer()
    const exported = renderer.exportModel('cube(1);', [], 'binstl')
    const rejected = expect(exported).rejects.toThrow('Worker crashed')
    FakeWorker.instances[0].onerror?.({ message: 'Worker crashed' })
    await rejected
    expect(vi.getTimerCount()).toBe(0)
    renderer.render('cube(2);')
    expect(FakeWorker.instances).toHaveLength(2)
  })
})
