/**
 * Shopify Admin API client, used for one job: turning a design into a draft
 * order the customer can pay for.
 *
 * Draft orders are the right primitive here because every print is priced from
 * its own geometry. There is no product variant to add to a cart — the line
 * item's price is computed per order. Shopify returns an invoice URL, the
 * customer pays through normal Shopify checkout, and the shop sees the order
 * with the design details attached.
 *
 * A draft order is not a confirmed sale. It stays in the Shopify admin until
 * somebody sends or completes it, which is the point where the shop checks the
 * quote against the actual design before any filament is spent.
 */

/**
 * Shopify supports roughly a year of API versions. Pin a specific one rather
 * than 'latest' so a Shopify release cannot change behaviour underneath us,
 * and move it forward deliberately.
 */
const API_VERSION = '2026-07'

/**
 * The shop's presentment currency. The line item price is expressed in it and
 * the draft order is pinned to it, because Shopify requires the two to match.
 */
const CURRENCY = process.env.SHOPIFY_CURRENCY ?? 'INR'

/**
 * Shopify offers two ways to authenticate a server-side app, and which one is
 * available depends on when the app was made.
 *
 * - `token`: a long-lived Admin API token from an admin-created custom app.
 *   Shopify stopped allowing new ones, but existing apps keep working.
 * - `client_credentials`: client id and secret exchanged for a token that
 *   expires after 24 hours. This is the path for an app created in the Dev
 *   Dashboard, which is the only way to make a new one.
 *
 * Both are supported so the integration works whichever kind of app the shop
 * already has. A static token wins if both are configured, because it costs no
 * extra round trip.
 */
export type ShopifyConfig =
  | { mode: 'token'; storeDomain: string; accessToken: string }
  | { mode: 'client_credentials'; storeDomain: string; clientId: string; clientSecret: string }

/**
 * Accept the store as either `shop` or `shop.myshopify.com`, with or without a
 * scheme, and normalise to the full host. Getting this wrong is the most
 * common setup mistake and it fails with an unhelpful 404.
 */
function normaliseStoreDomain(raw: string): string {
  const host = raw
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
  return host.includes('.') ? host : `${host}.myshopify.com`
}

/**
 * The configured store, or null when Shopify is not set up.
 *
 * Online checkout is switched on by configuring the store and one set of
 * credentials and nothing else. A deployment without them still quotes prints,
 * and the order dialog sends customers to WhatsApp instead of Shopify.
 */
export function shopifyConfig(): ShopifyConfig | null {
  const rawDomain = process.env.SHOPIFY_STORE_DOMAIN
  if (!rawDomain) return null
  const storeDomain = normaliseStoreDomain(rawDomain)

  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  if (accessToken) return { mode: 'token', storeDomain, accessToken }

  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  if (clientId && clientSecret) {
    return { mode: 'client_credentials', storeDomain, clientId, clientSecret }
  }
  return null
}

export function isOrderingEnabled(): boolean {
  return shopifyConfig() !== null
}

/**
 * Cached client-credentials token, keyed by store so a misconfigured second
 * store cannot be served another's token.
 */
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/** Discard a cached token, so the next call fetches a fresh one. */
function forgetToken(storeDomain: string): void {
  tokenCache.delete(storeDomain)
}

/**
 * The token to send as `X-Shopify-Access-Token`.
 *
 * Client-credentials tokens last 24 hours, so they are cached and renewed a
 * minute early rather than fetched per request — but the cache lives in
 * process memory, so a serverless instance simply fetches its own on first use.
 */
