import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getProject } from '@/lib/db/queries'
import { workbenchFetch } from '@/lib/workbench-service'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ project?: string | string[] }> }

export default async function StudioPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { project } = await searchParams
  let selected = typeof project === 'string' ? project : null
  let error: string | undefined
  if (selected) {
    try {
      const response = await workbenchFetch(userId, `/api/projects/${encodeURIComponent(selected)}/state`)
      if (response.status === 404) {
        const legacy = await getProject(selected, userId)
        if (legacy) {
          const imported = await workbenchFetch(userId, '/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: legacy.id, name: legacy.name, code: legacy.code, files: legacy.files }) })
          if (!imported.ok) throw new Error('Could not open the saved design in the new workspace')
        } else selected = null
      } else if (!response.ok) throw new Error('The workspace service is unavailable')
    } catch (e) { error = e instanceof Error ? e.message : 'Could not open design' }
  }
  return <main style={{ height: '100dvh', background: '#eef2f5', color: '#263a48' }}>
    {error ? <p role="alert" style={{ padding: 24 }}>{error}. <a href="/studio/legacy">Open the previous studio</a></p> :
      <iframe title="E3D design workspace" src={`/api/workbench/view${selected ? `?project=${encodeURIComponent(selected)}` : ''}`}
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />}
  </main>
}
