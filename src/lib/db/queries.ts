import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { generateId, type UIMessage } from 'ai'
import { db } from '.'
import { messages, projects, workspaceFiles } from './schema'
import { DEFAULT_CODE, type FullProject, type ProjectSummary, type WorkspaceFile } from '../types'

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
      name: name || 'Untitled project',
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
  const source = await getProject(sourceId, userId)
  if (!source) return null
  const sourceMessages = await getProjectMessages(sourceId)

  const id = generateId()
  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id,
      userId,
      name: `${source.name} (fork)`,
      code: source.code,
      forkedFrom: source.id,
    })
    if (sourceMessages.length) {
      await tx.insert(messages).values(
        sourceMessages.map((m) => ({
          id: m.id,
          projectId: id,
          role: m.role,
          parts: m.parts,
          metadata: m.metadata ?? null,
        })),
      )
    }
    if (source.files.length) {
      await tx.insert(workspaceFiles).values(
        source.files.map((f) => ({
          projectId: id,
          name: f.name,
          data: f.data,
          size: f.size,
          addedAt: new Date(f.addedAt),
        })),
      )
    }
  })

  return getProject(id, userId)
}

export async function renameProject(id: string, userId: string, name: string): Promise<void> {
  await db
    .update(projects)
    .set({ name, updatedAt: sql`now()` })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
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

    // Auto-name untitled projects from the first user message.
    const firstUserText = uiMessages
      .find((m) => m.role === 'user')
      ?.parts.find((p) => p.type === 'text')
    if (firstUserText && 'text' in firstUserText) {
      const [project] = await tx
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
      if (project?.name === 'Untitled project') {
        patch.name = firstUserText.text.slice(0, 40)
      }
    }

    await tx.update(projects).set(patch).where(eq(projects.id, projectId))
  })
}
