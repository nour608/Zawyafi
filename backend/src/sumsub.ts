import { createHmac } from 'node:crypto'
import { AppError } from './errors'
import { verifyHmacSha256 } from './crypto'
import type { ReviewAnswer } from './types'

interface SumsubWebhookShape {
  applicantId?: string
  applicant_id?: string
  externalUserId?: string
  reviewResult?: {
    reviewAnswer?: string
  }
  reviewAnswer?: string
  eventId?: string
  event_id?: string
  correlationId?: string
}

export interface ParsedWebhook {
  eventId: string
  applicantId: string
  reviewAnswer: ReviewAnswer
}

export interface SumsubIntakeConfig {
  appToken: string
  secretKey: string
  baseUrl: string
  levelName: string
  sdkTtlSeconds: number
}

export interface SumsubIntakeArtifacts {
  applicantId: string
  sdkToken: string
}

const toReviewAnswer = (value: string | undefined): ReviewAnswer => {
  if (!value) return 'UNKNOWN'
  const normalized = value.toUpperCase()
  if (normalized === 'GREEN') return 'GREEN'
  if (normalized === 'RED') return 'RED'
  if (normalized === 'YELLOW') return 'YELLOW'
  return 'UNKNOWN'
}

export const verifySumsubWebhook = (
  secret: string | undefined,
  signatureHeader: string | undefined,
  rawBody: string,
): void => {
  if (!secret) {
    return
  }

  if (!signatureHeader) {
    throw new AppError('WEBHOOK_UNAUTHORIZED', 'Missing Sumsub signature', 401)
  }

  const valid = verifyHmacSha256(secret, rawBody, signatureHeader)
  if (!valid) {
    throw new AppError('WEBHOOK_UNAUTHORIZED', 'Invalid Sumsub webhook signature', 401)
  }
}

export const parseSumsubWebhook = (payload: unknown): ParsedWebhook => {
  if (typeof payload !== 'object' || payload === null) {
    throw new AppError('INVALID_INPUT', 'Invalid webhook payload', 400)
  }

  const body = payload as SumsubWebhookShape
  const applicantId = body.applicantId ?? body.applicant_id
  if (!applicantId || applicantId.length === 0) {
    throw new AppError('INVALID_INPUT', 'Webhook payload missing applicantId', 400)
  }

  const eventId = body.eventId ?? body.event_id ?? body.correlationId ?? `${applicantId}:${Date.now()}`
  const reviewAnswer = toReviewAnswer(body.reviewResult?.reviewAnswer ?? body.reviewAnswer)

  return {
    eventId,
    applicantId,
    reviewAnswer,
  }
}

const buildSignature = (secretKey: string, timestamp: string, method: string, path: string, bodyText: string): string =>
  createHmac('sha256', secretKey).update(`${timestamp}${method.toUpperCase()}${path}${bodyText}`, 'utf8').digest('hex')

const parseJson = async (response: Response): Promise<Record<string, unknown>> => {
  const bodyText = await response.text()

  if (!bodyText || bodyText.trim().length === 0) {
    return {}
  }

  try {
    return JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    throw new AppError('SUMSUB_API_ERROR', 'Sumsub returned non-JSON response', 502)
  }
}

const callSumsub = async (
  fetchFn: typeof fetch,
  config: SumsubIntakeConfig,
  request: {
    method: 'POST'
    path: string
    body: Record<string, unknown>
    idempotencyKey: string
  },
): Promise<Record<string, unknown>> => {
  const bodyText = JSON.stringify(request.body)
  const timestamp = Math.floor(Date.now() / 1_000).toString()

  const response = await fetchFn(`${config.baseUrl}${request.path}`, {
    method: request.method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-App-Token': config.appToken,
      'X-App-Access-Ts': timestamp,
      'X-App-Access-Sig': buildSignature(config.secretKey, timestamp, request.method, request.path, bodyText),
      'X-Idempotency-Key': request.idempotencyKey,
    },
    body: bodyText,
  })

  const payload = await parseJson(response)
  if (!response.ok) {
    const terminal = response.status >= 400 && response.status < 500 && response.status !== 429
    throw new AppError(
      terminal ? 'SUMSUB_TERMINAL' : 'SUMSUB_RETRYABLE',
      `Sumsub request failed with status ${response.status}`,
      terminal ? 400 : 502,
      { statusCode: response.status, payload },
    )
  }

  return payload
}

export const createSumsubIntake = async (
  fetchFn: typeof fetch,
  config: SumsubIntakeConfig,
  input: {
    externalUserId: string
    requestId: string
  },
): Promise<SumsubIntakeArtifacts> => {
  const applicantPath = `/resources/applicants?levelName=${encodeURIComponent(config.levelName)}`
  const applicantPayload = await callSumsub(fetchFn, config, {
    method: 'POST',
    path: applicantPath,
    body: {
      externalUserId: input.externalUserId,
    },
    idempotencyKey: input.requestId,
  })

  const applicantId =
    typeof applicantPayload.id === 'string'
      ? applicantPayload.id
      : typeof applicantPayload.applicantId === 'string'
        ? applicantPayload.applicantId
        : undefined

  if (!applicantId) {
    throw new AppError('SUMSUB_API_ERROR', 'Sumsub applicant creation returned no applicant id', 502)
  }

  const sdkPayload = await callSumsub(fetchFn, config, {
    method: 'POST',
    path: '/resources/accessTokens/sdk',
    body: {
      userId: applicantId,
      levelName: config.levelName,
      ttlInSecs: config.sdkTtlSeconds,
    },
    idempotencyKey: input.requestId,
  })

  const sdkToken =
    typeof sdkPayload.token === 'string'
      ? sdkPayload.token
      : typeof sdkPayload.sdkToken === 'string'
        ? sdkPayload.sdkToken
        : undefined

  if (!sdkToken) {
    throw new AppError('SUMSUB_API_ERROR', 'Sumsub SDK token response missing token', 502)
  }

  return {
    applicantId,
    sdkToken,
  }
}
