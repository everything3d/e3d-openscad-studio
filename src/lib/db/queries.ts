import { randomBytes } from 'node:crypto'
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { generateId, type UIMessage } from 'ai'
import { db } from '.'
import { buildCanonicalProjectSeed } from '../canonicals'
import {
  BUILT_IN_CANONICALS,
  RETIRED_CANONICAL_IDS,
  SYSTEM_CANONICAL_OWNER_ID,
  builtInVersionId,
} from '../builtin-canonicals'
import {
  canonicalDesigns,
  canonicalVersions,
  messages,
  printOrders,
  projects,
  projectShares,
  workspaceFiles,
} from './schema'
import {
  DEFAULT_CODE,
  PLACEHOLDER_PROJECT_NAME,
  type CanonicalDetail,
  type CanonicalSummary,
  type FullProject,
  type ProjectSummary,
  type WorkspaceFile,
} from '../types'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface ProjectArtifacts {
  sourceId: string
  name: string
  code: string
  files: WorkspaceFile[]
  canonicalDesignId: string | null
  canonicalVersionId: string | null
}

interface ProjectSnapshot extends ProjectArtifacts {
  messages: UIMessage[]
}

/** Load mutable design artifacts without bringing conversation history along. */
async function loadProjectArtifacts(
  tx: DbTransaction,
  sourceId: string,
  ownerId: string,
): Promise<ProjectArtifacts | null> {
  const [project] = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.id, sourceId), eq(projects.userId, ownerId)))
  if (!project) return null

  const fileRows = await tx
    .select()
    .from(workspaceFiles)
    .where(eq(workspaceFiles.projectId, sourceId))
    .orderBy(asc(workspaceFiles.addedAt))

  return {
    sourceId: project.id,
    name: project.name,
    code: project.code,
    files: fileRows.map((row) => ({
      name: row.name,
      data: row.data,
      size: row.size,
      addedAt: row.addedAt.getTime(),
    })),
    canonicalDesignId: project.canonicalDesignId,
    canonicalVersionId: project.canonicalVersionId,
  }
}

/**
 * Load every artifact that follows a project when it is copied. Both local
 * forks and share snapshots use this boundary so the two flows cannot drift.
 */
async function loadProjectSnapshot(
  tx: DbTransaction,
  sourceId: string,
  ownerId: string,
): Promise<ProjectSnapshot | null> {
  const artifacts = await loadProjectArtifacts(tx, sourceId, ownerId)
  if (!artifacts) return null

  const messageRows = await tx
    .select()
    .from(messages)
    .where(eq(messages.projectId, sourceId))
    .orderBy(asc(messages.seq))
  return {
    ...artifacts,
    messages: messageRows.map(
      (row) =>
        ({
          id: row.id,
          role: row.role,
          parts: row.parts,
          ...(row.metadata ? { metadata: row.metadata } : {}),
        }) as UIMessage,
    ),
  }
}

/**
 * Materialize a complete project copy. Local forks and cross-account imports
 * both pass through here, keeping message/file copy behavior in one place.
 */
