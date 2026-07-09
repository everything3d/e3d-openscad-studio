export type Role = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: Role
  /** Full text content of the message (may include markdown / code fences). */
  content: string
  /** OpenSCAD code that this assistant message produced, if any. */
  code?: string
  createdAt: number
}

/**
 * A Project *is* a chat. Everything the user makes lives inside one: the
 * conversation history and the current OpenSCAD source. Forking clones a
 * project into a new one that remembers its ancestor.
 */
export interface Project {
  id: string
  name: string
  messages: ChatMessage[]
  /** The latest OpenSCAD source for this project. */
  code: string
  forkedFrom?: string
  createdAt: number
  updatedAt: number
}

export interface Settings {
  /** OpenAI-compatible base URL, e.g. https://api.openai.com/v1 */
  baseUrl: string
  apiKey: string
  model: string
}
