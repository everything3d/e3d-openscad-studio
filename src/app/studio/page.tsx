import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { listProjects } from '@/lib/db/queries'
import { Studio } from '@/components/studio/studio'

export const dynamic = 'force-dynamic'

export default async function StudioPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const projects = await listProjects(userId)
  return <Studio initialProjects={projects} />
}
