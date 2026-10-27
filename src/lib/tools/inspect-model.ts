import { tool, type UIToolInvocation } from 'ai'
import { z } from 'zod'

/** Camera angles the inspection can draw. Named from the viewer's side, in OpenSCAD axes. */
export const INSPECT_VIEWS = ['iso', 'front', 'back', 'left', 'right', 'top', 'bottom'] as const
export type InspectView = (typeof INSPECT_VIEWS)[number]

export const DEFAULT_INSPECT_VIEWS: InspectView[] = ['iso', 'front', 'right', 'top']

type Vec3 = [number, number, number]

/** What the browser reports back after rendering the current source. */
export interface InspectModelOutput {
  /** False when OpenSCAD failed to compile or render the source. */
  ok: boolean
  error?: string
  /** WARNING/ERROR/ECHO lines from the OpenSCAD log, trimmed. */
  messages: string[]
  /** Bounding box of the whole model in OpenSCAD coordinates (mm). */
  bounds?: { min: Vec3; max: Vec3; size: Vec3 }
  /** One entry per distinct face color, largest first. */
  parts?: { color: string; triangles: number; min: Vec3; max: Vec3 }[]
  triangles?: number
  views?: InspectView[]
  /**
   * JPEG data URL: a labeled sheet with one tile per view. Dropped from older
   * turns before the history is sent again, so only the latest look is kept.
   */
  image?: string | null
}

const fmt = (v: Vec3) => `(${v.map((n) => Number(n.toFixed(2))).join(', ')})`

/** The facts the model reads, as plain text next to the picture. */
export function describeInspection(output: InspectModelOutput): string {
  if (!output.ok) {
    return [
      'RENDER FAILED. The current source does not compile or render.',
      output.error ? `Error: ${output.error}` : '',
      output.messages.length ? `OpenSCAD log:\n${output.messages.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
  const lines = ['Rendered successfully.']
  if (output.bounds) {
    lines.push(
      `Bounding box (mm): min ${fmt(output.bounds.min)}, max ${fmt(output.bounds.max)}, size ${fmt(output.bounds.size)}.`,
    )
  }
  if (output.triangles !== undefined) lines.push(`Triangles: ${output.triangles}.`)
  if (output.parts?.length) {
    lines.push('Parts by color:')
    for (const part of output.parts) {
      lines.push(`- ${part.color}: ${part.triangles} triangles, min ${fmt(part.min)}, max ${fmt(part.max)}`)
    }
  }
  if (output.messages.length) lines.push(`OpenSCAD log:\n${output.messages.join('\n')}`)
  if (output.image && output.views?.length) {
    lines.push(
      `The image shows the views ${output.views.join(', ')} (labeled in each tile). ` +
        'Grid lines lie on the plane z = bottom of the model.',
    )
  } else if (output.image === null) {
    lines.push('(The picture from this inspection is no longer kept.)')
  }
  return lines.join('\n')
}

/**
 * Render the current source in the user's browser and look at it. It has no
 * `execute`: the call streams to the browser, which renders the model with
 * OpenSCAD, draws the requested views and sends the result back, and the chat
 * then continues the turn with it.
 */
export const inspectModelTool = tool({
  description:
    "Render the project's current OpenSCAD source and look at the result. Returns whether it compiled, " +
    'OpenSCAD warnings, the bounding box and parts by color in mm, and a picture of the model from the ' +
    'requested angles. Call it only after writeOpenscad has returned.',
  inputSchema: z.object({
    views: z
      .array(z.enum(INSPECT_VIEWS))
      .min(1)
      .max(4)
      .optional()
      .describe(
        `Up to 4 camera angles. Default: ${DEFAULT_INSPECT_VIEWS.join(', ')}. ` +
          'front looks from -Y, right from +X, top from +Z, iso from the front-right-top corner.',
      ),
  }),
  outputSchema: z.custom<InspectModelOutput>(),
  toModelOutput: ({ output }) => {
    const text = { type: 'text' as const, text: describeInspection(output) }
    const match = output.image?.match(/^data:(image\/[a-z]+);base64,(.+)$/)
    if (!match) return { type: 'content', value: [text] }
    return {
      type: 'content',
      value: [text, { type: 'file', mediaType: match[1], data: { type: 'data', data: match[2] } }],
    }
  },
})

export type InspectModelInvocation = UIToolInvocation<typeof inspectModelTool>