async function materializeProjectCopy(
  tx: DbTransaction,
  {
    snapshot,
    userId,
    name,
    sharedFrom = null,
  }: {
    snapshot: ProjectSnapshot
    userId: string
    name: string
    sharedFrom?: string | null
  },
): Promise<string> {
  const id = generateId()
  const values = {
    id,
    userId,
    name,
    code: snapshot.code,
    forkedFrom: snapshot.sourceId,
    // Cross-account share imports remain standalone snapshots. Local workspace
    // Forks keep canonical provenance so update hints continue to work.
    canonicalDesignId: sharedFrom ? null : (snapshot.canonicalDesignId ?? null),
    canonicalVersionId: sharedFrom ? null : (snapshot.canonicalVersionId ?? null),
    sharedFrom,
  }

  if (sharedFrom) {
    const inserted = await tx
      .insert(projects)
      .values(values)
      .onConflictDoNothing({
        target: [projects.userId, projects.sharedFrom],
      })
      .returning({ id: projects.id })

    if (!inserted[0]) {
      const [existing] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.sharedFrom, sharedFrom)))
      if (!existing) throw new Error('Shared project import conflicted without an existing copy')
      return existing.id
    }
  } else {
    await tx.insert(projects).values(values)
  }

  if (snapshot.messages.length) {
    await tx.insert(messages).values(
      snapshot.messages.map((message) => ({
        id: message.id,
        projectId: id,
        role: message.role,
        parts: message.parts,
        metadata: message.metadata ?? null,
      })),
    )
  }
  if (snapshot.files.length) {
    await tx.insert(workspaceFiles).values(
      snapshot.files.map((file) => ({
        projectId: id,
        name: file.name,
        data: file.data,
        size: file.size,
        addedAt: new Date(file.addedAt),
      })),
    )
  }

  return id
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      forkedFrom: projects.forkedFrom,
      canonicalDesignId: projects.canonicalDesignId,
      canonicalVersionId: projects.canonicalVersionId,
      canonicalTitle: canonicalDesigns.title,
      canonicalCurrentVersionId: canonicalDesigns.currentVersionId,
      updatedAt: projects.updatedAt,
      messageCount: count(messages.seq),
    })
    .from(projects)
    .leftJoin(messages, eq(messages.projectId, projects.id))
    .leftJoin(canonicalDesigns, eq(canonicalDesigns.id, projects.canonicalDesignId))
    .where(eq(projects.userId, userId))
    .groupBy(projects.id, canonicalDesigns.title, canonicalDesigns.currentVersionId)
    .orderBy(desc(projects.updatedAt))

  return rows.map(({ canonicalCurrentVersionId, ...r }) => ({
    ...r,
    canonicalHasNewerVersion: Boolean(
      r.canonicalVersionId &&
        canonicalCurrentVersionId &&
        r.canonicalVersionId !== canonicalCurrentVersionId,
    ),
    updatedAt: r.updatedAt.getTime(),
  }))
}

/** An ILIKE pattern matching `query` as a literal substring. */
function containsPattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/**
 * Ids of the user's projects whose name, OpenSCAD source, or chat history
 * contains `query` (case-insensitive substring). Messages are matched against
 * their serialized parts, so tool inputs/outputs are searched as well.
 */
export async function searchProjects(userId: string, query: string): Promise<string[]> {
  const pattern = containsPattern(query)
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.userId, userId),
        sql`(${projects.name} ilike ${pattern}
          or ${projects.code} ilike ${pattern}
          or exists (
            select 1 from ${messages}
            where ${messages.projectId} = ${projects.id}
              and ${messages.parts}::text ilike ${pattern}
          ))`,
      ),
    )
  return rows.map((r) => r.id)
}

export async function getProject(id: string, userId: string): Promise<FullProject | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
  if (!project) return null

  const files = await db
    .select()
    .from(workspaceFiles)
    .where(eq(workspaceFiles.projectId, id))
    .orderBy(asc(workspaceFiles.addedAt))

  let canonicalTitle: string | null = null
  let canonicalVersionNumber: number | null = null
  let canonicalHasNewerVersion = false
  if (project.canonicalDesignId && project.canonicalVersionId) {
    const [source] = await db
      .select({
        title: canonicalDesigns.title,
        currentVersionId: canonicalDesigns.currentVersionId,
        versionNumber: canonicalVersions.versionNumber,
      })
      .from(canonicalDesigns)
      .leftJoin(canonicalVersions, eq(canonicalVersions.id, project.canonicalVersionId))
      .where(eq(canonicalDesigns.id, project.canonicalDesignId))
    canonicalTitle = source?.title ?? null
    canonicalVersionNumber = source?.versionNumber ?? null
    canonicalHasNewerVersion = Boolean(
      source?.currentVersionId && source.currentVersionId !== project.canonicalVersionId,
    )
  }

  return {
    id: project.id,
    name: project.name,
    code: project.code,
    forkedFrom: project.forkedFrom,
    canonicalDesignId: project.canonicalDesignId,
    canonicalVersionId: project.canonicalVersionId,
    canonicalTitle,
    canonicalVersionNumber,
    canonicalHasNewerVersion,
    files: files.map((f) => ({
      name: f.name,
      data: f.data,
      size: f.size,
      addedAt: f.addedAt.getTime(),
    })),
    createdAt: project.createdAt.getTime(),
    updatedAt: project.updatedAt.getTime(),
  }
}

