/**
 * Low-credit alert for the OpenRouter account behind every model call.
 *
 * On 2026-10-19 the account ran dry and every chat turn failed for 8+ hours
 * before anyone noticed. A cron (vercel.json → /api/cron/openrouter-credits)
 * runs this check and emails the team while the balance is under a threshold,
 * and also when the check itself fails, so silence always means healthy.
 */

const CREDITS_URL = 'https://openrouter.ai/api/v1/credits'
const RESEND_URL = 'https://api.resend.com/emails'

export const DEFAULT_THRESHOLD_USD = 20
export const DEFAULT_RECIPIENTS = [
  'apoorv@everything3dindia.com',
  'juthika@everything3dindia.com',
  'tejas@everything3dindia.com',
]
// Resend only delivers from a domain verified in its dashboard.
export const DEFAULT_SENDER = 'E3D Alerts <alerts@everything3dindia.com>'

export interface CreditAlertEnv {
  [name: string]: string | undefined
  /** OpenRouter's credits endpoint needs a management key; a regular key gets 403. */
  OPENROUTER_MANAGEMENT_KEY?: string
  OPENROUTER_API_KEY?: string
  OPENROUTER_CREDIT_ALERT_USD?: string
  RESEND_API_KEY?: string
  CREDIT_ALERT_EMAIL_TO?: string
  CREDIT_ALERT_EMAIL_FROM?: string
}

export type CreditCheck =
  | { ok: true; remaining: number; totalCredits: number; totalUsage: number }
  | { ok: false; error: string }

export type CreditAlertResult = {
  check: CreditCheck
  threshold: number
  /** Whether an email went out, and if sending failed, why. */
  alerted: boolean
  alertError?: string
}

function parseThreshold(value: string | undefined): number {
  const n = Number(value)
  return value?.trim() && Number.isFinite(n) && n >= 0 ? n : DEFAULT_THRESHOLD_USD
}

function parseRecipients(value: string | undefined): string[] {
  const list = (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return list.length ? list : DEFAULT_RECIPIENTS
}

const usd = (n: number) => `$${n.toFixed(2)}`

export async function fetchCredits(key: string | undefined, fetchFn = fetch): Promise<CreditCheck> {
  if (!key) return { ok: false, error: 'No OpenRouter key is configured.' }
  try {
    const res = await fetchFn(CREDITS_URL, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300)
      return { ok: false, error: `OpenRouter answered ${res.status}: ${body}` }
    }
    const json = (await res.json()) as { data?: { total_credits?: unknown; total_usage?: unknown } }
    const totalCredits = json.data?.total_credits
    const totalUsage = json.data?.total_usage
    if (typeof totalCredits !== 'number' || typeof totalUsage !== 'number') {
      return { ok: false, error: 'OpenRouter returned an unexpected credits response.' }
    }
    return { ok: true, remaining: totalCredits - totalUsage, totalCredits, totalUsage }
  } catch (error) {
    return { ok: false, error: `Could not reach OpenRouter: ${String(error)}` }
  }
}

export function alertEmail(check: CreditCheck, threshold: number): { subject: string; text: string } | null {
  if (check.ok) {
    if (check.remaining >= threshold) return null
    const empty = check.remaining <= 0
    return {
      subject: empty
        ? 'OpenRouter credits are exhausted: the studio chat is down'
        : `OpenRouter credits low: ${usd(check.remaining)} left`,
      text: [
        `Remaining OpenRouter credit: ${usd(check.remaining)} (alert threshold ${usd(threshold)}).`,
        `Purchased ${usd(check.totalCredits)}, used ${usd(check.totalUsage)}.`,
        '',
        empty
          ? 'Every chat request is failing until credits are added.'
          : 'When this reaches $0 every chat request fails.',
        'Top up at https://openrouter.ai/settings/credits',
      ].join('\n'),
    }
  }
  return {
    subject: 'OpenRouter credit check failed',
    text: [
      'The scheduled OpenRouter credit check could not read the balance, so a low balance would go unnoticed.',
      '',
      check.error,
      '',
      'The check needs OPENROUTER_MANAGEMENT_KEY (a management key from https://openrouter.ai/settings/keys).',
    ].join('\n'),
  }
}

async function sendEmail(
  env: CreditAlertEnv,
  email: { subject: string; text: string },
  fetchFn: typeof fetch,
): Promise<string | null> {
  if (!env.RESEND_API_KEY) return 'RESEND_API_KEY is not set.'
  try {
    const res = await fetchFn(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.CREDIT_ALERT_EMAIL_FROM?.trim() || DEFAULT_SENDER,
        to: parseRecipients(env.CREDIT_ALERT_EMAIL_TO),
        subject: email.subject,
        text: email.text,
      }),
    })
    if (!res.ok) {
      return `Resend answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`
    }
    return null
  } catch (error) {
    return `Could not reach Resend: ${String(error)}`
  }
}

export async function runCreditAlert(
  env: CreditAlertEnv,
  fetchFn: typeof fetch = fetch,
): Promise<CreditAlertResult> {
  const threshold = parseThreshold(env.OPENROUTER_CREDIT_ALERT_USD)
  const check = await fetchCredits(env.OPENROUTER_MANAGEMENT_KEY || env.OPENROUTER_API_KEY, fetchFn)
  const email = alertEmail(check, threshold)
  if (!email) return { check, threshold, alerted: false }
  const alertError = await sendEmail(env, email, fetchFn)
  return alertError
    ? { check, threshold, alerted: false, alertError }
    : { check, threshold, alerted: true }
}
