import { formatDuration, formatInr, type Quote } from './pricing'

/**
 * WhatsApp handoff to the Everything 3D team.
 *
 * The number is the business line from everything3dindia.com. It is public on
 * the main site, so it is safe in the bundle, but it is overridable so a
 * staging deployment can point somewhere else.
 */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '917892554719'

export function whatsAppUrl(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
}

/** For visitors who have not started a design yet, e.g. on the homepage. */
export const GENERAL_MESSAGE = 'Hi! I have a question about OpenSCAD Studio.'

export interface OrderMessageInput {
  designName: string
  /** Absolute link the team can open; omitted if one could not be made. */
  designUrl?: string | null
  /** The estimate the customer was shown, so the team can confirm it. */
  quote?: Quote | null
  sizeMm?: readonly [number, number, number] | null
  /** Set once a Shopify draft order exists, so the team can find it. */
  orderName?: string | null
}

/**
 * The message a customer sends when they want to order, or have questions
 * about ordering. Everything the team needs to follow up travels in it: which
 * design, a link to it, and the price the customer has already seen.
 */
export function orderMessage({
  designName,
  designUrl,
  quote,
  sizeMm,
  orderName,
}: OrderMessageInput): string {
  const lines = ["Hey, I made this model on OpenSCAD Studio and I'd like to order it.", '']
  lines.push(`Design: ${designName}`)
  if (designUrl) lines.push(`Link: ${designUrl}`)
  if (orderName) lines.push(`Order: ${orderName}`)
  if (quote) {
    const details = [`about ${formatDuration(quote.printMinutes)} print`, `${quote.filamentGrams.toFixed(0)} g`]
    if (sizeMm) details.push(sizeMm.map((v) => v.toFixed(0)).join(' × ') + ' mm')
    lines.push(`Quoted estimate: ${formatInr(quote.totalInr)} (${details.join(', ')})`)
  }
  return lines.join('\n')
}
