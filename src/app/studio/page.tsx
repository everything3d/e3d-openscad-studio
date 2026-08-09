import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { listProjects } from '@/lib/db/queries'
import { Studio } from '@/components/studio/studio'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ project?: string | string[] }> }

export default async function StudioPage({ searchParams }: Props) {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  const { project } = await searchParams
  const access = { userId, organizationId: orgId ?? null }
  const projects = await listProjects(access)
  const requestedId = typeof project === 'string' ? project : null
  const initialActiveId = projects.some((item) => item.id === requestedId) ? requestedId : null
  return (
    <Studio
      key={orgId ?? `personal:${userId}`}
      initialProjects={projects}
      initialActiveId={initialActiveId}
    />
  )
}
