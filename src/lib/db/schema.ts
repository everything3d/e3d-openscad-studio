import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * A project *is* a chat: conversation history, the current OpenSCAD source,
 * and the workspace files it imports. Forking clones a project into a new
 * one that remembers its ancestor.
 */
export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    /** Clerk user id that created this project (and owns it when personal). */
    userId: text('user_id').notNull().default(''),
    /** Clerk organization id. Null means this is a private, personal project. */
    organizationId: text('organization_id'),
    name: text('name').notNull(),
    code: text('code').notNull(),
    forkedFrom: text('forked_from'),
    /** Internal share snapshot id, set only on cross-account imports. */
    sharedFrom: text('shared_from'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('projects_user_updated_at_idx').on(t.userId, t.updatedAt),
    index('projects_organization_updated_at_idx').on(t.organizationId, t.updatedAt),
    uniqueIndex('projects_user_shared_from_unique')
      .on(t.userId, t.sharedFrom)
      .where(sql`${t.organizationId} is null`),
    uniqueIndex('projects_organization_shared_from_unique')
      .on(t.organizationId, t.sharedFrom)
      .where(sql`${t.organizationId} is not null`),
  ],
)

/**
 * Chat messages, stored in the AI SDK UIMessage shape (`parts` is the
 * UIMessage parts array). `seq` orders messages within a project.
 */
export const messages = pgTable('messages', {
  seq: bigserial('seq', { mode: 'number' }).primaryKey(),
  id: text('id').notNull(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  parts: jsonb('parts').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Files available to `import()` / `use <>` during rendering (SVG, DXF, STL,
 * .scad libraries, …). `data` is base64 so it round-trips through JSON to
 * the browser and the wasm worker.
 */
export const workspaceFiles = pgTable(
  'workspace_files',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    data: text('data').notNull(),
    size: integer('size').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.name] })],
)

/**
 * A frozen, capability-link snapshot of a project. Replacing or disabling a
 * link deletes this row; projects imported from it remain independent.
 */
export const projectShares = pgTable('project_shares', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),
  /** Clerk user id that created the current share snapshot. */
  ownerId: text('owner_id').notNull(),
  /** Organization that owned the source snapshot, or null for personal projects. */
  organizationId: text('organization_id'),
  /** 256 random bits encoded as base64url. Possession grants snapshot access. */
  token: text('token').notNull().unique(),
  /** Denormalized so the public landing page need not load the large snapshot. */
  snapshotName: text('snapshot_name').notNull(),
  /**
   * The complete copy payload as one object. New copyable project artifacts can
   * be added to the shared fork infrastructure without another share migration.
   */
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ProjectRow = typeof projects.$inferSelect
export type MessageRow = typeof messages.$inferSelect
export type WorkspaceFileRow = typeof workspaceFiles.$inferSelect
export type ProjectShareRow = typeof projectShares.$inferSelect
