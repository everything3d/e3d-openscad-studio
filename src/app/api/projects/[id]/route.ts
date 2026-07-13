import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  deleteProject,
  getProject,
  getProjectMessages,
  renameProject,
  updateProjectCode,
} from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const project = await getProject(id, userId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  const messages = await getProjectMessages(id)
  return NextResponse.json({ ...project, messages })
}

export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = (await req.json()) as { name?: string; code?: string }

  if (typeof body.name === 'string' && body.name.trim()) {
    await renameProject(id, userId, body.name.trim())
  }
  if (typeof body.code === 'string') {
    await updateProjectCode(id, userId, body.code)
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await deleteProject(id, userId)
  return new Response(null, { status: 204 })
}
