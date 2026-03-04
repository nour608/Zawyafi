import { createHmac, timingSafeEqual } from 'node:crypto'
import { recoverMessageAddress, isAddress } from 'viem'
import { AppError } from './errors'

export type WalletAuthScope = 'authenticated' | 'merchant' | 'compliance' | 'admin'

export interface WalletAuthHeaders {
  address: string
  timestamp: string
  signature: string
}

export interface WalletAuthCapabilities {
  canUseMerchant: boolean
  canUseCompliance: boolean
  canUseAdmin: boolean
}

export interface WalletSessionClaims {
  address: string
  issuedAtMs: number
  expiresAtMs: number
}

const WALLET_SESSION_TOKEN_VERSION = 'v1'

export const buildWalletAuthMessage = (params: {
  address: string
  timestamp: string
}): string =>
  [
    'Zawyafi API Session',
    `address:${params.address.toLowerCase()}`,
    `timestamp:${params.timestamp}`,
  ].join('\n')

const toSingleHeader = (value: string | string[] | undefined): string | undefined => {
  if (!value) return undefined
  if (Array.isArray(value)) return value[0]
  return value
}

export const parseWalletAuthHeaders = (headers: Record<string, string | string[] | undefined>): WalletAuthHeaders => {
  const address = toSingleHeader(headers['x-auth-address'])
  const timestamp = toSingleHeader(headers['x-auth-timestamp'])
  const signature = toSingleHeader(headers['x-auth-signature'])

  if (!address || !timestamp || !signature) {
    throw new AppError('UNAUTHORIZED', 'Missing wallet authentication headers', 401)
  }

  if (!isAddress(address)) {
    throw new AppError('UNAUTHORIZED', 'Invalid wallet authentication address', 401)
  }

  return {
    address: address.toLowerCase(),
    timestamp,
    signature,
  }
}

export const parseWalletSessionHeader = (headers: Record<string, string | string[] | undefined>): string | undefined => {
  const sessionToken = toSingleHeader(headers['x-auth-session'])
  if (!sessionToken) {
    return undefined
  }
  return sessionToken.trim()
}

const toBase64Url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url')

const fromBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8')

const signWalletSessionPayload = (payloadEncoded: string, secret: string): string =>
  createHmac('sha256', secret).update(payloadEncoded, 'utf8').digest('base64url')

export const createWalletSessionToken = (params: {
  address: string
  nowMs: number
  ttlMs: number
  secret: string
}): WalletSessionClaims & { token: string } => {
  if (!isAddress(params.address)) {
    throw new AppError('UNAUTHORIZED', 'Invalid wallet session address', 401)
  }

  if (!Number.isFinite(params.nowMs) || !Number.isFinite(params.ttlMs) || params.ttlMs <= 0) {
    throw new AppError('INTERNAL_ERROR', 'Invalid wallet session timing configuration', 500)
  }

  const issuedAtMs = Math.trunc(params.nowMs)
  const expiresAtMs = issuedAtMs + Math.trunc(params.ttlMs)
  const payload = {
    address: params.address.toLowerCase(),
    iat: issuedAtMs,
    exp: expiresAtMs,
  }
  const payloadEncoded = toBase64Url(JSON.stringify(payload))
  const signature = signWalletSessionPayload(payloadEncoded, params.secret)

  return {
    token: `${WALLET_SESSION_TOKEN_VERSION}.${payloadEncoded}.${signature}`,
    address: payload.address,
    issuedAtMs,
    expiresAtMs,
  }
}

