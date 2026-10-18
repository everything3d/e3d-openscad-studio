import { base64ToBytes } from './files'
import type { WorkspaceFile } from './types'

/**
 * Browser side of workspace file storage: uploads go straight to Blob, and
 * downloaded bytes are kept in memory and in Cache Storage keyed by content
 * hash, so reopening a project or re-rendering it doesn't download them again.
 */

/** Recently used file bytes, oldest first. Bounded so browsing many projects can't exhaust memory. */
const MEMORY_BUDGET_BYTES = 400 * 1024 * 1024
const memory = new Map<string, Uint8Array>()
let memoryBytes = 0
const downloads = new Map<string, Promise<Uint8Array>>()

const CACHE_NAME = 'e3d-workspace-files-v1'

function cacheKey(file: WorkspaceFile): string {
  return file.sha256 ?? file.blobPath ?? file.name
}

function remember(key: string, bytes: Uint8Array) {
  const previous = memory.get(key)
  if (previous) {
    memory.delete(key)
    memoryBytes -= previous.byteLength
  }
  memory.set(key, bytes)
  memoryBytes += bytes.byteLength
  for (const [oldKey, oldBytes] of memory) {
    if (memoryBytes <= MEMORY_BUDGET_BYTES || oldKey === key) break
    memory.delete(oldKey)
    memoryBytes -= oldBytes.byteLength
  }
}

function cacheRequest(key: string): Request {
  return new Request(`/__workspace-files/${encodeURIComponent(key)}`)
}

// Cache Storage is best effort: it's missing outside secure contexts and can
// throw when storage is full or blocked, and the download is the fallback.
async function readCache(key: string): Promise<Uint8Array | undefined> {
  try {
    const res = await (await caches.open(CACHE_NAME)).match(cacheRequest(key))
    return res ? new Uint8Array(await res.arrayBuffer()) : undefined
  } catch {
    return undefined
  }
}

async function writeCache(key: string, bytes: Uint8Array): Promise<void> {
  try {
    await (await caches.open(CACHE_NAME)).put(cacheRequest(key), new Response(bytes.slice()))
  } catch {
    // Not cached; the next session downloads it again.
  }
}

/** Whether a file's bytes are available without waiting. */
export function hasFileBytesNow(file: WorkspaceFile): boolean {
  return !file.blobPath || memory.has(cacheKey(file))
}

/** A file's bytes when `hasFileBytesNow`; callers must not modify them. */
export function fileBytesNow(file: WorkspaceFile): Uint8Array {
  if (!file.blobPath) return base64ToBytes(file.data ?? '')
  const key = cacheKey(file)
  const bytes = memory.get(key)
  if (!bytes) throw new Error(`${file.name} is not loaded yet`)
  remember(key, bytes)
  return bytes
}

/** A file's bytes, from memory, Cache Storage or its signed download URL. Callers must not modify them. */
export function loadFileBytes(file: WorkspaceFile): Promise<Uint8Array> {
  if (hasFileBytesNow(file)) return Promise.resolve(fileBytesNow(file))
  const key = cacheKey(file)
  let download = downloads.get(key)
  if (!download) {
    download = (async () => {
      const cached = await readCache(key)
      if (cached) return cached
      if (!file.url) throw new Error(`${file.name} can't be downloaded. Reload the page and try again.`)
      const res = await fetch(file.url)
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? `The download link for ${file.name} has expired. Reload the page to get a new one.`
            : `Couldn't download ${file.name} (HTTP ${res.status}).`,
        )
      }
      const bytes = new Uint8Array(await res.arrayBuffer())
      void writeCache(key, bytes)
      return bytes
    })()
      .then((bytes) => {
        remember(key, bytes)
        return bytes
      })
      .finally(() => downloads.delete(key))
    downloads.set(key, download)
  }
  return download
}

/** Keep bytes the browser just uploaded, so rendering them needn't download them back. */
export function storeFileBytes(file: WorkspaceFile, bytes: Uint8Array): void {
  const key = cacheKey(file)
  remember(key, bytes)
  void writeCache(key, bytes)
}
