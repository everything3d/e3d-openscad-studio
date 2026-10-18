import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { storedBlobSize } from '@/lib/blob'
import { ownsProject } from '@/lib/db/queries'
import { isSha256Hex, newFileProblem, workspaceBlobPath } from '@/lib/files'

type Params = { params: Promise<{ id: string }> }

const checkSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  sha256: z.string(),
})

/**
 * Step one of adding a workspace file: where its bytes belong, and whether
 * they're already stored there (the same file added before, in any project),
 * in which case the browser skips the upload.
 */
export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = checkSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success || !isSha256Hex(parsed.data.sha256)) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 })
  }
  const problem = newFileProblem(parsed.data)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })
  if (!(await ownsProject((await params).id, userId))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const blobPath = workspaceBlobPath(userId, parsed.data.sha256)
  const storedSize = await storedBlobSize(blobPath)
  if (storedSize !== null && storedSize !== parsed.data.size) {
    return NextResponse.json({ error: 'A different file is stored under this hash' }, { status: 409 })
  }
  return NextResponse.json({ blobPath, exists: storedSize !== null })
}
