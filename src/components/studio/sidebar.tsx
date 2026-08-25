'use client'

import { useState } from 'react'
import {
  GitForkIcon,
  LayoutGridIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProjectSummary } from '@/lib/types'

interface Props {
  projects: ProjectSummary[]
  activeId: string | null
  homeActive: boolean
  onHome: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onFork: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export function Sidebar({
  projects,
  activeId,
  homeActive,
  onHome,
  onSelect,
  onNew,
  onFork,
  onRename,
  onDelete,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 motion-reduce:transition-none',
        collapsed ? 'w-14' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex border-b p-2',
          collapsed ? 'flex-col items-center gap-1' : 'items-center gap-1',
        )}
      >
        <button
          type="button"
          onClick={onHome}
          title="Go to canonical designs"
          aria-label="E3D Studio — go to canonical designs"
          className={cn(
            'flex min-w-0 items-center gap-2 rounded-md p-1.5 text-sm font-semibold hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'justify-center' : 'mr-auto',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/e3d-mark-white.png" alt="Everything 3D" className="size-5" />
          {!collapsed && <span className="truncate">E3D Studio</span>}
        </button>
        <Button
          variant="ghost"
          size={collapsed ? 'icon-sm' : 'sm'}
          onClick={onNew}
          title="Blank design"
          aria-label="Create blank design"
        >
          <PlusIcon className="size-3.5" />
          {!collapsed && 'Blank'}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-3.5" />
          ) : (
            <PanelLeftCloseIcon className="size-3.5" />
          )}
        </Button>
      </div>

      <div className={cn('flex-1 overflow-y-auto p-2', collapsed && 'overflow-x-hidden')}>
        <button
          type="button"
          title="Canonical designs"
          aria-label="Canonical designs"
          className={cn(
            'mb-2 flex w-full items-center rounded-md py-2 text-left text-sm',
            collapsed ? 'justify-center px-0' : 'gap-2 px-2',
            homeActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
          onClick={onHome}
        >
          <LayoutGridIcon className="size-4" />
          {!collapsed && 'Canonical designs'}
        </button>
        {!collapsed && (
          <>
            <div className="px-2 pb-2 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Derivative designs
            </div>
            {sorted.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">No derivative designs yet.</div>
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
                      const name = prompt('Rename design', p.name)
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
          </>
        )}
      </div>

      {!collapsed && (
        <div className="border-t p-3 text-xs leading-5 text-muted-foreground">
          Canonical designs stay unchanged. Every derivative gets an independent workspace.
        </div>
      )}
    </aside>
  )
}
