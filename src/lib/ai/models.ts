import { anthropic, type AnthropicLanguageModelOptions } from '@ai-sdk/anthropic'

/**
 * Every model call in the studio goes straight to the Claude API.
 *
 * The key is read from ANTHROPIC_API_KEY lazily, per request, by the provider
 * itself — importing this module with no key configured is safe, and a missing
 * key surfaces as an error on the first model call rather than at boot.
 */

/** The model behind every call unless an env var says otherwise. */
const DEFAULT_MODEL = 'claude-opus-5-5'

type Effort = NonNullable<AnthropicLanguageModelOptions['effort']>
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

/**
 * Resolve a model override. Only Claude API ids are accepted: a deployment
 * still carrying an OpenRouter-style id ("openai/gpt-…") from before the
 * switch would otherwise fail every request, so it falls back to the default.
 */
function modelId(override: string | undefined): string {
  const id = override?.trim()
  if (!id) return DEFAULT_MODEL
  if (id.startsWith('claude-')) return id
  console.warn(`[models] ignoring non-Claude model id "${id}", using ${DEFAULT_MODEL}`)
  return DEFAULT_MODEL
}

function effortFrom(value: string | undefined, fallback: Effort): Effort {
  const effort = value?.trim() as Effort | undefined
  return effort && EFFORTS.includes(effort) ? effort : fallback
}

/**
 * The modeling agent's model — needs tool calling and image input (users
 * attach reference photos and sketches). Override with STUDIO_MODEL.
 */
export function studioModel() {
  return anthropic(modelId(process.env.STUDIO_MODEL))
}

/**
 * Request options for the modeling agent.
 *
 * - effort: Opus 5.5 always thinks, so effort is the cost and latency control.
 *   `medium` is the API default; it is set explicitly so the behaviour does not
 *   move if that default does. Override with STUDIO_EFFORT.
 * - blockBinding: Opus 5.5 ties each thinking block to everything sent before
 *   it and rejects the request if that prefix changed. Ours changes by design:
 *   the live editor source is part of the instructions, and old inspection
 *   pictures are stripped from history. `drop_block` has the API discard the
 *   thinking it can no longer verify instead of failing the turn.
 * - fallbacks: if a safety classifier declines a request, the API retries it
 *   on Anthropic's recommended fallback model within the same call.
 */
export function studioModelOptions() {
  return {
    anthropic: {
      effort: effortFrom(process.env.STUDIO_EFFORT, 'medium'),
      thinking: { type: 'adaptive', blockBinding: { prefixMismatchBehavior: 'drop_block' } },
      fallbacks: 'default',
    } satisfies AnthropicLanguageModelOptions,
  }
}

/** The project-naming model — one short line of text. Override with NAMING_MODEL. */
export function namingModel() {
  return anthropic(modelId(process.env.NAMING_MODEL))
}

/**
 * The starter-metadata model. It defaults to the naming model because both are
 * short, structured tasks. Override with STARTER_DRAFT_MODEL.
 */
export function starterDraftModel() {
  return anthropic(modelId(process.env.STARTER_DRAFT_MODEL ?? process.env.NAMING_MODEL))
}

/** Naming and starter drafts are short, simple tasks: think as little as possible. */
export const shortTaskOptions = {
  anthropic: { effort: 'low' } satisfies AnthropicLanguageModelOptions,
}
