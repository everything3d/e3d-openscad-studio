'use client'

import { MessageResponse } from '@/components/ai-elements/message'
import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool'
import { CodeBlock } from '@/components/ai-elements/code-block'
import type { StudioUIMessage } from '@/lib/agents/studio-agent'

/** One chat message's parts, drawn the same in the studio and the staff desk. */
export function MessageParts({ message }: { message: StudioUIMessage }) {
  return message.parts.map((part, i) => {
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
      case 'tool-readOpenscad':
        return (
          <Tool key={part.toolCallId} className="my-0">
            <ToolHeader type={part.type} state={part.state} title="Read model code" />
            <ToolContent>
              <div className="p-3 text-xs text-muted-foreground">
                {part.state === 'output-available'
                  ? 'Read the current OpenSCAD source.'
                  : 'Reading the current OpenSCAD source…'}
              </div>
            </ToolContent>
          </Tool>
        )
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
  })
}
