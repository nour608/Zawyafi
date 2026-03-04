import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { AppError } from './errors'
import type {
  ComplianceProcessingOutcome,
  ComplianceReportPacket,
  ComplianceReportRequestRecord,
  ComplianceReportStatus,
} from './types'

const toIso = (value: Date): string => value.toISOString()
const asIsoString = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value))

const mapRequestRow = (row: Record<string, unknown>): ComplianceReportRequestRecord => ({
  requestId: String(row.request_id),
  merchantIdHash: String(row.merchant_id_hash),
  startDate: String(row.start_date),
  endDate: String(row.end_date),
  status: row.status as ComplianceReportStatus,
  attemptCount: Number(row.attempt_count),
  nextRetryAt: row.next_retry_at ? asIsoString(row.next_retry_at) : null,
  processingLockUntil: row.processing_lock_until ? asIsoString(row.processing_lock_until) : null,
  lastErrorCode: (row.last_error_code as string | null) ?? null,
  lastErrorMessage: (row.last_error_message as string | null) ?? null,
  createdAt: asIsoString(row.created_at),
  updatedAt: asIsoString(row.updated_at),
})

export class PgComplianceStore {
  constructor(private readonly pool: Pool) {}

  async listRequests(input: {
    status?: ComplianceReportStatus
    merchantIdHash?: string
    offset: number
    limit: number
  }): Promise<{ records: ComplianceReportRequestRecord[]; nextCursor: string | null }> {
    const whereClauses: string[] = []
    const values: Array<string | number> = []

    if (input.status) {
      values.push(input.status)
      whereClauses.push(`status = $${values.length}`)
    }

    if (input.merchantIdHash) {
      values.push(input.merchantIdHash.toLowerCase())
      whereClauses.push(`merchant_id_hash = $${values.length}`)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const pageSize = input.limit + 1
    values.push(pageSize, input.offset)
    const limitPlaceholder = `$${values.length - 1}`
    const offsetPlaceholder = `$${values.length}`

    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT *
       FROM compliance_report_requests
       ${whereSql}
       ORDER BY updated_at DESC, created_at DESC, request_id DESC
       LIMIT ${limitPlaceholder}
       OFFSET ${offsetPlaceholder}`,
      values,
    )

    const hasMore = result.rows.length > input.limit
    const records = result.rows.slice(0, input.limit).map((row: Record<string, unknown>) => mapRequestRow(row))

    return {
      records,
      nextCursor: hasMore ? String(input.offset + input.limit) : null,
    }
  }

  async createRequest(input: { merchantIdHash: string; startDate: string; endDate: string }, now: Date): Promise<ComplianceReportRequestRecord> {
    const requestId = randomUUID()
    const timestamp = toIso(now)

    await this.pool.query(
      `INSERT INTO compliance_report_requests (
        request_id, merchant_id_hash, start_date, end_date, status, attempt_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'QUEUED', 0, $5, $6)`,
      [requestId, input.merchantIdHash.toLowerCase(), input.startDate, input.endDate, timestamp, timestamp],
    )

    const record = await this.getRequestById(requestId)
    if (!record) {
      throw new Error('Failed to load created compliance request')
    }

    return record
  }

  async getRequestById(requestId: string): Promise<ComplianceReportRequestRecord | null> {
    const result = await this.pool.query('SELECT * FROM compliance_report_requests WHERE request_id = $1', [requestId])
    if (result.rows.length === 0) {
      return null
    }
    return mapRequestRow(result.rows[0] as Record<string, unknown>)
  }

  async getPacketByRequestId(requestId: string): Promise<ComplianceReportPacket | null> {
    const result = await this.pool.query('SELECT payload_json FROM compliance_report_packets WHERE request_id = $1', [requestId])
    if (result.rows.length === 0) {
      return null
    }

    const payload = result.rows[0]?.payload_json
    try {
      if (typeof payload === 'string') {
        return JSON.parse(payload) as ComplianceReportPacket
      }
      return payload as ComplianceReportPacket
    } catch {
      throw new AppError('INTERNAL_ERROR', 'Stored compliance report packet is invalid JSON', 500, { requestId })
    }
  }

  async claimReady(limit: number, lockSeconds: number, now: Date): Promise<ComplianceReportRequestRecord[]> {
    const nowIso = toIso(now)
    const lockUntilIso = toIso(new Date(now.getTime() + lockSeconds * 1000))

    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      const candidates = await client.query<{ request_id: string }>(
        `SELECT request_id
         FROM compliance_report_requests
         WHERE
           status = 'QUEUED'
           AND (next_retry_at IS NULL OR next_retry_at <= $1)
           AND (processing_lock_until IS NULL OR processing_lock_until <= $1)
         ORDER BY created_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
        [nowIso, limit],
      )

      if (candidates.rows.length === 0) {
        await client.query('COMMIT')
        return []
      }

      const ids = candidates.rows.map((candidate: { request_id: string }) => String(candidate.request_id))
      const updated = await client.query<Record<string, unknown>>(
        `UPDATE compliance_report_requests
         SET status = 'PROCESSING', processing_lock_until = $1, updated_at = $2
         WHERE request_id = ANY($3::text[])
         RETURNING *`,
        [lockUntilIso, nowIso, ids],
      )

      await client.query('COMMIT')
      return updated.rows.map((row: Record<string, unknown>) => mapRequestRow(row))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async recordResult(
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
  ): Promise<ComplianceReportRequestRecord> {
    const record = await this.getRequestById(input.requestId)
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

      const client = await this.pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          `UPDATE compliance_report_requests
           SET status = 'SUCCEEDED', processing_lock_until = NULL, next_retry_at = NULL, updated_at = $1,
               last_error_code = NULL, last_error_message = NULL
           WHERE request_id = $2`,
          [nowIso, input.requestId],
        )

        await client.query(
          `INSERT INTO compliance_report_packets (
            request_id, report_hash, period_merkle_root, payload_json, created_at, updated_at
          ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
          ON CONFLICT(request_id) DO UPDATE SET
            report_hash = excluded.report_hash,
            period_merkle_root = excluded.period_merkle_root,
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at`,
          [input.requestId, input.report.reportHash, input.report.periodMerkleRoot, JSON.stringify(input.report), nowIso, nowIso],
        )

        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }

