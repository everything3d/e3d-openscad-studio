import { useCallback, useEffect, useRef, useState } from 'react'

export interface RenderState {
  status: 'idle' | 'rendering' | 'done' | 'error'
  stl: ArrayBuffer | null
  error: string | null
  log: string
}

interface WorkerResult {
  id: number
  ok: boolean
  stl?: ArrayBuffer
  error?: string
  log: string
}

/**
 * Owns the OpenSCAD web worker and exposes a debounced `render(code)` call.
 * Only the most recent request's result is applied (stale renders are dropped).
 */
export function useRenderer() {
  const workerRef = useRef<Worker | null>(null)
  const reqId = useRef(0)
  const latest = useRef(0)
  const [state, setState] = useState<RenderState>({
    status: 'idle',
    stl: null,
    error: null,
    log: '',
  })

  useEffect(() => {
    const worker = new Worker(
      new URL('./render.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      const { id, ok, stl, error, log } = e.data
      if (id !== latest.current) return // stale
      if (ok && stl) {
        setState({ status: 'done', stl, error: null, log })
      } else {
        setState((s) => ({
          status: 'error',
          stl: s.stl,
          error: error || 'Render failed',
          log,
        }))
      }
    }

    worker.onerror = (e) => {
      setState((s) => ({
        status: 'error',
        stl: s.stl,
        error: e.message || 'Worker crashed',
        log: '',
      }))
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const render = useCallback((code: string) => {
    const worker = workerRef.current
    if (!worker) return
    const id = ++reqId.current
    latest.current = id
    setState((s) => ({ ...s, status: 'rendering', error: null }))
    worker.postMessage({ id, code })
  }, [])

  return { state, render }
}
