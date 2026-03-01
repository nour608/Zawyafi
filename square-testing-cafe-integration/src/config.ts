import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

export interface AppConfig {
  port: number
  host: string
  logLevel: string
  squareBaseUrl: string
  squareVersion: string
  squarePatToken: string
  squareTimeoutMs: number
  squareMaxRetries: number
  squareRetryBaseDelayMs: number
  squareWebhookSignatureKey?: string
  squareWebhookNotificationUrl?: string
  squareWebhookRequireSignature: boolean
}

const configSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  SQUARE_BASE_URL: z.string().url().default('https://connect.squareupsandbox.com'),
  SQUARE_VERSION: z.string().default('2026-01-22'),
  SQUARE_PAT_FALLBACK_TOKEN: z.string().min(1, 'SQUARE_PAT_FALLBACK_TOKEN is required'),
  SQUARE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  SQUARE_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  SQUARE_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  SQUARE_WEBHOOK_SIGNATURE_KEY: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().optional(),
  ),
  SQUARE_WEBHOOK_NOTIFICATION_URL: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().url().optional(),
  ),
  SQUARE_WEBHOOK_REQUIRE_SIGNATURE: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z
      .enum(['true', 'false'])
      .optional()
      .default('false')
      .transform((flag) => flag === 'true'),
  ),
})

let didLoadDotEnv = false

const loadDotEnvFromCwd = (): void => {
  if (didLoadDotEnv) {
    return
  }
  didLoadDotEnv = true

  const envPath = path.resolve(process.cwd(), '.env')
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

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export const loadConfig = (): AppConfig => {
  loadDotEnvFromCwd()

  const parsed = configSchema.safeParse(process.env)

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${errors}`)
  }

  const env = parsed.data

  return {
    port: env.PORT,
    host: env.HOST,
    logLevel: env.LOG_LEVEL,
    squareBaseUrl: env.SQUARE_BASE_URL.replace(/\/$/, ''),
    squareVersion: env.SQUARE_VERSION,
    squarePatToken: env.SQUARE_PAT_FALLBACK_TOKEN,
    squareTimeoutMs: env.SQUARE_TIMEOUT_MS,
    squareMaxRetries: env.SQUARE_MAX_RETRIES,
    squareRetryBaseDelayMs: env.SQUARE_RETRY_BASE_DELAY_MS,
    squareWebhookSignatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    squareWebhookNotificationUrl: env.SQUARE_WEBHOOK_NOTIFICATION_URL,
    squareWebhookRequireSignature: Boolean(env.SQUARE_WEBHOOK_REQUIRE_SIGNATURE),
  }
}
