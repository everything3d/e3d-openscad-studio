import { listProjects } from '@/lib/db/queries'
import { Studio } from '@/components/studio/studio'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const projects = await listProjects()
  return <Studio initialProjects={projects} />
}
