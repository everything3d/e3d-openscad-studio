import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getCanonicalThumbnail: vi.fn() }))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db/queries', () => ({ getCanonicalThumbnail: mocks.getCanonicalThumbnail }))
import { GET } from './route'
const context = { params: Promise.resolve({ id: 'design-1' }) }

describe('canonical thumbnail caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1' })
    mocks.getCanonicalThumbnail.mockResolvedValue('data:image/jpeg;base64,aGVsbG8=')
  })
  it('serves the requested immutable version rather than silently substituting the current version', async () => {
    const response = await GET(new Request('http://localhost/api/canonicals/design-1/thumbnail?v=old-version'), context)
    expect(mocks.getCanonicalThumbnail).toHaveBeenCalledWith('design-1', 'old-version')
    expect(response.headers.get('Cache-Control')).toContain('immutable')
    expect(await response.text()).toBe('hello')
  })
  it('revalidates URLs without a version', async () => {
    const response = await GET(new Request('http://localhost/api/canonicals/design-1/thumbnail'), context)
    expect(mocks.getCanonicalThumbnail).toHaveBeenCalledWith('design-1', null)
    expect(response.headers.get('Cache-Control')).toBe('private, no-cache')
  })
  it('requires authentication', async () => {
    mocks.auth.mockResolvedValue({ userId: null })
    const response = await GET(new Request('http://localhost/api/canonicals/design-1/thumbnail?v=version-1'), context)
    expect(response.status).toBe(401)
    expect(mocks.getCanonicalThumbnail).not.toHaveBeenCalled()
  })
})
