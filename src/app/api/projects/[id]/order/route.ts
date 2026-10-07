import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getProject,
  ordersPerHourLimit,
  recentOrderCount,
  recordPrintOrder,
} from '@/lib/db/queries'
import { formatDuration, formatInr, quoteForPrint } from '@/lib/pricing'
import { createDraftOrder, shopifyConfig } from '@/lib/shopify'

type Params = { params: Promise<{ id: string }> }

/**
 * Measurements taken from the rendered mesh in the browser.
 *
 * Only measurements cross the wire, never a price: the server recomputes the
 * quote from its own rates, so a tampered request cannot choose what it pays.
 * The measurements themselves are client-reported — the shop sees them on the
 * draft order and checks them against the design before printing, which is the
 * step that catches a forged one. Nothing is charged until that review.
 */
const orderRequestSchema = z.object({
  printMinutes: z.number().finite().min(0).max(60 * 24 * 14),
  filamentGrams: z.number().finite().min(0).max(50_000),
  volumeMm3: z.number().finite().min(0),
  boundingBoxMm: z.tuple([
    z.number().finite().min(0),
    z.number().finite().min(0),
    z.number().finite().min(0),
  ]),
})

export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shopify = shopifyConfig()
  if (!shopify) {
    return NextResponse.json(
      { error: 'Ordering is not available yet. Please get in touch on WhatsApp.' },
      { status: 503 },
    )
  }

  const { id } = await params
  const project = await getProject(id, userId)
  if (!project) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  const parsed = orderRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Could not read the design measurements' }, { status: 400 })
  }

  const limit = ordersPerHourLimit()
  if (limit > 0 && (await recentOrderCount(userId)) >= limit) {
    return NextResponse.json(
      { error: 'That is a lot of orders at once. Please try again a bit later.' },
      { status: 429 },
    )
  }

  const measurements = parsed.data
  const quote = quoteForPrint(measurements)
  const [width, depth, height] = measurements.boundingBoxMm

  // Whoever picks this up in the Shopify admin needs to be able to check the
  // quote without opening the studio, so the numbers travel with the order.
  const note = [
    `E3D Studio design: ${project.name}`,
    `Design ID: ${id}`,
    '',
    `Size: ${width.toFixed(1)} x ${depth.toFixed(1)} x ${height.toFixed(1)} mm`,
    `Estimated print time: ${formatDuration(measurements.printMinutes)}`,
    `Estimated filament: ${measurements.filamentGrams.toFixed(0)} g`,
    '',
    `Handling: ${formatInr(quote.baseFeeInr)}`,
    `Print time: ${formatInr(quote.timeInr)}`,
    `Material: ${formatInr(quote.materialInr)}`,
    quote.minimumApplied ? `Minimum order applied: ${formatInr(quote.totalInr)}` : '',
    `Total: ${formatInr(quote.totalInr)}`,
    '',
    'Estimates are computed from the model geometry, not a slicer. Confirm before printing.',
  ]
    .filter(Boolean)
    .join('\n')

  let draftOrder
  try {
    const user = await currentUser()
    draftOrder = await createDraftOrder(
      {
        title: `3D print — ${project.name}`,
        priceInr: quote.totalInr,
        email: user?.primaryEmailAddress?.emailAddress ?? null,
        note,
        customAttributes: [
          { key: 'Design', value: project.name },
          { key: 'Design ID', value: id },
          { key: 'Estimated print time', value: formatDuration(measurements.printMinutes) },
          { key: 'Estimated filament', value: `${measurements.filamentGrams.toFixed(0)} g` },
        ],
      },
      shopify,
    )
  } catch (error) {
    // The real reason is already logged by the client; the customer gets a
    // sentence they can act on.
    console.error('[order] could not create draft order', error)
    return NextResponse.json(
      { error: 'We could not start that order. Please try again, or message us on WhatsApp.' },
      { status: 502 },
    )
  }

  await recordPrintOrder({
    projectId: id,
    userId,
    draftOrderId: draftOrder.id,
    draftOrderName: draftOrder.name,
    invoiceUrl: draftOrder.invoiceUrl,
    totalInr: quote.totalInr,
    printMinutes: measurements.printMinutes,
    filamentGrams: measurements.filamentGrams,
  })

  return NextResponse.json({
    orderName: draftOrder.name,
    invoiceUrl: draftOrder.invoiceUrl,
    quote,
  })
}
