import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'

/**
 * A query builder stand-in: every chained call returns the chain, and awaiting
 * it yields the next queued result for that kind of statement.
 */
function chain(result: () => unknown, record?: (method: string, args: unknown[]) => void) {
  const proxy: object = new Proxy(
    {},
    {
      get(_target, method) {
        if (method === 'then') {
          return (resolve: (value: unknown) => void) => resolve(result())
        }
        return (...args: unknown[]) => {
          record?.(String(method), args)
          return proxy
        }
      },
    },
  )
  return proxy
}

const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  inserted: [] as unknown[],
  deleted: 0,
}))

function nextSelect() {
  return state.selects.shift() ?? []
}

vi.mock('./index', () => {
  const tx = {
    select: () => chain(nextSelect),
    insert: () =>
      chain(
        () => undefined,
        (method, args) => {
          if (method === 'values') state.inserted.push(...(args[0] as unknown[]))
        },
      ),
    delete: () => {
      state.deleted++
      return chain(() => undefined)
    },
    update: () => chain(() => undefined),
  }
  return {
    db: {
      ...tx,
      transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  }
})

import { getProjectMessages, saveChat } from './queries'

const user: UIMessage = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'a cube' }] }
const emptyReply: UIMessage = { id: 'a1', role: 'assistant', parts: [] }
const reply: UIMessage = { id: 'a2', role: 'assistant', parts: [{ type: 'text', text: 'Done.' }] }
const user2: UIMessage = { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'taller' }] }

beforeEach(() => {
  state.selects = []
  state.inserted = []
  state.deleted = 0
})

describe('saveChat', () => {
  it('never persists an assistant message with no parts', async () => {
    // The project row (locked), then the stored history.
    state.selects = [[{ name: 'Cube' }], []]
    await saveChat({ projectId: 'p1', uiMessages: [user, emptyReply], code: null })
    expect(state.inserted).toEqual([expect.objectContaining({ id: 'u1', role: 'user' })])
  })

  it('rewrites a poisoned history without its empty reply', async () => {
    // Stored before the fix: the user's message and the empty failed reply.
    state.selects = [[{ name: 'Cube' }], [{ id: 'u1' }, { id: 'a1' }]]
    await saveChat({ projectId: 'p1', uiMessages: [user, user2, reply], code: null })
    expect(state.deleted).toBe(1)
    expect(state.inserted.map((m) => (m as { id: string }).id)).toEqual(['u1', 'u2', 'a2'])
  })
})

describe('getProjectMessages', () => {
  it('skips stored messages with no parts so the next turn validates', async () => {
    state.selects = [
      [user, emptyReply, user2, reply].map((m, i) => ({
        seq: i,
        id: m.id,
        projectId: 'p1',
        role: m.role,
        parts: m.parts,
        metadata: null,
        createdAt: new Date(),
      })),
    ]
    const loaded = await getProjectMessages('p1')
    expect(loaded.map((m) => m.id)).toEqual(['u1', 'u2', 'a2'])
  })
})
