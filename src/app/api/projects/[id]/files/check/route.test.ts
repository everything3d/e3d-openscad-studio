import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ownsProject: vi.fn(),
  storedBlobSize: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db/queries', () => ({ ownsProject: mocks.ownsProject }))
vi.mock('@/lib/blob', () => ({ storedBlobSize: mocks.storedBlobSize }))

import { POST } from './route'

const SHA = 'e'.repeat(64)

function call(body: unknown) {
  const req = new Request('http://localhost/api/projects/p1/files/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return POST(req, { params: Promise.resolve({ id: 'p1' }) })
}

describe('POST /api/projects/[id]/files/check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user_1' })
    mocks.ownsProject.mockResolvedValue(true)
    mocks.storedBlobSize.mockResolvedValue(null)
  })

  it('points a new file at the caller’s content-addressed path', async () => {
    const res = await call({ name: 'part.stl', size: 10, sha256: SHA })
    expect(await res.json()).toEqual({ blobPath: `workspace/user_1/${SHA}`, exists: false })
  })

  it('reports bytes that are already stored, so the upload is skipped', async () => {
    mocks.storedBlobSize.mockResolvedValue(10)
    const res = await call({ name: 'part.stl', size: 10, sha256: SHA })
    expect(await res.json()).toMatchObject({ exists: true })
  })

  it('rejects oversized and unsupported files before touching storage', async () => {
    expect((await call({ name: 'part.stl', size: 101 * 1024 * 1024, sha256: SHA })).status).toBe(400)
    expect((await call({ name: 'photo.png', size: 1, sha256: SHA })).status).toBe(400)
    expect((await call({ name: 'part.stl', size: 1, sha256: 'nope' })).status).toBe(400)
    expect(mocks.storedBlobSize).not.toHaveBeenCalled()
  })

  it('hides other users’ projects', async () => {
    mocks.ownsProject.mockResolvedValue(false)
    expect((await call({ name: 'part.stl', size: 10, sha256: SHA })).status).toBe(404)
  })
})
