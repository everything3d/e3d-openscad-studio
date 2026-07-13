import { NextResponse } from 'next/server'
import { createProject, forkProject, listProjects } from '@/lib/db/queries'

export async function GET() {
  return NextResponse.json(await listProjects())
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    forkFrom?: string
  }

  if (body.forkFrom) {
    const project = await forkProject(body.forkFrom)
    if (!project) {
      return NextResponse.json({ error: 'Source project not found' }, { status: 404 })
    }
    return NextResponse.json(project, { status: 201 })
  }

  return NextResponse.json(await createProject(body.name), { status: 201 })
}
