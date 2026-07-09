import type { Project } from '../types'

interface Props {
  projects: Project[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onFork: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export default function Sidebar({
  projects,
  activeId,
  onSelect,
  onNew,
  onFork,
  onRename,
  onDelete,
}: Props) {
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-name">E3D Studio</span>
        </div>
        <button className="btn-new" onClick={onNew} title="New project">
          + New
        </button>
      </div>

      <div className="project-list">
        {sorted.length === 0 && (
          <div className="project-empty">No projects yet.</div>
        )}
        {sorted.map((p) => (
          <div
            key={p.id}
            className={`project ${p.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <div className="project-main">
              <div className="project-name">{p.name}</div>
              <div className="project-meta">
                {p.forkedFrom && <span className="fork-tag">fork</span>}
                {p.messages.length} msg
              </div>
            </div>
            <div className="project-actions" onClick={(e) => e.stopPropagation()}>
              <button
                title="Fork"
                onClick={() => onFork(p.id)}
              >
                ⑂
              </button>
              <button
                title="Rename"
                onClick={() => {
                  const name = prompt('Rename project', p.name)
                  if (name && name.trim()) onRename(p.id, name.trim())
                }}
              >
                ✎
              </button>
              <button
                title="Delete"
                onClick={() => {
                  if (confirm(`Delete "${p.name}"? This cannot be undone.`))
                    onDelete(p.id)
                }}
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        Projects are chats. Fork any one to branch a new idea.
      </div>
    </aside>
  )
}
