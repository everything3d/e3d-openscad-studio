import { generateText } from 'ai'
import { namingModel } from '../ai/openrouter'

const SYSTEM = `You name projects in a 3D modeling studio where users describe parts and the AI writes OpenSCAD code.

Given the user's first request, reply with a short project name and NOTHING else.
- 2-5 words, Title Case, no quotes, no trailing punctuation.
- Name the object being built, not the action: "Hexagonal Phone Stand", not "Make Me A Stand".
- Keep a distinguishing detail if the request has one ("Ring Doorbell 30° Wedge"), but never restate the whole prompt.
- If the request is too vague to name an object, answer: Untitled Design`

const DERIVATIVE_SYSTEM = `You name projects in a 3D modeling studio. The user started from an existing design and their first message says how to customize it.

Reply with a short project name and NOTHING else.
- 2-6 words, no quotes, no trailing punctuation.
- Lead with what makes this copy theirs — the personal text, name, or key change — then the base object: "Dr Himani Sharma Display Base", "Aarav Name Keychain", "Blue 80mm Desk Nameplate".
- Keep names and text the user supplied exactly as written (spelling, honorifics), in Title Case.
- Shorten the base design's title to its core object if it is long.
- If the message carries no distinguishing detail, answer with the base design's title.`

/**
 * Infer a project name from the user's first message. For a derivative, pass
 * the title of the design it was started from so the name can combine the two.
 * Best-effort: returns null if the message is empty or the model call fails, so
 * callers can fall back to whatever name they already have.
 */
export async function generateProjectName(
  firstMessage: string,
  baseTitle?: string,
): Promise<string | null> {
  const message = firstMessage.trim().slice(0, 2000)
  if (!message) return null
  const prompt = baseTitle ? `Base design: ${baseTitle}\n\nUser's message:\n${message}` : message

  try {
    const { text } = await generateText({
      // Naming is a one-liner: use the cheapest fast model, overridable.
      model: namingModel(),
      system: baseTitle ? DERIVATIVE_SYSTEM : SYSTEM,
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
