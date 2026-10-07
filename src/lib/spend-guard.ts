import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from './db'
import { modelCalls } from './db/schema'

/**
 * A spend guard, not a usage quota.
 *
 * Every model-calling route bills the OpenRouter account, so an open sign-up
 * means any account can in principle run the agent in a loop until the card
 * behind that key is empty. These limits exist only to stop that. They are
 * deliberately far above anything a person can reach by using the studio hard
 * all day: a heavy human session is tens of turns, and each one takes seconds
 * of model time plus however long it takes to read the result and decide what
 * to say next.
 *
 * Both windows are rolling rather than calendar-aligned, so there is no
 * midnight cliff and no fixed instant for a script to synchronise against.
 */

/** Rolling-day ceiling. Orders of magnitude above real use; catches a runaway loop. */
const DEFAULT_CALLS_PER_DAY = 500

/**
 * Rolling-minute ceiling. A person cannot read a render and reply twenty times
 * in a minute, so crossing this means something automated is driving the API.
 */
const DEFAULT_CALLS_PER_MINUTE = 20

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

/** Read a positive integer limit from the environment; 0 disables that window. */
function limitFrom(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function dailyLimit(): number {
  return limitFrom(process.env.MODEL_CALLS_PER_DAY, DEFAULT_CALLS_PER_DAY)
}

function burstLimit(): number {
  return limitFrom(process.env.MODEL_CALLS_PER_MINUTE, DEFAULT_CALLS_PER_MINUTE)
}

export interface SpendGuardVerdict {
  allowed: boolean
  /** Seconds until the caller could retry, for the Retry-After header. */
  retryAfterSeconds: number
  /** Which window tripped, for the message shown to the user. */
  window: 'day' | 'minute' | null
}

const ALLOWED: SpendGuardVerdict = { allowed: true, retryAfterSeconds: 0, window: null }

/**
 * Record one model call for `userId` and report whether it should proceed.
 *
 * Fails open. If the counter table is unreachable the request is allowed: a
 * database hiccup blocking paying users is a worse outcome than a brief gap in
 * a guard whose only job is to catch sustained abuse.
 */
export async function guardModelCall(userId: string): Promise<SpendGuardVerdict> {
  const perDay = dailyLimit()
  const perMinute = burstLimit()
  if (perDay === 0 && perMinute === 0) return ALLOWED

  const now = Date.now()
  const dayStart = new Date(now - DAY_MS)
  const minuteStart = new Date(now - MINUTE_MS)

  try {
    // One indexed scan over this user's recent rows answers both windows.
    const [counts] = await db
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
      .where(and(eq(modelCalls.userId, userId), gte(modelCalls.createdAt, dayStart)))

    if (perMinute > 0 && counts.minute >= perMinute) {
      return {
        allowed: false,
        retryAfterSeconds: secondsUntilFree(counts.oldestInMinute, MINUTE_MS, now),
        window: 'minute',
      }
    }
    if (perDay > 0 && counts.day >= perDay) {
      return {
        allowed: false,
        retryAfterSeconds: secondsUntilFree(counts.oldestInDay, DAY_MS, now),
        window: 'day',
      }
    }

    await db.insert(modelCalls).values({ userId })

    // Opportunistic pruning keeps the table proportional to recent activity.
    // Rows outside the longest window can never affect a verdict again.
    if (counts.day % 50 === 0) {
      await db.delete(modelCalls).where(lt(modelCalls.createdAt, dayStart))
    }

    return ALLOWED
  } catch (error) {
    console.error('[spend-guard] usage check failed, allowing request', error)
    return ALLOWED
  }
}

/** How long until the oldest call in a window ages out of it. */
function secondsUntilFree(oldest: Date | null, windowMs: number, now: number): number {
  if (!oldest) return Math.ceil(windowMs / 1000)
  const freeAt = new Date(oldest).getTime() + windowMs
  return Math.max(1, Math.ceil((freeAt - now) / 1000))
}

/** The message shown to a user who trips a window. */
export function spendGuardMessage(verdict: SpendGuardVerdict): string {
  return verdict.window === 'minute'
    ? 'That was a lot of requests at once. Give it a moment and try again.'
    : 'You have reached the daily limit for AI requests on this account. It resets as your earlier requests age out — get in touch if you need more.'
}

/** A 429 for a caller that tripped a window, with the standard Retry-After header. */
export function spendGuardResponse(verdict: SpendGuardVerdict): Response {
  return Response.json(
    { error: spendGuardMessage(verdict) },
    { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } },
  )
}

/**
 * The same 429 as plain text, for the streaming chat endpoint. The AI SDK
 * surfaces a failed response's raw body as `error.message`, so sending text
 * puts the sentence itself in front of the user rather than a JSON wrapper.
 */
export function spendGuardTextResponse(verdict: SpendGuardVerdict): Response {
  return new Response(spendGuardMessage(verdict), {
    status: 429,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Retry-After': String(verdict.retryAfterSeconds),
    },
  })
}
