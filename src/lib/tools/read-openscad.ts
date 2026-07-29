import { tool, type UIToolInvocation } from 'ai'
import { z } from 'zod'

/**
 * Read the project's current OpenSCAD source. Created per request over a
 * shared source box so it always reflects the latest state: the live editor
 * content (including manual user edits) at the start of the turn, plus any
 * writeOpenscad calls the agent made earlier in this same turn.
 */
export function createReadOpenscadTool(source: { code: string }) {
  return tool({
    description:
      'Read the current OpenSCAD source of the project. This is the live editor content — ' +
      'the user may have edited the code by hand since you last wrote it, so read before ' +
      'modifying if there is any chance your memory of the code is stale.',
    inputSchema: z.object({}),
    execute: async () => ({ code: source.code }),
  })
}

export type ReadOpenscadInvocation = UIToolInvocation<ReturnType<typeof createReadOpenscadTool>>
