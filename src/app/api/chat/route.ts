import { createAgentUIStreamResponse, generateId, validateUIMessages, type UIMessage } from 'ai'
import { auth } from '@clerk/nextjs/server'
import { createStudioAgent, studioTools, type StudioUIMessage } from '@/lib/agents/studio-agent'
import { getProject, saveChat } from '@/lib/db/queries'

export const maxDuration = 120

/** The most recent complete writeOpenscad code in the given messages, if any. */
function latestCode(messages: StudioUIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i].parts
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j]
      if (
        part.type === 'tool-writeOpenscad' &&
        (part.state === 'input-available' || part.state === 'output-available')
      ) {
        return part.input.code
      }
    }
  }
  return null
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages: rawMessages, projectId, code: liveCode } = (await req.json()) as {
    messages: unknown[]
    projectId?: string
    /** The live editor content at send time — fresher than the DB row. */
    code?: string
  }

  if (!projectId) {
    return Response.json({ error: 'projectId is required' }, { status: 400 })
  }
  const project = await getProject(projectId, userId)
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const uiMessages = (await validateUIMessages({
    messages: rawMessages,
    tools: studioTools,
  })) as StudioUIMessage[]

  // Prefer the live editor content over the DB row: manual edits are only
  // persisted after a debounce, so the row can be stale at send time.
  const currentCode = typeof liveCode === 'string' ? liveCode : project.code

  const agent = createStudioAgent(
    currentCode,
    project.files.map((f) => f.name),
  )

  return createAgentUIStreamResponse({
    agent,
    uiMessages,
    originalMessages: uiMessages,
    // Without this the streamed assistant message has an empty id, which
    // breaks React keys and message identity once persisted.
    generateMessageId: generateId,
    // Surface real error messages (e.g. missing OPENROUTER_API_KEY) instead
    // of the SDK's masked default — this app has no secrets in errors.
    onError: (error) => (error instanceof Error ? error.message : String(error)),
    onFinish: async ({ messages }) => {
      await saveChat({
        projectId,
        uiMessages: messages as UIMessage[],
        // Only persist code written THIS turn. Scanning the whole history
        // would resurrect an old writeOpenscad on text-only turns and
        // clobber the user's manual edits.
        code: latestCode(messages.slice(uiMessages.length) as StudioUIMessage[]),
      })
    },
  })
}
