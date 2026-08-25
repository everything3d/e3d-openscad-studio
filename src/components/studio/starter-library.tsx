'use client'

import { useMemo, useState } from 'react'
import { BoxIcon, Clock3Icon, FileCode2Icon, SearchIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CanonicalDetail, CanonicalSummary, ProjectSummary } from '@/lib/types'

interface Props {
  canonicals: CanonicalSummary[]
  projects: ProjectSummary[]
  onBlank: () => Promise<void>
  onStart: (canonicalId: string) => Promise<void>
  onOpenProject: (projectId: string) => void
}

function StarterArtwork({ starter }: { starter: CanonicalSummary }) {
  if (starter.thumbnail) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={starter.thumbnail} alt="" className="h-full w-full object-cover" />
  }
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#11151b]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(110,155,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(110,155,255,.07)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <BoxIcon className="relative size-16 stroke-[1] text-[#6e9bff]/70" />
    </div>
  )
}

export function StarterLibrary({
  canonicals,
  projects,
  onBlank,
  onStart,
  onOpenProject,
}: Props) {
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<CanonicalDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const [creatingBlank, setCreatingBlank] = useState(false)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return canonicals
    return canonicals.filter((item) =>
      [item.title, item.description, item.category ?? ''].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    )
  }, [canonicals, query])

  const openDetail = async (id: string) => {
    setLoadingDetail(id)
    try {
      const res = await fetch(`/api/canonicals/${id}`)
      if (res.ok) setDetail(await res.json())
    } finally {
      setLoadingDetail(null)
    }
  }

  const start = async (id: string) => {
    setStarting(id)
    try {
      await onStart(id)
      setDetail(null)
    } finally {
      setStarting(null)
    }
  }

  const blank = async () => {
    setCreatingBlank(true)
    try {
      await onBlank()
    } finally {
      setCreatingBlank(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0f1115] text-[#f4f5f7]">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end">
          <div>
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#6e9bff]">
              Canonical design library
            </div>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Start from a canonical design.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
              Choose a reusable model, then create an independent derivative with AI.
              The canonical design stays unchanged.
            </p>
          </div>
          <label className="relative block w-full md:w-80">
            <span className="sr-only">Search canonical designs</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search canonical designs"
              className="h-10 border-white/10 bg-white/[0.04] pl-9"
            />
          </label>
        </div>

        <section className="py-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <button
              onClick={() => void blank()}
              disabled={creatingBlank}
              className="group min-h-72 overflow-hidden rounded-xl border border-dashed border-white/20 bg-white/[0.025] text-left transition hover:border-[#6e9bff]/60 hover:bg-[#6e9bff]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6e9bff]"
            >
              <div className="flex h-44 items-center justify-center border-b border-white/10">
                <div className="flex size-16 items-center justify-center rounded-full border border-white/15 bg-black/20 transition group-hover:scale-105 motion-reduce:transform-none">
                  <SparklesIcon className="size-6 text-[#6e9bff]" />
                </div>
              </div>
              <div className="p-4">
                <div className="text-base font-medium">Blank design</div>
                <p className="mt-1 text-sm text-white/45">
                  Begin with a fresh model and no inherited guidance.
                </p>
                <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                  New workspace · Empty chat
                </div>
              </div>
            </button>

            {filtered.map((starter) => (
              <button
                key={starter.id}
                onClick={() => void openDetail(starter.id)}
                className="group overflow-hidden rounded-xl border border-white/10 bg-[#1a1e24] text-left transition hover:-translate-y-0.5 hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6e9bff] motion-reduce:transform-none"
              >
                <div className="h-44 overflow-hidden border-b border-white/10">
                  <div className="h-full transition duration-300 group-hover:scale-[1.025] motion-reduce:transform-none">
                    <StarterArtwork starter={starter} />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="truncate text-base font-medium">{starter.title}</div>
                    {loadingDetail === starter.id && (
                      <span className="text-xs text-white/40">Loading…</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-white/45">
                    {starter.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                    <span>Canonical · v{starter.versionNumber}</span>
                    <span>{starter.fileCount} files</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 && query && (
            <div className="mt-4 border border-white/10 p-8 text-center text-sm text-white/45">
              No canonical designs match “{query}”. Start blank or try a broader search.
            </div>
          )}
        </section>

        {projects.length > 0 && (
          <section className="border-t border-white/10 pt-8">
            <div className="mb-4 flex items-center gap-2">
              <Clock3Icon className="size-4 text-white/40" />
              <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-white/65">
                Recent work
              </h2>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {projects.slice(0, 6).map((project) => (
                <button
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-3 text-left hover:border-white/20 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6e9bff]"
                >
                  <FileCode2Icon className="size-4 shrink-0 text-[#6e9bff]/75" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{project.name}</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
                      {project.canonicalTitle
                        ? `${project.canonicalTitle}${project.canonicalHasNewerVersion ? ' · update available' : ''}`
                        : 'Blank origin'}{' '}
                      · {project.messageCount} messages
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        {detail && (
          <DialogContent className="max-h-[88vh] overflow-y-auto border border-white/10 bg-[#171a20] sm:max-w-2xl">
            <div className="-mx-4 -mt-4 h-64 overflow-hidden border-b border-white/10">
              <StarterArtwork starter={detail} />
            </div>
            <DialogHeader>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#6e9bff]">
                Canonical · version {detail.versionNumber}
              </div>
              <DialogTitle className="text-2xl">{detail.title}</DialogTitle>
              <DialogDescription className="leading-6">{detail.description}</DialogDescription>
            </DialogHeader>
            {detail.modificationGuide && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Common changes and gotchas
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-white/70">
                  {detail.modificationGuide}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => void start(detail.id)} disabled={starting === detail.id}>
                {starting === detail.id ? 'Creating…' : 'Create derivative'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
