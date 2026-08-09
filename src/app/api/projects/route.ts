import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createProject, forkProject, listProjects } from '@/lib/db/queries'

export async function GET() {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await listProjects({ userId, organizationId: orgId ?? null }))
}

export async function POST(req: Request) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = { userId, organizationId: orgId ?? null }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    forkFrom?: string
  }

  if (body.forkFrom) {
    const project = await forkProject(body.forkFrom, access)
    if (!project) {
      return NextResponse.json({ error: 'Source project not found' }, { status: 404 })
    }
    return NextResponse.json(project, { status: 201 })
  }

  return NextResponse.json(await createProject(access, body.name), { status: 201 })
}
