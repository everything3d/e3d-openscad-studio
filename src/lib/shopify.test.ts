import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __clearTokenCache,
  createDraftOrder,
  isOrderingEnabled,
  shopifyConfig,
  type ShopifyConfig,
} from './shopify'

const CREDENTIALS: ShopifyConfig = {
  mode: 'token',
  storeDomain: 'shop.myshopify.com',
  accessToken: 'shpat_test',
}

/** Capture the request the client sends without ever leaving the process. */
function mockShopify(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string)
}

const OK_RESPONSE = {
  data: {
    draftOrderCreate: {
      draftOrder: {
        id: 'gid://shopify/DraftOrder/1',
        name: '#D1',
        invoiceUrl: 'https://shop.myshopify.com/invoice/abc',
      },
      userErrors: [],
    },
  },
}

beforeEach(() => {
  __clearTokenCache()
  for (const key of [
    'SHOPIFY_STORE_DOMAIN',
    'SHOPIFY_ADMIN_ACCESS_TOKEN',
    'SHOPIFY_CLIENT_ID',
    'SHOPIFY_CLIENT_SECRET',
  ]) {
    delete process.env[key]
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('configuration gate', () => {
  it('stays off until a store and one set of credentials are present', () => {
    expect(isOrderingEnabled()).toBe(false)
    process.env.SHOPIFY_STORE_DOMAIN = 'shop.myshopify.com'
    // A store with no credentials must not switch ordering on.
    expect(isOrderingEnabled()).toBe(false)
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'shpat_test'
    expect(shopifyConfig()).toEqual(CREDENTIALS)
  })

  it('accepts a Dev Dashboard app\u2019s client id and secret', () => {
    process.env.SHOPIFY_STORE_DOMAIN = 'shop.myshopify.com'
    process.env.SHOPIFY_CLIENT_ID = 'cid'
    process.env.SHOPIFY_CLIENT_SECRET = 'csecret'
    expect(shopifyConfig()).toEqual({
      mode: 'client_credentials',
      storeDomain: 'shop.myshopify.com',
      clientId: 'cid',
      clientSecret: 'csecret',
    })
  })

  it('needs both halves of the client credentials', () => {
    process.env.SHOPIFY_STORE_DOMAIN = 'shop.myshopify.com'
    process.env.SHOPIFY_CLIENT_ID = 'cid'
    expect(isOrderingEnabled()).toBe(false)
  })

  it('accepts the store written any of the usual ways', () => {
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'shpat_test'
    for (const written of [
      'shop',
      'shop.myshopify.com',
      'https://shop.myshopify.com',
      'https://shop.myshopify.com/',
    ]) {
      process.env.SHOPIFY_STORE_DOMAIN = written
      expect(shopifyConfig()?.storeDomain).toBe('shop.myshopify.com')
    }
  })
})

describe('createDraftOrder', () => {
  it('calls a supported API version', async () => {
    const fetchMock = mockShopify(OK_RESPONSE)
    await createDraftOrder({ title: 'x', priceInr: 427, note: 'n' }, CREDENTIALS)

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toBe('https://shop.myshopify.com/admin/api/2026-07/graphql.json')
    // Shopify retires versions after about a year; a stale pin fails outright.
    expect(url).not.toContain('2025-')
  })

  it('authenticates with the admin token header', async () => {
    const fetchMock = mockShopify(OK_RESPONSE)
    await createDraftOrder({ title: 'x', priceInr: 427, note: 'n' }, CREDENTIALS)
    expect(fetchMock.mock.calls[0][1].headers['X-Shopify-Access-Token']).toBe('shpat_test')
  })

  it('prices the custom line item with originalUnitPriceWithCurrency', async () => {
    const fetchMock = mockShopify(OK_RESPONSE)
    await createDraftOrder({ title: 'Bank', priceInr: 427, note: 'n' }, CREDENTIALS)

    const { input } = sentBody(fetchMock).variables
    const [line] = input.lineItems
    expect(line.originalUnitPriceWithCurrency).toEqual({ amount: '427.00', currencyCode: 'INR' })
    // priceOverride only replaces a catalog variant's price. Shopify ignores it
    // on a custom line item, which created ₹0 orders on the live store.
    expect(line).not.toHaveProperty('priceOverride')
    // The deprecated string field is ignored on current versions too.
    expect(line).not.toHaveProperty('originalUnitPrice')
    expect(input.presentmentCurrencyCode).toBe('INR')
    expect(line.quantity).toBe(1)
    expect(line.requiresShipping).toBe(true)
    // A custom line item must not reference a catalog variant.
    expect(line).not.toHaveProperty('variantId')
  })

  it('passes the note, tag and measurements through for the shop to check', async () => {
    const fetchMock = mockShopify(OK_RESPONSE)
    await createDraftOrder(
      {
        title: 'Bank',
        priceInr: 427,
        note: 'Estimated print time: 1 h 36 min',
        customAttributes: [{ key: 'Design ID', value: 'proj_1' }],
      },
      CREDENTIALS,
    )

    const { input } = sentBody(fetchMock).variables
    expect(input.note).toContain('1 h 36 min')
    expect(input.tags).toContain('e3d-studio')
    expect(input.lineItems[0].customAttributes).toEqual([{ key: 'Design ID', value: 'proj_1' }])
  })

  it('omits email entirely rather than sending null', async () => {
    const fetchMock = mockShopify(OK_RESPONSE)
    await createDraftOrder({ title: 'x', priceInr: 1, note: 'n', email: null }, CREDENTIALS)
    expect(sentBody(fetchMock).variables.input).not.toHaveProperty('email')
  })

  it('returns the draft order and its invoice link', async () => {
    mockShopify(OK_RESPONSE)
    const order = await createDraftOrder({ title: 'x', priceInr: 1, note: 'n' }, CREDENTIALS)
    expect(order.name).toBe('#D1')
    expect(order.invoiceUrl).toBe('https://shop.myshopify.com/invoice/abc')
  })

  it('throws on a userErrors rejection instead of reporting success', async () => {
    mockShopify({
      data: {
        draftOrderCreate: {
          draftOrder: null,
          userErrors: [{ field: ['lineItems'], message: 'Price override is invalid' }],
        },
      },
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      createDraftOrder({ title: 'x', priceInr: 1, note: 'n' }, CREDENTIALS),
    ).rejects.toThrow('Price override is invalid')
  })

  it('throws on a top-level GraphQL error', async () => {
    mockShopify({ errors: [{ message: 'Invalid API version' }] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      createDraftOrder({ title: 'x', priceInr: 1, note: 'n' }, CREDENTIALS),
    ).rejects.toThrow('Invalid API version')
  })

  it('does not leak the response body when Shopify returns an HTTP error', async () => {
    mockShopify({ errors: 'unauthorized' }, 401)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      createDraftOrder({ title: 'x', priceInr: 1, note: 'n' }, CREDENTIALS),
    ).rejects.toThrow('Shopify returned 401')
    expect(log).toHaveBeenCalled()
  })
})

describe('client credentials exchange', () => {
  const CLIENT: ShopifyConfig = {
    mode: 'client_credentials',
    storeDomain: 'shop.myshopify.com',
    clientId: 'cid',
    clientSecret: 'csecret',
  }

  /**
   * Answer by endpoint rather than by call order, so a test that triggers a
   * second token exchange still gets a token back instead of a GraphQL body.
   */
  function mockExchangeThenGraphQl(tokenBody: unknown, tokenStatus = 200) {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/admin/oauth/access_token')) {
        return {
          ok: tokenStatus >= 200 && tokenStatus < 300,
          status: tokenStatus,
          json: async () => tokenBody,
          text: async () => JSON.stringify(tokenBody),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => OK_RESPONSE,
        text: async () => JSON.stringify(OK_RESPONSE),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('exchanges the client id and secret for a token first', async () => {
    const fetchMock = mockExchangeThenGraphQl({ access_token: 'tok', expires_in: 86399 })
    await createDraftOrder({ title: 'x', priceInr: 1, note: 'n' }, CLIENT)

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]
    expect(tokenUrl).toBe('https://shop.myshopify.com/admin/oauth/access_token')
    expect(String(tokenInit.body)).toContain('grant_type=client_credentials')
    expect(String(tokenInit.body)).toContain('client_id=cid')

    // The GraphQL call then carries the exchanged token, never the secret.
    const [, graphInit] = fetchMock.mock.calls[1]
    expect(graphInit.headers['X-Shopify-Access-Token']).toBe('tok')
    expect(String(graphInit.body)).not.toContain('csecret')
  })

  it('reuses a cached token instead of exchanging on every order', async () => {
    const fetchMock = mockExchangeThenGraphQl({ access_token: 'tok', expires_in: 86399 })
    await createDraftOrder({ title: 'a', priceInr: 1, note: 'n' }, CLIENT)
    await createDraftOrder({ title: 'b', priceInr: 1, note: 'n' }, CLIENT)
    // One exchange plus two GraphQL calls, not two exchanges.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('oauth')).length).toBe(1)
  })

  it('re-exchanges once a token has expired', async () => {
    // expires_in 30s is inside the 60s safety margin, so it is never reused.
    const fetchMock = mockExchangeThenGraphQl({ access_token: 'tok', expires_in: 30 })
    await createDraftOrder({ title: 'a', priceInr: 1, note: 'n' }, CLIENT)
    await createDraftOrder({ title: 'b', priceInr: 1, note: 'n' }, CLIENT)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('oauth')).length).toBe(2)
  })

  it('surfaces a refused credential exchange without leaking the secret', async () => {
    const fetchMock = mockExchangeThenGraphQl({ error: 'shop_not_permitted' }, 401)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      createDraftOrder({ title: 'x', priceInr: 1, note: 'n' }, CLIENT),
    ).rejects.toThrow('Shopify refused the credentials (401)')
    // It must not have gone on to call the Admin API with no token.
    expect(fetchMock.mock.calls.length).toBe(1)
    expect(JSON.stringify(log.mock.calls)).not.toContain('csecret')
  })

  it('retries once with a fresh token when a cached one is rejected', async () => {
    // First exchange hands out a token the Admin API then rejects; the second
    // hands out a good one.
    let exchanges = 0
    let graphQlCalls = 0
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/admin/oauth/access_token')) {
        exchanges += 1
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: exchanges === 1 ? 'stale' : 'fresh',
            expires_in: 86399,
          }),
          text: async () => '',
        }
      }
      graphQlCalls += 1
      if (graphQlCalls === 1) {
        return { ok: false, status: 401, json: async () => ({}), text: async () => '' }
      }
      return { ok: true, status: 200, json: async () => OK_RESPONSE, text: async () => '' }
    })
    vi.stubGlobal('fetch', fetchMock)

    const order = await createDraftOrder({ title: 'x', priceInr: 1, note: 'n' }, CLIENT)
    expect(order.name).toBe('#D1')
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
    expect(lastCall[1].headers['X-Shopify-Access-Token']).toBe('fresh')
  })
})
