/**
 * True for a message whose `parts` is an empty array.
 *
 * A model call that fails before producing anything (OpenRouter out of
 * credits, a provider outage) still ends the turn with an assistant message,
 * just one with `parts: []`. The AI SDK rejects such a message when it is sent
 * back as history ("Message must contain at least one part"), so a single
 * failed turn used to break every later turn in that project.
 */
export function isEmptyMessage(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) return false
  const parts = (message as { parts?: unknown }).parts
  return Array.isArray(parts) && parts.length === 0
}

/**
 * Drop messages with no parts. Applied when history is saved, loaded and
 * received from the browser, so an empty reply is never persisted and the
 * projects already holding one recover on their next turn.
 */
export function withoutEmptyMessages<T>(messages: T[]): T[] {
  return messages.some(isEmptyMessage) ? messages.filter((m) => !isEmptyMessage(m)) : messages
}

type LooseMessage = { parts?: unknown }
type LoosePart = { type?: unknown; state?: unknown; output?: unknown }

/** Rewrite the inspectModel parts of every message but the last; other messages pass through unchanged. */
function mapEarlierInspections<T>(messages: T[], map: (part: LoosePart) => LoosePart | null): T[] {
  let changed = false
  const out = messages.map((message, i) => {
    const parts = (message as LooseMessage | null)?.parts
    if (i === messages.length - 1 || !Array.isArray(parts)) return message
    let partsChanged = false
    const next = parts.map((part: LoosePart) => {
      if (part?.type !== 'tool-inspectModel') return part
      const mapped = map(part)
      if (!mapped) return part
      partsChanged = true
      return mapped
    })
    if (!partsChanged) return message
    changed = true
    return { ...message, parts: next }
  })
  return changed ? out : messages
}

/**
 * An inspection runs in the browser, so a tab closed mid-turn leaves its call
 * with no result, and the model API rejects a tool call without one. Once a
 * later message exists that call can never finish, so close it as an error.
 */
export function settleInterruptedInspections<T>(messages: T[]): T[] {
  return mapEarlierInspections(messages, (part) =>
    part.state === 'input-streaming' || part.state === 'input-available'
      ? {
          ...part,
          state: 'output-error',
          errorText: 'The inspection was interrupted before it finished.',
        }
      : null,
  )
}

/**
 * Inspection pictures are only useful to the turn that took them, and the
 * whole history is re-sent and saved every turn. Keep the facts, drop the
 * picture, everywhere but the latest message.
 */
export function withoutOldInspectionImages<T>(messages: T[]): T[] {
  return mapEarlierInspections(messages, (part) => {
    const output = part.output as { image?: unknown } | undefined
    return part.state === 'output-available' && typeof output?.image === 'string'
      ? { ...part, output: { ...output, image: null } }
      : null
  })
}
