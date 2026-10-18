import { fileListProblem, newFileProblem, ownWorkspaceBlobHash } from '../files'
import type { WorkspaceFile } from '../types'
import type { workspaceFiles } from './schema'

export type WorkspaceFileRow = typeof workspaceFiles.$inferSelect
export type NewWorkspaceFileRow = typeof workspaceFiles.$inferInsert

/**
 * A stored row as a workspace file. A Blob-stored file leaves its inline copy
 * behind (rows backfilled into Blob keep one until it's dropped), so copies
 * made from it carry only the reference.
 */
export function fileFromRow(row: WorkspaceFileRow): WorkspaceFile {
  const file = { name: row.name, size: row.size, addedAt: row.addedAt.getTime() }
  if (row.blobPath) return { ...file, blobPath: row.blobPath, sha256: row.sha256 ?? undefined }
  return { ...file, data: row.data ?? '' }
}

export function fileToRow(projectId: string, file: WorkspaceFile): NewWorkspaceFileRow {
  return {
    projectId,
    name: file.name,
    size: file.size,
    addedAt: new Date(file.addedAt),
    ...(file.blobPath
      ? { blobPath: file.blobPath, sha256: file.sha256 ?? null, data: null }
      : { data: file.data ?? '' }),
  }
}

/** What makes two copies of a file the same bytes. */
export function fileIdentity(file: WorkspaceFile): string | undefined {
  return file.blobPath ?? file.data
}

export type FileReplacementPlan =
  | { ok: true; rows: NewWorkspaceFileRow[] }
  | { ok: false; error: string }

/**
 * The rows that replace a project's workspace files, given the references the
 * browser sends back (it never sends bytes). A file the project already holds
 * keeps its stored row. A new file must name a blob in the user's own
 * namespace whose stored size matches, so a project can't be pointed at
 * another user's blobs or at bytes that were never uploaded.
 */
export async function planFileReplacement({
  projectId,
  userId,
  existing,
  incoming,
  storedSize,
}: {
  projectId: string
  userId: string
  existing: WorkspaceFileRow[]
  incoming: WorkspaceFile[]
  storedSize: (blobPath: string) => Promise<number | null>
}): Promise<FileReplacementPlan> {
  const byName = new Map(existing.map((row) => [row.name, row]))
  const byBlobPath = new Map(
    existing.flatMap((row) => (row.blobPath ? [[row.blobPath, row] as const] : [])),
  )
  const notUploaded = (file: WorkspaceFile) => ({ ok: false as const, error: `${file.name} was not uploaded.` })

  const rows: NewWorkspaceFileRow[] = []
  for (const file of incoming) {
    const kept = byName.get(file.name)
    if (kept && (file.blobPath ?? null) === kept.blobPath) {
      rows.push(kept)
      continue
    }

    const problem = newFileProblem(file)
    if (problem) return { ok: false, error: problem }
    const blobPath = file.blobPath
    if (!blobPath) return notUploaded(file)

    const stored = byBlobPath.get(blobPath)
    if (stored) {
      rows.push({ ...stored, name: file.name, addedAt: new Date(file.addedAt) })
      continue
    }
    const sha256 = ownWorkspaceBlobHash(userId, blobPath)
    if (!sha256 || sha256 !== file.sha256) return notUploaded(file)
    const size = await storedSize(blobPath)
    if (size !== file.size) return notUploaded(file)
    rows.push(fileToRow(projectId, { name: file.name, size, addedAt: file.addedAt, blobPath, sha256 }))
  }

  const listProblem = fileListProblem(rows.map((row) => ({ name: row.name, size: row.size })))
  if (listProblem) return { ok: false, error: listProblem }
  return { ok: true, rows }
}
