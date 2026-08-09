import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  disableProjectShare,
  getActiveProjectShare,
  replaceProjectShare,
} from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const share = await getActiveProjectShare(id, {
    userId,
    organizationId: orgId ?? null,
  })
  return NextResponse.json({ share })
}

export async function POST(_req: Request, { params }: Params) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const share = await replaceProjectShare(id, {
    userId,
    organizationId: orgId ?? null,
  })
  if (!share) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  return NextResponse.json({ share }, { status: 201 })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await disableProjectShare(id, { userId, organizationId: orgId ?? null })
  return new Response(null, { status: 204 })
}
