import { upload } from '@vercel/blob/client'
import { safeName } from './files'
import type { WorkspaceFile } from './types'
import { storeFileBytes } from './workspace-files'

const MULTIPART_THRESHOLD_BYTES = 16 * 1024 * 1024

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function uploadTarget(
  projectId: string,
  name: string,
  size: number,
  sha256: string,
): Promise<{ blobPath: string; exists: boolean }> {
  const res = await fetch(`/api/projects/${projectId}/files/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, size, sha256 }),
  })
  const body = (await res.json().catch(() => null)) as
    | { blobPath: string; exists: boolean }
    | { error?: string }
    | null
  if (!res.ok || !body || !('blobPath' in body)) {
    throw new Error((body && 'error' in body && body.error) || `Couldn't upload ${name}.`)
  }
  return body
}

/**
 * Upload a file straight to Blob storage and return its workspace reference.
 * Bytes already stored (the same file added before) aren't sent again. The
 * caller still has to save the project's file list for the file to join it.
 */
export async function uploadWorkspaceFile(
  projectId: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<WorkspaceFile> {
  const name = safeName(file.name)
  const buffer = await file.arrayBuffer()
  const sha256 = await sha256Hex(buffer)
  const target = await uploadTarget(projectId, name, file.size, sha256)
  if (!target.exists) {
    try {
      await upload(target.blobPath, file, {
        access: 'private',
        handleUploadUrl: `/api/projects/${projectId}/files/upload`,
        contentType: 'application/octet-stream',
        multipart: file.size > MULTIPART_THRESHOLD_BYTES,
        onUploadProgress: ({ percentage }) => onProgress?.(percentage / 100),
      })
    } catch (err) {
      // Stored paths are never overwritten, so a concurrent upload of the same
      // bytes (another tab) fails here even though the file is now stored.
      const retry = await uploadTarget(projectId, name, file.size, sha256).catch(() => null)
      if (!retry?.exists) throw err
    }
  }
  onProgress?.(1)
  const added: WorkspaceFile = {
    name,
    size: file.size,
    addedAt: Date.now(),
    sha256,
    blobPath: target.blobPath,
  }
  storeFileBytes(added, new Uint8Array(buffer))
  return added
}
