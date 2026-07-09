import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import CodeEditor from './components/CodeEditor'
import Preview from './components/Preview'
import SettingsModal from './components/Settings'
import { useRenderer } from './openscad/useRenderer'
import { sendChat } from './ai'
import type { Project, Settings } from './types'
import {
  createProject,
  forkProject,
  loadActiveId,
  loadProjects,
  loadSettings,
  makeMessage,
  saveActiveId,
  saveProjects,
  saveSettings,
} from './store'

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>(loadSettings())
  const [showSettings, setShowSettings] = useState(false)
  const [busy, setBusy] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'preview' | 'code'>('preview')

  const { state: renderState, render } = useRenderer()
  const renderTimer = useRef<number | null>(null)

  // ---- bootstrap ----------------------------------------------------------
  useEffect(() => {
    const loaded = loadProjects()
    if (loaded.length === 0) {
      const first = createProject('My first model')
      setProjects([first])
      setActiveId(first.id)
    } else {
      setProjects(loaded)
      const saved = loadActiveId()
      setActiveId(saved && loaded.some((p) => p.id === saved) ? saved : loaded[0].id)
    }
  }, [])

  // ---- persistence --------------------------------------------------------
  useEffect(() => {
    if (projects.length) saveProjects(projects)
  }, [projects])

  useEffect(() => {
    saveActiveId(activeId)
  }, [activeId])

  const active = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId],
  )

  // ---- live render (debounced) -------------------------------------------
  useEffect(() => {
    if (!active) return
    if (renderTimer.current) window.clearTimeout(renderTimer.current)
    renderTimer.current = window.setTimeout(() => {
      render(active.code)
    }, 400)
    return () => {
      if (renderTimer.current) window.clearTimeout(renderTimer.current)
    }
    // Re-render whenever the active project or its code changes.
  }, [active?.id, active?.code, render])

  // ---- project mutations --------------------------------------------------
  const patchProject = useCallback(
    (id: string, patch: Partial<Project>) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
        ),
      )
    },
    [],
  )

  const handleNew = () => {
    const p = createProject()
    setProjects((prev) => [p, ...prev])
    setActiveId(p.id)
  }

  const handleFork = (id: string) => {
    const src = projects.find((p) => p.id === id)
    if (!src) return
    const p = forkProject(src)
    setProjects((prev) => [p, ...prev])
    setActiveId(p.id)
  }

  const handleDelete = (id: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id)
      if (id === activeId) setActiveId(next[0]?.id ?? null)
      return next
    })
  }

  const handleCodeChange = (code: string) => {
    if (active) patchProject(active.id, { code })
  }

  // ---- chat ---------------------------------------------------------------
  const handleSend = async (text: string) => {
    if (!active) return
    setChatError(null)

    const userMsg = makeMessage('user', text)
    const historyForApi = [...active.messages, userMsg]
    const codeForApi = active.code
    const projectId = active.id

    // Optimistically show the user's message + auto-name new projects.
    patchProject(projectId, {
      messages: historyForApi,
      name:
        active.messages.length === 0 && active.name === 'Untitled project'
          ? text.slice(0, 40)
          : active.name,
    })

    setBusy(true)
    try {
      const result = await sendChat(settings, historyForApi, codeForApi)
      const assistantMsg = makeMessage(
        'assistant',
        result.content,
        result.code ?? undefined,
      )
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p
          return {
            ...p,
            messages: [...p.messages, assistantMsg],
            code: result.code ?? p.code,
            updatedAt: Date.now(),
          }
        }),
      )
      if (result.code) setRightTab('preview')
    } catch (e) {
      setChatError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleSaveSettings = (s: Settings) => {
    setSettings(s)
    saveSettings(s)
  }

  const needsSetup = !settings.apiKey

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onFork={handleFork}
        onRename={(id, name) => patchProject(id, { name })}
        onDelete={handleDelete}
      />

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            {active ? active.name : 'No project'}
            {active?.forkedFrom && <span className="fork-tag">forked</span>}
          </div>
          <div className="topbar-actions">
            {needsSetup && (
              <span className="setup-hint" onClick={() => setShowSettings(true)}>
                ⚠ Add your API key to start
              </span>
            )}
            <button className="btn-secondary" onClick={() => setShowSettings(true)}>
              Settings
            </button>
          </div>
        </header>

        <div className="workspace">
          <section className="pane pane-chat">
            {active ? (
              <Chat
                messages={active.messages}
                busy={busy}
                error={chatError}
                onSend={handleSend}
              />
            ) : (
              <div className="chat-empty">
                <p>Create a project to get started.</p>
              </div>
            )}
          </section>

          <section className="pane pane-right">
            <div className="right-tabs">
              <button
                className={rightTab === 'preview' ? 'tab active' : 'tab'}
                onClick={() => setRightTab('preview')}
              >
                Preview
              </button>
              <button
                className={rightTab === 'code' ? 'tab active' : 'tab'}
                onClick={() => setRightTab('code')}
              >
                Code
              </button>
            </div>
            <div className="right-body">
              <div
                className="right-panel"
                style={{ display: rightTab === 'preview' ? 'block' : 'none' }}
              >
                <Preview render={renderState} />
              </div>
              <div
                className="right-panel"
                style={{ display: rightTab === 'code' ? 'block' : 'none' }}
              >
                {active && (
                  <CodeEditor value={active.code} onChange={handleCodeChange} />
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
