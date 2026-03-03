import { randomUUID } from 'node:crypto'
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify'
import type { Logger as PinoLogger } from 'pino'
import { z } from 'zod'
import { ComplianceStore } from './compliance-store'
import { computeCommitment, createNonce, sha256Hex } from './crypto'
import type { AppConfig } from './config'
import { loadConfig } from './config'
import { assertInternalAuth } from './cre-trigger'
import { ensurePostgresSchema, openDatabase, openPostgresPool } from './db'
import { AppError, isAppError } from './errors'
import { KycStore } from './kyc-store'
import { PgComplianceStore } from './pg-compliance-store'
import { PgKycStore } from './pg-kyc-store'
import { createSumsubIntake, parseSumsubWebhook, verifySumsubWebhook } from './sumsub'
import type { OnchainOutcome } from './types'
import {
  assertWalletScope,
  parseWalletAuthHeaders,
  resolveWalletCapabilities,
  verifyWalletRequestAuth,
  type WalletAuthScope,
} from './wallet-auth'

interface RequestWithRawBody {
  rawBodyText?: string
}

const loggerRedactionPaths = [
  'req.headers.authorization',
  'authorization',
  '*.authorization',
  '*.token',
  '*.secret',
  '*.sdkToken',
  '*.sumsubSecretKey',
]

const corsAllowHeaders = [
  'Content-Type',
  'Authorization',
  'x-payload-digest',
  'x-sumsub-signature',
  'x-auth-address',
  'x-auth-timestamp',
  'x-auth-signature',
].join(', ')

const proxyRequestHeaderAllowlist = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'content-type',
  'user-agent',
  'x-request-id',
  'x-correlation-id',
])

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/$/, '').toLowerCase()

interface RateLimitBucket {
  count: number
  resetAtMs: number
}

const RATE_LIMIT_MAX_BUCKETS = 50_000
const WALLET_AUTH_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

const startSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.coerce.number().int().positive(),
})

const bindSchema = z.object({
  requestId: z.string().uuid(),
  commit: z.string().min(32),
  applicantId: z.string().min(1),
  sdkToken: z.string().min(1),
  keyVersion: z.string().min(1),
})

const onchainResultSchema = z.object({
  requestId: z.string().uuid(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  outcome: z.enum(['SUCCESS', 'RETRYABLE', 'TERMINAL']),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
})

const limitSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
})

const optionalLimitSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
})

const sessionParamsSchema = z.object({
  requestId: z.string().uuid(),
})

const isoDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const complianceCreateSchema = z.object({
  merchantIdHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  startDate: isoDaySchema,
  endDate: isoDaySchema,
})

const complianceResultReportSchema = z.object({
  generatedAt: z.string().datetime(),
  merchantIdHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  startDate: isoDaySchema,
  endDate: isoDaySchema,
  chainSelectorName: z.string().min(1),
  revenueRegistryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  scanFromBlock: z.string(),
  scanToBlock: z.string(),
  reportHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  periodMerkleRoot: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  totals: z.object({
    periodCount: z.number().int().nonnegative(),
    grossSalesMinor: z.string(),
    refundsMinor: z.string(),
    netSalesMinor: z.string(),
    unitsSold: z.string(),
    refundUnits: z.string(),
    netUnitsSold: z.string(),
    verifiedCount: z.number().int().nonnegative(),
    unverifiedCount: z.number().int().nonnegative(),
  }),
  periods: z.array(
    z.object({
      periodId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      merchantIdHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      productIdHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      periodStart: z.string().datetime(),
      periodEnd: z.string().datetime(),
      generatedAt: z.string().datetime(),
      grossSalesMinor: z.string(),
      refundsMinor: z.string(),
      netSalesMinor: z.string(),
      unitsSold: z.string(),
      refundUnits: z.string(),
      netUnitsSold: z.string(),
      eventCount: z.number().int().nonnegative(),
      status: z.enum(['VERIFIED', 'UNVERIFIED']),
      riskScore: z.number().int().min(0).max(1000),
      reasonCode: z.enum(['OK', 'REFUND_RATIO', 'SUDDEN_SPIKE', 'REFUND_AND_SPIKE', 'UNKNOWN']),
      batchHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      blockNumber: z.string(),
      logIndex: z.number().int().nonnegative(),
    }),
  ),
})

