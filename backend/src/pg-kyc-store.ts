import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { AppError } from './errors'
import type { KycRequestRecord, KycStatus, OnchainOutcome, ReviewAnswer } from './types'

const toIso = (value: Date): string => value.toISOString()
const asIsoString = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value))

const TRANSITIONS: Record<KycStatus, ReadonlySet<KycStatus>> = {
  PENDING_CRE_BIND: new Set(['PENDING_USER_SUBMISSION', 'FAILED_RETRYABLE', 'FAILED_TERMINAL']),
  PENDING_USER_SUBMISSION: new Set(['IN_REVIEW', 'APPROVED_READY', 'REJECTED', 'REVIEW_REQUIRED']),
  IN_REVIEW: new Set(['APPROVED_READY', 'REJECTED', 'REVIEW_REQUIRED']),
  APPROVED_READY: new Set(['APPROVED_ONCHAIN_PENDING']),
  APPROVED_ONCHAIN_PENDING: new Set(['ONCHAIN_APPROVED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL']),
  ONCHAIN_APPROVED: new Set([]),
  REJECTED: new Set([]),
  REVIEW_REQUIRED: new Set(['IN_REVIEW', 'APPROVED_READY', 'REJECTED']),
  FAILED_RETRYABLE: new Set(['APPROVED_ONCHAIN_PENDING', 'FAILED_TERMINAL']),
  FAILED_TERMINAL: new Set([]),
}

const assertTransition = (from: KycStatus, to: KycStatus): void => {
  if (!TRANSITIONS[from].has(to)) {
    throw new AppError('INVALID_STATUS_TRANSITION', `Cannot transition from ${from} to ${to}`, 409, {
      from,
      to,
    })
  }
}

const mapRow = (row: Record<string, unknown>): KycRequestRecord => ({
  requestId: String(row.request_id),
  wallet: String(row.wallet),
  chainId: Number(row.chain_id),
  nonce: String(row.nonce),
  commit: (row.commit as string | null) ?? null,
  commitKeyVersion: (row.commit_key_version as string | null) ?? null,
  sumsubApplicantId: (row.sumsub_applicant_id as string | null) ?? null,
  sumsubSdkToken: (row.sumsub_sdk_token as string | null) ?? null,
  sumsubReviewAnswer: (row.sumsub_review_answer as ReviewAnswer | null) ?? null,
  status: row.status as KycStatus,
  attemptCount: Number(row.attempt_count),
  nextRetryAt: row.next_retry_at ? asIsoString(row.next_retry_at) : null,
  processingLockUntil: row.processing_lock_until ? asIsoString(row.processing_lock_until) : null,
  lastErrorCode: (row.last_error_code as string | null) ?? null,
  lastErrorMessage: (row.last_error_message as string | null) ?? null,
  onchainTxHash: (row.onchain_tx_hash as string | null) ?? null,
  createdAt: asIsoString(row.created_at),
  updatedAt: asIsoString(row.updated_at),
})

export class PgKycStore {
  constructor(private readonly pool: Pool) {}

  async createRequest(input: { wallet: string; chainId: number; nonce: string }, now: Date): Promise<KycRequestRecord> {
    const requestId = randomUUID()
    const timestamp = toIso(now)

    await this.pool.query(
      `INSERT INTO kyc_requests (
        request_id, wallet, chain_id, nonce, status, attempt_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'PENDING_CRE_BIND', 0, $5, $6)`,
      [requestId, input.wallet.toLowerCase(), input.chainId, input.nonce, timestamp, timestamp],
    )

    const record = await this.getByRequestId(requestId)
    if (!record) {
      throw new Error('Failed to load created request')
    }

    return record
  }

  async getByRequestId(requestId: string): Promise<KycRequestRecord | null> {
    const result = await this.pool.query('SELECT * FROM kyc_requests WHERE request_id = $1', [requestId])
    if (result.rows.length === 0) {
      return null
    }

    return mapRow(result.rows[0] as Record<string, unknown>)
  }

