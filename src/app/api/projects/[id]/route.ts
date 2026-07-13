import { NextResponse } from 'next/server'
import {
  deleteProject,
  getProject,
  getProjectMessages,
  renameProject,
  updateProjectCode,
} from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const project = await getProject(id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  const messages = await getProjectMessages(id)
  return NextResponse.json({ ...project, messages })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const body = (await req.json()) as { name?: string; code?: string }

  if (typeof body.name === 'string' && body.name.trim()) {
    await renameProject(id, body.name.trim())
  }
  if (typeof body.code === 'string') {
    await updateProjectCode(id, body.code)
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  await deleteProject(id)
  return new Response(null, { status: 204 })
}
