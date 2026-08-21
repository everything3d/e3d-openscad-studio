import { createOpenRouter } from '@openrouter/ai-sdk-provider'

/**
 * The OpenRouter client behind every model call in the studio.
 *
 * The key is read from OPENROUTER_API_KEY lazily, per request, by the provider
 * itself — importing this module with no key configured is safe, and a missing
 * key surfaces as an error on the first model call rather than at boot.
 * `appName`/`appUrl` set the attribution headers OpenRouter uses to group usage
 * by app on its dashboard.
 */
const openrouter = createOpenRouter({
  appName: 'E3D OpenSCAD Studio',
  appUrl: process.env.OPENROUTER_APP_URL ?? 'https://github.com/everything3d/e3d-openscad-studio',
  // We talk to OpenRouter itself, not an OpenAI-compatible third party.
  compatibility: 'strict',
})

/** Parse a comma-separated model list from an env var. */
function parseModelList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

/**
 * Build a chat model, optionally with OpenRouter's server-side routing chain:
 * given more than one id, OpenRouter tries them in order within the SAME
 * request, falling through when one is unknown, rate-limited, or its upstream
 * provider is down. Cheap insurance against a model id going away.
 */
function chatModel(primary: string, fallbacks: string[]) {
  return openrouter.chat(primary, fallbacks.length ? { models: [primary, ...fallbacks] } : {})
}

/**
 * The modeling agent's model — needs tool calling and image input (users
 * attach reference photos and sketches). Override with STUDIO_MODEL, and set
 * STUDIO_MODEL_FALLBACKS to a comma-separated list for a routing chain.
 */
export function studioModel() {
  return chatModel(
    process.env.STUDIO_MODEL ?? 'openai/gpt-5.6-terra',
    parseModelList(process.env.STUDIO_MODEL_FALLBACKS),
  )
}

/**
 * The project-naming model — one short line of text, so the cheapest fast
 * model wins. Override with NAMING_MODEL / NAMING_MODEL_FALLBACKS.
 */
export function namingModel() {
  return chatModel(
    process.env.NAMING_MODEL ?? 'openai/gpt-5.4-nano',
    parseModelList(process.env.NAMING_MODEL_FALLBACKS),
  )
}