export async function getProjectMessages(id: string): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.projectId, id))
    .orderBy(asc(messages.seq))

  return rows.map(
    (r) =>
      ({
        id: r.id,
        role: r.role,
        parts: r.parts,
        ...(r.metadata ? { metadata: r.metadata } : {}),
      }) as UIMessage,
  )
}

export async function createProject(userId: string, name?: string): Promise<FullProject> {
  const [row] = await db
    .insert(projects)
    .values({
      id: generateId(),
      userId,
      name: name || PLACEHOLDER_PROJECT_NAME,
      code: DEFAULT_CODE,
    })
    .returning()

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    forkedFrom: row.forkedFrom,
    canonicalDesignId: row.canonicalDesignId,
    canonicalVersionId: row.canonicalVersionId,
    canonicalTitle: null,
    canonicalVersionNumber: null,
    canonicalHasNewerVersion: false,
    files: [],
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

export async function forkProject(sourceId: string, userId: string): Promise<FullProject | null> {
  const id = await db.transaction(async (tx) => {
    const snapshot = await loadProjectSnapshot(tx, sourceId, userId)
    if (!snapshot) return null
    return materializeProjectCopy(tx, {
      snapshot,
      userId,
      name: `${snapshot.name} (fork)`,
    })
  })

  return id ? getProject(id, userId) : null
}

type CanonicalDesignRecord = typeof canonicalDesigns.$inferSelect
type CanonicalVersionRecord = typeof canonicalVersions.$inferSelect

function toCanonicalSummary(
  design: CanonicalDesignRecord,
  version: CanonicalVersionRecord,
  userId: string,
): CanonicalSummary {
  const files = version.files as WorkspaceFile[]
  return {
    id: design.id,
    title: design.title,
    description: design.description,
    category: design.category,
    currentVersionId: design.currentVersionId,
    versionNumber: version.versionNumber,
    thumbnail: version.thumbnail,
    fileCount: files.length,
    isOwner: design.ownerId === userId,
    updatedAt: design.updatedAt.getTime(),
  }
}

function toCanonicalDetail(
  design: CanonicalDesignRecord,
  version: CanonicalVersionRecord,
  userId: string,
): CanonicalDetail {
  return {
    ...toCanonicalSummary(design, version, userId),
    code: version.code,
    files: version.files as WorkspaceFile[],
    modificationGuide: version.modificationGuide,
    changeSummary: version.changeSummary,
    createdAt: design.createdAt.getTime(),
  }
}

let builtInCanonicalSeed: Promise<void> | null = null

/**
 * Install the product-owned starter catalog on first use, and bring it up to
 * date after a deploy that changed it.
 *
 * Each starter's current content lives in an immutable version row whose id
 * is derived from that content, so an edited starter is published as the next
 * version while workspaces started from an earlier one keep pointing at it.
 * The design row is then pointed at the current version, with its title,
 * description and category refreshed from code. Product-owned rows take their
 * content from code, never from the database.
 *
 * Stable ids make this safe to run from several serverless instances at once:
 * if two race to publish the same new version, one transaction fails on the
 * unique version number and its caller retries on the next request. The
 * promise is memoised so concurrent readers share one round trip, and dropped
 * on failure so a transient outage does not disable the catalog for the life
 * of the process.
 */
async function ensureBuiltInCanonicals(): Promise<void> {
  builtInCanonicalSeed ??= db
    .transaction(async (tx) => {
      for (const starter of BUILT_IN_CANONICALS) {
        const versionId = builtInVersionId(starter)
        await tx
          .insert(canonicalDesigns)
          .values({
            id: starter.id,
            ownerId: SYSTEM_CANONICAL_OWNER_ID,
            title: starter.title,
            description: starter.description,
            category: starter.category,
            currentVersionId: versionId,
          })
          .onConflictDoNothing()

        const [published] = await tx
          .select({ id: canonicalVersions.id })
          .from(canonicalVersions)
          .where(eq(canonicalVersions.id, versionId))
        if (!published) {
          const [{ latest }] = await tx
            .select({ latest: sql<number | null>`max(${canonicalVersions.versionNumber})` })
            .from(canonicalVersions)
            .where(eq(canonicalVersions.canonicalDesignId, starter.id))
          const versionNumber = Number(latest ?? 0) + 1
          await tx.insert(canonicalVersions).values({
            id: versionId,
            canonicalDesignId: starter.id,
            versionNumber,
            code: starter.code,
            files: [],
            modificationGuide: starter.modificationGuide,
            thumbnail: starter.thumbnail,
            changeSummary:
              versionNumber === 1
                ? 'Initial built-in canonical design'
                : 'Updated built-in canonical design',
            sourceProjectId: null,
            createdBy: SYSTEM_CANONICAL_OWNER_ID,
          })
        }

        // Only touch the row when something changed, so a routine cold start
        // does not rewrite every starter's updated_at.
        await tx
          .update(canonicalDesigns)
          .set({
            title: starter.title,
            description: starter.description,
            category: starter.category,
            currentVersionId: versionId,
            archivedAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(canonicalDesigns.id, starter.id),
              eq(canonicalDesigns.ownerId, SYSTEM_CANONICAL_OWNER_ID),
              or(
                ne(canonicalDesigns.title, starter.title),
                ne(canonicalDesigns.description, starter.description),
                sql`${canonicalDesigns.category} is distinct from ${starter.category}`,
                ne(canonicalDesigns.currentVersionId, versionId),
                isNotNull(canonicalDesigns.archivedAt),
              ),
            ),
          )
      }

      // Retire rows the catalog replaced (renamed or merged starters) or took
      // out of circulation. Archiving rather than deleting keeps any workspace
      // already started from one working.
      const retired = [
        ...BUILT_IN_CANONICALS.flatMap((starter) => starter.supersedes ?? []),
        ...RETIRED_CANONICAL_IDS,
      ]
      await tx
        .update(canonicalDesigns)
        .set({ archivedAt: new Date() })
        .where(and(inArray(canonicalDesigns.id, retired), isNull(canonicalDesigns.archivedAt)))
    })
    .catch((error) => {
      builtInCanonicalSeed = null
      throw error
    })
  return builtInCanonicalSeed
}

/** Where a starter sits in the curated order, or -1 for a user's own design. */
function builtInRank(id: string): number {
  return BUILT_IN_CANONICALS.findIndex((starter) => starter.id === id)
}

export async function listCanonicals(userId: string): Promise<CanonicalSummary[]> {
  await ensureBuiltInCanonicals()
  const rows = await db
    .select({ design: canonicalDesigns, version: canonicalVersions })
    .from(canonicalDesigns)
    .innerJoin(canonicalVersions, eq(canonicalVersions.id, canonicalDesigns.currentVersionId))
    .where(isNull(canonicalDesigns.archivedAt))
    .orderBy(desc(canonicalDesigns.updatedAt))
  // The starters are seeded in one transaction, so they all share a timestamp
  // and cannot be ordered by it. Present them first, in the order they are
  // declared, hero first, then everyone's own designs by recency.
  return rows
    .map(({ design, version }) => toCanonicalSummary(design, version, userId))
    .sort((a, b) => {
      const rankA = builtInRank(a.id)
      const rankB = builtInRank(b.id)
      if (rankA === -1 && rankB === -1) return 0
      if (rankA === -1) return 1
      if (rankB === -1) return -1
      return rankA - rankB
    })
}

/**
 * Ids of live canonicals whose metadata or current version (source, guide,
 * file names) contains `query`. File contents are base64 and not searched.
 */
export async function searchCanonicals(query: string): Promise<string[]> {
  await ensureBuiltInCanonicals()
  const pattern = containsPattern(query)
  const rows = await db
    .select({ id: canonicalDesigns.id })
    .from(canonicalDesigns)
    .innerJoin(canonicalVersions, eq(canonicalVersions.id, canonicalDesigns.currentVersionId))
    .where(
      and(
        isNull(canonicalDesigns.archivedAt),
        sql`(${canonicalDesigns.title} ilike ${pattern}
          or ${canonicalDesigns.description} ilike ${pattern}
          or ${canonicalDesigns.category} ilike ${pattern}
          or ${canonicalVersions.code} ilike ${pattern}
          or ${canonicalVersions.modificationGuide} ilike ${pattern}
          or exists (
            select 1 from jsonb_array_elements(${canonicalVersions.files}) f
            where f->>'name' ilike ${pattern}
          ))`,
      ),
    )
  return rows.map((r) => r.id)
}

export async function getCanonical(id: string, userId: string): Promise<CanonicalDetail | null> {
  await ensureBuiltInCanonicals()
  const [row] = await db
    .select({ design: canonicalDesigns, version: canonicalVersions })
    .from(canonicalDesigns)
    .innerJoin(canonicalVersions, eq(canonicalVersions.id, canonicalDesigns.currentVersionId))
    .where(and(eq(canonicalDesigns.id, id), isNull(canonicalDesigns.archivedAt)))
  return row ? toCanonicalDetail(row.design, row.version, userId) : null
}

export interface PublishCanonicalInput {
  projectId: string
  title: string
  description: string
  category?: string | null
  modificationGuide: string
  thumbnail?: string | null
  changeSummary?: string | null
}

export async function createCanonicalFromProject(
  input: PublishCanonicalInput,
  userId: string,
): Promise<CanonicalDetail | null> {
  const canonicalId = generateId()
  const versionId = generateId()
  const created = await db.transaction(async (tx) => {
    const artifacts = await loadProjectArtifacts(tx, input.projectId, userId)
    if (!artifacts) return false
    await tx.insert(canonicalDesigns).values({
      id: canonicalId,
      ownerId: userId,
      title: input.title,
      description: input.description,
      category: input.category ?? null,
      currentVersionId: versionId,
    })
    await tx.insert(canonicalVersions).values({
      id: versionId,
      canonicalDesignId: canonicalId,
      versionNumber: 1,
      code: artifacts.code,
      files: artifacts.files,
      modificationGuide: input.modificationGuide,
      thumbnail: input.thumbnail ?? null,
      changeSummary: input.changeSummary ?? null,
      sourceProjectId: input.projectId,
      createdBy: userId,
    })
    return true
  })
  return created ? getCanonical(canonicalId, userId) : null
}

export async function addCanonicalVersionFromProject(
  canonicalId: string,
  input: PublishCanonicalInput,
  userId: string,
): Promise<CanonicalDetail | null> {
  const versionId = generateId()
  const created = await db.transaction(async (tx) => {
    const [design] = await tx
      .select()
      .from(canonicalDesigns)
      .where(
        and(
          eq(canonicalDesigns.id, canonicalId),
          eq(canonicalDesigns.ownerId, userId),
          isNull(canonicalDesigns.archivedAt),
        ),
      )
      .for('update')
    if (!design) return false
    const [current] = await tx
      .select({ versionNumber: canonicalVersions.versionNumber })
      .from(canonicalVersions)
      .where(eq(canonicalVersions.id, design.currentVersionId))
    if (!current) throw new Error('Canonical current version is missing')

    const artifacts = await loadProjectArtifacts(tx, input.projectId, userId)
    if (!artifacts) return false
    await tx.insert(canonicalVersions).values({
      id: versionId,
      canonicalDesignId: canonicalId,
      versionNumber: current.versionNumber + 1,
      code: artifacts.code,
      files: artifacts.files,
      modificationGuide: input.modificationGuide,
      thumbnail: input.thumbnail ?? null,
      changeSummary: input.changeSummary ?? null,
      sourceProjectId: input.projectId,
      createdBy: userId,
    })
    await tx
      .update(canonicalDesigns)
      .set({
        title: input.title,
        description: input.description,
        category: input.category === undefined ? design.category : input.category,
        currentVersionId: versionId,
        updatedAt: sql`now()`,
      })
      .where(eq(canonicalDesigns.id, canonicalId))
    return true
  })
  return created ? getCanonical(canonicalId, userId) : null
}

export async function updateCanonicalMetadata(
  id: string,
  userId: string,
  patch: {
    title?: string
    description?: string
    category?: string | null
    archived?: boolean
  },
): Promise<boolean> {
  const values: Record<string, unknown> = { updatedAt: sql`now()` }
  if (patch.title !== undefined) values.title = patch.title
  if (patch.description !== undefined) values.description = patch.description
  if (patch.category !== undefined) values.category = patch.category
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? sql`now()` : null
  const rows = await db
    .update(canonicalDesigns)
    .set(values)
    .where(and(eq(canonicalDesigns.id, id), eq(canonicalDesigns.ownerId, userId)))
    .returning({ id: canonicalDesigns.id })
  return rows.length > 0
}

export async function startCanonical(id: string, userId: string): Promise<FullProject | null> {
  const projectId = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ design: canonicalDesigns, version: canonicalVersions })
      .from(canonicalDesigns)
      .innerJoin(canonicalVersions, eq(canonicalVersions.id, canonicalDesigns.currentVersionId))
      .where(and(eq(canonicalDesigns.id, id), isNull(canonicalDesigns.archivedAt)))
    if (!row) return null
    const newId = generateId()
    await tx.insert(projects).values({
      id: newId,
      userId,
      ...buildCanonicalProjectSeed({
        id: row.design.id,
        title: row.design.title,
        versionId: row.version.id,
        code: row.version.code,
      }),
    })
    const files = row.version.files as WorkspaceFile[]
    if (files.length) {
      await tx.insert(workspaceFiles).values(
        files.map((file) => ({
          projectId: newId,
          name: file.name,
          data: file.data,
          size: file.size,
          addedAt: new Date(file.addedAt),
        })),
      )
    }
    return newId
  })
  return projectId ? getProject(projectId, userId) : null
}

