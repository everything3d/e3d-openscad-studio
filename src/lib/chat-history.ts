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
