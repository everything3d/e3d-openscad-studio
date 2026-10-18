import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { listProjectFiles, replaceFiles } from '@/lib/db/queries'
import { MAX_PROJECT_FILES } from '@/lib/files'

type Params = { params: Promise<{ id: string }> }

/** File references only: bytes go straight to Blob storage, never through here. */
const saveFilesSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        size: z.number().int().nonnegative(),
        addedAt: z.number(),
        blobPath: z.string().max(512).optional(),
        sha256: z.string().max(64).optional(),
      }),
    )
    .max(MAX_PROJECT_FILES),
})

/** The project's files with fresh download URLs, for when earlier ones expired. */
export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const files = await listProjectFiles((await params).id, userId)
  if (!files) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ files })
}

export async function PUT(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = saveFilesSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid file list' }, { status: 400 })
  }

  const result = await replaceFiles((await params).id, userId, parsed.data.files)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
