import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createCanonicalFromProject: vi.fn(),
  listCanonicals: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db/queries', () => ({
  createCanonicalFromProject: mocks.createCanonicalFromProject,
  listCanonicals: mocks.listCanonicals,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/canonicals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/canonicals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user_1' })
  })

  it('requires authentication', async () => {
    mocks.auth.mockResolvedValue({ userId: null })
    const response = await POST(request({}))
    expect(response.status).toBe(401)
    expect(mocks.createCanonicalFromProject).not.toHaveBeenCalled()
  })

  it('passes only validated starter metadata into the snapshot operation', async () => {
    const canonical = { id: 'canonical_1' }
    mocks.createCanonicalFromProject.mockResolvedValue(canonical)
    const response = await POST(
      request({
        projectId: 'project_1',
        title: 'Reusable Plaque',
        description: 'A reusable plaque.',
        modificationGuide: 'Change the text parameter.',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'private detail' }] }],
      }),
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(canonical)
    expect(mocks.createCanonicalFromProject).toHaveBeenCalledWith(
      {
        projectId: 'project_1',
        title: 'Reusable Plaque',
        description: 'A reusable plaque.',
        category: null,
        modificationGuide: 'Change the text parameter.',
        thumbnail: null,
        changeSummary: null,
      },
      'user_1',
    )
  })
})
