import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkspaceFile } from '@/lib/types'
import { base64ToBytes } from '@/lib/files'
import { parseOFF, type ParsedMesh } from './off'

export interface RenderState {
  status: 'idle' | 'rendering' | 'done' | 'error'
  mesh: ParsedMesh | null
  error: string | null
  log: string
}

type ExportFormat = 'off' | 'binstl'

interface WorkerResult {
  id: number
  ok: boolean
  data?: ArrayBuffer
  format?: ExportFormat
  error?: string
  log: string
}

interface Pending {
  resolve: (data: ArrayBuffer) => void
  reject: (err: Error) => void
}

function toPayload(files: WorkspaceFile[]) {
  return files.map((f) => ({
    name: f.name,
    data: base64ToBytes(f.data).buffer as ArrayBuffer,
  }))
}

/**
 * Owns the OpenSCAD web worker. `render(code, files)` drives the live
 * preview (colored OFF, latest request wins); `exportModel(...)` runs a
 * one-off render in any supported format and resolves with the file bytes.
 */
export function useRenderer() {
  const workerRef = useRef<Worker | null>(null)
  const reqId = useRef(0)
  const latest = useRef(0)
  const pending = useRef(new Map<number, Pending>())
  const [state, setState] = useState<RenderState>({
    status: 'idle',
    mesh: null,
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
      const { id, ok, data, error, log } = e.data

      // Export requests resolve their own promise.
      const p = pending.current.get(id)
      if (p) {
        pending.current.delete(id)
        if (ok && data) p.resolve(data)
        else p.reject(new Error(error || 'Export failed'))
        return
      }

      // Preview renders: only the most recent request is applied.
      if (id !== latest.current) return
      if (ok && data) {
        try {
          const mesh = parseOFF(data)
          setState({ status: 'done', mesh, error: null, log })
        } catch (err) {
          setState((s) => ({
            status: 'error',
            mesh: s.mesh,
            error: err instanceof Error ? err.message : String(err),
            log,
          }))
        }
      } else {
        setState((s) => ({
          status: 'error',
          mesh: s.mesh,
          error: error || 'Render failed',
          log,
        }))
      }
    }

    worker.onerror = (e) => {
      setState((s) => ({
        status: 'error',
        mesh: s.mesh,
        error: e.message || 'Worker crashed',
        log: '',
      }))
    }

    return () => {
      worker.terminate()
      workerRef.current = null
      for (const p of pending.current.values()) {
        p.reject(new Error('Worker terminated'))
      }
      pending.current.clear()
    }
  }, [])

  const render = useCallback((code: string, files: WorkspaceFile[] = []) => {
    const worker = workerRef.current
    if (!worker) return
    const id = ++reqId.current
    latest.current = id
    setState((s) => ({ ...s, status: 'rendering', error: null }))
    const payload = toPayload(files)
    worker.postMessage(
      { id, code, files: payload, format: 'off' },
      payload.map((f) => f.data),
    )
  }, [])

  const exportModel = useCallback(
    (code: string, files: WorkspaceFile[], format: ExportFormat): Promise<ArrayBuffer> => {
      const worker = workerRef.current
      if (!worker) return Promise.reject(new Error('Renderer not ready'))
      const id = ++reqId.current
      return new Promise((resolve, reject) => {
        pending.current.set(id, { resolve, reject })
        const payload = toPayload(files)
        worker.postMessage(
          { id, code, files: payload, format },
          payload.map((f) => f.data),
        )
      })
    },
    [],
  )

  return { state, render, exportModel }
}
