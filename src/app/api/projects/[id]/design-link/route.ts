import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { designLinkForOrder } from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

/**
 * A link to this design the team can open, for the customer to send on
 * WhatsApp. Reuses the project's share link when it already shows the
 * current design; see `designLinkForOrder`.
 */
export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const link = await designLinkForOrder(id, userId)
  if (!link) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  return NextResponse.json({ url: new URL(link.path, req.url).toString() })
}
