'use client'

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { BoxIcon, ImagePlusIcon } from 'lucide-react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { downscaleImageDataUrl } from '@/lib/images'
import { trackEvent } from '@/lib/analytics'
import { isEmptyMessage, withoutEmptyMessages } from '@/lib/chat-history'
import { MessageParts } from '@/components/studio/message-parts'
import { Spinner } from '@/components/ui/spinner'
import type { StudioUIMessage } from '@/lib/agents/studio-agent'

/**
 * How long after sending a turn its reply can still be saved. The chat route
 * keeps the agent running when the browser drops the stream, for at most its
 * maxDuration (120 s); the slack covers the final save.
 */
const TURN_DEADLINE_MS = 120_000 + 15_000
/** How often to re-read the project while catching up on a dropped turn. */
const CATCH_UP_POLL_MS = 3_000

/**
 * fetch reports a dropped or refused connection as a TypeError (Safari words
 * it "The network connection was lost." or "Load failed"). Errors our server
 * sends, HTTP failures and the agent's error chunk, arrive as plain Errors.
 */
function isConnectionError(error: Error): boolean {
  return error instanceof TypeError || error.name === 'NetworkError'
}

/** The turn being caught up on, or 'failed' once it is clear it was never saved. */
type CatchUp = { userMessageId: string; deadline: number } | 'failed' | null

interface Props {
  projectId: string
  /** The live editor content, sent with each message so the agent never works from stale code. */
  code: string
  initialMessages: StudioUIMessage[]
  /** Called when the agent produces a new complete OpenSCAD program. */
  onCode: (code: string) => void
  /** Called after a chat turn finishes (server has persisted everything). */
  onTurnFinish: () => void
  /** Called with the text of the very first message sent in this project. */
  onFirstMessage: (text: string) => void
}

/** The latest writeOpenscad call whose input has fully arrived. */
function latestWrite(
  messages: StudioUIMessage[],
): { toolCallId: string; code: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i].parts
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j]
      if (
        part.type === 'tool-writeOpenscad' &&
        (part.state === 'input-available' || part.state === 'output-available')
      ) {
        return { toolCallId: part.toolCallId, code: part.input.code }
      }
    }
  }
  return null
}

/** Opens the composer's file picker. Must render inside PromptInput. */
function AttachImagesButton() {
  const attachments = usePromptInputAttachments()
  return (
    <PromptInputButton
      tooltip="Attach images (or paste / drop)"
      aria-label="Attach images"
      onClick={() => attachments.openFileDialog()}
    >
      <ImagePlusIcon className="size-4" />
    </PromptInputButton>
  )
}

/**
 * A failed request reaches us as its raw response body, which is JSON for most
 * of our API routes. Unwrap it so the user reads the sentence rather than the
 * envelope, and fall back to a neutral line for anything unrecognisable —
 * network failures and framework errors are not written for end users.
 */
function errorText(error: Error): string {
  const raw = error.message?.trim()
  if (!raw) return 'Something went wrong. Please try again.'
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown }
      if (typeof parsed.error === 'string' && parsed.error) return parsed.error
    } catch {
      // Not the JSON we expected; fall through to the raw text.
    }
  }
  return raw
}

