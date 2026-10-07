import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

// Reuse the connection across Next.js dev hot reloads so we don't exhaust
// the Postgres connection limit.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>
  drizzleDb?: Db
}

function connect(): Db {
  if (globalForDb.drizzleDb) return globalForDb.drizzleDb

  const url = process.env.POSTGRES_URL
  if (!url) {
    throw new Error('POSTGRES_URL is not set. Copy .env.example to .env.local and configure it.')
  }

  const client = globalForDb.pgClient ?? postgres(url, { max: 5 })
  const instance = drizzle(client, { schema })
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.pgClient = client
    globalForDb.drizzleDb = instance
  }
  return instance
}

/**
 * The Drizzle client, connected on first use rather than on import.
 *
 * `next build` evaluates every route module to collect page data, so throwing
 * at import time made a production build require a live database URL — which
 * broke clean clones and any CI without the secret. Deferring to first query
 * keeps a missing URL a runtime error on the request that needed the database,
 * which is also how the OpenRouter key behaves.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    return Reflect.get(connect() as object, property, receiver)
  },
})
