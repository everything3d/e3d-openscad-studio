import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not set. Copy .env.example to .env.local and configure it.')
}

// Reuse the connection across Next.js dev hot reloads so we don't exhaust
// the Postgres connection limit.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> }

const client = globalForDb.pgClient ?? postgres(process.env.POSTGRES_URL, { max: 5 })
if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client

export const db = drizzle(client, { schema })