export function ChatPanel({
  projectId,
  code,
  initialMessages,
  onCode,
  onTurnFinish,
  onFirstMessage,
}: Props) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { projectId },
      }),
    [projectId],
  )

  /**
   * The turn in flight: when it was sent, whether its reply started arriving,
   * and whether the page was backgrounded while it ran. Together they tell a
   * connection that dropped mid-turn from a request that never got through.
   */
  const turn = useRef<{ sentAt: number; streamed: boolean; hidden: boolean } | null>(null)
  const [catchUp, setCatchUp] = useState<CatchUp>(null)
  const catchingUp = catchUp !== null && catchUp !== 'failed'

  const { messages, setMessages, sendMessage, status, error, clearError } =
    useChat<StudioUIMessage>({
      id: projectId,
      messages: initialMessages,
      transport,
      onFinish: ({ isError }) => {
        if (!isError) turn.current = null
        onTurnFinish()
      },
      // Coalesce streamed deltas: without this every token re-renders the whole
      // message list, which makes typing in the editor stutter while the agent writes.
      throttle: 50,
    })

  useEffect(() => {
    if (status === 'streaming' && turn.current) turn.current.streamed = true
  }, [status])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && turn.current) turn.current.hidden = true
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Phones suspend background tabs, which drops the stream mid-turn. The
  // server keeps the turn running and saves it, so once the request is known
  // to have reached it (the reply had started, or the page was backgrounded
  // while waiting) catch up from the saved project instead of failing.
  useEffect(() => {
    const dropped = turn.current
    if (status !== 'error' || !error || !dropped) return
    turn.current = null
    const userMessage = messages.findLast((m) => m.role === 'user')
    if (isConnectionError(error) && (dropped.streamed || dropped.hidden) && userMessage) {
      setCatchUp({ userMessageId: userMessage.id, deadline: dropped.sentAt + TURN_DEADLINE_MS })
    }
  }, [status, error, messages])

  const finishCatchUp = useEffectEvent((saved: StudioUIMessage[]) => {
    setMessages(saved)
    clearError()
    setCatchUp(null)
    onTurnFinish()
  })

  useEffect(() => {
    if (!catchUp || catchUp === 'failed') return
    const { userMessageId, deadline } = catchUp
    let cancelled = false
    let inFlight = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const check = async () => {
      // A suspended tab cannot fetch; the visibility listener picks this up again.
      if (cancelled || inFlight || document.visibilityState === 'hidden') return
      inFlight = true
      clearTimeout(timer)
      let reached = false
      try {
        const res = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' })
        reached = true
        if (res.ok) {
          const saved = ((await res.json()) as { messages: StudioUIMessage[] }).messages
          const at = saved.findIndex((m) => m.id === userMessageId)
          // The server saves a turn only once the reply is complete, so the
          // sent message appearing with something after it means it is done.
          if (!cancelled && at !== -1 && at < saved.length - 1) {
            finishCatchUp(saved)
            return
          }
        }
      } catch {
        // Still offline: no answer either way yet, so keep trying.
      } finally {
        inFlight = false
      }
      if (cancelled) return
      // Past the deadline the server can no longer be working on it. Only
      // give up on an actual answer, so a phone that comes back offline waits.
      if (reached && Date.now() > deadline) {
        setCatchUp('failed')
        return
      }
      timer = setTimeout(check, CATCH_UP_POLL_MS)
    }

    const resume = () => void check()
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    resume()
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('online', resume)
    }
  }, [catchUp, projectId])

  // Apply agent-written code to the editor/preview as soon as the tool input
  // has fully streamed in. History that was already applied (anything present
  // at mount) is skipped by seeding the ref with it.
  const appliedCallId = useRef<string | null>(latestWrite(initialMessages)?.toolCallId ?? null)
  useEffect(() => {
    const write = latestWrite(messages)
    if (write && write.toolCallId !== appliedCallId.current) {
      appliedCallId.current = write.toolCallId
      onCode(write.code)
    }
  }, [messages, onCode])

  // A turn that ended without an error but also without any reply (the model
  // returned nothing) would otherwise leave the user staring at silence.
  const last = messages.at(-1)
  const emptyReply = status === 'ready' && last?.role === 'assistant' && isEmptyMessage(last)

  const [attachError, setAttachError] = useState<string | null>(null)
  useEffect(() => {
    if (!attachError) return
    const t = setTimeout(() => setAttachError(null), 4000)
    return () => clearTimeout(t)
  }, [attachError])

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim()
    if (
      (!text && message.files.length === 0) ||
      status === 'streaming' ||
      status === 'submitted' ||
      catchingUp
    )
      return
    // Shrink attached images before sending: the full history (including
    // these data URLs) is re-sent every turn and persisted to the DB.
    const files = await Promise.all(
      message.files.map(async (file) => ({
        ...file,
        ...(await downscaleImageDataUrl(file.url, file.mediaType)),
      })),
    )
    // Opening message: let the parent name the project from it, in parallel
    // with the modeling turn.
    if (messages.length === 0 && text) onFirstMessage(text)
    setCatchUp(null)
    turn.current = {
      sentAt: Date.now(),
      streamed: false,
      hidden: document.visibilityState === 'hidden',
    }
    // Never the text itself: only whether this opens the conversation.
    trackEvent('prompt_sent', { first: messages.length === 0, images: files.length })
    // Ship the live editor content with the request: manual edits are only
    // persisted after a debounce, so the server's copy may be stale.
    void sendMessage(text ? { text, files } : { files }, { body: { code } })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<BoxIcon className="size-8" />}
              title="Describe what you want to build"
              description='The AI writes the OpenSCAD code and it renders live in the preview. Try "a hexagonal phone stand", or attach photos or sketches of a part to recreate.'
            />
          )}
          {/* A failed turn leaves an assistant message with no parts; the error
              below explains it, so do not draw an empty bubble for it. */}
          {withoutEmptyMessages(messages).map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                <MessageParts message={message} />
              </MessageContent>
            </Message>
          ))}
          {catchingUp ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
              <Spinner className="shrink-0" />
              Connection lost. Catching up on the reply…
            </div>
          ) : catchUp === 'failed' ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              The connection dropped before the reply was saved. Please send your message again.
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorText(error)}
            </div>
          ) : (
            emptyReply && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                The AI did not send a reply. Please try again.
              </div>
            )
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3">
        <PromptInput
          onSubmit={handleSubmit}
          accept="image/*"
          multiple
          maxFiles={6}
          maxFileSize={20 * 1024 * 1024}
          onError={(err) => setAttachError(err.message)}
        >
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask the AI to build or change the model…" />
          </PromptInputBody>
          <PromptInputFooter className="justify-between">
            <AttachImagesButton />
            <PromptInputSubmit status={catchingUp ? 'submitted' : status} />
          </PromptInputFooter>
        </PromptInput>
        {attachError && (
          <p className="mt-1.5 text-xs text-destructive">{attachError}</p>
        )}
      </div>
    </div>
  )
}
