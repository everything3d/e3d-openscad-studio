import { NextResponse } from 'next/server'
import { getProject, replaceFiles } from '@/lib/db/queries'
import type { WorkspaceFile } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  const project = await getProject(id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const body = (await req.json()) as { files?: WorkspaceFile[] }
  if (!Array.isArray(body.files)) {
    return NextResponse.json({ error: 'files array is required' }, { status: 400 })
  }

  await replaceFiles(id, body.files)
  return NextResponse.json({ ok: true })
}
