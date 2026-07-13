'use client'

import { GitForkIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProjectSummary } from '@/lib/types'

interface Props {
  projects: ProjectSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onFork: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export function Sidebar({
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
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-primary">◈</span>
          <span>E3D Studio</span>
        </div>
        <Button size="sm" onClick={onNew} title="New project">
          + New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sorted.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground">No projects yet.</div>
        )}
        {sorted.map((p) => (
          <div
            key={p.id}
            className={cn(
              'group flex cursor-pointer items-center gap-1 rounded-md px-2 py-2',
              p.id === activeId ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
            )}
            onClick={() => onSelect(p.id)}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{p.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {p.forkedFrom && (
                  <span className="rounded bg-muted px-1 text-[10px] uppercase">fork</span>
                )}
                {p.messageCount} msg
              </div>
            </div>
            <div
              className="hidden shrink-0 items-center group-hover:flex"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="icon-sm" title="Fork" onClick={() => onFork(p.id)}>
                <GitForkIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Rename"
                onClick={() => {
                  const name = prompt('Rename project', p.name)
                  if (name && name.trim()) onRename(p.id, name.trim())
                }}
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Delete"
                onClick={() => {
                  if (confirm(`Delete "${p.name}"? This cannot be undone.`)) onDelete(p.id)
                }}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3 text-xs text-muted-foreground">
        Projects are chats. Fork any one to branch a new idea.
      </div>
    </aside>
  )
}
