import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  disableProjectShare,
  getActiveProjectShare,
  replaceProjectShare,
} from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

/** The studio's thumbnail is a ~30–60 KB JPEG; anything far larger isn't one. */
const MAX_PREVIEW_IMAGE_CHARS = 300_000

/** Accept only a JPEG data URL the studio could have produced; drop anything else. */
async function readPreviewImage(req: Request): Promise<string | null> {
  const body = (await req.json().catch(() => null)) as { previewImage?: unknown } | null
  const image = body?.previewImage
  if (typeof image !== 'string' || image.length > MAX_PREVIEW_IMAGE_CHARS) return null
  return /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image) ? image : null
}

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const share = await getActiveProjectShare(id, userId)
  return NextResponse.json({ share })
}

export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const share = await replaceProjectShare(id, userId, await readPreviewImage(req))
  if (!share) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  return NextResponse.json({ share }, { status: 201 })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await disableProjectShare(id, userId)
  return new Response(null, { status: 204 })
}
