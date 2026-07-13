import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createProject, forkProject, listProjects } from '@/lib/db/queries'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await listProjects(userId))
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    forkFrom?: string
  }

  if (body.forkFrom) {
    const project = await forkProject(body.forkFrom, userId)
    if (!project) {
      return NextResponse.json({ error: 'Source project not found' }, { status: 404 })
    }
    return NextResponse.json(project, { status: 201 })
  }

  return NextResponse.json(await createProject(userId, body.name), { status: 201 })
}