export async function getCanonicalModificationGuide(versionId: string): Promise<string | null> {
  const [version] = await db
    .select({ modificationGuide: canonicalVersions.modificationGuide })
    .from(canonicalVersions)
    .where(eq(canonicalVersions.id, versionId))
  return version?.modificationGuide ?? null
}

export interface ProjectShareLink {
  path: string
  createdAt: number
}

function shareLink(token: string, createdAt: Date): ProjectShareLink {
  return {
    path: `/share/${token}`,
    createdAt: createdAt.getTime(),
  }
}

export async function getActiveProjectShare(
  projectId: string,
  userId: string,
): Promise<ProjectShareLink | null> {
  const [share] = await db
    .select({ token: projectShares.token, createdAt: projectShares.createdAt })
    .from(projectShares)
    .where(and(eq(projectShares.projectId, projectId), eq(projectShares.ownerId, userId)))
  return share ? shareLink(share.token, share.createdAt) : null
}

/** Replace the current link with a fresh immutable snapshot and token. */
export async function replaceProjectShare(
  projectId: string,
  userId: string,
): Promise<ProjectShareLink | null> {
  return db.transaction(async (tx) => {
    const snapshot = await loadProjectSnapshot(tx, projectId, userId)
    if (!snapshot) return null
    return writeProjectShare(tx, projectId, userId, snapshot)
  })
}

