import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { listCanonicals, listProjects } from '@/lib/db/queries'
import { Studio } from '@/components/studio/studio'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ project?: string | string[] }> }

export default async function StudioPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { project } = await searchParams
  const [projects, canonicals] = await Promise.all([listProjects(userId), listCanonicals(userId)])
  const requestedId = typeof project === 'string' ? project : null
  const initialActiveId = projects.some((item) => item.id === requestedId) ? requestedId : null
  return (
    <Studio
      initialProjects={projects}
      initialCanonicals={canonicals}
      initialActiveId={initialActiveId}
    />
  )
}
