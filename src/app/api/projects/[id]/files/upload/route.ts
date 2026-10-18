import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { ownsProject } from '@/lib/db/queries'
import { MAX_FILE_BYTES, ownWorkspaceBlobHash } from '@/lib/files'

type Params = { params: Promise<{ id: string }> }

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

class UploadRejected extends Error {}

/**
 * Issues the short-lived token the browser's `upload()` uses to send a
 * workspace file straight to Blob storage, bypassing the function request
 * size limit. The token only allows the caller's own content-addressed path.
 * Nothing is recorded here: the file joins the project when the browser saves
 * the file list, which checks the stored blob.
 */
export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null
  if (body?.type !== 'blob.generate-client-token') {
    return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 })
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!ownWorkspaceBlobHash(userId, pathname)) throw new UploadRejected('Upload path not allowed')
        if (!(await ownsProject(id, userId))) throw new UploadRejected('Project not found')
        return {
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: false,
          // The path is the content hash: stored bytes never change.
          allowOverwrite: false,
          cacheControlMaxAge: ONE_YEAR_SECONDS,
          validUntil: Date.now() + 30 * 60 * 1000,
        }
      },
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof UploadRejected) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    throw err
  }
}
