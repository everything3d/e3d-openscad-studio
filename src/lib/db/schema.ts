import {
  bigserial,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** A reusable design identity. Its current version is the source for new workspaces. */
export const canonicalDesigns = pgTable('canonical_designs', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category'),
  /** Kept as a logical pointer to avoid a circular FK with canonical_versions. */
  currentVersionId: text('current_version_id').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * A mutable derivative workspace: conversation history, current OpenSCAD source,
 * and imported files. It may have been seeded from an immutable canonical version.
 */
export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    /** Clerk user id owning this project. */
    userId: text('user_id').notNull().default(''),
    name: text('name').notNull(),
    code: text('code').notNull(),
    forkedFrom: text('forked_from'),
    canonicalDesignId: text('canonical_design_id').references(() => canonicalDesigns.id, {
      onDelete: 'set null',
    }),
    /** Logical immutable-version pointer; canonical versions are never deleted. */
    canonicalVersionId: text('canonical_version_id'),
    /** Internal share snapshot id, set only on cross-account imports. */
    sharedFrom: text('shared_from'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('projects_user_shared_from_unique').on(t.userId, t.sharedFrom)],
)

/** Immutable artifact and guidance snapshot published under a canonical design. */
export const canonicalVersions = pgTable(
  'canonical_versions',
  {
    id: text('id').primaryKey(),
    canonicalDesignId: text('canonical_design_id')
      .notNull()
      .references(() => canonicalDesigns.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    code: text('code').notNull(),
    files: jsonb('files').notNull(),
    modificationGuide: text('modification_guide').notNull(),
    thumbnail: text('thumbnail'),
    changeSummary: text('change_summary'),
    sourceProjectId: text('source_project_id'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('canonical_versions_design_version_unique').on(
      t.canonicalDesignId,
      t.versionNumber,
    ),
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
  /** Denormalized for simple owner-scoped share lifecycle queries. */
  ownerId: text('owner_id').notNull(),
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
export type CanonicalDesignRow = typeof canonicalDesigns.$inferSelect
export type CanonicalVersionRow = typeof canonicalVersions.$inferSelect
export type MessageRow = typeof messages.$inferSelect
export type WorkspaceFileRow = typeof workspaceFiles.$inferSelect
export type ProjectShareRow = typeof projectShares.$inferSelect