  async bindApplicant(
    input: {
      requestId: string
      commit: string
      applicantId: string
      sdkToken: string
      keyVersion: string
    },
    now: Date,
  ): Promise<KycRequestRecord> {
    const existing = await this.getByRequestId(input.requestId)
    if (!existing) {
      throw new AppError('REQUEST_NOT_FOUND', 'KYC request not found', 404)
    }

    assertTransition(existing.status, 'PENDING_USER_SUBMISSION')

    await this.pool.query(
      `UPDATE kyc_requests
       SET "commit" = $1, commit_key_version = $2, sumsub_applicant_id = $3, sumsub_sdk_token = $4,
           status = 'PENDING_USER_SUBMISSION', updated_at = $5, last_error_code = NULL, last_error_message = NULL
       WHERE request_id = $6`,
      [input.commit, input.keyVersion, input.applicantId, input.sdkToken, toIso(now), input.requestId],
    )

    return (await this.getByRequestId(input.requestId)) as KycRequestRecord
  }

  async recordIntakeFailure(
    input: {
      requestId: string
      outcome: 'RETRYABLE' | 'TERMINAL'
      errorCode: string
      errorMessage: string
    },
    now: Date,
  ): Promise<KycRequestRecord> {
    const existing = await this.getByRequestId(input.requestId)
    if (!existing) {
      throw new AppError('REQUEST_NOT_FOUND', 'KYC request not found', 404)
    }

    if (existing.status !== 'PENDING_CRE_BIND') {
      return existing
    }

    const targetStatus = input.outcome === 'TERMINAL' ? 'FAILED_TERMINAL' : 'FAILED_RETRYABLE'
    assertTransition(existing.status, targetStatus)

    await this.pool.query(
      `UPDATE kyc_requests
       SET status = $1, updated_at = $2, last_error_code = $3, last_error_message = $4
       WHERE request_id = $5`,
      [targetStatus, toIso(now), input.errorCode, input.errorMessage, input.requestId],
    )

    return (await this.getByRequestId(input.requestId)) as KycRequestRecord
  }

  async recordWebhookEvent(input: { eventId: string; applicantId: string; payloadHash: string }, now: Date): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO kyc_webhook_events (event_id, applicant_id, received_at, payload_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [input.eventId, input.applicantId, toIso(now), input.payloadHash],
    )

