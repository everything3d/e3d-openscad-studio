import type { WorkspaceFile } from './types'

/** Formats supported by OpenSCAD's `import()` plus scad libraries and data files. */
export const ACCEPTED_EXTENSIONS = [
  '.svg',
  '.dxf',
  '.stl',
  '.off',
  '.3mf',
  '.amf',
  '.obj',
  '.scad',
  '.csv',
  '.dat',
  '.json',
  '.txt',
]

/**
 * Per-file cap. Bytes go straight from the browser to Blob storage, so this is
 * bounded by render time and browser memory rather than request size limits.
 */
export const MAX_FILE_BYTES = 100 * 1024 * 1024

/** Every file is written into the renderer's memory on each render. */
export const MAX_PROJECT_BYTES = 200 * 1024 * 1024

export const MAX_PROJECT_FILES = 50

export function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value)
}

/**
 * Workspace files are stored content-addressed under their owner. Re-adding a
 * file reuses the stored object, and the owner prefix keeps one user from
 * planting bytes at a path another user's upload would then reuse.
 */
export function workspaceBlobPath(userId: string, sha256: string): string {
  return `workspace/${userId}/${sha256}`
}

/** The SHA-256 a pathname names when it's in `userId`'s own namespace, else null. */
export function ownWorkspaceBlobHash(userId: string, pathname: string): string | null {
  const prefix = `workspace/${userId}/`
  if (!pathname.startsWith(prefix)) return null
  const sha256 = pathname.slice(prefix.length)
  return isSha256Hex(sha256) ? sha256 : null
}

/** Why a newly added file can't be stored, or null when it's acceptable. */
export function newFileProblem(file: Pick<WorkspaceFile, 'name' | 'size'>): string | null {
  if (file.name !== safeName(file.name) || !hasAcceptedExtension(file.name)) {
    return `${file.name} isn't a supported file type.`
  }
  if (!Number.isSafeInteger(file.size) || file.size < 0) return `${file.name} has an invalid size.`
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} is ${formatSize(file.size)} — max is ${formatSize(MAX_FILE_BYTES)}.`
  }
  return null
}

/**
 * Why a project's whole file list can't be saved, or null when it fits.
 * Shared by the upload panel (to fail before uploading) and the save route.
 */
export function fileListProblem(files: Pick<WorkspaceFile, 'name' | 'size'>[]): string | null {
  if (files.length > MAX_PROJECT_FILES) {
    return `A project can hold at most ${MAX_PROJECT_FILES} files.`
  }
  const names = new Set<string>()
  let total = 0
  for (const f of files) {
    if (names.has(f.name)) return `Two files are named ${f.name}.`
    names.add(f.name)
    total += f.size
  }
  if (total > MAX_PROJECT_BYTES) {
    return `Files total ${formatSize(total)} — a project can hold ${formatSize(MAX_PROJECT_BYTES)}.`
  }
  return null
}

/** What the browser sends back when saving: no bytes and no signed URL. */
export function toFileRef(f: WorkspaceFile): WorkspaceFile {
  return {
    name: f.name,
    size: f.size,
    addedAt: f.addedAt,
    ...(f.blobPath ? { blobPath: f.blobPath, sha256: f.sha256 } : {}),
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Sanitize a filename to something safe for the wasm FS root. */
export function safeName(name: string): string {
  return name.replace(/[/\\]/g, '_').replace(/^\.+/, '_')
}
