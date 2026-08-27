import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { publishCanonicalSchema } from '@/lib/canonicals'
import { createCanonicalFromProject, listCanonicals } from '@/lib/db/queries'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await listCanonicals(userId))
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = publishCanonicalSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid canonical design', details: parsed.error.flatten() }, { status: 400 })
  }
  const canonical = await createCanonicalFromProject(parsed.data, userId)
  if (!canonical) return NextResponse.json({ error: 'Source workspace not found' }, { status: 404 })
  return NextResponse.json(canonical, { status: 201 })
}
