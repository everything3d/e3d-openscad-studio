import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { publishCanonicalVersionSchema } from '@/lib/canonicals'
import { addCanonicalVersionFromProject, isCanonicalPublisher } from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = publishCanonicalVersionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid canonical version' }, { status: 400 })
  if (parsed.data.visibility === 'published' && !isCanonicalPublisher(userId)) {
    return NextResponse.json({ error: 'Not allowed to publish shared canonical designs' }, { status: 403 })
  }
  const canonical = await addCanonicalVersionFromProject((await params).id, parsed.data, userId)
  if (!canonical) return NextResponse.json({ error: 'Canonical design or workspace not found' }, { status: 404 })
  return NextResponse.json(canonical, { status: 201 })
}
