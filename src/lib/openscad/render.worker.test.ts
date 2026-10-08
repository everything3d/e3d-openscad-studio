import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import type { WorkerRequest, WorkerResponse } from './render.worker'

it('coalesces previews and renders colored geometry, text, and STL through the compiled wasm worker', { timeout: 60_000 }, async () => {
  const responses: WorkerResponse[] = []
  const worker = {
    onmessage: null as ((event: { data: WorkerRequest }) => void) | null,
    postMessage: (message: WorkerResponse) => { responses.push(message) },
  }
  vi.stubGlobal('self', worker)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/openscad/')) {
      const filename = url.split('?')[0].split('/').pop()!
      const bytes = readFileSync(new URL(`../../../public/openscad/${filename}`, import.meta.url))
      return new Response(bytes, { headers: { 'Content-Type': filename.endsWith('.wasm') ? 'application/wasm' : 'application/zip' } })
    }
    if (url === '/api/fonts/catalog') return Response.json({ families: [] })
    throw new Error(`Unexpected fetch: ${url}`)
  }))
  try {
    await import('./render.worker')
    const send = (data: WorkerRequest) => worker.onmessage!({ data })
    send({ type: 'render', id: 1, code: 'cube(1);' })
    send({ type: 'render', id: 2, code: 'cube(2);' })
    send({ type: 'render', id: 3, code: 'color("red") cube(3);' })
    send({ type: 'export', id: 4, code: 'cube(3);', format: 'binstl' })
    send({ type: 'render', id: 5, code: 'linear_extrude(2) text("Hi");' })
    // The latest preview supersedes id 3 but never the queued export.
    await vi.waitFor(() => expect(responses.some((r) => 'id' in r && r.id === 5 && r.type === 'render')).toBe(true), { timeout: 55_000, interval: 50 })
    expect(responses).toContainEqual({ type: 'cancelled', id: 2 })
    expect(responses).toContainEqual({ type: 'cancelled', id: 3 })
    const stl = responses.find((r) => r.type === 'export' && r.id === 4)
    expect(stl?.type === 'export' && stl.ok && stl.data.byteLength).toBeGreaterThan(84)
    const text = responses.find((r) => r.type === 'render' && r.id === 5)
    expect(text?.type === 'render' && text.ok && text.mesh.vertices.length).toBeGreaterThan(0)
    send({ type: 'render', id: 6, code: 'color("red") cube(3);' })
    await vi.waitFor(() => expect(responses.some((r) => r.type === 'render' && r.id === 6)).toBe(true))
    const colored = responses.find((r) => r.type === 'render' && r.id === 6)
    expect(colored?.type === 'render' && colored.ok && Array.from(colored.mesh.faceColors!.slice(0, 3))).toEqual([255, 0, 0])
    expect(responses.filter((r) => 'ok' in r && !r.ok)).toEqual([])
  } finally {
    vi.unstubAllGlobals()
  }
})