async function accessTokenFor(config: ShopifyConfig): Promise<string> {
  if (config.mode === 'token') return config.accessToken

  const cached = tokenCache.get(config.storeDomain)
  if (cached && Date.now() < cached.expiresAt) return cached.token

  const response = await fetch(`https://${config.storeDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    // `shop_not_permitted` means the app and store are in different Shopify
    // organizations, which is the usual cause and not obvious from the status.
    console.error('[shopify] token request failed', response.status, body.slice(0, 300))
    throw new Error(`Shopify refused the credentials (${response.status})`)
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!payload.access_token) throw new Error('Shopify returned no access token')

  const lifetimeMs = (payload.expires_in ?? 86_399) * 1000
  tokenCache.set(config.storeDomain, {
    token: payload.access_token,
    expiresAt: Date.now() + lifetimeMs - 60_000,
  })
  return payload.access_token
}

interface GraphQlResponse<T> {
  data?: T
  errors?: { message: string }[]
}

/**
 * Run one Admin GraphQL operation.
 *
 * Shopify reports failures three different ways — HTTP status, a top-level
 * `errors` array, and per-mutation `userErrors` — so callers check the last of
 * those and this handles the first two.
 *
 * A 401 is retried once against a freshly fetched token: a cached token can be
 * invalidated early if the app is reinstalled or its secret rotated, and one
 * retry turns that from a failed order into a slow one.
 */
async function adminGraphQl<T>(
  config: ShopifyConfig,
  query: string,
  variables: Record<string, unknown>,
  { allowRetry = true }: { allowRetry?: boolean } = {},
): Promise<T> {
  const token = await accessTokenFor(config)
  const response = await fetch(
    `https://${config.storeDomain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    },
  )

  if (response.status === 401 && config.mode === 'client_credentials' && allowRetry) {
    forgetToken(config.storeDomain)
    return adminGraphQl<T>(config, query, variables, { allowRetry: false })
  }

  if (!response.ok) {
    // The body can echo the request, so it is logged rather than propagated.
    const body = await response.text().catch(() => '')
    console.error('[shopify] admin API returned', response.status, body.slice(0, 500))
    throw new Error(`Shopify returned ${response.status}`)
  }

  const payload = (await response.json()) as GraphQlResponse<T>
  if (payload.errors?.length) {
    console.error('[shopify] admin API errors', payload.errors)
    throw new Error(payload.errors[0].message)
  }
  if (!payload.data) throw new Error('Shopify returned no data')
  return payload.data
}

const DRAFT_ORDER_CREATE = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        invoiceUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`

interface DraftOrderCreateResult {
  draftOrderCreate: {
    draftOrder: { id: string; name: string; invoiceUrl: string | null } | null
    userErrors: { field: string[] | null; message: string }[]
  }
}

export interface CreateDraftOrderInput {
  /** What the customer sees on the invoice line. */
  title: string
  /** Whole rupees. */
  priceInr: number
  /** Signed-in customer's email, so Shopify can send them the invoice. */
  email?: string | null
  /**
   * Details shown to the shop in the admin: measurements, the quote breakdown,
   * and a link back to the design. This is what somebody checks before printing.
   */
  note: string
  /** Searchable key/values on the order, e.g. the project id. */
  customAttributes?: { key: string; value: string }[]
}

export interface DraftOrder {
  id: string
  name: string
  invoiceUrl: string | null
}

export async function createDraftOrder(
  input: CreateDraftOrderInput,
  config: ShopifyConfig,
): Promise<DraftOrder> {
  const data = await adminGraphQl<DraftOrderCreateResult>(config, DRAFT_ORDER_CREATE, {
    input: {
      lineItems: [
        {
          title: input.title,
          quantity: 1,
          // Every print is priced from its own geometry, so there is no
          // catalog variant to reference — this is a custom line item whose
          // price is set outright. That is `originalUnitPriceWithCurrency`.
          // `priceOverride` looks right but only replaces a catalog variant's
          // price: on a custom line item Shopify ignores it and the print
          // goes through at ₹0.
          originalUnitPriceWithCurrency: {
            amount: input.priceInr.toFixed(2),
            currencyCode: CURRENCY,
          },
          requiresShipping: true,
          customAttributes: input.customAttributes ?? [],
        },
      ],
      note: input.note,
      presentmentCurrencyCode: CURRENCY,
      tags: ['e3d-studio'],
      ...(input.email ? { email: input.email } : {}),
    },
  })

  const { draftOrder, userErrors } = data.draftOrderCreate
  if (userErrors.length) {
    console.error('[shopify] draftOrderCreate rejected', userErrors)
    throw new Error(userErrors[0].message)
  }
  if (!draftOrder) throw new Error('Shopify did not return a draft order')
  return draftOrder
}

/** Test seam: drop every cached token. */
export function __clearTokenCache(): void {
  tokenCache.clear()
}
