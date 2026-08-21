import { generateText } from 'ai'
import { namingModel } from '../ai/openrouter'

const SYSTEM = `You name projects in a 3D modeling studio where users describe parts and the AI writes OpenSCAD code.

Given the user's first request, reply with a short project name and NOTHING else.
- 2-5 words, Title Case, no quotes, no trailing punctuation.
- Name the object being built, not the action: "Hexagonal Phone Stand", not "Make Me A Stand".
- Keep a distinguishing detail if the request has one ("Ring Doorbell 30° Wedge"), but never restate the whole prompt.
- If the request is too vague to name an object, answer: Untitled Design`

/**
 * Infer a project name from the user's first message. Best-effort: returns
 * null if the message is empty or the model call fails, so callers can fall
 * back to whatever name they already have.
 */
export async function generateProjectName(firstMessage: string): Promise<string | null> {
  const prompt = firstMessage.trim().slice(0, 2000)
  if (!prompt) return null

  try {
    const { text } = await generateText({
      // Naming is a one-liner: use the cheapest fast model, overridable.
      model: namingModel(),
      system: SYSTEM,
      prompt,
    })
    return cleanName(text)
  } catch (error) {
    // A missing name is cosmetic — never fail the user's turn over it.
    console.error('[name-project]', error)
    return null
  }
}

/** Strip the model's stray quotes/markdown/punctuation and clamp the length. */
function cleanName(raw: string): string | null {
  const line = raw.split('\n').find((l) => l.trim()) ?? ''
  const cleaned = line
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'`*#-]+/, '')
    .replace(/[\s"'`*.]+$/, '')
    .trim()
  if (!cleaned) return null
  return cleaned.length > 60 ? `${cleaned.slice(0, 60).trimEnd()}…` : cleaned
}
