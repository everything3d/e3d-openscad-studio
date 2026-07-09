import type { ChatMessage, Settings } from './types'

export const SYSTEM_PROMPT = `You are an expert OpenSCAD engineer embedded in a live 3D modeling studio.
The user describes parts and models in plain language; you write the OpenSCAD code that builds them.

Rules:
- Always reply with the COMPLETE, self-contained OpenSCAD program for the current model, inside a single fenced code block tagged \`scad\`. Never send a partial snippet or a diff — send the whole file every time so it can be rendered directly.
- When the user asks for a change, start from the current code (given to you) and return the full updated program.
- Keep the code clean and parametric: pull key dimensions into named variables at the top.
- Prefer a smooth preview: set a reasonable \`$fn\` (e.g. 48–96) for curved shapes.
- Before the code block, add one or two short sentences explaining what you built or changed. Keep prose brief.
- Do not include any other code block besides the single \`scad\` block.`

/** Extract the last fenced code block (any language tag) from a markdown string. */
export function extractCode(text: string): string | null {
  const fence = /```(?:scad|openscad)?\s*\n([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  let last: string | null = null
  while ((match = fence.exec(text)) !== null) {
    last = match[1]
  }
  return last !== null ? last.trimEnd() : null
}

export interface ChatResult {
  content: string
  code: string | null
}

/**
 * Send the conversation to an OpenAI-compatible chat/completions endpoint.
 * `currentCode` is injected so the model always edits from the latest source.
 */
export async function sendChat(
  settings: Settings,
  history: ChatMessage[],
  currentCode: string,
  signal?: AbortSignal,
): Promise<ChatResult> {
  if (!settings.apiKey) {
    throw new Error('No API key set. Open Settings and add your API key.')
  }
  if (!settings.baseUrl) {
    throw new Error('No API base URL set. Open Settings to configure it.')
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `Current OpenSCAD source for this project:\n\n\`\`\`scad\n${currentCode}\n\`\`\``,
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ]

  const url = settings.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.3,
      stream: false,
    }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `AI request failed (${res.status} ${res.statusText}). ${body.slice(0, 500)}`,
    )
  }

  const data = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  if (!content) {
    throw new Error('AI returned an empty response.')
  }

  return { content, code: extractCode(content) }
}
