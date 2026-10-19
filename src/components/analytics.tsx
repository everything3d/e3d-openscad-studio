'use client'

import { Analytics as VercelAnalytics } from '@vercel/analytics/next'
import { scrubAnalyticsEvent } from '@/lib/analytics'

/**
 * Vercel Web Analytics: page views plus the product events in lib/analytics.
 * A client component of its own because `beforeSend` is a function, which
 * the server layout cannot pass across the boundary.
 */
export function Analytics() {
  return <VercelAnalytics beforeSend={scrubAnalyticsEvent} />
}
