import { Writable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'
import type { AppConfig } from '../../src/config'
import { buildSquareWebhookSignature } from '../../src/webhooks'

interface MockResponsePlan {
  statusCode: number
  body: unknown
}

interface MockFetchSetup {
  payments?: MockResponsePlan[]
  refunds?: MockResponsePlan[]
  locations?: MockResponsePlan[]
}

const createTestConfig = (overrides: Partial<AppConfig>): AppConfig => ({
  port: 0,
  host: '127.0.0.1',
  logLevel: 'info',
  squareBaseUrl: 'https://square-mock.local',
  squareVersion: '2026-01-22',
  squarePatToken: 'super-secret-token',
  squareTimeoutMs: 1_000,
  squareMaxRetries: 1,
  squareRetryBaseDelayMs: 5,
  squareWebhookSignatureKey: undefined,
  squareWebhookNotificationUrl: undefined,
  squareWebhookRequireSignature: false,
  ...overrides,
})

const createLogCollector = (): { loggerOptions: Record<string, unknown>; lines: string[] } => {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString('utf-8').trim())
      callback()
    },
  })

  return {
    loggerOptions: {
      level: 'info',
      stream,
      redact: {
        paths: [
          'req.headers.authorization',
          'headers.authorization',
          'authorization',
          'token',
          '*.token',
          '*.accessToken',
          '*.refreshToken',
          'SQUARE_PAT_FALLBACK_TOKEN',
        ],
        remove: true,
      },
    },
    lines,
  }
}

const createMockFetch = (setup: MockFetchSetup): {
  fetchFn: typeof fetch
  calls: { payments: number; refunds: number; locations: number }
} => {
  const calls = { payments: 0, refunds: 0, locations: 0 }

  const pickPlan = (plans: MockResponsePlan[] | undefined, index: number): MockResponsePlan => {
    if (!plans || plans.length === 0) {
      return { statusCode: 200, body: {} }
    }

    return plans[Math.min(index, plans.length - 1)]
  }

  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    const pathname = url.pathname

    let plan: MockResponsePlan
    if (pathname === '/v2/payments') {
      plan = pickPlan(setup.payments, calls.payments)
      calls.payments += 1
    } else if (pathname === '/v2/refunds') {
      plan = pickPlan(setup.refunds, calls.refunds)
      calls.refunds += 1
    } else if (pathname === '/v2/locations') {
      plan = pickPlan(setup.locations, calls.locations)
      calls.locations += 1
    } else {
      plan = { statusCode: 404, body: { errors: [{ detail: 'unknown path' }] } }
    }

    return new Response(JSON.stringify(plan.body), {
      status: plan.statusCode,
      headers: {
        'content-type': 'application/json',
      },
    })
  }

  return { fetchFn, calls }
}

