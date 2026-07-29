import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clearProjectMessages } from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const cleared = await clearProjectMessages(id, userId)
  if (!cleared) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  return new Response(null, { status: 204 })
}
