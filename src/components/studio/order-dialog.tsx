'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { WhatsAppIcon } from '@/components/whatsapp-button'
import type { ParsedMesh } from '@/lib/openscad/off'
import { estimatePrint } from '@/lib/print-estimate'
import { formatDuration, formatInr, quoteForPrint, type Quote } from '@/lib/pricing'
import { orderMessage, whatsAppUrl } from '@/lib/whatsapp'

interface OrderResponse {
  orderName: string
  invoiceUrl: string | null
  designUrl: string | null
  quote: Quote
}

/** A link to the design for the team, or null if one could not be made. */
async function fetchDesignLink(projectId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/projects/${projectId}/design-link`, { method: 'POST' })
    if (!response.ok) return null
    const body = (await response.json()) as { url?: string }
    return body.url ?? null
  } catch {
    return null
  }
}

/**
 * Turns the design on screen into a Shopify order.
 *
 * The quote shown here is computed in the browser from the rendered mesh so it
 * appears instantly, but it is only a preview: the server recomputes it from
 * the same measurements before creating the order, and the price the customer
 * actually pays is the one that comes back. If the two ever disagree, what is
 * displayed after confirming is the server's number.
 *
 * WhatsApp is always offered alongside checkout, for questions or for people
 * who would rather not pay online, and it is the only way to order when
 * Shopify is not configured. Either way the message carries a link to the
 * design and the quote shown here, so the team can follow up without asking.
 */
export function OrderDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  mesh,
  checkoutEnabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  mesh: ParsedMesh | null
  /** False when Shopify is not configured: WhatsApp is then the way to order. */
  checkoutEnabled: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'placing' | 'placed' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderResponse | null>(null)
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false)

  // An order belongs to the design it was placed for. If the design changes
  // while the dialog stays mounted, start over rather than show the old one.
  const [orderedMesh, setOrderedMesh] = useState(mesh)
  if (mesh !== orderedMesh) {
    setOrderedMesh(mesh)
    setStatus('idle')
    setError(null)
    setOrder(null)
  }

  const estimate = useMemo(() => (mesh ? estimatePrint(mesh) : null), [mesh])
  const preview = useMemo(
    () =>
      estimate
        ? quoteForPrint({
            printMinutes: estimate.printMinutes,
            filamentGrams: estimate.filamentGrams,
          })
        : null,
    [estimate],
  )

  // Once an order exists the server's quote is the real one.
  const quote = order?.quote ?? preview

  async function placeOrder() {
    if (!estimate) return
    setStatus('placing')
    setError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printMinutes: estimate.printMinutes,
          filamentGrams: estimate.filamentGrams,
          volumeMm3: estimate.volumeMm3,
          boundingBoxMm: estimate.boundingBox.size,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error ?? 'Could not start that order.')
        setStatus('error')
        return
      }
      setOrder(body as OrderResponse)
      setStatus('placed')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setStatus('error')
    }
  }

  async function openWhatsApp() {
    // Open the tab inside the click, before awaiting anything, or mobile
    // browsers treat it as a popup and block it.
    const tab = window.open('', '_blank')
    setOpeningWhatsApp(true)
    const designUrl = order?.designUrl ?? (await fetchDesignLink(projectId))
    setOpeningWhatsApp(false)
    const url = whatsAppUrl(
      orderMessage({
        designName: projectName,
        designUrl,
        quote,
        sizeMm: estimate?.boundingBox.size,
        orderName: order?.orderName,
      }),
    )
    if (tab) {
      tab.opener = null
      tab.location.href = url
    } else {
      window.location.href = url
    }
  }

  const size = estimate?.boundingBox.size
  const whatsAppButton = (
    <Button
      variant={checkoutEnabled ? 'outline' : 'default'}
      onClick={() => void openWhatsApp()}
      disabled={openingWhatsApp}
      className={checkoutEnabled ? undefined : 'bg-[#25D366] text-white hover:bg-[#1ebe5a]'}
    >
      {openingWhatsApp ? <Spinner /> : <WhatsAppIcon className="size-4" />}
      {checkoutEnabled ? 'Ask on WhatsApp' : 'Order on WhatsApp'}
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Order this print</DialogTitle>
          <DialogDescription>
            We print it in Bangalore and ship it to you. Estimates come from the
            model itself, and we check them before printing.
          </DialogDescription>
        </DialogHeader>

        {!estimate || !quote ? (
          <p className="py-4 text-sm text-muted-foreground">
            Waiting for the design to finish rendering.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <dl className="space-y-1.5 text-sm">
              <Row label="Design" value={projectName} />
              {size && (
                <Row
                  label="Size"
                  value={`${size[0].toFixed(0)} × ${size[1].toFixed(0)} × ${size[2].toFixed(0)} mm`}
                />
              )}
              <Row label="Print time" value={`about ${formatDuration(quote.printMinutes)}`} />
              <Row label="Material" value={`about ${quote.filamentGrams.toFixed(0)} g`} />
            </dl>

            <div className="space-y-1.5 border-t pt-3 text-sm">
              <Row label="Handling" value={formatInr(quote.baseFeeInr)} muted />
              <Row label="Print time" value={formatInr(quote.timeInr)} muted />
              <Row label="Material" value={formatInr(quote.materialInr)} muted />
              {quote.minimumApplied && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Minimum order of {formatInr(quote.totalInr)} applies to prints this small.
                </p>
              )}
              <div className="flex items-baseline justify-between border-t pt-2 font-medium">
                <span>Total</span>
                <span className="text-lg">{formatInr(quote.totalInr)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {checkoutEnabled ? 'Shipping is added at checkout.' : 'Shipping is extra.'}
              </p>
            </div>

            {status === 'placed' && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                <p className="font-medium">Order {order?.orderName} is ready.</p>
                <p className="mt-1 text-muted-foreground">
                  {order?.invoiceUrl
                    ? 'Continue to Shopify to pay and enter your delivery address.'
                    : 'We will send you a payment link by email shortly.'}
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {checkoutEnabled
            ? 'Questions, or rather not pay online? Message us on WhatsApp. Your design link and this quote come with the message.'
            : 'Message us on WhatsApp to order. Your design link and this quote come with the message, and we confirm before printing.'}
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          {whatsAppButton}
          {!checkoutEnabled ? null : status === 'placed' && order?.invoiceUrl ? (
            <Button
              onClick={() => window.open(order.invoiceUrl ?? '', '_blank', 'noopener,noreferrer')}
            >
              Continue to payment
            </Button>
          ) : (
            <Button onClick={() => void placeOrder()} disabled={!estimate || status === 'placing'}>
              {status === 'placing' ? (
                <>
                  <Spinner /> Starting order…
                </>
              ) : (
                'Place order'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? 'text-muted-foreground' : ''}>{label}</dt>
      <dd className={muted ? 'text-muted-foreground' : 'text-right font-medium'}>{value}</dd>
    </div>
  )
}
