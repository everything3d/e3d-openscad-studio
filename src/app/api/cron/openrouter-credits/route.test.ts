import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ runCreditAlert: vi.fn() }))
vi.mock('@/lib/credit-alert', () => ({ runCreditAlert: mocks.runCreditAlert }))

import { GET } from './route'

function request(authorization?: string) {
  return new Request('http://localhost/api/cron/openrouter-credits', {
    headers: authorization ? { authorization } : {},
  })
}

describe('GET /api/cron/openrouter-credits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 's3cret')
    mocks.runCreditAlert.mockResolvedValue({
      check: { ok: true, remaining: 42, totalCredits: 50, totalUsage: 8 },
      threshold: 20,
      alerted: false,
    })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('rejects calls without the cron secret', async () => {
    expect((await GET(request())).status).toBe(401)
    expect((await GET(request('Bearer wrong'))).status).toBe(401)
    expect(mocks.runCreditAlert).not.toHaveBeenCalled()
  })

  it('refuses everything when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await GET(request('Bearer '))).status).toBe(401)
  })

  it('runs the check for Vercel Cron', async () => {
    const response = await GET(request('Bearer s3cret'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ remaining: 42, threshold: 20, alerted: false })
  })

  it('fails the run when the balance could not be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.runCreditAlert.mockResolvedValue({
      check: { ok: false, error: 'OpenRouter answered 403' },
      threshold: 20,
      alerted: true,
    })
    const response = await GET(request('Bearer s3cret'))
    expect(response.status).toBe(500)
  })
})
