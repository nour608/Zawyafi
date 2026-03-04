import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { AppError } from './errors'
import type { KycRequestRecord, KycStatus, OnchainOutcome, ReviewAnswer } from './types'

const toIso = (value: Date): string => value.toISOString()

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
  nextRetryAt: (row.next_retry_at as string | null) ?? null,
  processingLockUntil: (row.processing_lock_until as string | null) ?? null,
  lastErrorCode: (row.last_error_code as string | null) ?? null,
  lastErrorMessage: (row.last_error_message as string | null) ?? null,
  onchainTxHash: (row.onchain_tx_hash as string | null) ?? null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
})

const assertTransition = (from: KycStatus, to: KycStatus): void => {
  if (!TRANSITIONS[from].has(to)) {
    throw new AppError('INVALID_STATUS_TRANSITION', `Cannot transition from ${from} to ${to}`, 409, {
      from,
      to,
    })
  }
}

export class KycStore {
  constructor(private readonly db: DatabaseSync) {}

  listRequests(input: {
    status?: KycStatus
    wallet?: string
    offset: number
    limit: number
  }): { records: KycRequestRecord[]; nextCursor: string | null } {
    const whereClauses: string[] = []
    const values: Array<string | number> = []

    if (input.status) {
      whereClauses.push('status = ?')
      values.push(input.status)
    }

    if (input.wallet) {
      whereClauses.push('wallet = ?')
      values.push(input.wallet.toLowerCase())
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const pageSize = input.limit + 1
    const rows = this.db
      .prepare(
        `SELECT *
         FROM kyc_requests
         ${whereSql}
         ORDER BY updated_at DESC, created_at DESC, request_id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...values, pageSize, input.offset) as Array<Record<string, unknown>>

    const hasMore = rows.length > input.limit
    const records = rows.slice(0, input.limit).map(mapRow)

    return {
      records,
      nextCursor: hasMore ? String(input.offset + input.limit) : null,
    }
  }

  listLatestWalletStates(input: {
    status?: KycStatus
    offset: number
    limit: number
  }): { records: KycRequestRecord[]; nextCursor: string | null } {
    const whereClauses: string[] = ['rn = 1']
    const values: Array<string | number> = []

    if (input.status) {
      whereClauses.push('status = ?')
      values.push(input.status)
    }

    const pageSize = input.limit + 1
    const whereSql = whereClauses.join(' AND ')
    const rows = this.db
      .prepare(
        `SELECT *
         FROM (
           SELECT *,
             ROW_NUMBER() OVER (
               PARTITION BY wallet
               ORDER BY updated_at DESC, created_at DESC, request_id DESC
             ) as rn
           FROM kyc_requests
         ) ranked
         WHERE ${whereSql}
         ORDER BY updated_at DESC, created_at DESC, request_id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...values, pageSize, input.offset) as Array<Record<string, unknown>>

    const hasMore = rows.length > input.limit
    const records = rows.slice(0, input.limit).map(mapRow)

    return {
      records,
      nextCursor: hasMore ? String(input.offset + input.limit) : null,
    }
  }

  createRequest(input: { wallet: string; chainId: number; nonce: string }, now: Date): KycRequestRecord {
    const requestId = randomUUID()
    const timestamp = toIso(now)

    this.db
      .prepare(
        `INSERT INTO kyc_requests (
          request_id, wallet, chain_id, nonce, status, attempt_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'PENDING_CRE_BIND', 0, ?, ?)`
      )
      .run(requestId, input.wallet.toLowerCase(), input.chainId, input.nonce, timestamp, timestamp)

    const record = this.getByRequestId(requestId)
    if (!record) {
      throw new Error('Failed to load created request')
    }

    return record
  }

  getByRequestId(requestId: string): KycRequestRecord | null {
    const row = this.db.prepare('SELECT * FROM kyc_requests WHERE request_id = ?').get(requestId) as
      | Record<string, unknown>
      | undefined

    if (!row) {
      return null
    }

    return mapRow(row)
  }

  bindApplicant(
    input: {
      requestId: string
      commit: string
      applicantId: string
      sdkToken: string
      keyVersion: string
    },
    now: Date,
  ): KycRequestRecord {
    const existing = this.getByRequestId(input.requestId)
    if (!existing) {
      throw new AppError('REQUEST_NOT_FOUND', 'KYC request not found', 404)
    }

    assertTransition(existing.status, 'PENDING_USER_SUBMISSION')

    const timestamp = toIso(now)
    this.db
      .prepare(
        `UPDATE kyc_requests
         SET "commit" = ?, commit_key_version = ?, sumsub_applicant_id = ?, sumsub_sdk_token = ?,
             status = 'PENDING_USER_SUBMISSION', updated_at = ?, last_error_code = NULL, last_error_message = NULL
         WHERE request_id = ?`
      )
      .run(input.commit, input.keyVersion, input.applicantId, input.sdkToken, timestamp, input.requestId)

    return this.getByRequestId(input.requestId) as KycRequestRecord
  }

  recordIntakeFailure(
    input: {
      requestId: string
      outcome: 'RETRYABLE' | 'TERMINAL'
      errorCode: string
      errorMessage: string
    },
    now: Date,
  ): KycRequestRecord {
    const existing = this.getByRequestId(input.requestId)
    if (!existing) {
      throw new AppError('REQUEST_NOT_FOUND', 'KYC request not found', 404)
    }

    if (existing.status !== 'PENDING_CRE_BIND') {
      return existing
    }

    const targetStatus = input.outcome === 'TERMINAL' ? 'FAILED_TERMINAL' : 'FAILED_RETRYABLE'
    assertTransition(existing.status, targetStatus)

    this.db
      .prepare(
        `UPDATE kyc_requests
         SET status = ?, updated_at = ?, last_error_code = ?, last_error_message = ?
         WHERE request_id = ?`,
      )
      .run(targetStatus, toIso(now), input.errorCode, input.errorMessage, input.requestId)

    return this.getByRequestId(input.requestId) as KycRequestRecord
  }

  recordWebhookEvent(input: { eventId: string; applicantId: string; payloadHash: string }, now: Date): boolean {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO kyc_webhook_events (event_id, applicant_id, received_at, payload_hash) VALUES (?, ?, ?, ?)',
    )
    const result = stmt.run(input.eventId, input.applicantId, toIso(now), input.payloadHash)
    return Number(result.changes ?? 0) > 0
  }

