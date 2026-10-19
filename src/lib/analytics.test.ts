import { beforeEach, describe, expect, it, vi } from 'vitest'

const analytics = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@vercel/analytics', () => analytics)
import {
  downloadEvent,
  durationBucket,
  scrubAnalyticsEvent,
  scrubAnalyticsUrl,
  trackEvent,
} from './analytics'

describe('product analytics', () => {
  beforeEach(() => {
    analytics.track.mockReset()
  })

  it('sends events through Vercel Web Analytics', () => {
    trackEvent('prompt_sent', { first: true, images: 0 })
    expect(analytics.track).toHaveBeenCalledWith('prompt_sent', { first: true, images: 0 })
  })

  it('never lets an analytics failure reach the caller', () => {
    analytics.track.mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => trackEvent('share_created', { replaced: false })).not.toThrow()
  })

  it('queues events fired before <Analytics /> loads, with the URL scrubber first', () => {
    const page: Partial<Window> = {}
    vi.stubGlobal('window', page)
    try {
      trackEvent('studio_opened', { starter: 'blank', source: 'new' })
      trackEvent('prompt_sent', { first: true, images: 0 })
      expect(page.vaq).toEqual([['beforeSend', scrubAnalyticsEvent]])
      expect(analytics.track).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('names the download format and, for 3MF, the slicer profile', () => {
    expect(downloadEvent('stl')).toEqual({ format: 'stl' })
    expect(downloadEvent('3mf-bambu')).toEqual({ format: '3mf', profile: 'bambu' })
    expect(downloadEvent('3mf-snapmaker-u1')).toEqual({ format: '3mf', profile: 'snapmaker_u1' })
  })

  it('buckets render times', () => {
    expect(durationBucket(0)).toBe('<1s')
    expect(durationBucket(999)).toBe('<1s')
    expect(durationBucket(1_000)).toBe('1-3s')
    expect(durationBucket(9_999)).toBe('3-10s')
    expect(durationBucket(29_999)).toBe('10-30s')
    expect(durationBucket(90_000)).toBe('30s+')
  })
})

describe('analytics URL scrubbing', () => {
  it('drops project ids and redirect URLs but keeps campaign tags', () => {
    expect(
      scrubAnalyticsUrl(
        'https://studio.example/studio?project=p_123&utm_source=instagram&utm_campaign=reel#top',
      ),
    ).toBe('https://studio.example/studio?utm_source=instagram&utm_campaign=reel')
    expect(
      scrubAnalyticsUrl('https://studio.example/sign-in?redirect_url=https%3A%2F%2Fstudio.example%2Fstudio'),
    ).toBe('https://studio.example/sign-in')
  })

  it('hides share tokens, which open the shared project', () => {
    expect(scrubAnalyticsUrl('https://studio.example/share/s3cr3t-token')).toBe(
      'https://studio.example/share/[token]',
    )
    expect(scrubAnalyticsUrl('https://studio.example/shared/thing')).toBe(
      'https://studio.example/shared/thing',
    )
  })

  it('leaves unparseable URLs alone and keeps the event shape', () => {
    expect(scrubAnalyticsUrl('not a url')).toBe('not a url')
    expect(
      scrubAnalyticsEvent({ type: 'event', url: 'https://studio.example/studio?project=p_1' }),
    ).toEqual({ type: 'event', url: 'https://studio.example/studio' })
  })
})
