// Move workspace files saved before Blob storage (base64 in workspace_files.data)
// into the private Blob store, at the same content-addressed path a fresh upload
// would use. Dry run by default; pass --apply to write.
//
//   node --env-file=.env.local scripts/backfill-workspace-blobs.mjs [--apply]
//
// The inline copy is kept, so code deployed before Blob storage keeps working.
// Once the Blob version is live, clear the inline copies:
//
//   node --env-file=.env.local scripts/backfill-workspace-blobs.mjs --drop-inline [--apply]
//
// Canonical versions and share links are frozen JSON snapshots; their inline
// files keep working as they are and are left alone.
import { createHash } from 'node:crypto'
import { BlobNotFoundError, head, put } from '@vercel/blob'
import postgres from 'postgres'

const apply = process.argv.includes('--apply')
const dropInline = process.argv.includes('--drop-inline')
if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL is not set')
if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set')

const sql = postgres(process.env.POSTGRES_URL, { max: 1 })
const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

try {
  if (dropInline) {
    const [{ count, bytes }] = await sql`
      select count(*)::int as count, coalesce(sum(length(data)), 0)::bigint as bytes
      from workspace_files where blob_path is not null and data is not null`
    console.log(`${count} Blob-stored files still have an inline copy (${mb(Number(bytes))} of base64).`)
    if (apply && count > 0) {
      const result = await sql`
        update workspace_files set data = null where blob_path is not null and data is not null`
      console.log(`Cleared ${result.count} inline copies.`)
    }
  } else {
    const rows = await sql`
      select f.project_id, f.name, f.data, f.size, p.user_id
      from workspace_files f join projects p on p.id = f.project_id
      where f.blob_path is null and f.data is not null`
    let uploaded = 0
    let reused = 0
    let total = 0
    for (const row of rows) {
      const bytes = Buffer.from(row.data, 'base64')
      total += bytes.length
      if (bytes.length !== row.size) {
        console.warn(`${row.project_id}/${row.name}: stored size ${row.size}, decoded ${bytes.length}`)
      }
      if (!apply) continue

      const sha256 = createHash('sha256').update(bytes).digest('hex')
      const blobPath = `workspace/${row.user_id}/${sha256}`
      let stored = true
      try {
        await head(blobPath)
      } catch (err) {
        if (!(err instanceof BlobNotFoundError)) throw err
        stored = false
      }
      if (stored) {
        reused++
      } else {
        await put(blobPath, bytes, {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: 'application/octet-stream',
          cacheControlMaxAge: 365 * 24 * 60 * 60,
        })
        uploaded++
      }
      await sql`
        update workspace_files set blob_path = ${blobPath}, sha256 = ${sha256}
        where project_id = ${row.project_id} and name = ${row.name} and blob_path is null`
    }
    console.log(`${rows.length} inline files (${mb(total)}).`)
    if (apply) console.log(`Uploaded ${uploaded}, reused ${reused} already-stored blobs.`)
    else console.log('Dry run: pass --apply to upload and link them.')
  }
} finally {
  await sql.end()
}
