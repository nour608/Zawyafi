import { buildApp } from '../../src/app'
import type { AppConfig } from '../../src/config'

const testConfig = (): AppConfig => ({
  port: 3000,
  host: '127.0.0.1',
  logLevel: 'silent',
  nodeEnv: 'test',
  databaseUrl: undefined,
  databaseSsl: false,
  kycDbPath: ':memory:',
  internalApiToken: 'internal-token',
  kycHmacKey: 'kyc-hmac-key',
  kycCommitKeyVersion: 'v1',
  sumsubWebhookSecret: 'sumsub-secret',
  sumsubAppToken: 'sumsub-app-token',
  sumsubSecretKey: 'sumsub-secret-key',
  sumsubBaseUrl: 'https://sumsub.local',
  sumsubLevelName: 'basic-kyc-level',
  sumsubSdkTtlSeconds: 3600,
  kycOnchainLockSeconds: 120,
  kycRetryBaseDelaySeconds: 30,
  complianceLockSeconds: 120,
  complianceRetryBaseDelaySeconds: 30,
  complianceMaxAttempts: 5,
  complianceReadyLimitDefault: 25,
  rateLimitWindowSeconds: 60,
  rateLimitKycStartMax: 20,
  rateLimitComplianceCreateMax: 20,
  corsAllowedOrigins: ['http://127.0.0.1:3000'],
  squareProxyBaseUrl: 'https://square-proxy.local',
  squareProxyTimeoutMs: 1000,
})

