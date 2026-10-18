import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('./db', () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    delete: mocks.delete,
  },
}))

import type { SQL } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './db/schema'
import { guardModelCall, spendGuardMessage, spendGuardTextResponse } from './spend-guard'

/** The real postgres-js dialect, never connected: it only compiles queries. */
const compiler = drizzle.mock({ schema })

/** Stand in for the single aggregate row the guard reads. */
function counts(row: {
  day: number
  minute: number
  oldestInDay?: Date | null
  oldestInMinute?: Date | null
}) {
  mocks.select.mockReturnValue({
    from: () => ({
      where: () =>
        Promise.resolve([
          {
            day: row.day,
            minute: row.minute,
            oldestInDay: row.oldestInDay ?? null,
            oldestInMinute: row.oldestInMinute ?? null,
          },
        ]),
    }),
  })
}

describe('guardModelCall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.MODEL_CALLS_PER_DAY
    delete process.env.MODEL_CALLS_PER_MINUTE
    mocks.insert.mockReturnValue({ values: () => Promise.resolve() })
    mocks.delete.mockReturnValue({ where: () => Promise.resolve() })
  })

  afterEach(() => {
    delete process.env.MODEL_CALLS_PER_DAY
    delete process.env.MODEL_CALLS_PER_MINUTE
  })

  it('allows and records an ordinary call', async () => {
    counts({ day: 12, minute: 1 })
    const verdict = await guardModelCall('user_1')
    expect(verdict.allowed).toBe(true)
    expect(mocks.insert).toHaveBeenCalledOnce()
  })

  it('leaves a heavy but human day well under the limit', async () => {
    counts({ day: 180, minute: 3 })
    expect((await guardModelCall('user_1')).allowed).toBe(true)
  })

  it('stops a burst and does not record the rejected call', async () => {
    const oldest = new Date(Date.now() - 30_000)
    counts({ day: 40, minute: 20, oldestInMinute: oldest })
    const verdict = await guardModelCall('user_1')
    expect(verdict.allowed).toBe(false)
    expect(verdict.window).toBe('minute')
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0)
    expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(60)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('stops a sustained day and reports when the window frees up', async () => {
    const oldest = new Date(Date.now() - 60 * 60 * 1000)
    counts({ day: 500, minute: 2, oldestInDay: oldest })
    const verdict = await guardModelCall('user_1')
    expect(verdict.allowed).toBe(false)
    expect(verdict.window).toBe('day')
    // 23 hours until the oldest call ages out of a 24 hour window.
    expect(verdict.retryAfterSeconds).toBeCloseTo(23 * 60 * 60, -2)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('honours raised limits from the environment', async () => {
    process.env.MODEL_CALLS_PER_DAY = '5000'
    counts({ day: 900, minute: 2 })
    expect((await guardModelCall('user_1')).allowed).toBe(true)
  })

  it('treats a zero limit as disabled', async () => {
    process.env.MODEL_CALLS_PER_DAY = '0'
    process.env.MODEL_CALLS_PER_MINUTE = '0'
    const verdict = await guardModelCall('user_1')
    expect(verdict.allowed).toBe(true)
    // Disabled entirely: nothing is read or written.
    expect(mocks.select).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('ignores a malformed limit and keeps the default', async () => {
    process.env.MODEL_CALLS_PER_DAY = 'not-a-number'
    counts({ day: 500, minute: 1, oldestInDay: new Date() })
    expect((await guardModelCall('user_1')).allowed).toBe(false)
  })

  it('binds no raw Date that postgres-js would refuse to send', async () => {
    // Drizzle replaces postgres-js's timestamp serialiser with a pass-through,
    // so a Date bound outside a column comparison throws ERR_INVALID_ARG_TYPE
    // before the query leaves the process. The guard then fails open on every
    // call and records nothing, which mocked rows alone cannot reveal.
    const compiled: { sql: string; params: unknown[] }[] = []
    mocks.select.mockImplementation((fields) => ({
      from: (table: typeof schema.modelCalls) => ({
        where: (condition: SQL) => {
          compiled.push(compiler.select(fields).from(table).where(condition).toSQL())
          return Promise.resolve([{ day: 50, minute: 1, oldestInDay: null, oldestInMinute: null }])
        },
      }),
    }))
    mocks.delete.mockImplementation((table: typeof schema.modelCalls) => ({
      where: (condition: SQL) => {
        compiled.push(compiler.delete(table).where(condition).toSQL())
        return Promise.resolve()
      },
    }))

    const error = vi.spyOn(console, 'error')
    expect((await guardModelCall('user_1')).allowed).toBe(true)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()

    // The usage read and the prune (day is a multiple of 50) both compiled.
    expect(compiled).toHaveLength(2)
    for (const query of compiled) {
      expect(query.params.filter((param) => param instanceof Date)).toEqual([])
    }
    expect(mocks.insert).toHaveBeenCalledOnce()
  })

  it('fails open when the counter table is unreachable', async () => {
    mocks.select.mockImplementation(() => {
      throw new Error('connection refused')
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await guardModelCall('user_1')).allowed).toBe(true)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('spendGuardTextResponse', () => {
  it('sends the message as plain text with Retry-After', async () => {
    const verdict = { allowed: false, retryAfterSeconds: 42, window: 'minute' as const }
    const response = spendGuardTextResponse(verdict)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(response.headers.get('Content-Type')).toContain('text/plain')
    // The AI SDK shows a failed response's body verbatim, so the body must
    // already be the sentence the user should read.
    expect(await response.text()).toBe(spendGuardMessage(verdict))
  })
})
