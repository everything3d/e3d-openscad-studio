import { randomBytes } from 'node:crypto'
import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { generateId, type UIMessage } from 'ai'
import { db } from '.'
import { messages, projects, projectShares, workspaceFiles } from './schema'
import {
  DEFAULT_CODE,
  PLACEHOLDER_PROJECT_NAME,
  type FullProject,
  type ProjectSummary,
  type WorkspaceFile,
} from '../types'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface ProjectSnapshot {
  sourceId: string
  name: string
  code: string
  messages: UIMessage[]
  files: WorkspaceFile[]
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
  const [project] = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.id, sourceId), eq(projects.userId, ownerId)))
  if (!project) return null

  const messageRows = await tx
    .select()
    .from(messages)
    .where(eq(messages.projectId, sourceId))
    .orderBy(asc(messages.seq))
  const fileRows = await tx
    .select()
    .from(workspaceFiles)
    .where(eq(workspaceFiles.projectId, sourceId))
    .orderBy(asc(workspaceFiles.addedAt))

  return {
    sourceId: project.id,
    name: project.name,
    code: project.code,
    messages: messageRows.map(
      (row) =>
        ({
          id: row.id,
          role: row.role,
          parts: row.parts,
          ...(row.metadata ? { metadata: row.metadata } : {}),
        }) as UIMessage,
    ),
    files: fileRows.map((row) => ({
      name: row.name,
      data: row.data,
      size: row.size,
      addedAt: row.addedAt.getTime(),
    })),
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
      updatedAt: projects.updatedAt,
      messageCount: count(messages.seq),
    })
    .from(projects)
    .leftJoin(messages, eq(messages.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt))

  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.getTime() }))
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

  return {
    id: project.id,
    name: project.name,
    code: project.code,
    forkedFrom: project.forkedFrom,
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
 * Apply an inferred name, but only while the project is still unnamed — so a
 * name the user typed (or an earlier auto-name) is never clobbered. Returns
 * whether the name was actually applied.
 */
export async function autoNameProject(
  id: string,
  userId: string,
  name: string,
): Promise<boolean> {
  const rows = await db
    .update(projects)
    .set({ name })
    .where(
      and(
        eq(projects.id, id),
        eq(projects.userId, userId),
        eq(projects.name, PLACEHOLDER_PROJECT_NAME),
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
