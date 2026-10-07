import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getProject: vi.fn(),
  designLinkForOrder: vi.fn(),
  recentOrderCount: vi.fn(),
  recordPrintOrder: vi.fn(),
  createDraftOrder: vi.fn(),
  shopifyConfig: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth, currentUser: mocks.currentUser }))
vi.mock('@/lib/db/queries', () => ({
  getProject: mocks.getProject,
  designLinkForOrder: mocks.designLinkForOrder,
  recentOrderCount: mocks.recentOrderCount,
  recordPrintOrder: mocks.recordPrintOrder,
  ordersPerHourLimit: () => 10,
}))
vi.mock('@/lib/shopify', () => ({
  createDraftOrder: mocks.createDraftOrder,
  shopifyConfig: mocks.shopifyConfig,
}))

import { POST } from './route'

const measurements = {
  printMinutes: 13,
  filamentGrams: 4,
  volumeMm3: 2800,
  boundingBoxMm: [62, 16, 5],
}

function post(body: unknown = measurements) {
  return POST(
    new Request('https://studio.example/api/projects/p1/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'p1' }) },
  )
}

describe('POST /api/projects/[id]/order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user_1' })
    mocks.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'a@b.test' } })
    mocks.shopifyConfig.mockReturnValue({ mode: 'token', storeDomain: 's', accessToken: 't' })
    mocks.getProject.mockResolvedValue({ id: 'p1', name: 'Keychain' })
    mocks.designLinkForOrder.mockResolvedValue({ path: '/share/tok', createdAt: 0 })
    mocks.recentOrderCount.mockResolvedValue(0)
    mocks.createDraftOrder.mockResolvedValue({ id: 'gid://d/1', name: '#D1', invoiceUrl: 'https://pay' })
  })

  it('points the shop at the design it is printing', async () => {
    const response = await post()
    expect(response.status).toBe(200)
    const input = mocks.createDraftOrder.mock.calls[0][0]
    expect(input.note).toContain('Design link: https://studio.example/share/tok')
    expect(input.customAttributes).toContainEqual({
      key: 'Design link',
      value: 'https://studio.example/share/tok',
    })
    // Sections stay readable in the Shopify admin.
    expect(input.note).toContain('\n\nSize:')
    expect((await response.json()).designUrl).toBe('https://studio.example/share/tok')
  })

  it('prices from its own rates, applying the minimum to a small print', async () => {
    await post()
    expect(mocks.createDraftOrder.mock.calls[0][0].priceInr).toBe(299)
  })

  it('still places the order if the design link cannot be made', async () => {
    mocks.designLinkForOrder.mockRejectedValue(new Error('db down'))
    const response = await post()
    expect(response.status).toBe(200)
    expect(mocks.createDraftOrder.mock.calls[0][0].note).toContain('Design link: unavailable')
  })

  it('sends people to WhatsApp when checkout is not configured', async () => {
    mocks.shopifyConfig.mockReturnValue(null)
    const response = await post()
    expect(response.status).toBe(503)
    expect(mocks.createDraftOrder).not.toHaveBeenCalled()
  })
})