      return (await this.getRequestById(input.requestId)) as ComplianceReportRequestRecord
    }

    const updatedAttempts = record.attemptCount + 1
    if (input.outcome === 'RETRYABLE' && updatedAttempts < input.maxAttempts) {
      const delaySeconds = input.retryBaseDelaySeconds * Math.max(1, 2 ** Math.max(0, updatedAttempts - 1))
      const nextRetryAt = toIso(new Date(now.getTime() + delaySeconds * 1000))

      await this.pool.query(
        `UPDATE compliance_report_requests
         SET status = 'QUEUED', attempt_count = $1, next_retry_at = $2, processing_lock_until = NULL, updated_at = $3,
             last_error_code = $4, last_error_message = $5
         WHERE request_id = $6`,
        [updatedAttempts, nextRetryAt, nowIso, input.errorCode ?? 'WORKFLOW_RETRYABLE', input.errorMessage ?? null, input.requestId],
      )

      return (await this.getRequestById(input.requestId)) as ComplianceReportRequestRecord
    }

    await this.pool.query(
      `UPDATE compliance_report_requests
       SET status = 'FAILED', attempt_count = $1, next_retry_at = NULL, processing_lock_until = NULL, updated_at = $2,
           last_error_code = $3, last_error_message = $4
       WHERE request_id = $5`,
      [
        updatedAttempts,
        nowIso,
        input.errorCode ?? (input.outcome === 'TERMINAL' ? 'WORKFLOW_TERMINAL' : 'WORKFLOW_MAX_ATTEMPTS'),
        input.errorMessage ?? null,
        input.requestId,
      ],
    )

    return (await this.getRequestById(input.requestId)) as ComplianceReportRequestRecord
  }
}