    return result.rowCount > 0
  }

  async applySumsubReview(input: { applicantId: string; reviewAnswer: ReviewAnswer }, now: Date): Promise<KycRequestRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM kyc_requests
       WHERE sumsub_applicant_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [input.applicantId],
    )

    if (result.rows.length === 0) {
      return null
    }

    const current = mapRow(result.rows[0] as Record<string, unknown>)
    const targetStatus =
      input.reviewAnswer === 'GREEN'
        ? 'APPROVED_READY'
        : input.reviewAnswer === 'RED'
          ? 'REJECTED'
          : input.reviewAnswer === 'YELLOW'
            ? 'REVIEW_REQUIRED'
            : 'IN_REVIEW'

    if (
      current.status !== 'PENDING_USER_SUBMISSION' &&
      current.status !== 'IN_REVIEW' &&
      current.status !== 'REVIEW_REQUIRED'
    ) {
      return current
    }

    if (current.status !== targetStatus) {
      assertTransition(current.status, targetStatus)
    }

    await this.pool.query(
      `UPDATE kyc_requests
       SET sumsub_review_answer = $1, status = $2, updated_at = $3, processing_lock_until = NULL,
           last_error_code = NULL, last_error_message = NULL
       WHERE request_id = $4`,
      [input.reviewAnswer, targetStatus, toIso(now), current.requestId],
    )

    return this.getByRequestId(current.requestId)
  }

  async transitionToReviewingByRequestId(requestId: string, now: Date): Promise<KycRequestRecord> {
    const existing = await this.getByRequestId(requestId)
    if (!existing) {
      throw new AppError('REQUEST_NOT_FOUND', 'KYC request not found', 404)
    }

    assertTransition(existing.status, 'IN_REVIEW')

    await this.pool.query('UPDATE kyc_requests SET status = $1, updated_at = $2 WHERE request_id = $3', ['IN_REVIEW', toIso(now), requestId])

    return (await this.getByRequestId(requestId)) as KycRequestRecord
  }

  async claimReadyOnchain(limit: number, lockSeconds: number, now: Date): Promise<KycRequestRecord[]> {
    const nowIso = toIso(now)
    const lockUntilIso = toIso(new Date(now.getTime() + lockSeconds * 1_000))

    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const candidates = await client.query<{ request_id: string; status: KycStatus }>(
        `SELECT request_id, status
         FROM kyc_requests
         WHERE
           (status = 'APPROVED_READY' OR (status = 'FAILED_RETRYABLE' AND (next_retry_at IS NULL OR next_retry_at <= $1)))
           AND (processing_lock_until IS NULL OR processing_lock_until <= $1)
         ORDER BY updated_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
        [nowIso, limit],
      )

      if (candidates.rows.length === 0) {
        await client.query('COMMIT')
        return []
      }

      const requestIds = candidates.rows.map((row: { request_id: string }) => String(row.request_id))
      for (const row of candidates.rows) {
        const status = row.status as KycStatus
        if (status === 'APPROVED_READY' || status === 'FAILED_RETRYABLE') {
          assertTransition(status, 'APPROVED_ONCHAIN_PENDING')
        }
      }

      const updated = await client.query<Record<string, unknown>>(
        `UPDATE kyc_requests
         SET status = 'APPROVED_ONCHAIN_PENDING', processing_lock_until = $1, next_retry_at = NULL, updated_at = $2
         WHERE request_id = ANY($3::text[])
         RETURNING *`,
        [lockUntilIso, nowIso, requestIds],
      )

      await client.query('COMMIT')
      return updated.rows.map((row: Record<string, unknown>) => mapRow(row))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async recordOnchainResult(
    input: {
      requestId: string
      txHash?: string
      outcome: OnchainOutcome
      errorCode?: string
      errorMessage?: string
      retryBaseDelaySeconds: number
    },
    now: Date,
  ): Promise<KycRequestRecord> {
    const record = await this.getByRequestId(input.requestId)
    if (!record) {
      throw new AppError('REQUEST_NOT_FOUND', 'KYC request not found', 404)
    }

    if (record.status !== 'APPROVED_ONCHAIN_PENDING') {
      throw new AppError('INVALID_STATUS_TRANSITION', 'Request is not awaiting onchain result', 409, {
        requestId: input.requestId,
        status: record.status,
      })
    }

    const nowIso = toIso(now)

    if (input.outcome === 'SUCCESS') {
      assertTransition(record.status, 'ONCHAIN_APPROVED')
      await this.pool.query(
        `UPDATE kyc_requests
         SET status = 'ONCHAIN_APPROVED', onchain_tx_hash = $1, processing_lock_until = NULL,
             updated_at = $2, last_error_code = NULL, last_error_message = NULL
         WHERE request_id = $3`,
        [input.txHash ?? null, nowIso, input.requestId],
      )

      return (await this.getByRequestId(input.requestId)) as KycRequestRecord
    }

    const updatedAttempts = record.attemptCount + 1

    if (input.outcome === 'RETRYABLE') {
      assertTransition(record.status, 'FAILED_RETRYABLE')
      const delaySeconds = input.retryBaseDelaySeconds * Math.max(1, 2 ** Math.max(0, updatedAttempts - 1))
      const nextRetryAt = toIso(new Date(now.getTime() + delaySeconds * 1_000))

      await this.pool.query(
        `UPDATE kyc_requests
         SET status = 'FAILED_RETRYABLE', attempt_count = $1, next_retry_at = $2, processing_lock_until = NULL,
             updated_at = $3, last_error_code = $4, last_error_message = $5
         WHERE request_id = $6`,
        [updatedAttempts, nextRetryAt, nowIso, input.errorCode ?? 'ONCHAIN_RETRYABLE', input.errorMessage ?? null, input.requestId],
      )

      return (await this.getByRequestId(input.requestId)) as KycRequestRecord
    }

    assertTransition(record.status, 'FAILED_TERMINAL')

    await this.pool.query(
      `UPDATE kyc_requests
       SET status = 'FAILED_TERMINAL', attempt_count = $1, processing_lock_until = NULL,
           updated_at = $2, last_error_code = $3, last_error_message = $4
       WHERE request_id = $5`,
      [updatedAttempts, nowIso, input.errorCode ?? 'ONCHAIN_TERMINAL', input.errorMessage ?? null, input.requestId],
    )

    return (await this.getByRequestId(input.requestId)) as KycRequestRecord
  }
}
