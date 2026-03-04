import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_BACKEND_BASE_URL: z.string().url().default('http://127.0.0.1:3100'),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().default(11155111),
  NEXT_PUBLIC_SEPOLIA_RPC_URL: z.string().url().default('https://ethereum-sepolia-rpc.publicnode.com'),
  NEXT_PUBLIC_THIRDWEB_CLIENT_ID: z.string().default('test'),
  NEXT_PUBLIC_FACTORY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default('0x394c072f983980543e12b2f554cc182d591f5a0b'),
  NEXT_PUBLIC_SETTLEMENT_VAULT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default('0xd559ffb149ddbece2db13b6d4a385ff87c6d5fcb'),
  NEXT_PUBLIC_REVENUE_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default('0x179f312e78d66ac8d1a0be97f0c44913b393655d'),
  NEXT_PUBLIC_ORACLE_COORDINATOR_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default('0x01d8f16b97e1dd6dc3b7a907e12382400c4a1cc0'),
  NEXT_PUBLIC_ADMIN_ALLOWLIST: z.string().default(''),
  NEXT_PUBLIC_MERCHANT_ALLOWLIST: z.string().default(''),
  NEXT_PUBLIC_COMPLIANCE_ALLOWLIST: z.string().default(''),
})

const rawEnv = {
  NEXT_PUBLIC_BACKEND_BASE_URL: process.env.NEXT_PUBLIC_BACKEND_BASE_URL,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  NEXT_PUBLIC_THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
  NEXT_PUBLIC_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_FACTORY_ADDRESS,
  NEXT_PUBLIC_SETTLEMENT_VAULT_ADDRESS: process.env.NEXT_PUBLIC_SETTLEMENT_VAULT_ADDRESS,
  NEXT_PUBLIC_REVENUE_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_REVENUE_REGISTRY_ADDRESS,
  NEXT_PUBLIC_ORACLE_COORDINATOR_ADDRESS: process.env.NEXT_PUBLIC_ORACLE_COORDINATOR_ADDRESS,
  NEXT_PUBLIC_ADMIN_ALLOWLIST: process.env.NEXT_PUBLIC_ADMIN_ALLOWLIST,
  NEXT_PUBLIC_MERCHANT_ALLOWLIST: process.env.NEXT_PUBLIC_MERCHANT_ALLOWLIST,
  NEXT_PUBLIC_COMPLIANCE_ALLOWLIST: process.env.NEXT_PUBLIC_COMPLIANCE_ALLOWLIST,
}

const parsed = envSchema.safeParse(rawEnv)

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  throw new Error(`Invalid frontend environment: ${details}`)
}

const parseList = (raw: string): string[] =>
  raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

const normalizedBackendBaseUrl = parsed.data.NEXT_PUBLIC_BACKEND_BASE_URL.trim().replace(/\/$/, '')

if (process.env.NODE_ENV === 'production' && /(^https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?$/i.test(normalizedBackendBaseUrl)) {
  throw new Error(
    `Invalid frontend environment: NEXT_PUBLIC_BACKEND_BASE_URL must not point to localhost in production (${normalizedBackendBaseUrl})`,
  )
}

export const env = {
  ...parsed.data,
  NEXT_PUBLIC_BACKEND_BASE_URL: normalizedBackendBaseUrl,
  adminAllowlist: parseList(parsed.data.NEXT_PUBLIC_ADMIN_ALLOWLIST),
  merchantAllowlist: parseList(parsed.data.NEXT_PUBLIC_MERCHANT_ALLOWLIST),
  complianceAllowlist: parseList(parsed.data.NEXT_PUBLIC_COMPLIANCE_ALLOWLIST),
}