  applySumsubReview(input: { applicantId: string; reviewAnswer: ReviewAnswer }, now: Date): KycRequestRecord | null {
    const row = this.db
      .prepare('SELECT * FROM kyc_requests WHERE sumsub_applicant_id = ? ORDER BY updated_at DESC LIMIT 1')
      .get(input.applicantId) as Record<string, unknown> | undefined

    if (!row) {
      return null
    }

    const current = mapRow(row)
    const targetStatus =
      input.reviewAnswer === 'GREEN'
        ? 'APPROVED_READY'
        : input.reviewAnswer === 'RED'
          ? 'REJECTED'
          : input.reviewAnswer === 'YELLOW'
            ? 'REVIEW_REQUIRED'
            : 'IN_REVIEW'

    // Ignore webhook review updates once the request has moved to immutable states.
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

    this.db
      .prepare(
        `UPDATE kyc_requests
         SET sumsub_review_answer = ?, status = ?, updated_at = ?, processing_lock_until = NULL,
             last_error_code = NULL, last_error_message = NULL
         WHERE request_id = ?`
      )
      .run(input.reviewAnswer, targetStatus, toIso(now), current.requestId)

    return this.getByRequestId(current.requestId)
  }

  transitionToReviewingByRequestId(requestId: string, now: Date): KycRequestRecord {
    const existing = this.getByRequestId(requestId)
    if (!existing) {
      throw new AppError('REQUEST_NOT_FOUND', 'KYC request not found', 404)
    }

    assertTransition(existing.status, 'IN_REVIEW')

    this.db
      .prepare('UPDATE kyc_requests SET status = ?, updated_at = ? WHERE request_id = ?')
      .run('IN_REVIEW', toIso(now), requestId)

    return this.getByRequestId(requestId) as KycRequestRecord
  }

