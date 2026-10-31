import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { saveProjectThumbnail } from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

/** The studio's thumbnail is a ~30–60 KB JPEG; anything far larger isn't one. */
const MAX_IMAGE_CHARS = 300_000

/**
 * Store the studio's latest render of a project. The browser renders the
 * model itself, so this is the only way the server ever sees what a chat
 * produced; the staff desk shows it next to each chat.
 */
export async function PUT(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { image?: unknown } | null
  const image = body?.image
  if (
    typeof image !== 'string' ||
    image.length > MAX_IMAGE_CHARS ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image)
  ) {
    return NextResponse.json({ error: 'Expected a JPEG data URL' }, { status: 400 })
  }

  const { id } = await params
  if (!(await saveProjectThumbnail(id, userId, image))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  return new Response(null, { status: 204 })
}