async function writeProjectShare(
  tx: DbTransaction,
  projectId: string,
  userId: string,
  snapshot: ProjectSnapshot,
): Promise<ProjectShareLink> {
  await tx.delete(projectShares).where(eq(projectShares.projectId, projectId))

  const [share] = await tx
    .insert(projectShares)
    .values({
      id: generateId(),
      projectId,
      ownerId: userId,
      token: randomBytes(32).toString('base64url'),
      snapshotName: snapshot.name,
      snapshot,
    })
    .returning({ token: projectShares.token, createdAt: projectShares.createdAt })

  return shareLink(share.token, share.createdAt)
}

/** Same code and the same workspace files, ignoring chat history and names. */
function sameDesign(a: Pick<ProjectArtifacts, 'code' | 'files'>, b: Pick<ProjectArtifacts, 'code' | 'files'>) {
  return (
    a.code === b.code &&
    a.files.length === b.files.length &&
    a.files.every((file, i) => file.name === b.files[i].name && file.data === b.files[i].data)
  )
}

/**
 * A link the shop can open to see exactly the design being ordered.
 *
 * Projects are private, so an order or a WhatsApp message needs a share
 * snapshot to point at. An existing link is reused when it already shows the
 * current design, so a link the owner has handed out keeps working; it is only
 * replaced when the design has changed since, because a stale snapshot would
 * have the shop print the wrong thing.
 */
