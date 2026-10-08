import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { autoNameProject, getProject } from '@/lib/db/queries'
import { generateProjectName } from '@/lib/agents/name-project'
import { provisionalNameBase } from '@/lib/types'
import { guardModelCall, spendGuardResponse } from '@/lib/spend-guard'

type Params = { params: Promise<{ id: string }> }

/**
 * Auto-name a still-unnamed project — a blank one, or a derivative still on its
 * "<design> — new" name — from the user's first message. Idempotent:
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
  const baseTitle = provisionalNameBase(project.name)
  if (baseTitle === null) return NextResponse.json({ name: project.name })

  const verdict = await guardModelCall(userId)
  if (!verdict.allowed) return spendGuardResponse(verdict)

  const name = await generateProjectName(text ?? '', baseTitle || undefined)
  if (!name) return NextResponse.json({ name: project.name })

  const applied = await autoNameProject(id, userId, project.name, name)
  return NextResponse.json({ name: applied ? name : project.name })
}