const complianceResultSchema = z.object({
  requestId: z.string().uuid(),
  outcome: z.enum(['SUCCESS', 'RETRYABLE', 'TERMINAL']),
  report: complianceResultReportSchema.optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
})

const toApiError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error
  }

  if (error instanceof Error) {
    return new AppError('INTERNAL_ERROR', error.message, 500)
  }

  return new AppError('INTERNAL_ERROR', 'Unexpected server error', 500)
}

const parseBody = (request: RequestWithRawBody): unknown => {
  if (!request.rawBodyText || request.rawBodyText.length === 0) {
    return {}
  }

  try {
    return JSON.parse(request.rawBodyText)
  } catch {
    throw new AppError('INVALID_INPUT', 'Invalid JSON body', 400)
  }
}

const parseAuthorization = (value: string | string[] | undefined): string | undefined => {
  if (!value) return undefined
  if (Array.isArray(value)) return value[0]
  return value
}

const classifyIntakeError = (error: unknown): { statusCode: number; code: string; message: string } => {
  if (error instanceof AppError) {
    if (error.errorCode === 'SUMSUB_TERMINAL') {
      return {
        statusCode: 400,
        code: error.errorCode,
        message: error.message,
      }
    }

    if (error.errorCode.startsWith('SUMSUB_')) {
      return {
        statusCode: 502,
        code: error.errorCode,
        message: error.message,
      }
    }
  }

  if (error instanceof Error) {
    return {
      statusCode: 502,
      code: 'KYC_INTAKE_FAILED',
      message: error.message,
    }
  }

  return {
    statusCode: 502,
    code: 'KYC_INTAKE_FAILED',
    message: 'Unknown intake failure',
  }
}

const getClientIp = (request: FastifyRequest): string => {
  const forwarded =
    typeof request.headers['x-forwarded-for'] === 'string'
      ? request.headers['x-forwarded-for']
      : Array.isArray(request.headers['x-forwarded-for'])
        ? request.headers['x-forwarded-for'][0]
        : undefined

  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) {
      return first
    }
  }

  return request.ip
}

const cleanupExpiredRateLimitBuckets = (buckets: Map<string, RateLimitBucket>, nowMs: number): void => {
  if (buckets.size <= RATE_LIMIT_MAX_BUCKETS) {
    return
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAtMs <= nowMs) {
      buckets.delete(key)
    }
  }
}

const consumeRateLimit = (
  buckets: Map<string, RateLimitBucket>,
  key: string,
  maxRequests: number,
  windowMs: number,
  nowMs: number,
): number | null => {
  cleanupExpiredRateLimitBuckets(buckets, nowMs)

  const existing = buckets.get(key)
  if (!existing || existing.resetAtMs <= nowMs) {
    buckets.set(key, {
      count: 1,
      resetAtMs: nowMs + windowMs,
    })
    return null
  }

  if (existing.count >= maxRequests) {
    return Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1_000))
  }

  existing.count += 1
  buckets.set(key, existing)
  return null
}

const assertRateLimit = (
  buckets: Map<string, RateLimitBucket>,
  request: FastifyRequest,
  routeKey: 'kyc_start' | 'compliance_create',
  maxRequests: number,
  windowSeconds: number,
  nowValue: Date,
): void => {
  const clientIp = getClientIp(request)
  const retryAfterSeconds = consumeRateLimit(
    buckets,
    `${routeKey}:${clientIp}`,
    maxRequests,
    windowSeconds * 1_000,
    nowValue.getTime(),
  )

  if (retryAfterSeconds !== null) {
    throw new AppError('RATE_LIMITED', 'Too many requests', 429, {
      routeKey,
      retryAfterSeconds,
    })
  }
}

const parseDayStartMs = (isoDate: string): number => {
  const parsed = Date.parse(`${isoDate}T00:00:00.000Z`)
  if (!Number.isFinite(parsed)) {
    throw new AppError('INVALID_INPUT', 'Invalid ISO date', 400, { isoDate })
  }
  return parsed
}

const assertDateWindow = (startDate: string, endDate: string, maxDays: number): void => {
  const startMs = parseDayStartMs(startDate)
  const endMs = parseDayStartMs(endDate)

  if (endMs < startMs) {
    throw new AppError('INVALID_INPUT', 'endDate must be greater than or equal to startDate', 400, { startDate, endDate })
  }

  const dayCount = Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1
  if (dayCount > maxDays) {
    throw new AppError('INVALID_INPUT', `Date range exceeds maximum window of ${maxDays} days`, 400, {
      startDate,
      endDate,
      maxDays,
    })
  }
}

