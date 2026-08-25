'use client'

import { useEffect, useState } from 'react'
import { BookmarkPlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CanonicalDetail, FullProject, StarterDraft } from '@/lib/types'

interface Props {
  project: FullProject
  thumbnail: string | null
  canUpdateSource: boolean
  onPublished: (canonical: CanonicalDetail) => void
}

const EMPTY: StarterDraft = {
  title: '',
  description: '',
  modificationGuide: '',
  reusableChanges: [],
  derivativeSpecificRisks: [],
}

export function SaveAsStarterDialog({
  project,
  thumbnail,
  canUpdateSource,
  onPublished,
}: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<StarterDraft>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError(null)
    setReviewed(false)
    void fetch(`/api/projects/${project.id}/starter-draft`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not prepare canonical design details.')
        return (await res.json()) as StarterDraft
      })
      .then((value) => active && setDraft(value))
      .catch((reason) => {
        if (!active) return
        setDraft({ ...EMPTY, title: project.name })
        setError(reason instanceof Error ? reason.message : 'Could not prepare canonical design details.')
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, project.id, project.name])

  const publish = async (mode: 'new' | 'version') => {
    if (!draft.title.trim() || !draft.description.trim()) {
      setError('Add a title and description before saving.')
      return
    }
    if (draft.derivativeSpecificRisks.length > 0 && !reviewed) {
      setError('Review the derivative-specific details before saving.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const endpoint =
        mode === 'version' && project.canonicalDesignId
          ? `/api/canonicals/${project.canonicalDesignId}/versions`
          : '/api/canonicals'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          title: draft.title,
          description: draft.description,
          modificationGuide: draft.modificationGuide,
          changeSummary: draft.reusableChanges.join('; '),
          thumbnail,
          ...(mode === 'new' ? { visibility: 'private' } : {}),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Could not save canonical design.')
      }
      onPublished(await res.json())
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save canonical design.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <BookmarkPlusIcon className="size-3.5" /> Save as canonical
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save a canonical design</DialogTitle>
          <DialogDescription>
            The canonical receives the current code and files, but never this conversation.
            Review details that belong only to this derivative before saving.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Distilling reusable details…
          </div>
        ) : (
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-xs font-medium">
              Title
              <Input
                value={draft.title}
                onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium">
              Description
              <Textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, description: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium">
              Instructions for the design agent
              <Textarea
                className="min-h-28"
                value={draft.modificationGuide}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, modificationGuide: event.target.value }))
                }
              />
            </label>

            {draft.reusableChanges.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-medium">Potentially reusable improvements</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {draft.reusableChanges.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}

            {draft.derivativeSpecificRisks.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="text-xs font-medium text-amber-300">Review before saving</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/70">
                  {draft.derivativeSpecificRisks.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <label className="mt-3 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(event) => setReviewed(event.target.checked)}
                    className="mt-0.5"
                  />
                  I reviewed the code and files for details that should not become canonical.
                </label>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {canUpdateSource && (
            <Button variant="outline" disabled={loading || saving} onClick={() => void publish('version')}>
              {saving ? 'Saving…' : 'Save new version'}
            </Button>
          )}
          <Button disabled={loading || saving} onClick={() => void publish('new')}>
            {saving ? 'Saving…' : 'Create new canonical'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
