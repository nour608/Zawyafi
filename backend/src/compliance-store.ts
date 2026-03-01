import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { AppError } from './errors'
import type {
  ComplianceProcessingOutcome,
  ComplianceReportPacket,
  ComplianceReportRequestRecord,
  ComplianceReportStatus,
} from './types'

const toIso = (value: Date): string => value.toISOString()

const mapRequestRow = (row: Record<string, unknown>): ComplianceReportRequestRecord => ({
  requestId: String(row.request_id),
  merchantIdHash: String(row.merchant_id_hash),
  startDate: String(row.start_date),
  endDate: String(row.end_date),
  status: row.status as ComplianceReportStatus,
  attemptCount: Number(row.attempt_count),
  nextRetryAt: (row.next_retry_at as string | null) ?? null,
  processingLockUntil: (row.processing_lock_until as string | null) ?? null,
  lastErrorCode: (row.last_error_code as string | null) ?? null,
  lastErrorMessage: (row.last_error_message as string | null) ?? null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
})

export class ComplianceStore {
  constructor(private readonly db: DatabaseSync) {}

  createRequest(input: { merchantIdHash: string; startDate: string; endDate: string }, now: Date): ComplianceReportRequestRecord {
    const requestId = randomUUID()
    const timestamp = toIso(now)

    this.db
      .prepare(
        `INSERT INTO compliance_report_requests (
          request_id, merchant_id_hash, start_date, end_date, status, attempt_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'QUEUED', 0, ?, ?)`
      )
      .run(requestId, input.merchantIdHash.toLowerCase(), input.startDate, input.endDate, timestamp, timestamp)

    const record = this.getRequestById(requestId)
    if (!record) {
      throw new Error('Failed to load created compliance request')
    }

    return record
  }

  getRequestById(requestId: string): ComplianceReportRequestRecord | null {
    const row = this.db.prepare('SELECT * FROM compliance_report_requests WHERE request_id = ?').get(requestId) as
      | Record<string, unknown>
      | undefined

    if (!row) {
      return null
    }

    return mapRequestRow(row)
  }

  getPacketByRequestId(requestId: string): ComplianceReportPacket | null {
    const row = this.db.prepare('SELECT payload_json FROM compliance_report_packets WHERE request_id = ?').get(requestId) as
      | { payload_json: string }
      | undefined

    if (!row) {
      return null
    }

    try {
      return JSON.parse(row.payload_json) as ComplianceReportPacket
    } catch {
      throw new AppError('INTERNAL_ERROR', 'Stored compliance report packet is invalid JSON', 500, { requestId })
    }
  }

  claimReady(limit: number, lockSeconds: number, now: Date): ComplianceReportRequestRecord[] {
    const nowIso = toIso(now)
    const lockUntilIso = toIso(new Date(now.getTime() + lockSeconds * 1000))

    const candidates = this.db
      .prepare(
        `SELECT request_id
         FROM compliance_report_requests
         WHERE
           status = 'QUEUED'
           AND (next_retry_at IS NULL OR next_retry_at <= ?)
           AND (processing_lock_until IS NULL OR processing_lock_until <= ?)
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .all(nowIso, nowIso, limit) as Array<{ request_id: string }>

    if (candidates.length === 0) {
      return []
    }

    const updateStmt = this.db.prepare(
      `UPDATE compliance_report_requests
       SET status = 'PROCESSING', processing_lock_until = ?, updated_at = ?
       WHERE request_id = ?`
    )

    this.db.exec('BEGIN')
    try {
      for (const candidate of candidates) {
        updateStmt.run(lockUntilIso, nowIso, candidate.request_id)
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    const ids = candidates.map((candidate) => candidate.request_id)
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db.prepare(`SELECT * FROM compliance_report_requests WHERE request_id IN (${placeholders})`).all(...ids) as Array<
      Record<string, unknown>
    >

    return rows.map(mapRequestRow)
  }

  recordResult(
    input: {
      requestId: string
      outcome: ComplianceProcessingOutcome
      report?: ComplianceReportPacket
      errorCode?: string
      errorMessage?: string
      retryBaseDelaySeconds: number
      maxAttempts: number
    },
    now: Date,
  ): ComplianceReportRequestRecord {
    const record = this.getRequestById(input.requestId)
    if (!record) {
      throw new AppError('REQUEST_NOT_FOUND', 'Compliance report request not found', 404)
    }

    if (record.status !== 'PROCESSING') {
      throw new AppError('INVALID_STATUS_TRANSITION', 'Compliance request is not awaiting workflow result', 409, {
        requestId: input.requestId,
        status: record.status,
      })
    }

    const nowIso = toIso(now)

    if (input.outcome === 'SUCCESS') {
      if (!input.report) {
        throw new AppError('INVALID_INPUT', 'Missing report payload for SUCCESS outcome', 400)
      }

      this.db.exec('BEGIN')
      try {
        this.db
          .prepare(
            `UPDATE compliance_report_requests
             SET status = 'SUCCEEDED', processing_lock_until = NULL, next_retry_at = NULL, updated_at = ?,
                 last_error_code = NULL, last_error_message = NULL
             WHERE request_id = ?`
          )
          .run(nowIso, input.requestId)

        this.db
          .prepare(
            `INSERT INTO compliance_report_packets (
              request_id, report_hash, period_merkle_root, payload_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(request_id) DO UPDATE SET
              report_hash = excluded.report_hash,
              period_merkle_root = excluded.period_merkle_root,
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at`
          )
          .run(
            input.requestId,
            input.report.reportHash,
            input.report.periodMerkleRoot,
            JSON.stringify(input.report),
            nowIso,
            nowIso,
          )

        this.db.exec('COMMIT')
      } catch (error) {
        this.db.exec('ROLLBACK')
        throw error
      }

      return this.getRequestById(input.requestId) as ComplianceReportRequestRecord
    }

    const updatedAttempts = record.attemptCount + 1
    if (input.outcome === 'RETRYABLE' && updatedAttempts < input.maxAttempts) {
      const delaySeconds = input.retryBaseDelaySeconds * Math.max(1, 2 ** Math.max(0, updatedAttempts - 1))
      const nextRetryAt = toIso(new Date(now.getTime() + delaySeconds * 1000))

      this.db
        .prepare(
          `UPDATE compliance_report_requests
           SET status = 'QUEUED', attempt_count = ?, next_retry_at = ?, processing_lock_until = NULL, updated_at = ?,
               last_error_code = ?, last_error_message = ?
           WHERE request_id = ?`
        )
        .run(updatedAttempts, nextRetryAt, nowIso, input.errorCode ?? 'WORKFLOW_RETRYABLE', input.errorMessage ?? null, input.requestId)

      return this.getRequestById(input.requestId) as ComplianceReportRequestRecord
    }

    this.db
      .prepare(
        `UPDATE compliance_report_requests
         SET status = 'FAILED', attempt_count = ?, next_retry_at = NULL, processing_lock_until = NULL, updated_at = ?,
             last_error_code = ?, last_error_message = ?
         WHERE request_id = ?`
      )
      .run(
        updatedAttempts,
        nowIso,
        input.errorCode ?? (input.outcome === 'TERMINAL' ? 'WORKFLOW_TERMINAL' : 'WORKFLOW_MAX_ATTEMPTS'),
        input.errorMessage ?? null,
        input.requestId,
      )

    return this.getRequestById(input.requestId) as ComplianceReportRequestRecord
  }
}
