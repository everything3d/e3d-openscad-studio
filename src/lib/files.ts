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

/** Per-file cap. Everything lives in localStorage, which is ~5–10 MB total. */
export const MAX_FILE_BYTES = 3 * 1024 * 1024

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

export async function toWorkspaceFile(file: File): Promise<WorkspaceFile> {
  const buf = await file.arrayBuffer()
  return {
    name: safeName(file.name),
    data: bytesToBase64(new Uint8Array(buf)),
    size: buf.byteLength,
    addedAt: Date.now(),
  }
}
