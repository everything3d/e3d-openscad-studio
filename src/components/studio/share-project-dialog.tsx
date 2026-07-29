'use client'

import { useEffect, useState } from 'react'
import {
  CheckIcon,
  CopyIcon,
  Link2OffIcon,
  RefreshCwIcon,
  Share2Icon,
  SnowflakeIcon,
} from 'lucide-react'
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

interface ShareLink {
  path: string
  createdAt: number
}

interface Props {
  projectId: string
}

export function ShareProjectDialog({ projectId }: Props) {
  const [open, setOpen] = useState(false)
  const [share, setShare] = useState<ShareLink | null>(null)
  const [origin, setOrigin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setOrigin(window.location.origin)
    setLoading(true)
    setError(null)
    setCopied(false)

    void fetch(`/api/projects/${projectId}/share`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load sharing status.')
        const data = (await res.json()) as { share: ShareLink | null }
        setShare(data.share)
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Could not load sharing status.')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [open, projectId])

  const createLink = async (replacing: boolean) => {
    if (
      replacing &&
      !window.confirm('Replace this link? The current URL will stop working.')
    ) {
      return
    }

    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: 'POST' })
      if (!res.ok) throw new Error('Could not create a share link.')
      const data = (await res.json()) as { share: ShareLink }
      setShare(data.share)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create a share link.')
    } finally {
      setLoading(false)
    }
  }

  const disableLink = async () => {
    if (!window.confirm('Disable this link? Existing private copies will keep working.')) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not disable the share link.')
      setShare(null)
      setCopied(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not disable the share link.')
    } finally {
      setLoading(false)
    }
  }

  const shareUrl = share ? `${origin}${share.path}` : ''
  const snapshotDate = share
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(share.createdAt)
    : null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Share project"
      >
        <Share2Icon />
        <span className="hidden sm:inline">Share project</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share this project</DialogTitle>
            <DialogDescription>
              Send someone a private starting point, including this conversation, code, and files.
            </DialogDescription>
          </DialogHeader>

          {loading && !share ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          ) : share ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-3">
                <SnowflakeIcon className="size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-xs font-medium tracking-wide uppercase">Frozen snapshot</div>
                  <div className="truncate text-xs text-muted-foreground">{snapshotDate}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Input readOnly value={shareUrl} aria-label="Share link" />
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(shareUrl).then(() => {
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 2000)
                    })
                  }}
                  disabled={!shareUrl}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <p className="text-xs leading-5 text-muted-foreground">
                Later edits stay private. Replace the link when you want to share a newer version.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <SnowflakeIcon className="size-4 text-muted-foreground" />
                Share exactly what&apos;s here now
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                The link is a frozen snapshot. New messages, edits, and files won&apos;t appear in
                it.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="sm:justify-between">
            {share ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => void disableLink()}
                  disabled={loading}
                >
                  <Link2OffIcon />
                  Disable link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void createLink(true)}
                  disabled={loading}
                >
                  <RefreshCwIcon />
                  Replace with current version
                </Button>
              </>
            ) : (
              <Button
                className="sm:ml-auto"
                onClick={() => void createLink(false)}
                disabled={loading}
              >
                <Share2Icon />
                {loading ? 'Creating…' : 'Create share link'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
