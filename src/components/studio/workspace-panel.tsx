'use client'

import { useRef, useState } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkspaceFile } from '@/lib/types'
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  fileListProblem,
  formatSize,
  newFileProblem,
  safeName,
} from '@/lib/files'
import { uploadWorkspaceFile } from '@/lib/workspace-upload'

interface Props {
  projectId: string
  files: WorkspaceFile[]
  /** Apply a change to the latest file list and save it; rejects when the save fails. */
  onChange: (update: (files: WorkspaceFile[]) => WorkspaceFile[]) => Promise<void>
}

interface Upload {
  name: string
  fraction: number
}

function usageHint(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.scad')) return `use <${name}>`
  if (/\.(csv|dat|json|txt)$/.test(lower)) return name
  return `import("${name}");`
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function WorkspacePanel({ projectId, files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    setError(null)
    const errors: string[] = []
    const picked = Array.from(list).filter((file) => {
      const problem = newFileProblem({ name: safeName(file.name), size: file.size })
      if (problem) errors.push(problem)
      return !problem
    })
    // Check the project limits before uploading anything.
    const pickedNames = new Set(picked.map((file) => safeName(file.name)))
    const listProblem = fileListProblem([
      ...files.filter((f) => !pickedNames.has(f.name)),
      ...picked.map((file) => ({ name: safeName(file.name), size: file.size })),
    ])
    if (listProblem) {
      setError([...errors, listProblem].join(' '))
      return
    }

    setUploads(picked.map((file) => ({ name: safeName(file.name), fraction: 0 })))
    const added: WorkspaceFile[] = []
    for (const file of picked) {
      const name = safeName(file.name)
      try {
        added.push(
          await uploadWorkspaceFile(projectId, file, (fraction) =>
            setUploads((all) => all.map((u) => (u.name === name ? { ...u, fraction } : u))),
          ),
        )
      } catch (err) {
        errors.push(`${name}: ${errorMessage(err)}`)
      }
      setUploads((all) => all.filter((u) => u.name !== name))
    }

    if (added.length) {
      // Replace files with the same name, keep the rest.
      const names = new Set(added.map((f) => f.name))
      try {
        await onChange((current) => [...current.filter((f) => !names.has(f.name)), ...added])
      } catch (err) {
        errors.push(errorMessage(err))
      }
    }
    if (errors.length) setError(errors.join(' '))
  }

  const remove = (name: string) => {
    setError(null)
    onChange((current) => current.filter((f) => f.name !== name)).catch((err: unknown) =>
      setError(errorMessage(err)),
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={uploads.length > 0}
          onClick={() => inputRef.current?.click()}
        >
          + Add files
        </Button>
        <span className="text-xs text-muted-foreground">
          SVG, DXF, STL, .scad libraries… up to {formatSize(MAX_FILE_BYTES)} each, available to{' '}
          <code className="rounded bg-muted px-1 py-0.5">import()</code> in your code.
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {uploads.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Uploading">
          {uploads.map((u) => (
            <li key={u.name} className="rounded-md border border-dashed px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{u.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Uploading… {Math.round(u.fraction * 100)}%
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.round(u.fraction * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {files.length === 0 && uploads.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <p>No files yet.</p>
          <p>
            Add an SVG or DXF and extrude it:
            <br />
            <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
              linear_extrude(height = 5) import(&quot;logo.svg&quot;, center = true);
            </code>
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground">{formatSize(f.size)}</div>
              </div>
              <code
                className="cursor-pointer rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                title="Click to copy"
                onClick={() => {
                  void navigator.clipboard.writeText(usageHint(f.name))
                }}
              >
                {usageHint(f.name)}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Remove file"
                onClick={() => remove(f.name)}
              >
                <XIcon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