export async function designLinkForOrder(
  projectId: string,
  userId: string,
): Promise<ProjectShareLink | null> {
  return db.transaction(async (tx) => {
    const snapshot = await loadProjectSnapshot(tx, projectId, userId)
    if (!snapshot) return null

    const [existing] = await tx
      .select({
        token: projectShares.token,
        createdAt: projectShares.createdAt,
        snapshot: projectShares.snapshot,
      })
      .from(projectShares)
      .where(and(eq(projectShares.projectId, projectId), eq(projectShares.ownerId, userId)))
    if (existing && sameDesign(existing.snapshot as ProjectSnapshot, snapshot)) {
      return shareLink(existing.token, existing.createdAt)
    }
    return writeProjectShare(tx, projectId, userId, snapshot)
  })
}

export async function disableProjectShare(projectId: string, userId: string): Promise<void> {
  await db
    .delete(projectShares)
    .where(and(eq(projectShares.projectId, projectId), eq(projectShares.ownerId, userId)))
}

export interface ProjectSharePreview {
  sourceProjectId: string
  ownerId: string
  name: string
  createdAt: number
}

export async function getProjectSharePreview(token: string): Promise<ProjectSharePreview | null> {
  const [share] = await db
    .select({
      sourceProjectId: projectShares.projectId,
      ownerId: projectShares.ownerId,
      name: projectShares.snapshotName,
      createdAt: projectShares.createdAt,
    })
    .from(projectShares)
    .where(eq(projectShares.token, token))

  return share ? { ...share, createdAt: share.createdAt.getTime() } : null
}