export const verifyWalletSessionToken = (params: {
  token: string
  nowMs: number
  secret: string
}): WalletSessionClaims => {
  const token = params.token.trim()
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== WALLET_SESSION_TOKEN_VERSION) {
    throw new AppError('UNAUTHORIZED', 'Invalid wallet session token', 401)
  }

  const payloadEncoded = parts[1]
  const providedSignature = parts[2]
  if (!payloadEncoded || !providedSignature) {
    throw new AppError('UNAUTHORIZED', 'Invalid wallet session token', 401)
  }

  const expectedSignature = signWalletSessionPayload(payloadEncoded, params.secret)
  const expectedBytes = Buffer.from(expectedSignature, 'utf8')
  const providedBytes = Buffer.from(providedSignature, 'utf8')
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
    throw new AppError('UNAUTHORIZED', 'Invalid wallet session signature', 401)
  }

  let payload: { address?: unknown; iat?: unknown; exp?: unknown }
  try {
    payload = JSON.parse(fromBase64Url(payloadEncoded)) as { address?: unknown; iat?: unknown; exp?: unknown }
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid wallet session payload', 401)
  }

  const address = typeof payload.address === 'string' ? payload.address.toLowerCase() : ''
  const issuedAtMs = Number(payload.iat)
  const expiresAtMs = Number(payload.exp)

  if (!isAddress(address) || !Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= issuedAtMs) {
    throw new AppError('UNAUTHORIZED', 'Invalid wallet session payload', 401)
  }

  if (params.nowMs > expiresAtMs) {
    throw new AppError('UNAUTHORIZED', 'Wallet session expired', 401)
  }

  return {
    address,
    issuedAtMs: Math.trunc(issuedAtMs),
    expiresAtMs: Math.trunc(expiresAtMs),
  }
}

export const verifyWalletRequestAuth = async (params: {
  headers: WalletAuthHeaders
  nowMs: number
  maxClockSkewMs: number
}): Promise<{ address: string }> => {
  const timestampMs = Number.parseInt(params.headers.timestamp, 10)
  if (!Number.isFinite(timestampMs)) {
    throw new AppError('UNAUTHORIZED', 'Invalid wallet authentication timestamp', 401)
  }

  if (Math.abs(params.nowMs - timestampMs) > params.maxClockSkewMs) {
    throw new AppError('UNAUTHORIZED', 'Wallet authentication timestamp expired', 401, {
      maxClockSkewMs: params.maxClockSkewMs,
    })
  }

  const message = buildWalletAuthMessage({
    address: params.headers.address,
    timestamp: params.headers.timestamp,
  })

  let recoveredAddress: string
  try {
    recoveredAddress = await recoverMessageAddress({
      message,
      signature: params.headers.signature as `0x${string}`,
    })
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid wallet authentication signature', 401)
  }

  if (recoveredAddress.toLowerCase() !== params.headers.address) {
    throw new AppError('UNAUTHORIZED', 'Wallet authentication signature mismatch', 401)
  }

  return {
    address: params.headers.address,
  }
}

export const resolveWalletCapabilities = (
  address: string,
  allowlists: {
    adminAllowlist: string[]
    merchantAllowlist: string[]
    complianceAllowlist: string[]
  },
): WalletAuthCapabilities => {
  const normalized = address.toLowerCase()
  const isAdmin = allowlists.adminAllowlist.includes(normalized)

  return {
    canUseAdmin: isAdmin,
    canUseMerchant: isAdmin || allowlists.merchantAllowlist.includes(normalized),
    canUseCompliance: isAdmin || allowlists.complianceAllowlist.includes(normalized),
  }
}

export const assertWalletScope = (scope: WalletAuthScope, capabilities: WalletAuthCapabilities): void => {
  if (scope === 'authenticated') {
    return
  }

  if (scope === 'merchant' && !capabilities.canUseMerchant) {
    throw new AppError('FORBIDDEN', 'Merchant role required', 403)
  }

  if (scope === 'compliance' && !capabilities.canUseCompliance) {
    throw new AppError('FORBIDDEN', 'Compliance role required', 403)
  }

  if (scope === 'admin' && !capabilities.canUseAdmin) {
    throw new AppError('FORBIDDEN', 'Admin role required', 403)
  }
}
