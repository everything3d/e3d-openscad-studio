import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn(), getProject: vi.fn(), getCanonical: vi.fn(), listProjects: vi.fn(), listCanonicals: vi.fn() }))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/workbench-service', () => ({ workbenchFetch: mocks.fetch }))
vi.mock('@/lib/db/queries', () => ({ getProject: mocks.getProject, getCanonical: mocks.getCanonical, listProjects: mocks.listProjects, listCanonicals: mocks.listCanonicals }))
import { GET, POST } from './route'
const context = (path: string[]) => ({ params: Promise.resolve({ path }) })
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: 'owner' }) })
describe('workspace gateway', () => {
  it('rejects unauthenticated access before touching local workspaces', async () => {
    mocks.auth.mockResolvedValue({ userId: null })
    expect((await GET(new Request('http://localhost/api/workbench/api/projects'), context(['api', 'projects']))).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('rejects cross-origin writes', async () => {
    const request = new Request('http://localhost/api/workbench/api/projects', { method: 'POST', headers: { origin: 'https://example.org' }, body: '{}' })
    expect((await POST(request, context(['api', 'projects']))).status).toBe(403)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('forwards the authenticated owner instead of client-supplied owner headers', async () => {
    mocks.fetch.mockResolvedValue(new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
    await GET(new Request('http://localhost/api/workbench/api/projects', { headers: { 'x-e3d-owner': 'someone-else' } }), context(['api', 'projects']))
    expect(mocks.fetch).toHaveBeenCalledWith('owner', '/api/projects', expect.any(Object))
    expect(mocks.fetch.mock.calls[0][2].headers).not.toHaveProperty('x-e3d-owner')
  })
  it('imports a saved design only after looking it up for the current owner', async () => {
    mocks.getProject.mockResolvedValue(null)
    const response = await POST(new Request('http://localhost/api/workbench/library/import', { method: 'POST', body: JSON.stringify({ id: 'private', kind: 'project' }) }), context(['library', 'import']))
    expect(response.status).toBe(404)
    expect(mocks.getProject).toHaveBeenCalledWith('private', 'owner')
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
