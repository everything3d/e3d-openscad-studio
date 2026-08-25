import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { generateStarterDraft } from '@/lib/agents/starter-draft'
import { getProject, getProjectMessages } from '@/lib/db/queries'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const project = await getProject(id, userId)
  if (!project) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const messages = await getProjectMessages(id)
  return NextResponse.json(
    await generateStarterDraft({
      name: project.name,
      code: project.code,
      fileNames: project.files.map((file) => file.name),
      messages,
    }),
  )
}
