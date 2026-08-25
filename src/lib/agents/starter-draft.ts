import { generateText, type UIMessage } from 'ai'
import { z } from 'zod'
import type { StarterDraft } from '../types'

const draftSchema = z.object({
  title: z.string(),
  description: z.string(),
  modificationGuide: z.string(),
  reusableChanges: z.array(z.string()).max(8),
  customerSpecificRisks: z.array(z.string()).max(8),
})

const SYSTEM = `You distill an AI-assisted OpenSCAD customer workspace into metadata for a reusable starter design.
Return one JSON object and nothing else with these keys: title, description, modificationGuide, reusableChanges, customerSpecificRisks.

Rules:
- Title: 2-6 words naming the reusable design, not the customer.
- Description: 1-3 sentences explaining what the starter makes and when it is useful.
- modificationGuide: concise instructions for a future modeling agent: common modifications, important parameters, invariants, required files, and gotchas.
- reusableChanges: improvements in this workspace that are broadly useful.
- customerSpecificRisks: names, logos, exact order dimensions, one-off geometry, or imported files that should be reviewed before publishing.
- Never claim the design is safe to publish. The human must review it.`

function textHistory(messages: UIMessage[]): string {
  return messages
    .slice(-16)
    .map((message) => {
      const text = message.parts
        .filter((part): part is Extract<(typeof message.parts)[number], { type: 'text' }> =>
          part.type === 'text',
        )
        .map((part) => part.text)
        .join(' ')
        .slice(0, 1_200)
      return text ? `${message.role}: ${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, 12_000)
}

function fallback(name: string): StarterDraft {
  return {
    title: name,
    description: '',
    modificationGuide: '',
    reusableChanges: [],
    customerSpecificRisks: [],
  }
}

export async function generateStarterDraft({
  name,
  code,
  fileNames,
  messages,
}: {
  name: string
  code: string
  fileNames: string[]
  messages: UIMessage[]
}): Promise<StarterDraft> {
  try {
    const { text } = await generateText({
      model:
        process.env.STARTER_DRAFT_MODEL ??
        process.env.NAMING_MODEL ??
        'openai/gpt-5.4-nano',
      system: SYSTEM,
      prompt: `Current workspace name: ${name}\nFiles: ${fileNames.join(', ') || 'none'}\n\nCurrent OpenSCAD:\n${code.slice(0, 30_000)}\n\nRecent conversation:\n${textHistory(messages) || 'none'}`,
    })
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) return fallback(name)
    const parsed = draftSchema.safeParse(JSON.parse(text.slice(start, end + 1)))
    return parsed.success ? parsed.data : fallback(name)
  } catch (error) {
    console.error('[starter-draft]', error)
    return fallback(name)
  }
}
