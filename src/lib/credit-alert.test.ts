import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RECIPIENTS, runCreditAlert } from './credit-alert'

function credits(totalCredits: number, totalUsage: number) {
  return Response.json({ data: { total_credits: totalCredits, total_usage: totalUsage } })
}

/** Answers OpenRouter with `openrouter` and records what was sent to Resend. */
function fakeFetch(openrouter: () => Response, resend: () => Response = () => Response.json({ id: 'e1' })) {
  return vi.fn(async (url: string | URL | Request) =>
    String(url).includes('openrouter.ai') ? openrouter() : resend(),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

function sentEmail(fetchFn: ReturnType<typeof vi.fn>) {
  const call = fetchFn.mock.calls.find(([url]) => String(url).includes('resend.com'))
  return call ? JSON.parse((call[1] as RequestInit).body as string) : null
}

const env = { OPENROUTER_MANAGEMENT_KEY: 'mk', RESEND_API_KEY: 're' }

describe('runCreditAlert', () => {
  it('stays quiet while the balance is above the threshold', async () => {
    const fetchFn = fakeFetch(() => credits(100, 50))
    const result = await runCreditAlert(env, fetchFn)
    expect(result).toMatchObject({ check: { ok: true, remaining: 50 }, threshold: 20, alerted: false })
    expect(sentEmail(fetchFn)).toBeNull()
  })

  it('emails the team when remaining credit drops below the default $20', async () => {
    const fetchFn = fakeFetch(() => credits(100, 88.5))
    const result = await runCreditAlert(env, fetchFn)
    expect(result.alerted).toBe(true)
    const email = sentEmail(fetchFn)
    expect(email.to).toEqual(DEFAULT_RECIPIENTS)
    expect(email.subject).toBe('OpenRouter credits low: $11.50 left')
  })

  it('uses the threshold and recipients from the environment', async () => {
    const fetchFn = fakeFetch(() => credits(100, 60))
    await runCreditAlert(
      { ...env, OPENROUTER_CREDIT_ALERT_USD: '50', CREDIT_ALERT_EMAIL_TO: 'a@x.com, b@x.com' },
      fetchFn,
    )
    expect(sentEmail(fetchFn).to).toEqual(['a@x.com', 'b@x.com'])
  })

  it('says the chat is down once credits are exhausted', async () => {
    const fetchFn = fakeFetch(() => credits(100, 100.2))
    await runCreditAlert(env, fetchFn)
    expect(sentEmail(fetchFn).subject).toMatch(/exhausted/)
  })

  it('emails when the balance cannot be read, so silence means healthy', async () => {
    const fetchFn = fakeFetch(
      () => Response.json({ error: { message: 'Only management keys can perform this operation' } }, { status: 403 }),
    )
    const result = await runCreditAlert(env, fetchFn)
    expect(result.check).toMatchObject({ ok: false, error: expect.stringContaining('403') })
    expect(sentEmail(fetchFn).subject).toBe('OpenRouter credit check failed')
  })

  it('falls back to OPENROUTER_API_KEY when no management key is set', async () => {
    const fetchFn = fakeFetch(() => credits(100, 0))
    await runCreditAlert({ OPENROUTER_API_KEY: 'api', RESEND_API_KEY: 're' }, fetchFn)
    const [, init] = fetchFn.mock.calls[0]
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer api' })
  })

  it('reports an undelivered alert', async () => {
    const fetchFn = fakeFetch(() => credits(10, 5), () => new Response('bad domain', { status: 403 }))
    const result = await runCreditAlert(env, fetchFn)
    expect(result).toMatchObject({ alerted: false, alertError: expect.stringContaining('403') })
    expect((await runCreditAlert({ OPENROUTER_MANAGEMENT_KEY: 'mk' }, fakeFetch(() => credits(10, 5)))).alertError).toMatch(/RESEND_API_KEY/)
  })
})