describe('API integration', () => {
  const apps: Array<ReturnType<typeof buildApp>> = []

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop()
      if (app) {
        await app.close()
      }
    }
  })

  it('returns live payments and refunds directly from Square', async () => {
    const mock = createMockFetch({
      locations: [
        {
          statusCode: 200,
          body: {
            locations: [{ id: 'loc-1', name: 'Cafe Main Branch', status: 'ACTIVE', timezone: 'UTC' }],
          },
        },
      ],
      payments: [
        {
          statusCode: 200,
          body: {
            payments: [
              {
                id: 'pay-1',
                status: 'COMPLETED',
                amount_money: { amount: 960, currency: 'USD' },
                created_at: '2026-02-17T01:00:00.000Z',
                note: 'Cafe Seed #1 - Coffee/Cappuccino',
              },
              {
                id: 'pay-2',
                status: 'COMPLETED',
                amount_money: { amount: 890, currency: 'USD' },
                created_at: '2026-02-17T02:00:00.000Z',
                note: 'Cafe Seed #2 - Sandwiches/Veggie Halloumi Wrap',
              },
            ],
          },
        },
      ],
      refunds: [
        {
          statusCode: 200,
          body: {
            refunds: [
              {
                id: 'refund-1',
                status: 'COMPLETED',
                amount_money: { amount: 45, currency: 'USD' },
                created_at: '2026-02-17T03:00:00.000Z',
              },
            ],
          },
        },
      ],
    })

    const logs = createLogCollector()
    const app = buildApp({
      config: createTestConfig({}),
      logger: logs.loggerOptions,
      fetchFn: mock.fetchFn,
    })
    apps.push(app)

    const health = await app.inject({ method: 'GET', url: '/health' })
    expect(health.statusCode).toBe(200)
    expect(health.json().mode).toBe('stateless')

    const locations = await app.inject({ method: 'GET', url: '/square/locations' })
    expect(locations.statusCode).toBe(200)
    expect(locations.json().locations[0].name).toBe('Cafe Main Branch')

    const payments = await app.inject({
      method: 'GET',
      url: '/square/payments/daily?merchantId=merchant-1&date=2026-02-17',
    })
    expect(payments.statusCode).toBe(200)
    expect(payments.json().source).toBe('square')
    expect(payments.json().count).toBe(2)
    expect(payments.json().payments[0].amountMinor).toBe('960')
    expect(payments.json().payments[0].categoryName).toBe('Coffee')
    expect(payments.json().payments[1].itemName).toBe('Veggie Halloumi Wrap')

    const filtered = await app.inject({
      method: 'GET',
      url: '/square/payments/daily?merchantId=merchant-1&date=2026-02-17&category=coffee&item=cappuccino',
    })
    expect(filtered.statusCode).toBe(200)
    expect(filtered.json().count).toBe(1)
    expect(filtered.json().payments[0].id).toBe('pay-1')

    const refunds = await app.inject({
      method: 'GET',
      url: '/square/refunds/daily?merchantId=merchant-1&date=2026-02-17',
    })
    expect(refunds.statusCode).toBe(200)
    expect(refunds.json().source).toBe('square')
    expect(refunds.json().count).toBe(1)
    expect(refunds.json().refunds[0].amountMinor).toBe('45')

    const logBlob = logs.lines.join('\n')
    expect(logBlob).toContain('live_payments_fetch_start')
    expect(logBlob).toContain('live_refunds_fetch_complete')
    expect(logBlob).not.toContain('super-secret-token')
    expect(mock.calls.locations).toBe(1)
    expect(mock.calls.payments).toBe(2)
    expect(mock.calls.refunds).toBe(1)
  })

  it('returns INVALID_INPUT for malformed date', async () => {
    const app = buildApp({ config: createTestConfig({}) })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/square/payments/daily?merchantId=merchant-1&date=17-02-2026',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().errorCode).toBe('INVALID_INPUT')
  })

  it('serves frontend facade endpoints with typed payloads', async () => {
    const app = buildApp({ config: createTestConfig({}) })
    apps.push(app)

    const overview = await app.inject({
      method: 'GET',
      url: '/frontend/overview?date=2026-02-17',
    })
    expect(overview.statusCode).toBe(200)
    expect(overview.json().apiVersion).toBe('v1')
    expect(overview.json().date).toBe('2026-02-17')

    const batches = await app.inject({
      method: 'GET',
      url: '/frontend/batches',
    })
    expect(batches.statusCode).toBe(200)
    expect(Array.isArray(batches.json().batches)).toBe(true)
    expect(batches.json().batches.length).toBeGreaterThanOrEqual(2)

    const batchById = await app.inject({
      method: 'GET',
      url: '/frontend/batches/1',
    })
    expect(batchById.statusCode).toBe(200)
    expect(batchById.json().batches[0].batchId).toBe(1)

    const periods = await app.inject({
      method: 'GET',
      url: '/frontend/periods?batchId=2&status=UNVERIFIED&limit=5',
    })
    expect(periods.statusCode).toBe(200)
    expect(periods.json().periods.length).toBeGreaterThanOrEqual(1)
    expect(periods.json().periods.every((row: any) => row.batchId === 2)).toBe(true)
    expect(periods.json().periods.every((row: any) => row.status === 'UNVERIFIED')).toBe(true)

    const portfolio = await app.inject({
      method: 'GET',
      url: '/frontend/portfolio?wallet=0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7',
    })
    expect(portfolio.statusCode).toBe(200)
    expect(portfolio.json().wallet.toLowerCase()).toBe('0xa2cd38c20aa36a1d7d1569289d9b61e9b01a2cd7')
    expect(Array.isArray(portfolio.json().positions)).toBe(true)

    const tx = await app.inject({
      method: 'GET',
      url: '/frontend/tx/0x4e32f9e15b9ab1dc0b07b1ff578da675f2f9d18c220b09f7cad2721e3f40b90f',
    })
    expect(tx.statusCode).toBe(200)
    expect(tx.json().status).toBe('confirmed')
  })

  it('handles invalid frontend facade input and CORS preflight', async () => {
    const app = buildApp({ config: createTestConfig({}) })
    apps.push(app)

    const invalidPortfolio = await app.inject({
      method: 'GET',
      url: '/frontend/portfolio?wallet=invalid',
    })
    expect(invalidPortfolio.statusCode).toBe(400)
    expect(invalidPortfolio.json().errorCode).toBe('INVALID_INPUT')

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/frontend/batches',
      headers: {
        origin: 'http://localhost:3001',
        'access-control-request-method': 'GET',
      },
    })
    expect(preflight.statusCode).toBe(204)
    expect(preflight.headers['access-control-allow-origin']).toBe('*')
  })

  it('maps Square 401 to SQUARE_AUTH_FAILED', async () => {
    const mock = createMockFetch({
      payments: [{ statusCode: 401, body: { errors: [{ detail: 'unauthorized' }] } }],
    })

    const app = buildApp({ config: createTestConfig({}), fetchFn: mock.fetchFn })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/square/payments/daily?merchantId=merchant-1&date=2026-02-17',
    })

    expect(response.statusCode).toBe(502)
    expect(response.json().errorCode).toBe('SQUARE_AUTH_FAILED')
  })

  it('retries 429 and succeeds when a later attempt succeeds', async () => {
    const mock = createMockFetch({
      payments: [
        { statusCode: 429, body: { errors: [{ detail: 'rate limit' }] } },
        {
          statusCode: 200,
          body: {
            payments: [
              {
                id: 'pay-1',
                status: 'COMPLETED',
                amount_money: { amount: 1200, currency: 'USD' },
                created_at: '2026-02-17T01:00:00.000Z',
              },
            ],
          },
        },
      ],
    })

    const app = buildApp({
      config: createTestConfig({
        squareMaxRetries: 1,
        squareRetryBaseDelayMs: 1,
      }),
      fetchFn: mock.fetchFn,
    })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/square/payments/daily?merchantId=merchant-1&date=2026-02-17',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().count).toBe(1)
    expect(mock.calls.payments).toBe(2)
  })

  it('verifies webhook signature when enabled', async () => {
    const signatureKey = 'webhook-signature-key'
    const notificationUrl = 'https://api.example.com/square/webhooks'
    const payload = {
      event_id: 'evt-2',
      type: 'payment.updated',
      merchant_id: 'merchant-9',
    }
    const rawPayload = JSON.stringify(payload)

    const validSignature = buildSquareWebhookSignature(signatureKey, notificationUrl, rawPayload)

    const app = buildApp({
      config: createTestConfig({
        squareWebhookRequireSignature: true,
        squareWebhookSignatureKey: signatureKey,
        squareWebhookNotificationUrl: notificationUrl,
      }),
    })
    apps.push(app)

    const validResponse = await app.inject({
      method: 'POST',
      url: '/square/webhooks',
      headers: {
        'x-square-hmacsha256-signature': validSignature,
      },
      payload,
    })

    expect(validResponse.statusCode).toBe(200)
    expect(validResponse.json().signatureValid).toBe(true)

    const invalidResponse = await app.inject({
      method: 'POST',
      url: '/square/webhooks',
      headers: {
        'x-square-hmacsha256-signature': 'invalid',
      },
      payload,
    })

    expect(invalidResponse.statusCode).toBe(401)
    expect(invalidResponse.json().errorCode).toBe('SQUARE_AUTH_FAILED')
  })
})