/**
 * Import a token-gated snapshot into a user's account. Repeated or concurrent
 * imports return the same project via the (userId, sharedFrom) unique index.
 */
export async function importProjectShare(token: string, userId: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [share] = await tx
      .select()
      .from(projectShares)
      .where(eq(projectShares.token, token))
    if (!share) return null
    if (share.ownerId === userId) return share.projectId

    const snapshot = share.snapshot as ProjectSnapshot

    return materializeProjectCopy(tx, {
      snapshot,
      userId,
      name: `${snapshot.name} (shared copy)`,
      sharedFrom: share.id,
    })
  })
}

export async function renameProject(id: string, userId: string, name: string): Promise<void> {
  await db
    .update(projects)
    .set({ name, updatedAt: sql`now()` })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
}

/**
 * Apply an inferred name, but only while the project still carries the
 * provisional name it was read with — so a name the user typed (or an earlier
 * auto-name) is never clobbered. Returns whether the name was actually applied.
 */
export async function autoNameProject(
  id: string,
  userId: string,
  provisionalName: string,
  name: string,
): Promise<boolean> {
  const rows = await db
    .update(projects)
    .set({ name })
    .where(
      and(
        eq(projects.id, id),
        eq(projects.userId, userId),
        eq(projects.name, provisionalName),
      ),
    )
    .returning({ id: projects.id })
  return rows.length > 0
}

