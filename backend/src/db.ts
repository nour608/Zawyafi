import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Pool } from 'pg'

const toDbPath = (inputPath: string): string => {
  if (inputPath === ':memory:') {
    return inputPath
  }
  return path.resolve(process.cwd(), inputPath)
}

export const openDatabase = (inputPath: string): DatabaseSync => {
  const dbPath = toDbPath(inputPath)

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  }

  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')

  db.exec(`
    CREATE TABLE IF NOT EXISTS kyc_requests (
      request_id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      nonce TEXT NOT NULL,
      "commit" TEXT,
      commit_key_version TEXT,
      sumsub_applicant_id TEXT,
      sumsub_sdk_token TEXT,
      sumsub_review_answer TEXT,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      processing_lock_until TEXT,
      last_error_code TEXT,
      last_error_message TEXT,
      onchain_tx_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_kyc_requests_status_retry_lock
      ON kyc_requests(status, next_retry_at, processing_lock_until);

    CREATE INDEX IF NOT EXISTS idx_kyc_requests_applicant_id
      ON kyc_requests(sumsub_applicant_id);

    CREATE INDEX IF NOT EXISTS idx_kyc_requests_wallet_updated
      ON kyc_requests(wallet, updated_at DESC);

    CREATE TABLE IF NOT EXISTS kyc_webhook_events (
      event_id TEXT PRIMARY KEY,
      applicant_id TEXT NOT NULL,
      received_at TEXT NOT NULL,
      payload_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS compliance_report_requests (
      request_id TEXT PRIMARY KEY,
      merchant_id_hash TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      processing_lock_until TEXT,
      last_error_code TEXT,
      last_error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_compliance_requests_status_retry_lock
      ON compliance_report_requests(status, next_retry_at, processing_lock_until);

    CREATE INDEX IF NOT EXISTS idx_compliance_requests_merchant_created
      ON compliance_report_requests(merchant_id_hash, created_at DESC);

    CREATE TABLE IF NOT EXISTS compliance_report_packets (
      request_id TEXT PRIMARY KEY,
      report_hash TEXT NOT NULL,
      period_merkle_root TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES compliance_report_requests(request_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS listing_metadata (
      batch_id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  return db
}

export const openPostgresPool = (databaseUrl: string, useSsl: boolean): Pool => {
  const ssl = useSsl
    ? {
      rejectUnauthorized: false,
    }
    : undefined

  return new Pool({
    connectionString: databaseUrl,
    ssl,
    max: 10,
  })
}

export const ensurePostgresSchema = async (pool: Pool): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kyc_requests (
      request_id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      nonce TEXT NOT NULL,
      "commit" TEXT,
      commit_key_version TEXT,
      sumsub_applicant_id TEXT,
      sumsub_sdk_token TEXT,
      sumsub_review_answer TEXT,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TIMESTAMPTZ,
      processing_lock_until TIMESTAMPTZ,
      last_error_code TEXT,
      last_error_message TEXT,
      onchain_tx_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_kyc_requests_status_retry_lock
      ON kyc_requests(status, next_retry_at, processing_lock_until);

    CREATE INDEX IF NOT EXISTS idx_kyc_requests_applicant_id
      ON kyc_requests(sumsub_applicant_id);

    CREATE INDEX IF NOT EXISTS idx_kyc_requests_wallet_updated
      ON kyc_requests(wallet, updated_at DESC);

    CREATE TABLE IF NOT EXISTS kyc_webhook_events (
      event_id TEXT PRIMARY KEY,
      applicant_id TEXT NOT NULL,
      received_at TIMESTAMPTZ NOT NULL,
      payload_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS compliance_report_requests (
      request_id TEXT PRIMARY KEY,
      merchant_id_hash TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TIMESTAMPTZ,
      processing_lock_until TIMESTAMPTZ,
      last_error_code TEXT,
      last_error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_compliance_requests_status_retry_lock
      ON compliance_report_requests(status, next_retry_at, processing_lock_until);

    CREATE INDEX IF NOT EXISTS idx_compliance_requests_merchant_created
      ON compliance_report_requests(merchant_id_hash, created_at DESC);

    CREATE TABLE IF NOT EXISTS compliance_report_packets (
      request_id TEXT PRIMARY KEY,
      report_hash TEXT NOT NULL,
      period_merkle_root TEXT NOT NULL,
      payload_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      FOREIGN KEY (request_id) REFERENCES compliance_report_requests(request_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS listing_metadata (
      batch_id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `)
}
