'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { useRenderer } from '@/lib/openscad/useRenderer'
import { meshTo3MF } from '@/lib/openscad/threemf'
import {
  PLACEHOLDER_PROJECT_NAME,
  type CanonicalDetail,
  type CanonicalSummary,
  type FullProject,
  type ProjectSummary,
  type WorkspaceFile,
} from '@/lib/types'
import type { StudioUIMessage } from '@/lib/agents/studio-agent'
import { Sidebar } from './sidebar'
import { ChatPanel } from './chat-panel'
import { CodeEditor } from './code-editor'
import { Preview } from './preview'
import { ShareProjectDialog } from './share-project-dialog'
import { WorkspacePanel } from './workspace-panel'
import { StarterLibrary } from './starter-library'
import { SaveAsStarterDialog } from './save-as-starter-dialog'

type OpenProject = FullProject & { messages: StudioUIMessage[] }
type RightTab = 'preview' | 'code' | 'files'

export function Studio({
  initialProjects,
  initialCanonicals,
  initialActiveId = null,
}: {
  initialProjects: ProjectSummary[]
  initialCanonicals: CanonicalSummary[]
  initialActiveId?: string | null
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects)
  const [canonicals, setCanonicals] = useState<CanonicalSummary[]>(initialCanonicals)
  const [activeId, setActiveId] = useState<string | null>(initialActiveId)
  const [project, setProject] = useState<OpenProject | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('preview')
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  const { state: renderState, render, reset: resetRenderer, exportModel } = useRenderer()

  // ---- server helpers ------------------------------------------------------
  const refreshList = useCallback(async () => {
    const res = await fetch('/api/projects')
    if (res.ok) setProjects(await res.json())
  }, [])

  const refreshCanonicals = useCallback(async () => {
    const res = await fetch('/api/canonicals')
    if (res.ok) setCanonicals(await res.json())
  }, [])

  const openProject = useCallback(async (id: string) => {
    setProject(null)
    const res = await fetch(`/api/projects/${id}`)
    if (res.ok) setProject(await res.json())
  }, [])

  const selectProject = useCallback((id: string | null) => {
    setActiveId(id)
    window.history.replaceState({}, '', id ? `/studio?project=${encodeURIComponent(id)}` : '/studio')
  }, [])

  /**
   * Name a fresh project from its opening message. The server infers the name
   * with a small model call and ignores projects that are already named.
   */
  const nameProject = useCallback(async (id: string, text: string) => {
    const res = await fetch(`/api/projects/${id}/name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return
    const { name } = (await res.json()) as { name: string }
    setProject((p) => (p && p.id === id ? { ...p, name } : p))
    setProjects((list) => list.map((p) => (p.id === id ? { ...p, name } : p)))
  }, [])

  // ---- open the requested workspace; null is the persistent starter home ---
  useEffect(() => {
    setThumbnail(null)
    resetRenderer()
    if (activeId) {
      void openProject(activeId)
      return
    }
    setProject(null)
  }, [activeId, openProject, resetRenderer])

  // Never reuse a preview after its source starts rendering or fails. The next
  // successful mesh supplies a fresh thumbnail for the active workspace.
  useEffect(() => {
    if (renderState.status !== 'done') setThumbnail(null)
  }, [renderState.status])

  // ---- live render (debounced) --------------------------------------------
  useEffect(() => {
    if (!project) return
    const timer = setTimeout(() => render(project.code, project.files), 400)
    return () => clearTimeout(timer)
  }, [project?.id, project?.code, project?.files, render])

  // ---- code & files mutations ----------------------------------------------
  const codeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Manual edits in the editor: update locally, persist debounced. */
  const handleCodeEdit = useCallback((code: string) => {
    setProject((p) => (p ? { ...p, code } : p))
    if (codeSaveTimer.current) clearTimeout(codeSaveTimer.current)
    codeSaveTimer.current = setTimeout(() => {
      setProject((p) => {
        if (p) {
          void fetch(`/api/projects/${p.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: p.code }),
          })
        }
        return p
      })
    }, 800)
  }, [])

  /** Code written by the agent: already persisted server-side. */
  const handleAgentCode = useCallback((code: string) => {
    setProject((p) => (p ? { ...p, code } : p))
    setRightTab('preview')
  }, [])

  const handleFilesChange = useCallback((files: WorkspaceFile[]) => {
    setProject((p) => {
      if (!p) return p
      void fetch(`/api/projects/${p.id}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      })
      return { ...p, files }
    })
  }, [])

  // ---- export ----------------------------------------------------------------
  const handleExport = useCallback(
    async (format: 'stl' | '3mf') => {
      if (!project) return
      let bytes: BlobPart
      if (format === 'stl') {
        // Fresh render in binary STL (colors are not part of the STL format).
        bytes = await exportModel(project.code, project.files, 'binstl')
      } else {
        // 3MF is written client-side from the already-rendered colored mesh.
        if (!renderState.mesh) return
        bytes = meshTo3MF(renderState.mesh) as BlobPart
      }
      const blob = new Blob([bytes], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'model'}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    },
    [project, renderState.mesh, exportModel],
  )

  // ---- project list actions -------------------------------------------------
  const handleNew = async () => {
    const res = await fetch('/api/projects', { method: 'POST' })
    if (!res.ok) return
    const p: FullProject = await res.json()
    selectProject(p.id)
    await refreshList()
  }

  const handleStart = async (canonicalId: string) => {
    const res = await fetch(`/api/canonicals/${canonicalId}/start`, { method: 'POST' })
    if (!res.ok) return
    const p: FullProject = await res.json()
    selectProject(p.id)
    await refreshList()
  }

  const handleFork = async (id: string) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forkFrom: id }),
    })
    if (res.ok) {
      const p: FullProject = await res.json()
      selectProject(p.id)
      await refreshList()
    }
  }

  const handleRename = async (id: string, name: string) => {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setProject((p) => (p && p.id === id ? { ...p, name } : p))
    await refreshList()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    const next = projects.filter((p) => p.id !== id)
    setProjects(next)
    if (id === activeId) {
      setProject(null)
      selectProject(null)
    }
  }

  const handlePublished = (canonical: CanonicalDetail) => {
    setCanonicals((items) => {
      const summary: CanonicalSummary = canonical
      const exists = items.some((item) => item.id === summary.id)
      return exists
        ? items.map((item) => (item.id === summary.id ? summary : item))
        : [summary, ...items]
    })
    if (project?.canonicalDesignId === canonical.id) {
      setProject((value) => (value ? { ...value, canonicalHasNewerVersion: true } : value))
    }
    void refreshCanonicals()
  }

  const tabs: { id: RightTab; label: string }[] = [
    { id: 'preview', label: 'Preview' },
    { id: 'code', label: 'Code' },
    {
      id: 'files',
      label: `Files${project && project.files.length > 0 ? ` (${project.files.length})` : ''}`,
    },
  ]

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        projects={projects}
        activeId={activeId}
        homeActive={!activeId}
        onHome={() => selectProject(null)}
        onSelect={(id) => selectProject(id)}
        onNew={() => void handleNew()}
        onFork={(id) => void handleFork(id)}
        onRename={(id, name) => void handleRename(id, name)}
        onDelete={(id) => void handleDelete(id)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <div className="truncate text-sm font-medium">
            {project ? project.name : activeId ? 'Loading…' : 'Canonical designs'}
          </div>
          {project?.forkedFrom && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              forked
            </span>
          )}
          {project?.canonicalTitle && (
            <span className="rounded bg-[#6e9bff]/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#8eb0ff]">
              {project.canonicalTitle}
              {project.canonicalVersionNumber ? ` · v${project.canonicalVersionNumber}` : ''}
            </span>
          )}
          {project?.canonicalHasNewerVersion && (
            <button
              className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/20"
              onClick={() => selectProject(null)}
            >
              Newer canonical available
            </button>
          )}
          <div className="ml-auto flex items-center gap-1">
            {project && (
              <SaveAsStarterDialog
                project={project}
                thumbnail={thumbnail}
                canUpdateSource={Boolean(
                  project.canonicalDesignId &&
                    canonicals.some(
                      (item) => item.id === project.canonicalDesignId && item.isOwner,
                    ),
                )}
                onPublished={handlePublished}
              />
            )}
            {project && <ShareProjectDialog projectId={project.id} />}
            <UserButton />
          </div>
        </header>

        {!activeId ? (
          <div className="min-h-0 flex-1">
            <StarterLibrary
              canonicals={canonicals}
              projects={projects}
              onBlank={handleNew}
              onStart={handleStart}
              onOpenProject={(id) => selectProject(id)}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
          <section className="flex w-[26rem] shrink-0 flex-col border-r">
            {project ? (
              <ChatPanel
                key={project.id}
                projectId={project.id}
                code={project.code}
                initialMessages={project.messages}
                onCode={handleAgentCode}
                onTurnFinish={() => void refreshList()}
                onFirstMessage={(text) => {
                  if (project.name === PLACEHOLDER_PROJECT_NAME) {
                    void nameProject(project.id, text)
                  }
                }}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading workspace…
              </div>
            )}
          </section>

          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 gap-1 border-b px-3 py-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm',
                    rightTab === tab.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setRightTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative min-h-0 flex-1">
              <div className={cn('absolute inset-0', rightTab !== 'preview' && 'hidden')}>
                <Preview
                  render={renderState}
                  onExport={(f) => void handleExport(f)}
                  onThumbnailReady={setThumbnail}
                />
              </div>
              <div className={cn('absolute inset-0', rightTab !== 'code' && 'hidden')}>
                {project && <CodeEditor value={project.code} onChange={handleCodeEdit} />}
              </div>
              <div className={cn('absolute inset-0', rightTab !== 'files' && 'hidden')}>
                {project && (
                  <WorkspacePanel files={project.files} onChange={handleFilesChange} />
                )}
              </div>
            </div>
          </section>
        </div>
        )}
      </main>
    </div>
  )
}