export interface BuildAppOptions {
  config?: AppConfig
  now?: () => Date
  logger?: FastifyServerOptions['logger'] | PinoLogger
  fetchFn?: typeof fetch
}

export const buildApp = (options: BuildAppOptions = {}): FastifyInstance => {
  const config = options.config ?? loadConfig()
  const now = options.now ?? (() => new Date())
  const fetchFn = options.fetchFn ?? fetch

  const app = Fastify({
    logger:
      options.logger ??
      ({
        level: config.logLevel,
        redact: {
          paths: loggerRedactionPaths,
          remove: true,
        },
      } satisfies FastifyServerOptions['logger']),
  })

  const postgresPool = config.databaseUrl ? openPostgresPool(config.databaseUrl, config.databaseSsl) : null
  const sqliteDb = postgresPool ? null : openDatabase(config.kycDbPath)
  const store: KycStore | PgKycStore = postgresPool ? new PgKycStore(postgresPool) : new KycStore(sqliteDb as NonNullable<typeof sqliteDb>)
  const complianceStore: ComplianceStore | PgComplianceStore = postgresPool
    ? new PgComplianceStore(postgresPool)
    : new ComplianceStore(sqliteDb as NonNullable<typeof sqliteDb>)
  const rateLimitBuckets = new Map<string, RateLimitBucket>()

  if (postgresPool) {
    app.addHook('onReady', async () => {
      await ensurePostgresSchema(postgresPool)
      app.log.info('Postgres schema ensured')
    })

    app.addHook('onClose', async () => {
      await postgresPool.end()
    })
  }

  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    ;(request as RequestWithRawBody).rawBodyText = String(body ?? '')
    done(null, body)
  })

  app.addHook('onRequest', async (request, reply) => {
    const requestOriginHeader =
      typeof request.headers.origin === 'string'
        ? request.headers.origin
        : Array.isArray(request.headers.origin)
          ? request.headers.origin[0]
          : undefined

    const isAllowedOrigin =
      requestOriginHeader !== undefined && config.corsAllowedOrigins.includes(normalizeOrigin(requestOriginHeader))

    if (requestOriginHeader && !isAllowedOrigin) {
      throw new AppError('CORS_ORIGIN_DENIED', 'Origin is not allowed', 403)
    }

    if (requestOriginHeader && isAllowedOrigin) {
      reply.header('access-control-allow-origin', requestOriginHeader)
      reply.header('vary', 'Origin')
      reply.header('access-control-allow-methods', 'GET,POST,OPTIONS')
      reply.header('access-control-allow-headers', corsAllowHeaders)
    }

    if (request.method === 'OPTIONS') {
      reply.code(204)
      await reply.send()
    }
  })

  const assertWalletRequestAuth = async (
    request: FastifyRequest,
    scope: WalletAuthScope,
  ): Promise<{ address: string; capabilities: ReturnType<typeof resolveWalletCapabilities> }> => {
    const parsedHeaders = parseWalletAuthHeaders(request.headers)
    const nowMs = now().getTime()
    const verified = await verifyWalletRequestAuth({
      headers: parsedHeaders,
      nowMs,
      maxClockSkewMs: WALLET_AUTH_MAX_CLOCK_SKEW_MS,
    })

    const capabilities = resolveWalletCapabilities(verified.address, {
      adminAllowlist: config.adminAllowlist,
      merchantAllowlist: config.merchantAllowlist,
      complianceAllowlist: config.complianceAllowlist,
    })
    assertWalletScope(scope, capabilities)

    return {
      address: verified.address,
      capabilities,
    }
  }

  const getHealthPayload = async (): Promise<{
    status: string
    mode: string
    squareProxyHealthy: boolean
    timestamp: string
  }> => {
    let proxyHealthy = true

    try {
      const response = await fetchFn(`${config.squareProxyBaseUrl}/health`, {
        signal: AbortSignal.timeout(config.squareProxyTimeoutMs),
      })
      proxyHealthy = response.ok
    } catch {
      proxyHealthy = false
    }

    return {
      status: 'ok',
      mode: 'core',
      squareProxyHealthy: proxyHealthy,
      timestamp: now().toISOString(),
    }
  }

  app.get('/', async () => {
    return getHealthPayload()
  })

  app.get('/health', async () => {
    return getHealthPayload()
  })

  app.post('/kyc/start', async (request, reply) => {
    const authenticated = await assertWalletRequestAuth(request, 'authenticated')

    assertRateLimit(rateLimitBuckets, request, 'kyc_start', config.rateLimitKycStartMax, config.rateLimitWindowSeconds, now())

    const parsed = startSchema.safeParse(parseBody(request as RequestWithRawBody))
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid request payload', 400, {
        issues: parsed.error.issues.map((issue: z.ZodIssue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    if (parsed.data.wallet.toLowerCase() !== authenticated.address) {
      throw new AppError('FORBIDDEN', 'Authenticated wallet does not match payload wallet', 403)
    }

    const nonce = createNonce()
    const record = await store.createRequest(
      {
        wallet: parsed.data.wallet,
        chainId: parsed.data.chainId,
        nonce,
      },
      now(),
    )

    if (!config.kycHmacKey || !config.sumsubAppToken || !config.sumsubSecretKey) {
      await store.recordIntakeFailure(
        {
          requestId: record.requestId,
          outcome: 'TERMINAL',
          errorCode: 'KYC_INTAKE_NOT_CONFIGURED',
          errorMessage: 'KYC intake credentials are missing',
        },
        now(),
      )
      throw new AppError('KYC_INTAKE_NOT_CONFIGURED', 'KYC intake is not configured', 503, {
        requestId: record.requestId,
      })
    }

    const commit = computeCommitment(config.kycHmacKey, record.chainId, record.wallet, record.nonce)

    try {
      const sumsubArtifacts = await createSumsubIntake(fetchFn, {
        appToken: config.sumsubAppToken,
        secretKey: config.sumsubSecretKey,
        baseUrl: config.sumsubBaseUrl,
        levelName: config.sumsubLevelName,
        sdkTtlSeconds: config.sumsubSdkTtlSeconds,
      }, {
        externalUserId: commit,
        requestId: record.requestId,
      })

      const updated = await store.bindApplicant(
        {
          requestId: record.requestId,
          commit,
          applicantId: sumsubArtifacts.applicantId,
          sdkToken: sumsubArtifacts.sdkToken,
          keyVersion: config.kycCommitKeyVersion,
        },
        now(),
      )

      reply.code(201)
      return {
        requestId: updated.requestId,
        status: updated.status,
      }
    } catch (error) {
      const intakeError = classifyIntakeError(error)
      const terminal = intakeError.statusCode >= 400 && intakeError.statusCode < 500 && intakeError.statusCode !== 429

      await store.recordIntakeFailure(
        {
          requestId: record.requestId,
          outcome: terminal ? 'TERMINAL' : 'RETRYABLE',
          errorCode: intakeError.code,
          errorMessage: intakeError.message,
        },
        now(),
      )

      app.log.error(
        {
          requestId: record.requestId,
          code: intakeError.code,
          message: intakeError.message,
        },
        'KYC intake failed',
      )

      throw new AppError(intakeError.code, intakeError.message, intakeError.statusCode, {
        requestId: record.requestId,
      })
    }
  })

  app.get('/kyc/session/:requestId', async (request) => {
    const authenticated = await assertWalletRequestAuth(request, 'authenticated')

    const parsed = sessionParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid requestId', 400)
    }

    const record = await store.getByRequestId(parsed.data.requestId)
    if (!record) {
      throw new AppError('REQUEST_NOT_FOUND', 'KYC request not found', 404)
    }

    if (record.wallet.toLowerCase() !== authenticated.address) {
      throw new AppError('FORBIDDEN', 'You are not allowed to access this KYC session', 403)
    }

    return {
      requestId: record.requestId,
      wallet: record.wallet,
      chainId: record.chainId,
      status: record.status,
      sumsubApplicantId: record.sumsubApplicantId,
      onchainTxHash: record.onchainTxHash,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      sumsubWebSdk:
        record.status === 'PENDING_USER_SUBMISSION' &&
        record.sumsubApplicantId &&
        record.sumsubSdkToken &&
        config.sumsubAppToken
          ? {
              applicantId: record.sumsubApplicantId,
              sdkToken: record.sumsubSdkToken,
              appToken: config.sumsubAppToken,
            }
          : null,
    }
  })

  app.post('/kyc/webhook/sumsub', async (request) => {
    const req = request as RequestWithRawBody
    const rawBody = req.rawBodyText ?? ''
    const signatureHeader =
      typeof request.headers['x-payload-digest'] === 'string'
        ? request.headers['x-payload-digest']
        : typeof request.headers['x-sumsub-signature'] === 'string'
          ? request.headers['x-sumsub-signature']
          : undefined

    verifySumsubWebhook(config.sumsubWebhookSecret, signatureHeader, rawBody)

    const payload = parseBody(req)
    const parsed = parseSumsubWebhook(payload)
    const inserted = await store.recordWebhookEvent(
      {
        eventId: parsed.eventId,
        applicantId: parsed.applicantId,
        payloadHash: sha256Hex(rawBody),
      },
      now(),
    )

    if (!inserted) {
      return {
        accepted: true,
        duplicate: true,
      }
    }

    const updated = await store.applySumsubReview(
      {
        applicantId: parsed.applicantId,
        reviewAnswer: parsed.reviewAnswer,
      },
      now(),
    )

    return {
      accepted: true,
      duplicate: false,
      applicantId: parsed.applicantId,
      reviewAnswer: parsed.reviewAnswer,
      updated: Boolean(updated),
    }
  })

  app.post('/internal/kyc/bind', async (request) => {
    assertInternalAuth(parseAuthorization(request.headers.authorization), config.internalApiToken)

    const parsed = bindSchema.safeParse(parseBody(request as RequestWithRawBody))
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid bind payload', 400, {
        issues: parsed.error.issues.map((issue: z.ZodIssue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    const updated = await store.bindApplicant(parsed.data, now())
    return {
      requestId: updated.requestId,
      status: updated.status,
      applicantId: updated.sumsubApplicantId,
    }
  })

  app.get('/internal/kyc/ready-onchain', async (request) => {
    assertInternalAuth(parseAuthorization(request.headers.authorization), config.internalApiToken)

    const parsed = limitSchema.safeParse(request.query)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid query parameters', 400)
    }

    const records = await store.claimReadyOnchain(parsed.data.limit, config.kycOnchainLockSeconds, now())
    return {
      records: records.map((record) => ({
        requestId: record.requestId,
        wallet: record.wallet,
        chainId: record.chainId,
        status: record.status,
        commit: record.commit,
        approvedAt: record.updatedAt,
      })),
    }
  })

  app.post('/internal/kyc/onchain-result', async (request) => {
    assertInternalAuth(parseAuthorization(request.headers.authorization), config.internalApiToken)

    const parsed = onchainResultSchema.safeParse(parseBody(request as RequestWithRawBody))
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid onchain result payload', 400, {
        issues: parsed.error.issues.map((issue: z.ZodIssue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    const payload = parsed.data
    const updated = await store.recordOnchainResult(
      {
        requestId: payload.requestId,
        txHash: payload.txHash,
        outcome: payload.outcome as OnchainOutcome,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        retryBaseDelaySeconds: config.kycRetryBaseDelaySeconds,
      },
      now(),
    )

    return {
      requestId: updated.requestId,
      status: updated.status,
      attemptCount: updated.attemptCount,
      nextRetryAt: updated.nextRetryAt,
      onchainTxHash: updated.onchainTxHash,
    }
  })

  app.post('/compliance/reports', async (request, reply) => {
    await assertWalletRequestAuth(request, 'compliance')

    assertRateLimit(
      rateLimitBuckets,
      request,
      'compliance_create',
      config.rateLimitComplianceCreateMax,
      config.rateLimitWindowSeconds,
      now(),
    )

    const parsed = complianceCreateSchema.safeParse(parseBody(request as RequestWithRawBody))
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid compliance request payload', 400, {
        issues: parsed.error.issues.map((issue: z.ZodIssue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    assertDateWindow(parsed.data.startDate, parsed.data.endDate, 90)

    const created = await complianceStore.createRequest(
      {
        merchantIdHash: parsed.data.merchantIdHash,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      },
      now(),
    )

    reply.code(201)
    return {
      requestId: created.requestId,
      status: created.status,
      createdAt: created.createdAt,
      pollAfterMs: 2000,
    }
  })

  app.get('/compliance/reports/:requestId', async (request) => {
    await assertWalletRequestAuth(request, 'compliance')

    const parsed = sessionParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid requestId', 400)
    }

    const record = await complianceStore.getRequestById(parsed.data.requestId)
    if (!record) {
      throw new AppError('REQUEST_NOT_FOUND', 'Compliance request not found', 404)
    }

    const report = record.status === 'SUCCEEDED' ? await complianceStore.getPacketByRequestId(record.requestId) : null

    return {
      requestId: record.requestId,
      status: record.status,
      merchantIdHash: record.merchantIdHash,
      startDate: record.startDate,
      endDate: record.endDate,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attemptCount: record.attemptCount,
      nextRetryAt: record.nextRetryAt,
      errorCode: record.lastErrorCode,
      errorMessage: record.lastErrorMessage,
      report,
    }
  })

  app.get('/internal/compliance/ready', async (request) => {
    assertInternalAuth(parseAuthorization(request.headers.authorization), config.internalApiToken)

    const parsed = optionalLimitSchema.safeParse(request.query)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid query parameters', 400)
    }

    const limit = parsed.data.limit ?? config.complianceReadyLimitDefault
    const records = await complianceStore.claimReady(limit, config.complianceLockSeconds, now())

    return {
      records: records.map((record) => ({
        requestId: record.requestId,
        merchantIdHash: record.merchantIdHash,
        startDate: record.startDate,
        endDate: record.endDate,
      })),
    }
  })

  app.post('/internal/compliance/report-result', async (request) => {
    assertInternalAuth(parseAuthorization(request.headers.authorization), config.internalApiToken)

    const parsed = complianceResultSchema.safeParse(parseBody(request as RequestWithRawBody))
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid compliance result payload', 400, {
        issues: parsed.error.issues.map((issue: z.ZodIssue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    if (parsed.data.outcome === 'SUCCESS' && !parsed.data.report) {
      throw new AppError('INVALID_INPUT', 'Missing report payload for SUCCESS outcome', 400)
    }

    const updated = await complianceStore.recordResult(
      {
        requestId: parsed.data.requestId,
        outcome: parsed.data.outcome,
        report: parsed.data.report,
        errorCode: parsed.data.errorCode,
        errorMessage: parsed.data.errorMessage,
        retryBaseDelaySeconds: config.complianceRetryBaseDelaySeconds,
        maxAttempts: config.complianceMaxAttempts,
      },
      now(),
    )

    return {
      requestId: updated.requestId,
      status: updated.status,
      attemptCount: updated.attemptCount,
      nextRetryAt: updated.nextRetryAt,
      errorCode: updated.lastErrorCode,
      errorMessage: updated.lastErrorMessage,
    }
  })

  const proxyToSquare = async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method
    const originalUrl = request.raw.url ?? request.url
    const targetUrl = `${config.squareProxyBaseUrl}${originalUrl}`

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(request.headers)) {
      if (!value) continue
      const lower = key.toLowerCase()
      if (!proxyRequestHeaderAllowlist.has(lower)) continue
      headers[key] = Array.isArray(value) ? value.join(',') : String(value)
    }

    const body = ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : (request.body as BodyInit)

    const response = await fetchFn(targetUrl, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(config.squareProxyTimeoutMs),
    })

    const responseBody = await response.text()
    const contentType = response.headers.get('content-type')

    reply.code(response.status)
    if (contentType) {
      reply.header('content-type', contentType)
    }

    if (contentType?.includes('application/json')) {
      try {
        return reply.send(responseBody.length ? JSON.parse(responseBody) : {})
      } catch {
        return reply.send(responseBody)
      }
    }

    return reply.send(responseBody)
  }

  app.route({
    method: ['GET', 'POST', 'PUT', 'DELETE'],
    url: '/square/*',
    preHandler: async (request) => {
      await assertWalletRequestAuth(request, 'merchant')
    },
    handler: proxyToSquare,
  })

  app.route({
    method: ['GET'],
    url: '/frontend/*',
    preHandler: async (request) => {
      await assertWalletRequestAuth(request, 'authenticated')
    },
    handler: proxyToSquare,
  })

  app.setErrorHandler((error, request, reply) => {
    const appError = toApiError(error)
    const requestId = request.id ?? randomUUID()

    request.log.error(
      {
        requestId,
        errorCode: appError.errorCode,
        statusCode: appError.statusCode,
        details: appError.details,
      },
      appError.message,
    )

    reply.status(appError.statusCode).send({
      errorCode: appError.errorCode,
      message: appError.message,
      requestId,
      retriable: appError.statusCode >= 500,
      details: appError.details,
    })
  })

  return app
}
