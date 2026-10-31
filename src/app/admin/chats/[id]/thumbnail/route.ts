import { auth, isStaff } from '@/auth'
import { getProjectThumbnailForAdmin } from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

/**
 * A chat's latest studio render, for the staff desk. Staff-only, any owner.
 * Callers add `?v=<updatedAt ms>` so a newer render gets a new URL, which
 * makes the long private cache below safe.
 */
export async function GET(req: Request, { params }: Params) {
  if (!isStaff(await auth())) return new Response(null, { status: 401 })

  const { id } = await params
  const image = await getProjectThumbnailForAdmin(id)
  const match = image?.match(/^data:(image\/(?:jpeg|webp|png));base64,(.+)$/)
  if (!match) return new Response(null, { status: 404 })

  const versioned = new URL(req.url).searchParams.has('v')
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': match[1],
      'Cache-Control': versioned ? 'private, max-age=31536000, immutable' : 'private, no-cache',
    },
  })
}