export async function updateProjectCode(id: string, userId: string, code: string): Promise<void> {
  await db
    .update(projects)
    .set({ code, updatedAt: sql`now()` })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
}

export async function deleteProject(id: string, userId: string): Promise<void> {
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)))
}

/** Replace the full workspace file list for a project. */
export async function replaceFiles(id: string, files: WorkspaceFile[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(workspaceFiles).where(eq(workspaceFiles.projectId, id))
    if (files.length) {
      await tx.insert(workspaceFiles).values(
        files.map((f) => ({
          projectId: id,
          name: f.name,
          data: f.data,
          size: f.size,
          addedAt: new Date(f.addedAt),
        })),
      )
    }
    await tx
      .update(projects)
      .set({ updatedAt: sql`now()` })
      .where(eq(projects.id, id))
  })
}

/**
 * Persist the full conversation after a chat turn, along with the code the
 * agent produced (if any) and an auto-generated name for brand-new chats.
 */
export async function saveChat({
  projectId,
  uiMessages,
  code,
}: {
  projectId: string
  uiMessages: UIMessage[]
  code: string | null
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(messages).where(eq(messages.projectId, projectId))
    if (uiMessages.length) {
      await tx.insert(messages).values(
        uiMessages.map((m) => ({
          id: m.id,
          projectId,
          role: m.role,
          parts: m.parts,
          metadata: m.metadata ?? null,
        })),
      )
    }

    const patch: Record<string, unknown> = { updatedAt: sql`now()` }
    if (code !== null) patch.code = code

    // Fallback naming: normally the project is named by the model as soon as
    // the first message is sent (POST /api/projects/[id]/name). If that call
    // never landed, fall back to a truncation of the first user message.
    const firstUserText = uiMessages
      .find((m) => m.role === 'user')
      ?.parts.find((p) => p.type === 'text')
    if (firstUserText && 'text' in firstUserText) {
      const [project] = await tx
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
      if (project?.name === PLACEHOLDER_PROJECT_NAME) {
        patch.name = firstUserText.text.slice(0, 40)
      }
    }

    await tx.update(projects).set(patch).where(eq(projects.id, projectId))
  })
}

/** How many orders a single account may raise in an hour. */
const ORDERS_PER_HOUR = 10

export interface RecordPrintOrderInput {
  projectId: string
  userId: string
  draftOrderId: string
  draftOrderName: string
  invoiceUrl: string | null
  totalInr: number
  printMinutes: number
  filamentGrams: number
}

/**
 * Orders raised by this account in the last hour.
 *
 * A draft order lands in the shop's Shopify admin and a person looks at it, so
 * an unbounded endpoint is a way to bury them in junk. This is the check that
 * keeps that from happening.
 */
export async function recentOrderCount(userId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000)
  const [row] = await db
    .select({ total: count() })
    .from(printOrders)
    .where(and(eq(printOrders.userId, userId), gte(printOrders.createdAt, since)))
  return row?.total ?? 0
}

export function ordersPerHourLimit(): number {
  const parsed = Number(process.env.ORDERS_PER_HOUR)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : ORDERS_PER_HOUR
}

export async function recordPrintOrder(input: RecordPrintOrderInput): Promise<string> {
  const id = generateId()
  await db.insert(printOrders).values({
    id,
    projectId: input.projectId,
    userId: input.userId,
    draftOrderId: input.draftOrderId,
    draftOrderName: input.draftOrderName,
    invoiceUrl: input.invoiceUrl,
    totalInr: Math.round(input.totalInr),
    printMinutes: Math.round(input.printMinutes),
    filamentGrams: Math.round(input.filamentGrams),
  })
  return id
}
