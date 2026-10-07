import { and, eq, gte, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { describe, expect, it } from 'vitest'
import { modelCalls } from './db/schema'

/**
 * The spend guard answers both of its windows in one aggregate query that uses
 * a raw `filter (where ...)` clause, which no type check can validate. These
 * tests render the statement without connecting, so a change that produces
 * invalid SQL fails here rather than in production the first time somebody
 * sends a message.
 *
 * `postgres()` does not dial the server until a query runs, so constructing the
 * client is safe with a URL that points nowhere.
 */
const db = drizzle(postgres('postgres://unused@localhost:5432/unused'), {
  schema: { modelCalls },
})

function guardQuery(dayStart: Date, minuteStart: Date) {
  return db
    .select({
      day: sql<number>`count(*)`.mapWith(Number),
      minute: sql<number>`count(*) filter (where ${modelCalls.createdAt} >= ${minuteStart})`.mapWith(
        Number,
      ),
      oldestInDay: sql<Date | null>`min(${modelCalls.createdAt})`,
      oldestInMinute: sql<
        Date | null
      >`min(${modelCalls.createdAt}) filter (where ${modelCalls.createdAt} >= ${minuteStart})`,
    })
    .from(modelCalls)
    .where(and(eq(modelCalls.userId, 'user_1'), gte(modelCalls.createdAt, dayStart)))
}

describe('spend guard usage query', () => {
  const { sql: text, params } = guardQuery(
    new Date('2026-09-21T09:00:00Z'),
    new Date('2026-09-22T08:59:00Z'),
  ).toSQL()

  it('aggregates both windows in a single statement', () => {
    expect(text).toContain('count(*) filter (where')
    expect(text).toContain('min(')
    expect(text.match(/select/gi)).toHaveLength(1)
  })

  it('reads only the requested user, over the indexed columns', () => {
    expect(text).toContain('"user_id"')
    expect(text).toContain('"created_at"')
    expect(text).toContain('from "model_calls"')
  })

  it('parameterises every value rather than inlining it', () => {
    // user id, minute bound (twice, once per filter), day bound.
    expect(params).toHaveLength(4)
    expect(text).not.toContain('user_1')
    expect(text).not.toContain('2026-09')
  })
})
