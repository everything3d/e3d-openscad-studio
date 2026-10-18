import {
  consumeStream,
  createAgentUIStreamResponse,
  generateId,
  validateUIMessages,
  type UIMessage,
} from 'ai'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createStudioAgent, studioTools, type StudioUIMessage } from '@/lib/agents/studio-agent'
import { guardModelCall, spendGuardTextResponse } from '@/lib/spend-guard'
import { getProjectForChat, saveChat } from '@/lib/db/queries'

// The chat panel's catch-up deadline (TURN_DEADLINE_MS) is derived from this.
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
  // Validating the history does not touch the database, so it overlaps the
  // project lookup instead of waiting behind it.
  const validated = validateUIMessages<StudioUIMessage>({ messages: rawMessages, tools: studioTools })
  validated.catch(() => {}) // surfaced below; this only avoids an unhandled rejection

  const project = await getProjectForChat(projectId, userId)
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Checked after ownership so a probe against someone else's project id
  // cannot spend the caller's budget.
  const verdict = await guardModelCall(userId)
  if (!verdict.allowed) return spendGuardTextResponse(verdict)

  const uiMessages = await validated

  // Prefer the live editor content over the DB row: manual edits are only
  // persisted after a debounce, so the row can be stale at send time.
  const currentCode = typeof liveCode === 'string' ? liveCode : project.code

  const agent = createStudioAgent(currentCode, project.fileNames, project.modificationGuide)

  return createAgentUIStreamResponse({
    agent,
    uiMessages,
    originalMessages: uiMessages,
    // Without this the streamed assistant message has an empty id, which
    // breaks React keys and message identity once persisted.
    generateMessageId: generateId,
    // Phones suspend background tabs, which drops this response mid-turn.
    // Without a second reader that disconnect cancels the agent and persists
    // a half-finished reply. Draining a copy keeps the turn running to the end
    // so onFinish saves all of it, and the client catches up from the project
    // when it comes back. `after` keeps the function alive for it (up to
    // maxDuration).
    consumeSseStream: ({ stream }) => {
      const drained = consumeStream({ stream })
      after(() => drained)
    },
    // Provider errors can carry account, key and model detail, so the browser
    // gets a fixed sentence and the real error goes to the server log where
    // operators can find it.
    onError: (error) => {
      console.error('[chat] agent stream failed', error)
      return 'The AI service could not complete that request. Please try again.'
    },
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
