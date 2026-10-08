'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { UIMessage } from 'ai'
import { UserButton } from '@clerk/nextjs'
import { Maximize2Icon, MenuIcon, Minimize2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useRenderer } from '@/lib/openscad/useRenderer'
import { meshTo3MF } from '@/lib/openscad/threemf'
import {
  provisionalNameBase,
  type CanonicalDetail,
  type CanonicalSummary,
  type FullProject,
  type ProjectSummary,
  type WorkspaceFile,
} from '@/lib/types'
import type { StudioUIMessage } from '@/lib/agents/studio-agent'
import { Sidebar } from './sidebar'
import { ShareProjectDialog } from './share-project-dialog'
import { WorkspacePanel } from './workspace-panel'
import { StarterLibrary } from './starter-library'
import { SaveAsStarterDialog } from './save-as-starter-dialog'
import { OrderDialog } from './order-dialog'

// The workspace pulls in the chat stack (markdown, syntax highlighting),
// CodeMirror and three.js, together most of the page's JavaScript. Loading
// them on demand keeps the canonical library light, and none of them can
// render on the server anyway (they need the DOM and WebGL).
const workspaceFallback = (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
    Loading…
  </div>
)
const ChatPanel = dynamic(() => import('./chat-panel').then((m) => m.ChatPanel), {
  ssr: false,
  loading: () => workspaceFallback,
})
const CodeEditor = dynamic(() => import('./code-editor').then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => workspaceFallback,
})
const Preview = dynamic(() => import('./preview').then((m) => m.Preview), {
  ssr: false,
  loading: () => workspaceFallback,
})

type OpenProject = FullProject & { messages: StudioUIMessage[] }
type RightTab = 'preview' | 'code' | 'files'

export function Studio({
  initialProjects,
  initialCanonicals,
  initialActiveId = null,
  initialProject = null,
  checkoutEnabled = false,
}: {
  initialProjects: ProjectSummary[]
  initialCanonicals: CanonicalSummary[]
  initialActiveId?: string | null
  /** The workspace for `initialActiveId`, when the server already loaded it. */
  initialProject?: (FullProject & { messages: UIMessage[] }) | null
  /** False when Shopify is not configured: orders then go through WhatsApp. */
  checkoutEnabled?: boolean
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects)
  const [canonicals, setCanonicals] = useState<CanonicalSummary[]>(initialCanonicals)
  const [activeId, setActiveId] = useState<string | null>(initialActiveId)
  const [project, setProject] = useState<OpenProject | null>(
    initialProject && initialProject.id === initialActiveId
      ? (initialProject as OpenProject)
      : null,
  )
  /** Set while the server-loaded workspace is current, so the first effect run does not refetch it. */
  const preloadedId = useRef<string | null>(project?.id ?? null)
  const [rightTab, setRightTab] = useState<RightTab>('preview')
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)
  /** Phone layout only: the sidebar drawer, and whether the preview hides the chat. */
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false)

  const { state: renderState, render, reset: resetRenderer, exportModel, warmup } = useRenderer()

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
    setDrawerOpen(false)
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

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  // ---- open the requested workspace; null is the persistent starter home ---
  useEffect(() => {
    setThumbnail(null)
    resetRenderer()
    if (activeId) {
      // Start fetching the wasm and fonts now, in parallel with the project
      // itself, instead of after it arrives and the first render is requested.
      warmup()
      if (preloadedId.current === activeId) {
        // Already in state from the server render; nothing to fetch.
        preloadedId.current = null
        return
      }
      void openProject(activeId)
      return
    }
    setProject(null)
  }, [activeId, openProject, resetRenderer, warmup])

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
        mobileOpen={drawerOpen}
        onMobileClose={() => setDrawerOpen(false)}
      />
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 md:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open designs"
            aria-expanded={drawerOpen}
          >
            <MenuIcon className="size-4" />
          </Button>
          <div className="min-w-0 truncate text-sm font-medium">
            {project ? project.name : activeId ? 'Loading…' : 'Canonical designs'}
          </div>
          {project?.forkedFrom && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground max-sm:hidden">
              forked
            </span>
          )}
          {project?.canonicalTitle && (
            <span className="shrink-0 rounded bg-[#6e9bff]/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#8eb0ff] max-md:hidden">
              {project.canonicalTitle}
              {project.canonicalVersionNumber ? ` · v${project.canonicalVersionNumber}` : ''}
            </span>
          )}
          {project?.canonicalHasNewerVersion && (
            <button
              className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/20"
              onClick={() => selectProject(null)}
              title="Newer canonical available"
            >
              <span className="sm:hidden">Update</span>
              <span className="max-sm:hidden">Newer canonical available</span>
            </button>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
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
          // Phones stack the 3D workspace above the chat; from `md` they sit side by side.
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <section
            className={cn(
              'order-2 flex min-h-0 flex-1 flex-col border-t md:order-1 md:w-[26rem] md:flex-none md:shrink-0 md:border-r md:border-t-0',
              workspaceExpanded && 'max-md:hidden',
            )}
          >
            {project ? (
              <ChatPanel
                key={project.id}
                projectId={project.id}
                code={project.code}
                initialMessages={project.messages}
                onCode={handleAgentCode}
                onTurnFinish={() => void refreshList()}
                onFirstMessage={(text) => {
                  if (provisionalNameBase(project.name) !== null) {
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

          <section
            className={cn(
              'order-1 flex min-w-0 shrink-0 flex-col md:order-2 md:h-auto md:flex-1',
              workspaceExpanded ? 'max-md:flex-1' : 'h-[45%]',
            )}
          >
            <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5 md:px-3 md:py-2">
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
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto md:hidden"
                onClick={() => setWorkspaceExpanded((value) => !value)}
                aria-label={workspaceExpanded ? 'Show chat' : 'Expand to full screen'}
                aria-pressed={workspaceExpanded}
              >
                {workspaceExpanded ? <Minimize2Icon /> : <Maximize2Icon />}
              </Button>
            </div>
            <div className="relative min-h-0 flex-1">
              <div className={cn('absolute inset-0', rightTab !== 'preview' && 'hidden')}>
                <Preview
                  render={renderState}
                  onExport={(f) => void handleExport(f)}
                  onThumbnailReady={setThumbnail}
                  onOrder={() => setOrderOpen(true)}
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

      {project && (
        <OrderDialog
          open={orderOpen}
          onOpenChange={setOrderOpen}
          projectId={project.id}
          projectName={project.name}
          mesh={renderState.mesh}
          checkoutEnabled={checkoutEnabled}
        />
      )}
    </div>
  )
}
