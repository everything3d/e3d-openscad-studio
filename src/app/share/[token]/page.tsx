import { auth } from '@clerk/nextjs/server'
import { BoxIcon, GitForkIcon, LockKeyholeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getProjectSharePreview } from '@/lib/db/queries'
import { openSharedProject } from './actions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ token: string }> }

export default async function SharedProjectPage({ params }: Props) {
  const { token } = await params
  const [share, { userId, orgId }] = await Promise.all([getProjectSharePreview(token), auth()])

  if (!share) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
        <section className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-2xl shadow-black/20">
          <div className="mb-5 flex size-11 items-center justify-center rounded-xl border bg-muted">
            <LockKeyholeIcon className="size-5 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold">This share link is unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The owner may have replaced or disabled it. Ask them for a new project link.
          </p>
        </section>
      </main>
    )
  }

  const isSourceWorkspace = share.organizationId
    ? orgId === share.organizationId
    : userId === share.ownerId && !orgId
  const action = openSharedProject.bind(null, token)
  const snapshotDate = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(share.createdAt)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12 text-foreground">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/20">
        <div className="border-b p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BoxIcon className="size-5" />
            </div>
            <div>
              <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                E3D Studio project
              </div>
              <div className="text-sm text-muted-foreground">Shared as a frozen copy</div>
            </div>
          </div>

          <h1 className="text-balance text-2xl font-semibold leading-tight">{share.name}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Open a copy in your active workspace with the conversation, OpenSCAD code, and
            workspace files. Your changes won&apos;t affect the original.
          </p>
        </div>

        <div className="m-7 flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-4">
          <GitForkIcon className="size-4 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-xs font-medium tracking-wide uppercase">Snapshot</div>
            <div className="truncate text-xs text-muted-foreground">{snapshotDate}</div>
          </div>
          <LockKeyholeIcon className="ml-auto size-4 text-muted-foreground" />
        </div>

        <form action={action} className="border-t bg-muted/20 p-7">
          <Button type="submit" size="lg" className="w-full">
            {isSourceWorkspace
              ? 'Open original project'
              : userId
                ? 'Open a copy in this workspace'
                : 'Sign in to open a copy'}
          </Button>
        </form>
      </section>
    </main>
  )
}
