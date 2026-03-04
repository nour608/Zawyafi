import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

export interface AppConfig {
  port: number
  host: string
  logLevel: string
  nodeEnv: string
  databaseUrl?: string
  databaseSsl: boolean
  kycDbPath: string
  internalApiToken: string
  kycHmacKey?: string
  kycCommitKeyVersion: string
  sumsubWebhookSecret?: string
  sumsubAppToken?: string
  sumsubSecretKey?: string
  sumsubBaseUrl: string
  sumsubLevelName: string
  sumsubSdkTtlSeconds: number
  kycOnchainLockSeconds: number
  kycRetryBaseDelaySeconds: number
  complianceLockSeconds: number
  complianceRetryBaseDelaySeconds: number
  complianceMaxAttempts: number
  complianceReadyLimitDefault: number
  rateLimitWindowSeconds: number
  rateLimitKycStartMax: number
  rateLimitComplianceCreateMax: number
  corsAllowedOrigins: string[]
  squareProxyBaseUrl: string
  squareProxyTimeoutMs: number
  adminAllowlist: string[]
  merchantAllowlist: string[]
  complianceAllowlist: string[]
}

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.preprocess((v: unknown) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v), z.string().url().optional()),
  DATABASE_SSL: z.preprocess(
    (value: unknown) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z
      .enum(['true', 'false'])
      .optional()
      .default('false')
      .transform((flag: 'true' | 'false') => flag === 'true'),
  ),
  KYC_DB_PATH: z.string().default('./data/kyc.db'),
  INTERNAL_API_TOKEN: z.string().min(1, 'INTERNAL_API_TOKEN is required'),
  KYC_HMAC_KEY: z.preprocess((v: unknown) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v), z.string().optional()),
  KYC_COMMIT_KEY_VERSION: z.string().default('v1'),
  SUMSUB_WEBHOOK_SECRET: z.preprocess((v: unknown) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v), z.string().optional()),
  SUMSUB_APP_TOKEN: z.preprocess((v: unknown) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v), z.string().optional()),
  SUMSUB_SECRET_KEY: z.preprocess((v: unknown) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v), z.string().optional()),
  SUMSUB_BASE_URL: z.string().url().default('https://api.sumsub.com'),
  SUMSUB_LEVEL_NAME: z.string().default('basic-kyc-level'),
  SUMSUB_SDK_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  KYC_ONCHAIN_LOCK_SECONDS: z.coerce.number().int().positive().default(120),
  KYC_RETRY_BASE_DELAY_SECONDS: z.coerce.number().int().positive().default(30),
  COMPLIANCE_LOCK_SECONDS: z.coerce.number().int().positive().default(120),
  COMPLIANCE_RETRY_BASE_DELAY_SECONDS: z.coerce.number().int().positive().default(30),
  COMPLIANCE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  COMPLIANCE_READY_LIMIT_DEFAULT: z.coerce.number().int().positive().max(200).default(25),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_KYC_START_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_COMPLIANCE_CREATE_MAX: z.coerce.number().int().positive().default(20),
  CORS_ALLOWED_ORIGINS: z.string().default('http://127.0.0.1:3000,http://localhost:3000'),
  SQUARE_PROXY_BASE_URL: z.string().url().default('http://127.0.0.1:3001'),
  SQUARE_PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  ADMIN_ALLOWLIST: z.string().default(''),
  MERCHANT_ALLOWLIST: z.string().default(''),
  COMPLIANCE_ALLOWLIST: z.string().default(''),
})

let didLoadDotEnv = false

const loadDotEnvFile = (envPath: string): void => {
  if (!fs.existsSync(envPath)) {
    return
  }

  const content = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const equalIndex = line.indexOf('=')
    if (equalIndex <= 0) {
      continue
    }

    const key = line.slice(0, equalIndex).trim()
    let value = line.slice(equalIndex + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

const loadDotEnvFromCwd = (): void => {
  if (didLoadDotEnv) {
    return
  }
  didLoadDotEnv = true

  const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'backend/.env')]
  const uniqueCandidates = Array.from(new Set(candidates))

  for (const candidate of uniqueCandidates) {
    loadDotEnvFile(candidate)
  }
}

export const loadConfig = (): AppConfig => {
  loadDotEnvFromCwd()

  const parsed = configSchema.safeParse(process.env)
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${errors}`)
  }

  const env = parsed.data
  const nodeEnv = env.NODE_ENV.trim().toLowerCase()

  if (nodeEnv === 'production' && !env.SUMSUB_WEBHOOK_SECRET) {
    throw new Error('Invalid environment configuration: SUMSUB_WEBHOOK_SECRET is required in production')
  }

  const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin: string) => origin.trim().replace(/\/$/, '').toLowerCase())
    .filter(Boolean)
  const parseAllowlist = (raw: string): string[] =>
    raw
      .split(',')
      .map((entry: string) => entry.trim().toLowerCase())
      .filter(Boolean)

  return {
    port: env.PORT,
    host: env.HOST,
    logLevel: env.LOG_LEVEL,
    nodeEnv,
    databaseUrl: env.DATABASE_URL,
    databaseSsl: Boolean(env.DATABASE_SSL),
    kycDbPath: env.KYC_DB_PATH,
    internalApiToken: env.INTERNAL_API_TOKEN,
    kycHmacKey: env.KYC_HMAC_KEY,
    kycCommitKeyVersion: env.KYC_COMMIT_KEY_VERSION,
    sumsubWebhookSecret: env.SUMSUB_WEBHOOK_SECRET,
    sumsubAppToken: env.SUMSUB_APP_TOKEN,
    sumsubSecretKey: env.SUMSUB_SECRET_KEY,
    sumsubBaseUrl: env.SUMSUB_BASE_URL.replace(/\/$/, ''),
    sumsubLevelName: env.SUMSUB_LEVEL_NAME,
    sumsubSdkTtlSeconds: env.SUMSUB_SDK_TTL_SECONDS,
    kycOnchainLockSeconds: env.KYC_ONCHAIN_LOCK_SECONDS,
    kycRetryBaseDelaySeconds: env.KYC_RETRY_BASE_DELAY_SECONDS,
    complianceLockSeconds: env.COMPLIANCE_LOCK_SECONDS,
    complianceRetryBaseDelaySeconds: env.COMPLIANCE_RETRY_BASE_DELAY_SECONDS,
    complianceMaxAttempts: env.COMPLIANCE_MAX_ATTEMPTS,
    complianceReadyLimitDefault: env.COMPLIANCE_READY_LIMIT_DEFAULT,
    rateLimitWindowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    rateLimitKycStartMax: env.RATE_LIMIT_KYC_START_MAX,
    rateLimitComplianceCreateMax: env.RATE_LIMIT_COMPLIANCE_CREATE_MAX,
    corsAllowedOrigins,
    squareProxyBaseUrl: env.SQUARE_PROXY_BASE_URL.replace(/\/$/, ''),
    squareProxyTimeoutMs: env.SQUARE_PROXY_TIMEOUT_MS,
    adminAllowlist: parseAllowlist(env.ADMIN_ALLOWLIST),
    merchantAllowlist: parseAllowlist(env.MERCHANT_ALLOWLIST),
    complianceAllowlist: parseAllowlist(env.COMPLIANCE_ALLOWLIST),
  }
}
