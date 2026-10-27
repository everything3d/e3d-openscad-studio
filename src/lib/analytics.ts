import { track, type BeforeSendEvent } from '@vercel/analytics'
import type { ExportFormat } from '@/components/studio/preview'

/**
 * Product events, sent to Vercel Web Analytics (project → Analytics → Events).
 * They answer whether people who reach the studio get a model out of it, which
 * the database cannot: renders and downloads happen entirely in the browser.
 *
 * Every property is a fixed label, a count or a flag. Never send prompt text,
 * project or file names, or anything else a person typed. The Pro plan keeps
 * at most two properties per event, so no event has more than two.
 */
export interface ProductEvents {
  /** A design workspace opened. `starter` is the canonical it came from, or 'blank'. */
  studio_opened: { starter: string; source: 'new' | 'fork' | 'existing' }
  /** A chat message went to the agent. */
  prompt_sent: { first: boolean; images: number }
  /** The live preview rendered in the browser. `first` is the first result since the workspace opened. */
  render_succeeded: { seconds: DurationBucket; first: boolean }
  render_failed: { reason: 'openscad' | 'timeout' | 'crash'; first: boolean }
  /** A model file was handed to the browser to save. */
  download_clicked: { format: 'stl' } | { format: '3mf'; profile: 'bambu' | 'snapmaker_u1' }
  /** A step towards a print order: the dialog, Shopify checkout, payment, or WhatsApp. */
  order_started: { step: 'opened' | 'checkout' | 'payment' | 'whatsapp' }
  share_created: { replaced: boolean }
  /** The agent rendered and looked at its own work. `ok` is whether the source compiled. */
  model_inspected: { ok: boolean }
  /** A marked-up preview went into the chat composer. */
  markup_added: { pins: number; drawing: boolean }
}

/**
 * <Analytics /> hydrates in its own Suspense boundary, after the page, so
 * events fired while the studio mounts (a workspace opening, its first
 * render) would find no `window.va` and be dropped. Set up Vercel's queue
 * stub ourselves, with the URL scrubber queued ahead of any event: the script
 * replays the queue in order once it loads.
 */
function ensureQueue() {
  if (typeof window === 'undefined' || window.va) return
  window.va = (event, properties) => {
    ;(window.vaq ??= []).push([event, properties])
  }
  window.va('beforeSend', scrubAnalyticsEvent)
}

export function trackEvent<Name extends keyof ProductEvents>(
  name: Name,
  data: ProductEvents[Name],
): void {
  try {
    ensureQueue()
    track(name, data as Record<string, string | number | boolean>)
  } catch {
    // Analytics must never break the studio.
  }
}

export type DurationBucket = '<1s' | '1-3s' | '3-10s' | '10-30s' | '30s+'

/** Coarse buckets, so the dashboard groups render times instead of listing every millisecond. */
export function durationBucket(ms: number): DurationBucket {
  if (ms < 1_000) return '<1s'
  if (ms < 3_000) return '1-3s'
  if (ms < 10_000) return '3-10s'
  if (ms < 30_000) return '10-30s'
  return '30s+'
}

export function downloadEvent(format: ExportFormat): ProductEvents['download_clicked'] {
  if (format === 'stl') return { format: 'stl' }
  return { format: '3mf', profile: format === '3mf-snapmaker-u1' ? 'snapmaker_u1' : 'bambu' }
}

/**
 * What Web Analytics may record of a URL. Query strings carry project ids and
 * Clerk redirect URLs, and a share path is itself the key to a project, so
 * keep only the campaign tags (which the dashboard reads) and the share route.
 */
export function scrubAnalyticsUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (!key.startsWith('utm_')) parsed.searchParams.delete(key)
    }
    parsed.pathname = parsed.pathname.replace(/^\/share\/[^/]+/, '/share/[token]')
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}

export function scrubAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: scrubAnalyticsUrl(event.url) }
}
