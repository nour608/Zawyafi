import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import type { Logger as PinoLogger } from 'pino'
import { z } from 'zod'
import { loadConfig, type AppConfig } from './config'
import { toDateWindowUtc } from './date'
import { AppError, isAppError, toAppError } from './errors'
import {
  FRONTEND_API_VERSION,
  getBatch,
  getOverview,
  getPortfolio,
  getTx,
  listBatches,
  listPeriods,
} from './frontend-data'
import type { VerificationStatus } from './frontend-types'
import { SquareClient } from './square-client'
import { verifySquareWebhookSignature } from './webhooks'

const dailyQuerySchema = z.object({
  merchantId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const paymentsDailyQuerySchema = dailyQuerySchema.extend({
  category: z.string().min(1).optional(),
  item: z.string().min(1).optional(),
})

const frontendOverviewQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

const frontendBatchParamsSchema = z.object({
  batchId: z.coerce.number().int().positive(),
})

const frontendPeriodsQuerySchema = z.object({
  batchId: z.coerce.number().int().positive().optional(),
  status: z.enum(['VERIFIED', 'UNVERIFIED']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
})

const frontendPortfolioQuerySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
})

const frontendTxParamsSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
})

interface WebhookBodyCandidate {
  event_id?: string
  type?: string
  merchant_id?: string
}

interface RequestWithRawBody {
  rawBodyText?: string
}

const equalsIgnoreCase = (left?: string, right?: string): boolean => {
  if (!left || !right) {
    return false
  }
  return left.toLowerCase() === right.toLowerCase()
}

const filterPayments = <T extends { categoryName?: string; itemName?: string }>(
  payments: T[],
  filters: { category?: string; item?: string },
): T[] =>
  payments.filter((payment) => {
    if (filters.category && !equalsIgnoreCase(payment.categoryName, filters.category)) {
      return false
    }

    if (filters.item && !equalsIgnoreCase(payment.itemName, filters.item)) {
      return false
    }

    return true
  })

const serializeLivePayments = (
  payments: Array<{
    id: string
    orderId?: string
    amountMinor: bigint
    currency: string
    status: string
    createdAt: string
    note?: string
    categoryName?: string
    itemName?: string
    raw: Record<string, unknown>
  }>,
) =>
  payments.map((payment) => ({
    ...payment,
    amountMinor: payment.amountMinor.toString(),
  }))

const serializeLiveRefunds = (
  refunds: Array<{
    id: string
    amountMinor: bigint
    currency: string
    status: string
    createdAt: string
    raw: Record<string, unknown>
  }>,
) =>
  refunds.map((refund) => ({
    ...refund,
    amountMinor: refund.amountMinor.toString(),
  }))

const loggerRedactionPaths = [
  'req.headers.authorization',
  'headers.authorization',
  'authorization',
  'token',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  'SQUARE_PAT_FALLBACK_TOKEN',
]

