import { auth } from '@clerk/nextjs/server'
import { workbenchFetch } from '@/lib/workbench-service'
import { getCanonical, getProject, listCanonicals, listProjects } from '@/lib/db/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  if (request.method !== 'GET' && request.headers.get('origin') && request.headers.get('origin') !== url.origin) {
    return Response.json({ error: 'Use the Studio interface for this action' }, { status: 403 })
  }
  const { path: parts } = await context.params
  if (parts.some(part => part === '..' || part.includes('/') || part.includes('\\'))) return Response.json({ error: 'Invalid path' }, { status: 400 })
  try {
    if (parts.join('/') === 'library' && request.method === 'GET') {
      const [projects, canonicals] = await Promise.all([listProjects(userId), listCanonicals(userId)])
      return Response.json({ projects, canonicals })
    }
    if (parts.join('/') === 'library/import' && request.method === 'POST') {
      const input = await request.json()
      const source = input.kind === 'starter' ? await getCanonical(input.id, userId) : await getProject(input.id, userId)
      if (!source) return Response.json({ error: 'Design not found' }, { status: 404 })
      const response = await workbenchFetch(userId, '/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'title' in source ? source.title : source.name, code: source.code, files: source.files ?? [] }),
      })
      return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } })
    }
    const pathname = parts.join('/') === 'view' ? '/' : '/' + parts.map(encodeURIComponent).join('/')
    if (request.method !== 'GET' && Number(request.headers.get('content-length') || 0) > 48 * 1024 * 1024) return Response.json({ error: 'Upload exceeds 48 MB' }, { status: 413 })
    const body = request.method === 'GET' ? undefined : await request.arrayBuffer()
    if (body && body.byteLength > 48 * 1024 * 1024) return Response.json({ error: 'Upload exceeds 48 MB' }, { status: 413 })
    const response = await workbenchFetch(userId, pathname, { method: request.method, body,
      headers: { 'Content-Type': request.headers.get('content-type') || 'application/json' }, signal: request.signal })
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    for (const name of ['content-type', 'content-disposition']) { const value = response.headers.get(name); if (value) headers.set(name, value) }
    return new Response(response.body, { status: response.status, headers })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Workspace service failed' }, { status: 503 })
  }
}
export { handle as GET, handle as POST }
