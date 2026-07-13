import { tool, type UIToolInvocation } from 'ai'
import { z } from 'zod'

/**
 * The agent's single typed tool: replace the project's OpenSCAD source.
 * The client applies `input.code` to the editor and re-renders the preview;
 * the server persists it as the project's code when the turn finishes.
 */
export const writeOpenscadTool = tool({
  description:
    'Replace the OpenSCAD source of the current project with a complete, self-contained program. ' +
    'Always send the ENTIRE program, never a fragment or a diff — the code is rendered directly.',
  inputSchema: z.object({
    code: z.string().describe('The complete OpenSCAD program for the current model'),
  }),
  execute: async ({ code }) => ({
    ok: true as const,
    lines: code.split('\n').length,
  }),
})

export type WriteOpenscadInvocation = UIToolInvocation<typeof writeOpenscadTool>
