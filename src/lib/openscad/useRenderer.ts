import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkspaceFile } from '@/lib/types'
import { fileBytesNow, hasFileBytesNow, loadFileBytes } from '@/lib/workspace-files'
import type { ParsedMesh } from './off'
import type { ExportFormat, WorkerRequest, WorkerResponse } from './render.worker'

export interface RenderState {
  status: 'idle' | 'rendering' | 'done' | 'error'
  mesh: ParsedMesh | null
  error: string | null
  log: string
}

interface Pending {
  resolve: (data: ArrayBuffer) => void
  reject: (err: Error) => void
}

/**
 * How long one job may run before the worker is presumed stuck (an infinite
 * loop, a runaway `$fn`) and replaced. Without this the preview badge stays
 * on "Rendering…" forever and every later edit queues behind the stuck job.
 */
const JOB_TIMEOUT_MS = 90_000

type RenderPayload = { name: string; data: ArrayBuffer }[]

/** A copy, so transferring it to the worker leaves the cached bytes intact. */
function ownBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}

/** The worker payload, when every file's bytes are already loaded. */
function payloadNow(files: WorkspaceFile[]): RenderPayload | null {
  if (!files.every(hasFileBytesNow)) return null
  return files.map((f) => ({ name: f.name, data: ownBuffer(fileBytesNow(f)) }))
}

/** The worker payload, downloading any Blob-stored files not loaded yet. */
async function loadPayload(files: WorkspaceFile[]): Promise<RenderPayload> {
  return Promise.all(
    files.map(async (f) => ({ name: f.name, data: ownBuffer(await loadFileBytes(f)) })),
  )
}

/**
 * Owns the OpenSCAD web worker. `render(code, files)` drives the live
 * preview (colored OFF, latest request wins); `exportModel(...)` runs a
 * one-off render in any supported format and resolves with the file bytes.
 *
 * The worker is created on first use (or `warmup()`), not on mount, so the
 * canonical library does not download the 17 MB of wasm and fonts for a
 * visitor who never opens a workspace; opening one starts the download at
 * once, before the project itself has loaded.
 */
export function useRenderer() {
  const workerRef = useRef<Worker | null>(null)
  const reqId = useRef(0)
  const latest = useRef(0)
  const pending = useRef(new Map<number, Pending>())
  /** Jobs the worker has been given and not answered, for the watchdog. */
  const inFlight = useRef(new Set<number>())
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<RenderState>({
    status: 'idle',
    mesh: null,
    error: null,
    log: '',
  })

  const clearWatchdog = useCallback(() => {
    if (watchdog.current) clearTimeout(watchdog.current)
    watchdog.current = null
  }, [])

  const disposeWorker = useCallback(
    (reason: string) => {
      clearWatchdog()
      workerRef.current?.terminate()
      workerRef.current = null
      inFlight.current.clear()
      for (const p of pending.current.values()) p.reject(new Error(reason))
      pending.current.clear()
    },
    [clearWatchdog],
  )

  const armWatchdog = useCallback(() => {
    clearWatchdog()
    if (inFlight.current.size === 0) return
    watchdog.current = setTimeout(() => {
      const message = `Render timed out after ${JOB_TIMEOUT_MS / 1000} s. The model may contain an infinite loop or be far too detailed; the renderer has been restarted.`
      disposeWorker(message)
      setState((s) => ({ status: 'error', mesh: s.mesh, error: message, log: '' }))
    }, JOB_TIMEOUT_MS)
  }, [clearWatchdog, disposeWorker])

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current
    const worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (msg.type === 'ready') return
      inFlight.current.delete(msg.id)
      armWatchdog()
      if (msg.type === 'cancelled') return

      if (msg.type === 'export') {
        const p = pending.current.get(msg.id)
        if (!p) return
        pending.current.delete(msg.id)
        if (msg.ok) p.resolve(msg.data)
        else p.reject(new Error(msg.error || 'Export failed'))
        return
      }

      // Preview renders: only the most recent request is applied.
      if (msg.id !== latest.current) return
      if (msg.ok) {
        setState({ status: 'done', mesh: msg.mesh, error: null, log: msg.log })
      } else {
        setState((s) => ({
          status: 'error',
          mesh: s.mesh,
          error: msg.error || 'Render failed',
          log: msg.log,
        }))
      }
    }

    worker.onerror = (e) => {
      disposeWorker(e.message || 'Worker crashed')
      setState((s) => ({
        status: 'error',
        mesh: s.mesh,
        error: e.message || 'Worker crashed',
        log: '',
      }))
    }
    return worker
  }, [armWatchdog, disposeWorker])

  useEffect(() => () => disposeWorker('Worker terminated'), [disposeWorker])

  const postJob = useCallback(
    (worker: Worker, job: Extract<WorkerRequest, { type: 'render' | 'export' }>) => {
      inFlight.current.add(job.id)
      worker.postMessage(job, (job.files ?? []).map((f) => f.data))
      if (!watchdog.current) armWatchdog()
    },
    [armWatchdog],
  )

  /** Create the worker and start fetching the wasm and fonts in the background. */
  const warmup = useCallback(() => {
    ensureWorker().postMessage({ type: 'warmup' } satisfies WorkerRequest)
  }, [ensureWorker])

  const render = useCallback(
    (code: string, files: WorkspaceFile[] = []) => {
      const id = ++reqId.current
      latest.current = id
      setState((s) => ({ ...s, status: 'rendering', error: null }))
      const post = (payload: RenderPayload) =>
        postJob(ensureWorker(), { type: 'render', id, code, files: payload, format: 'off' })

      const ready = payloadNow(files)
      if (ready) return post(ready)
      // Only the newest request matters once the files arrive.
      loadPayload(files).then(
        (payload) => {
          if (id === latest.current) post(payload)
        },
        (err: unknown) => {
          if (id !== latest.current) return
          const message = err instanceof Error ? err.message : String(err)
          setState((s) => ({ status: 'error', mesh: s.mesh, error: message, log: '' }))
        },
      )
    },
    [ensureWorker, postJob],
  )

  /** Clear the preview and invalidate any in-flight preview response. */
  const reset = useCallback(() => {
    latest.current = ++reqId.current
    setState({ status: 'idle', mesh: null, error: null, log: '' })
  }, [])

  const exportModel = useCallback(
    async (code: string, files: WorkspaceFile[], format: ExportFormat): Promise<ArrayBuffer> => {
      const payload = payloadNow(files) ?? (await loadPayload(files))
      const worker = ensureWorker()
      const id = ++reqId.current
      return new Promise((resolve, reject) => {
        pending.current.set(id, { resolve, reject })
        postJob(worker, { type: 'export', id, code, files: payload, format })
      })
    },
    [ensureWorker, postJob],
  )

  return { state, render, reset, exportModel, warmup }
}