const parseWebhookMeta = (payload: unknown): { eventId: string; eventType: string; merchantId?: string } => {
  const fallbackEventId = `local-${randomUUID()}`

  if (typeof payload !== 'object' || payload === null) {
    return { eventId: fallbackEventId, eventType: 'unknown' }
  }

  const candidate = payload as WebhookBodyCandidate
  return {
    eventId: typeof candidate.event_id === 'string' && candidate.event_id.length > 0 ? candidate.event_id : fallbackEventId,
    eventType: typeof candidate.type === 'string' && candidate.type.length > 0 ? candidate.type : 'unknown',
    merchantId: typeof candidate.merchant_id === 'string' && candidate.merchant_id.length > 0 ? candidate.merchant_id : undefined,
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

  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const rawBodyText = String(body ?? '')
    ;(request as RequestWithRawBody).rawBodyText = rawBodyText

    if (rawBodyText.length === 0) {
      done(null, {})
      return
    }

    try {
      done(null, JSON.parse(rawBodyText))
    } catch {
      done(new AppError('INVALID_INPUT', 'Invalid JSON body', 400, false))
    }
  })

  const squareClient = new SquareClient(
    {
      baseUrl: config.squareBaseUrl,
      version: config.squareVersion,
      token: config.squarePatToken,
      timeoutMs: config.squareTimeoutMs,
      maxRetries: config.squareMaxRetries,
      retryBaseDelayMs: config.squareRetryBaseDelayMs,
    },
    options.fetchFn,
  )

  const now = options.now ?? (() => new Date())

  app.addHook('onRequest', async (request, reply) => {
    reply.header('access-control-allow-origin', '*')
    reply.header('access-control-allow-methods', 'GET,POST,OPTIONS')
    reply.header('access-control-allow-headers', 'Content-Type, Authorization, x-square-hmacsha256-signature')

    if (request.method === 'OPTIONS') {
      reply.code(204)
      await reply.send()
    }
  })

  app.get('/health', async () => ({
    status: 'ok',
    mode: 'stateless',
    timestamp: now().toISOString(),
  }))

  app.get('/frontend/overview', async (request) => {
    const parsed = frontendOverviewQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid query parameters', 400, false, {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    const date = parsed.data.date ?? now().toISOString().slice(0, 10)

    return getOverview(date)
  })

  app.get('/frontend/batches', async () => ({
    apiVersion: FRONTEND_API_VERSION,
    batches: listBatches(),
  }))

  app.get('/frontend/batches/:batchId', async (request) => {
    const parsed = frontendBatchParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid path parameter', 400, false, {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    const batch = getBatch(parsed.data.batchId)
    if (!batch) {
      throw new AppError('INVALID_INPUT', 'Batch not found', 404, false)
    }

    return {
      apiVersion: FRONTEND_API_VERSION,
      batches: [batch],
    }
  })

  app.get('/frontend/periods', async (request) => {
    const parsed = frontendPeriodsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid query parameters', 400, false, {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    const result = listPeriods({
      batchId: parsed.data.batchId,
      status: parsed.data.status as VerificationStatus | undefined,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    })

    return {
      apiVersion: FRONTEND_API_VERSION,
      nextCursor: result.nextCursor,
      periods: result.periods,
    }
  })

  app.get('/frontend/portfolio', async (request) => {
    const parsed = frontendPortfolioQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid query parameters', 400, false, {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    return getPortfolio(parsed.data.wallet)
  })

  app.get('/frontend/tx/:txHash', async (request) => {
    const parsed = frontendTxParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid path parameter', 400, false, {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    const tx = getTx(parsed.data.txHash)
    if (!tx) {
      throw new AppError('INVALID_INPUT', 'Transaction not found', 404, false)
    }

    return tx
  })

  app.get('/square/locations', async (request) => {
    request.log.info({ requestId: request.id }, 'list_locations_start')
    const locations = await squareClient.listLocations()
    request.log.info({ requestId: request.id, count: locations.length }, 'list_locations_complete')
    return { locations }
  })

  app.get('/square/payments/daily', async (request) => {
    const parsed = paymentsDailyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid query parameters', 400, false, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    const window = toDateWindowUtc(parsed.data.date)
    request.log.info(
      {
        requestId: request.id,
        merchantId: parsed.data.merchantId,
        date: parsed.data.date,
        category: parsed.data.category ?? null,
        item: parsed.data.item ?? null,
      },
      'live_payments_fetch_start',
    )

    const paymentsResult = await squareClient.listPayments(window.startIso, window.endIso)
    const filteredPayments = filterPayments(paymentsResult.items, {
      category: parsed.data.category,
      item: parsed.data.item,
    })
    const payments = serializeLivePayments(filteredPayments)

    request.log.info(
      {
        requestId: request.id,
        merchantId: parsed.data.merchantId,
        date: parsed.data.date,
        pageCount: paymentsResult.pageCount,
        count: payments.length,
      },
      'live_payments_fetch_complete',
    )

    return {
      source: 'square',
      merchantId: parsed.data.merchantId,
      date: parsed.data.date,
      periodStart: window.startIso,
      periodEnd: window.endIso,
      filters: {
        category: parsed.data.category ?? null,
        item: parsed.data.item ?? null,
      },
      pageCount: paymentsResult.pageCount,
      count: payments.length,
      payments,
    }
  })

  app.get('/square/refunds/daily', async (request) => {
    const parsed = dailyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid query parameters', 400, false, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    const window = toDateWindowUtc(parsed.data.date)
    request.log.info(
      {
        requestId: request.id,
        merchantId: parsed.data.merchantId,
        date: parsed.data.date,
      },
      'live_refunds_fetch_start',
    )

    const refundsResult = await squareClient.listRefunds(window.startIso, window.endIso)
    const refunds = serializeLiveRefunds(refundsResult.items)

    request.log.info(
      {
        requestId: request.id,
        merchantId: parsed.data.merchantId,
        date: parsed.data.date,
        pageCount: refundsResult.pageCount,
        count: refunds.length,
      },
      'live_refunds_fetch_complete',
    )

    return {
      source: 'square',
      merchantId: parsed.data.merchantId,
      date: parsed.data.date,
      periodStart: window.startIso,
      periodEnd: window.endIso,
      pageCount: refundsResult.pageCount,
      count: refunds.length,
      refunds,
    }
  })

  app.post('/square/webhooks', async (request, reply) => {
    const rawBody = (request as unknown as RequestWithRawBody).rawBodyText ?? JSON.stringify(request.body ?? {})
    const signatureHeader = request.headers['x-square-hmacsha256-signature']

    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
    const hasVerificationConfig = Boolean(config.squareWebhookSignatureKey && config.squareWebhookNotificationUrl)

    let signatureValid = false
    if (hasVerificationConfig && signature) {
      signatureValid = verifySquareWebhookSignature(
        config.squareWebhookSignatureKey as string,
        config.squareWebhookNotificationUrl as string,
        rawBody,
        signature,
      )
    }

    if (config.squareWebhookRequireSignature && !signatureValid) {
      throw new AppError('SQUARE_AUTH_FAILED', 'Invalid Square webhook signature', 401, false)
    }

    const payload = (typeof request.body === 'object' && request.body !== null
      ? (request.body as Record<string, unknown>)
      : {}) as Record<string, unknown>

    const webhookMeta = parseWebhookMeta(payload)

    request.log.info(
      {
        requestId: request.id,
        eventId: webhookMeta.eventId,
        eventType: webhookMeta.eventType,
        signatureValid,
      },
      'webhook_received',
    )

    reply.code(200)
    return {
      status: 'accepted',
      eventId: webhookMeta.eventId,
      signatureValid,
    }
  })

  app.setErrorHandler((error, request, reply) => {
    const hasValidation = typeof error === 'object' && error !== null && 'validation' in error
    const appError = isAppError(error)
      ? error
      : hasValidation
        ? new AppError('INVALID_INPUT', 'Request validation failed', 400, false)
        : toAppError(error)

    request.log.error(
      {
        requestId: request.id,
        errorCode: appError.errorCode,
        statusCode: appError.statusCode,
      },
      appError.message,
    )

    reply.status(appError.statusCode).send({
      errorCode: appError.errorCode,
      message: appError.message,
      requestId: request.id,
      retriable: appError.retriable,
      details: appError.details ?? {},
    })
  })

  return app
}
