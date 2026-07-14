'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { BoxIcon, ImagePlusIcon } from 'lucide-react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
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
import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool'
import { CodeBlock } from '@/components/ai-elements/code-block'
import type { StudioUIMessage } from '@/lib/agents/studio-agent'

interface Props {
  projectId: string
  initialMessages: StudioUIMessage[]
  /** Called when the agent produces a new complete OpenSCAD program. */
  onCode: (code: string) => void
  /** Called after a chat turn finishes (server has persisted everything). */
  onTurnFinish: () => void
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

export function ChatPanel({ projectId, initialMessages, onCode, onTurnFinish }: Props) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { projectId },
      }),
    [projectId],
  )

  const { messages, sendMessage, status, error } = useChat<StudioUIMessage>({
    id: projectId,
    messages: initialMessages,
    transport,
    onFinish: onTurnFinish,
  })

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

  const [attachError, setAttachError] = useState<string | null>(null)
  useEffect(() => {
    if (!attachError) return
    const t = setTimeout(() => setAttachError(null), 4000)
    return () => clearTimeout(t)
  }, [attachError])

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim()
    if ((!text && message.files.length === 0) || status === 'streaming' || status === 'submitted')
      return
    // Shrink attached images before sending: the full history (including
    // these data URLs) is re-sent every turn and persisted to the DB.
    const files = await Promise.all(
      message.files.map(async (file) => ({
        ...file,
        ...(await downscaleImageDataUrl(file.url, file.mediaType)),
      })),
    )
    void sendMessage(text ? { text, files } : { files })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<BoxIcon className="size-8" />}
              title="Describe what you want to build"
              description='The AI writes the OpenSCAD code and it renders live on the right. Try "a hexagonal phone stand", or attach photos or sketches of a part to recreate.'
            />
          )}
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return <MessageResponse key={i}>{part.text}</MessageResponse>
                    case 'file':
                      return part.mediaType?.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={part.url}
                          alt={part.filename ?? 'Attached image'}
                          className="max-h-48 max-w-full rounded-md border object-contain"
                        />
                      ) : null
                    case 'tool-searchFonts':
                      return (
                        <Tool key={part.toolCallId} className="my-0">
                          <ToolHeader type={part.type} state={part.state} title="Search fonts" />
                          <ToolContent>
                            <div className="p-3 text-xs text-muted-foreground">
                              {part.state === 'output-available'
                                ? `${part.output.total} matching font${part.output.total === 1 ? '' : 's'}: ${part.output.fonts.slice(0, 8).join(', ')}${part.output.total > 8 ? ', …' : ''}`
                                : 'Searching the font catalog…'}
                            </div>
                          </ToolContent>
                        </Tool>
                      )
                    case 'tool-writeOpenscad':
                      return (
                        <Tool key={part.toolCallId} className="my-0">
                          <ToolHeader
                            type={part.type}
                            state={part.state}
                            title="Update model code"
                          />
                          <ToolContent>
                            {part.state === 'input-available' ||
                            part.state === 'output-available' ? (
                              <CodeBlock code={part.input.code} language="openscad" />
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                Writing OpenSCAD…
                              </div>
                            )}
                          </ToolContent>
                        </Tool>
                      )
                    default:
                      return null
                  }
                })}
              </MessageContent>
            </Message>
          ))}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message}
            </div>
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
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
        {attachError && (
          <p className="mt-1.5 text-xs text-destructive">{attachError}</p>
        )}
      </div>
    </div>
  )
}
