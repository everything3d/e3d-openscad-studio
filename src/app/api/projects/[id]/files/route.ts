import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProject, replaceFiles } from '@/lib/db/queries'
import type { WorkspaceFile } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = { userId, organizationId: orgId ?? null }

  const { id } = await params
  const project = await getProject(id, access)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const body = (await req.json()) as { files?: WorkspaceFile[] }
  if (!Array.isArray(body.files)) {
    return NextResponse.json({ error: 'files array is required' }, { status: 400 })
  }

  await replaceFiles(id, access, body.files)
  return NextResponse.json({ ok: true })
}
