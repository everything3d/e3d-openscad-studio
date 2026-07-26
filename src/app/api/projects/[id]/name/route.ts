import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { autoNameProject, getProject } from '@/lib/db/queries'
import { generateProjectName } from '@/lib/agents/name-project'
import { PLACEHOLDER_PROJECT_NAME } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/**
 * Auto-name a still-unnamed project from the user's first message. Idempotent:
 * once the project has a real name this just echoes it back. Always responds
 * with the name the client should display.
 */
export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { text } = (await req.json().catch(() => ({}))) as { text?: string }

  const project = await getProject(id, userId)
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.name !== PLACEHOLDER_PROJECT_NAME) {
    return NextResponse.json({ name: project.name })
  }

  const name = await generateProjectName(text ?? '')
  if (!name) return NextResponse.json({ name: project.name })

  const applied = await autoNameProject(id, userId, name)
  return NextResponse.json({ name: applied ? name : project.name })
}
