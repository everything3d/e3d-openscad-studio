'use client'

import { useRef, useState } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkspaceFile } from '@/lib/types'
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  formatSize,
  toWorkspaceFile,
} from '@/lib/files'

interface Props {
  files: WorkspaceFile[]
  onChange: (files: WorkspaceFile[]) => void
}

function usageHint(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.scad')) return `use <${name}>`
  if (/\.(csv|dat|json|txt)$/.test(lower)) return name
  return `import("${name}");`
}

export function WorkspacePanel({ files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    setError(null)
    const errors: string[] = []
    const added: WorkspaceFile[] = []
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        errors.push(
          `${file.name} is ${formatSize(file.size)} — max is ${formatSize(MAX_FILE_BYTES)}.`,
        )
        continue
      }
      added.push(await toWorkspaceFile(file))
    }
    if (added.length) {
      // Replace files with the same name, keep the rest.
      const names = new Set(added.map((f) => f.name))
      onChange([...files.filter((f) => !names.has(f.name)), ...added])
    }
    if (errors.length) setError(errors.join(' '))
  }

  const remove = (name: string) => {
    onChange(files.filter((f) => f.name !== name))
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          + Add files
        </Button>
        <span className="text-xs text-muted-foreground">
          SVG, DXF, STL, .scad libraries… available to{' '}
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

      {files.length === 0 ? (
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
