import { auth } from '@clerk/nextjs/server'
import { getCanonicalThumbnail } from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

/**
 * The current version's preview image for a user-published canonical.
 *
 * Published thumbnails are stored as JPEG/WebP data URLs of up to 300 KB.
 * Listing the library used to inline every one of them into the page's HTML
 * and again into its RSC payload; the library now carries a URL to this route
 * instead, and the browser fetches (and caches) each image on its own. The
 * `v` query carries the version id, so a republished design gets a new URL
 * and the long cache lifetime below is safe.
 */
export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const thumbnail = await getCanonicalThumbnail(id)
  if (!thumbnail) return new Response(null, { status: 404 })

  const match = thumbnail.match(/^data:(image\/(?:jpeg|webp|png));base64,(.+)$/)
  if (!match) return new Response(null, { status: 404 })

  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': match[1],
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}
