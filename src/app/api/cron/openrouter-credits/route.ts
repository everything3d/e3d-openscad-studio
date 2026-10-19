import { runCreditAlert } from '@/lib/credit-alert'

export const maxDuration = 30

/**
 * Vercel Cron target (schedule in vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without the secret configured the
 * route refuses everything rather than letting anyone trigger alert emails.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runCreditAlert(process.env)
  if (!result.check.ok) console.error('[cron] OpenRouter credit check failed:', result.check.error)
  if (result.alertError) console.error('[cron] credit alert email failed:', result.alertError)

  // A failed check or undelivered alert shows as a failed cron run in Vercel.
  const failed = !result.check.ok || Boolean(result.alertError)
  return Response.json(
    {
      remaining: result.check.ok ? result.check.remaining : null,
      threshold: result.threshold,
      alerted: result.alerted,
      ...(result.check.ok ? {} : { checkError: result.check.error }),
      ...(result.alertError ? { alertError: result.alertError } : {}),
    },
    { status: failed ? 500 : 200 },
  )
}
