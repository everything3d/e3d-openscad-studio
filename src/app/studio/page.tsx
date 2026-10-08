import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getProject, getProjectMessages, listCanonicals, listProjects } from '@/lib/db/queries'
import { Studio } from '@/components/studio/studio'
import { isOrderingEnabled } from '@/lib/shopify'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ project?: string | string[] }> }

export default async function StudioPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { project } = await searchParams
  const requestedId = typeof project === 'string' ? project : null
  // Load the requested workspace here, alongside the lists, rather than
  // leaving the client to fetch it after hydration: that second round trip
  // (and the render that waits on it) was the longest step in opening a
  // design from a link or a reload.
  const [projects, canonicals, requested] = await Promise.all([
    listProjects(userId),
    listCanonicals(userId),
    requestedId
      ? Promise.all([getProject(requestedId, userId), getProjectMessages(requestedId)]).then(
          ([full, messages]) => (full ? { ...full, messages } : null),
        )
      : Promise.resolve(null),
  ])
  return (
    <Studio
      initialProjects={projects}
      initialCanonicals={canonicals}
      initialActiveId={requested?.id ?? null}
      initialProject={requested}
      checkoutEnabled={isOrderingEnabled()}
    />
  )
}
