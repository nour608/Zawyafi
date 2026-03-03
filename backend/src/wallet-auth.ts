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
