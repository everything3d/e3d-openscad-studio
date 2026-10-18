import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileBytesNow, hasFileBytesNow, loadFileBytes, storeFileBytes } from './workspace-files'
import type { WorkspaceFile } from './types'

function blobFile(sha: string, url = `https://store.example/${sha}`): WorkspaceFile {
  return { name: `${sha}.stl`, size: 3, addedAt: 0, sha256: sha.padEnd(64, '0'), blobPath: `workspace/u/${sha}`, url }
}

describe('workspace file bytes', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('decodes inline files without a download', () => {
    const file: WorkspaceFile = { name: 'a.scad', size: 2, addedAt: 0, data: 'aGk=' }
    expect(hasFileBytesNow(file)).toBe(true)
    expect(new TextDecoder().decode(fileBytesNow(file))).toBe('hi')
  })

  it('downloads a Blob-stored file once, then serves it from memory', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])))
    vi.stubGlobal('fetch', fetch)
    const file = blobFile('1')
    expect(hasFileBytesNow(file)).toBe(false)
    const [a, b] = await Promise.all([loadFileBytes(file), loadFileBytes(file)])
    expect(Array.from(a)).toEqual([1, 2, 3])
    expect(b).toBe(a)
    expect(fetch).toHaveBeenCalledOnce()
    expect(hasFileBytesNow(file)).toBe(true)
    // A later copy of the URL (fresh signature) still hits memory by content hash.
    expect(fileBytesNow({ ...file, url: 'https://store.example/other' })).toBe(a)
  })

  it('serves bytes the browser just uploaded without downloading them', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const file = blobFile('2')
    storeFileBytes(file, new Uint8Array([9]))
    expect(Array.from(await loadFileBytes(file))).toEqual([9])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('explains an expired link and retries on the next attempt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('denied', { status: 403 })))
    const file = blobFile('3')
    await expect(loadFileBytes(file)).rejects.toThrow('has expired')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([7]))))
    expect(Array.from(await loadFileBytes(file))).toEqual([7])
  })
})