  claimReadyOnchain(limit: number, lockSeconds: number, now: Date): KycRequestRecord[] {
    const nowIso = toIso(now)
    const lockUntilIso = toIso(new Date(now.getTime() + lockSeconds * 1_000))

    const candidates = this.db
      .prepare(
        `SELECT request_id
         FROM kyc_requests
         WHERE
           (status = 'APPROVED_READY' OR (status = 'FAILED_RETRYABLE' AND (next_retry_at IS NULL OR next_retry_at <= ?)))
           AND (processing_lock_until IS NULL OR processing_lock_until <= ?)
         ORDER BY updated_at ASC
         LIMIT ?`
      )
      .all(nowIso, nowIso, limit) as Array<{ request_id: string }>

    if (candidates.length === 0) {
      return []
    }

    const updateStmt = this.db.prepare(
      `UPDATE kyc_requests
       SET status = 'APPROVED_ONCHAIN_PENDING', processing_lock_until = ?, next_retry_at = NULL, updated_at = ?
       WHERE request_id = ?`,
    )

    this.db.exec('BEGIN')
    try {
      for (const row of candidates) {
        const record = this.getByRequestId(row.request_id)
        if (!record) {
          continue
        }
        if (record.status === 'APPROVED_READY') {
          assertTransition(record.status, 'APPROVED_ONCHAIN_PENDING')
        }
        if (record.status === 'FAILED_RETRYABLE') {
          assertTransition(record.status, 'APPROVED_ONCHAIN_PENDING')
        }
        updateStmt.run(lockUntilIso, nowIso, row.request_id)
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    const ids = candidates.map((row) => row.request_id)
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db.prepare(`SELECT * FROM kyc_requests WHERE request_id IN (${placeholders})`).all(...ids) as Array<
      Record<string, unknown>
    >

    return rows.map(mapRow)
  }

  recordOnchainResult(
    input: {
      requestId: string
      txHash?: string
      outcome: OnchainOutcome
      errorCode?: string
      errorMessage?: string
      retryBaseDelaySeconds: number
    },
    now: Date,
  ): KycRequestRecord {
    const record = this.getByRequestId(input.requestId)
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
      this.db
        .prepare(
          `UPDATE kyc_requests
           SET status = 'ONCHAIN_APPROVED', onchain_tx_hash = ?, processing_lock_until = NULL,
               updated_at = ?, last_error_code = NULL, last_error_message = NULL
           WHERE request_id = ?`,
        )
        .run(input.txHash ?? null, nowIso, input.requestId)
      return this.getByRequestId(input.requestId) as KycRequestRecord
    }

    const updatedAttempts = record.attemptCount + 1

    if (input.outcome === 'RETRYABLE') {
      assertTransition(record.status, 'FAILED_RETRYABLE')
      const delaySeconds = input.retryBaseDelaySeconds * Math.max(1, 2 ** Math.max(0, updatedAttempts - 1))
      const nextRetryAt = toIso(new Date(now.getTime() + delaySeconds * 1_000))

      this.db
        .prepare(
          `UPDATE kyc_requests
           SET status = 'FAILED_RETRYABLE', attempt_count = ?, next_retry_at = ?, processing_lock_until = NULL,
               updated_at = ?, last_error_code = ?, last_error_message = ?
           WHERE request_id = ?`,
        )
        .run(updatedAttempts, nextRetryAt, nowIso, input.errorCode ?? 'ONCHAIN_RETRYABLE', input.errorMessage ?? null, input.requestId)

      return this.getByRequestId(input.requestId) as KycRequestRecord
    }

    assertTransition(record.status, 'FAILED_TERMINAL')

    this.db
      .prepare(
        `UPDATE kyc_requests
         SET status = 'FAILED_TERMINAL', attempt_count = ?, processing_lock_until = NULL,
             updated_at = ?, last_error_code = ?, last_error_message = ?
         WHERE request_id = ?`,
      )
      .run(updatedAttempts, nowIso, input.errorCode ?? 'ONCHAIN_TERMINAL', input.errorMessage ?? null, input.requestId)

    return this.getByRequestId(input.requestId) as KycRequestRecord
  }
}
