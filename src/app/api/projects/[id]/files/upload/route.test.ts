import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ownsProject: vi.fn(),
  handleUpload: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db/queries', () => ({ ownsProject: mocks.ownsProject }))
vi.mock('@vercel/blob/client', () => ({ handleUpload: mocks.handleUpload }))

import { MAX_FILE_BYTES } from '@/lib/files'
import { POST } from './route'

const SHA = 'd'.repeat(64)

function call(pathname: string) {
  const req = new Request('http://localhost/api/projects/p1/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname, clientPayload: null, multipart: false },
    }),
  })
  return POST(req, { params: Promise.resolve({ id: 'p1' }) })
}

describe('POST /api/projects/[id]/files/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user_1' })
    mocks.ownsProject.mockResolvedValue(true)
    // Run the route's token policy the way the SDK would.
    mocks.handleUpload.mockImplementation(async ({ body, onBeforeGenerateToken }) => ({
      type: 'blob.generate-client-token',
      options: await onBeforeGenerateToken(body.payload.pathname, null, false),
    }))
  })

  it('requires authentication', async () => {
    mocks.auth.mockResolvedValue({ userId: null })
    expect((await call(`workspace/user_1/${SHA}`)).status).toBe(401)
    expect(mocks.handleUpload).not.toHaveBeenCalled()
  })

  it('issues a token for the caller’s own content-addressed path, never overwriting', async () => {
    const res = await call(`workspace/user_1/${SHA}`)
    expect(res.status).toBe(200)
    const { options } = await res.json()
    expect(options).toMatchObject({
      maximumSizeInBytes: MAX_FILE_BYTES,
      addRandomSuffix: false,
      allowOverwrite: false,
    })
    expect(mocks.ownsProject).toHaveBeenCalledWith('p1', 'user_1')
  })

  it.each([`workspace/user_2/${SHA}`, 'workspace/user_1/evil.stl', `other/${SHA}`])(
    'refuses %s',
    async (pathname) => {
      expect((await call(pathname)).status).toBe(403)
    },
  )

  it('refuses projects the caller does not own', async () => {
    mocks.ownsProject.mockResolvedValue(false)
    expect((await call(`workspace/user_1/${SHA}`)).status).toBe(403)
  })

  it('ignores upload-completed callbacks, which this route never asks for', async () => {
    const req = new Request('http://localhost/api/projects/p1/files/upload', {
      method: 'POST',
      body: JSON.stringify({ type: 'blob.upload-completed', payload: {} }),
    })
    expect((await POST(req, { params: Promise.resolve({ id: 'p1' }) })).status).toBe(400)
  })
})
