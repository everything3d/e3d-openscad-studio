import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { startCanonical } from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const project = await startCanonical((await params).id, userId)
  if (!project) return NextResponse.json({ error: 'Starter not found' }, { status: 404 })
  return NextResponse.json(project, { status: 201 })
}
