import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { updateCanonicalSchema } from '@/lib/canonicals'
import {
  getCanonical,
  isCanonicalPublisher,
  updateCanonicalMetadata,
} from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canonical = await getCanonical((await params).id, userId)
  if (!canonical) return NextResponse.json({ error: 'Starter not found' }, { status: 404 })
  return NextResponse.json(canonical)
}

export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = updateCanonicalSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid changes' }, { status: 400 })
  if (parsed.data.visibility === 'published' && !isCanonicalPublisher(userId)) {
    return NextResponse.json({ error: 'Not allowed to publish shared starters' }, { status: 403 })
  }
  const updated = await updateCanonicalMetadata((await params).id, userId, parsed.data)
  if (!updated) return NextResponse.json({ error: 'Starter not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
