import {
  bigserial,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * A project *is* a chat: conversation history, the current OpenSCAD source,
 * and the workspace files it imports. Forking clones a project into a new
 * one that remembers its ancestor.
 */
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  forkedFrom: text('forked_from'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

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

export type ProjectRow = typeof projects.$inferSelect
export type MessageRow = typeof messages.$inferSelect
export type WorkspaceFileRow = typeof workspaceFiles.$inferSelect