const toDigest = (secret: string, payload: string): string => {
  const crypto = require('node:crypto')
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

describe('API integration', () => {
  it('creates start request and returns session', async () => {
    const app = buildApp({
      config: testConfig(),
      fetchFn: async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === 'https://sumsub.local/resources/accessTokens/sdk') {
          return new Response(JSON.stringify({ token: 'sdk-token-1' }), { status: 200 }) as unknown as Response
        }
        if (url.startsWith('https://sumsub.local/resources/applicants?levelName=')) {
          return new Response(JSON.stringify({ id: 'sumsub-applicant-1' }), { status: 200 }) as unknown as Response
        }
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 }) as unknown as Response
      },
      now: () => new Date('2026-02-22T12:00:00.000Z'),
    })

    const start = await app.inject({
      method: 'POST',
      url: '/kyc/start',
      payload: {
        wallet: '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7',
        chainId: 11155111,
      },
    })

    expect(start.statusCode).toBe(201)
    const startBody = start.json() as { requestId: string; status: string }
    expect(startBody.status).toBe('PENDING_USER_SUBMISSION')

    const session = await app.inject({
      method: 'GET',
      url: `/kyc/session/${startBody.requestId}`,
    })

    expect(session.statusCode).toBe(200)
    expect((session.json() as { status: string }).status).toBe('PENDING_USER_SUBMISSION')

    await app.close()
  })

  it('does not return sumsub web sdk payload when app token is missing', async () => {
    const config = testConfig()
    const app = buildApp({
      config,
      fetchFn: async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === 'https://sumsub.local/resources/accessTokens/sdk') {
          return new Response(JSON.stringify({ token: 'sdk-token-1' }), { status: 200 }) as unknown as Response
        }
        if (url.startsWith('https://sumsub.local/resources/applicants?levelName=')) {
          return new Response(JSON.stringify({ id: 'sumsub-applicant-1' }), { status: 200 }) as unknown as Response
        }
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 }) as unknown as Response
      },
      now: () => new Date('2026-02-22T12:00:00.000Z'),
    })

    const start = await app.inject({
      method: 'POST',
      url: '/kyc/start',
      payload: {
        wallet: '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7',
        chainId: 11155111,
      },
    })

    expect(start.statusCode).toBe(201)
    const startBody = start.json() as { requestId: string }

    config.sumsubAppToken = undefined

    const session = await app.inject({
      method: 'GET',
      url: `/kyc/session/${startBody.requestId}`,
    })

    expect(session.statusCode).toBe(200)
    expect((session.json() as { sumsubWebSdk: unknown }).sumsubWebSdk).toBeNull()

    await app.close()
  })

  it('processes start + webhook + claim + onchain result', async () => {
    const app = buildApp({
      config: testConfig(),
      fetchFn: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === 'https://sumsub.local/resources/accessTokens/sdk' && init?.method === 'POST') {
          return new Response(JSON.stringify({ token: 'sdk-token-1' }), { status: 200 }) as unknown as Response
        }
        if (url.startsWith('https://sumsub.local/resources/applicants?levelName=') && init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 'sumsub-applicant-1' }), { status: 200 }) as unknown as Response
        }
        if (url.endsWith('/square/payments/daily?merchantId=m1&date=2026-02-22')) {
          return new Response(JSON.stringify({ source: 'square', payments: [] }), { status: 200 }) as unknown as Response
        }
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 }) as unknown as Response
      },
      now: () => new Date('2026-02-22T12:00:00.000Z'),
    })

    const start = await app.inject({
      method: 'POST',
      url: '/kyc/start',
      payload: {
        wallet: '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7',
        chainId: 11155111,
      },
    })
    const startBody = start.json() as { requestId: string }

    const webhookPayload = JSON.stringify({
      eventId: 'evt-1',
      applicantId: 'sumsub-applicant-1',
      reviewResult: {
        reviewAnswer: 'GREEN',
      },
    })

    const webhook = await app.inject({
      method: 'POST',
      url: '/kyc/webhook/sumsub',
      headers: {
        'content-type': 'application/json',
        'x-payload-digest': toDigest('sumsub-secret', webhookPayload),
      },
      payload: webhookPayload,
    })

    expect(webhook.statusCode).toBe(200)

    const claim = await app.inject({
      method: 'GET',
      url: '/internal/kyc/ready-onchain?limit=10',
      headers: {
        authorization: 'Bearer internal-token',
      },
    })

    expect(claim.statusCode).toBe(200)
    const records = (claim.json() as { records: Array<{ requestId: string }> }).records
    expect(records).toHaveLength(1)

    const onchainResult = await app.inject({
      method: 'POST',
      url: '/internal/kyc/onchain-result',
      headers: {
        authorization: 'Bearer internal-token',
      },
      payload: {
        requestId: records[0].requestId,
        txHash: `0x${'11'.repeat(32)}`,
        outcome: 'SUCCESS',
      },
    })

    expect(onchainResult.statusCode).toBe(200)
    expect((onchainResult.json() as { status: string }).status).toBe('ONCHAIN_APPROVED')

    const proxied = await app.inject({
      method: 'GET',
      url: '/square/payments/daily?merchantId=m1&date=2026-02-22',
    })

    expect(proxied.statusCode).toBe(200)
    expect((proxied.json() as { source: string }).source).toBe('square')

    await app.close()
  })

  it('rejects internal endpoints with missing auth', async () => {
    const app = buildApp({
      config: testConfig(),
      fetchFn: async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === 'https://sumsub.local/resources/accessTokens/sdk') {
          return new Response(JSON.stringify({ token: 'sdk-token-1' }), { status: 200 }) as unknown as Response
        }
        if (url.startsWith('https://sumsub.local/resources/applicants?levelName=')) {
          return new Response(JSON.stringify({ id: 'sumsub-applicant-1' }), { status: 200 }) as unknown as Response
        }
        return new Response('{}', { status: 200 }) as unknown as Response
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/internal/kyc/ready-onchain',
    })

    expect(response.statusCode).toBe(401)
    expect((response.json() as { errorCode: string }).errorCode).toBe('UNAUTHORIZED')

    await app.close()
  })

  it('rejects webhook with invalid signature', async () => {
    const app = buildApp({
      config: testConfig(),
      fetchFn: async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === 'https://sumsub.local/resources/accessTokens/sdk') {
          return new Response(JSON.stringify({ token: 'sdk-token-1' }), { status: 200 }) as unknown as Response
        }
        if (url.startsWith('https://sumsub.local/resources/applicants?levelName=')) {
          return new Response(JSON.stringify({ id: 'sumsub-applicant-1' }), { status: 200 }) as unknown as Response
        }
        return new Response('{}', { status: 200 }) as unknown as Response
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/kyc/webhook/sumsub',
      headers: {
        'content-type': 'application/json',
        'x-payload-digest': 'invalid',
      },
      payload: JSON.stringify({
        eventId: 'evt-invalid',
        applicantId: 'applicant-1',
      }),
    })

    expect(response.statusCode).toBe(401)
    expect((response.json() as { errorCode: string }).errorCode).toBe('WEBHOOK_UNAUTHORIZED')

    await app.close()
  })

  it('marks request as terminal when intake config is missing', async () => {
    const config = testConfig()
    config.kycHmacKey = undefined

    const app = buildApp({
      config,
      fetchFn: async () => new Response('{}', { status: 200 }) as unknown as Response,
      now: () => new Date('2026-02-22T12:00:00.000Z'),
    })

    const start = await app.inject({
      method: 'POST',
      url: '/kyc/start',
      payload: {
        wallet: '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7',
        chainId: 11155111,
      },
    })

    expect(start.statusCode).toBe(503)
    const payload = start.json() as { errorCode: string; details?: { requestId?: string } }
    expect(payload.errorCode).toBe('KYC_INTAKE_NOT_CONFIGURED')
    expect(payload.details?.requestId).toBeTruthy()

    const session = await app.inject({
      method: 'GET',
      url: `/kyc/session/${payload.details?.requestId}`,
    })

    expect(session.statusCode).toBe(200)
    expect((session.json() as { status: string }).status).toBe('FAILED_TERMINAL')

    await app.close()
  })

  it('creates, processes, and fetches compliance report jobs', async () => {
    const app = buildApp({
      config: testConfig(),
      fetchFn: async () => new Response('{}', { status: 200 }) as unknown as Response,
      now: () => new Date('2026-02-28T12:00:00.000Z'),
    })

    const createResponse = await app.inject({
      method: 'POST',
      url: '/compliance/reports',
      payload: {
        merchantIdHash: `0x${'11'.repeat(32)}`,
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      },
    })

    expect(createResponse.statusCode).toBe(201)
    const created = createResponse.json() as { requestId: string; status: string }
    expect(created.status).toBe('QUEUED')

    const readyResponse = await app.inject({
      method: 'GET',
      url: '/internal/compliance/ready',
      headers: {
        authorization: 'Bearer internal-token',
      },
    })

    expect(readyResponse.statusCode).toBe(200)
    const ready = readyResponse.json() as { records: Array<{ requestId: string }> }
    expect(ready.records).toHaveLength(1)
    expect(ready.records[0].requestId).toBe(created.requestId)

    const resultResponse = await app.inject({
      method: 'POST',
      url: '/internal/compliance/report-result',
      headers: {
        authorization: 'Bearer internal-token',
      },
      payload: {
        requestId: created.requestId,
        outcome: 'SUCCESS',
        report: {
          generatedAt: '2026-02-28T12:01:00.000Z',
          merchantIdHash: `0x${'11'.repeat(32)}`,
          startDate: '2026-02-01',
          endDate: '2026-02-28',
          chainSelectorName: 'ethereum-testnet-sepolia',
          revenueRegistryAddress: `0x${'22'.repeat(20)}`,
          scanFromBlock: '1',
          scanToBlock: '999',
          reportHash: `0x${'33'.repeat(32)}`,
          periodMerkleRoot: `0x${'44'.repeat(32)}`,
          totals: {
            periodCount: 1,
            grossSalesMinor: '1000',
            refundsMinor: '100',
            netSalesMinor: '900',
            unitsSold: '20',
            refundUnits: '2',
            netUnitsSold: '18',
            verifiedCount: 1,
            unverifiedCount: 0,
          },
          periods: [
            {
              periodId: `0x${'55'.repeat(32)}`,
              merchantIdHash: `0x${'11'.repeat(32)}`,
              productIdHash: `0x${'66'.repeat(32)}`,
              periodStart: '2026-02-27T00:00:00.000Z',
              periodEnd: '2026-02-27T23:59:59.000Z',
              generatedAt: '2026-02-28T00:15:00.000Z',
              grossSalesMinor: '1000',
              refundsMinor: '100',
              netSalesMinor: '900',
              unitsSold: '20',
              refundUnits: '2',
              netUnitsSold: '18',
              eventCount: 22,
              status: 'VERIFIED',
              riskScore: 10,
              reasonCode: 'OK',
              batchHash: `0x${'77'.repeat(32)}`,
              txHash: `0x${'88'.repeat(32)}`,
              blockNumber: '111',
              logIndex: 3,
            },
          ],
        },
      },
    })

    expect(resultResponse.statusCode).toBe(200)
    expect((resultResponse.json() as { status: string }).status).toBe('SUCCEEDED')

    const reportResponse = await app.inject({
      method: 'GET',
      url: `/compliance/reports/${created.requestId}`,
    })

    expect(reportResponse.statusCode).toBe(200)
    const reportPayload = reportResponse.json() as { status: string; report: { totals: { periodCount: number } } }
    expect(reportPayload.status).toBe('SUCCEEDED')
    expect(reportPayload.report.totals.periodCount).toBe(1)

    await app.close()
  })

  it('rejects compliance report window above 90 days', async () => {
    const app = buildApp({
      config: testConfig(),
      fetchFn: async () => new Response('{}', { status: 200 }) as unknown as Response,
    })

    const response = await app.inject({
      method: 'POST',
      url: '/compliance/reports',
      payload: {
        merchantIdHash: `0x${'11'.repeat(32)}`,
        startDate: '2025-01-01',
        endDate: '2025-05-01',
      },
    })

    expect(response.statusCode).toBe(400)
    expect((response.json() as { errorCode: string }).errorCode).toBe('INVALID_INPUT')

    await app.close()
  })

  it('rejects requests from disallowed browser origins', async () => {
    const app = buildApp({
      config: testConfig(),
      fetchFn: async () => new Response('{}', { status: 200 }) as unknown as Response,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'https://malicious.example',
      },
    })

    expect(response.statusCode).toBe(403)
    expect((response.json() as { errorCode: string }).errorCode).toBe('CORS_ORIGIN_DENIED')

    await app.close()
  })

  it('rate limits repeated compliance report creation requests from same IP', async () => {
    const config = testConfig()
    config.rateLimitComplianceCreateMax = 1
    config.rateLimitWindowSeconds = 60

    const app = buildApp({
      config,
      fetchFn: async () => new Response('{}', { status: 200 }) as unknown as Response,
      now: () => new Date('2026-02-28T12:00:00.000Z'),
    })

    const payload = {
      merchantIdHash: `0x${'11'.repeat(32)}`,
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    }

    const first = await app.inject({
      method: 'POST',
      url: '/compliance/reports',
      payload,
    })
    expect(first.statusCode).toBe(201)

    const second = await app.inject({
      method: 'POST',
      url: '/compliance/reports',
      payload,
    })
    expect(second.statusCode).toBe(429)
    expect((second.json() as { errorCode: string }).errorCode).toBe('RATE_LIMITED')

    await app.close()
  })
})
