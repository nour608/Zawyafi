import { env } from '@/lib/env'
import { clearWalletAuthSession, getWalletApiAuthHeaders, type WalletAuthAccount } from '@/lib/api/wallet-auth'
import {
  backendHealthSchema,
  batchesResponseSchema,
  complianceInvestorWalletsResponseSchema,
  complianceKycRequestsResponseSchema,
  complianceReportRequestListResponseSchema,
  complianceReportStatusSchema,
  createComplianceReportResponseSchema,
  overviewSchema,
  paymentsResponseSchema,
  periodsResponseSchema,
  portfolioResponseSchema,
  refundsResponseSchema,
  txResponseSchema,
  walletCapabilitiesResponseSchema,
} from '@/lib/api/schemas'
import type { ComplianceReportStatus, KycStatus } from '@/lib/types/frontend'

interface RequestOptions {
  account?: WalletAuthAccount
  requiresWalletAuth?: boolean
}

const fetchJson = async <T>(
  input: string,
  parser: { parse: (value: unknown) => T },
  options: RequestOptions = {},
): Promise<T> => {
  const buildHeaders = async (): Promise<HeadersInit> => {
    const headers: HeadersInit = {
      Accept: 'application/json',
    }
    if (options.requiresWalletAuth) {
      Object.assign(headers, await getWalletApiAuthHeaders(options.account, env.NEXT_PUBLIC_BACKEND_BASE_URL))
    }
    return headers
  }

  let response = await fetch(`${env.NEXT_PUBLIC_BACKEND_BASE_URL}${input}`, {
    cache: 'no-store',
    headers: await buildHeaders(),
  })

  if (!response.ok && options.requiresWalletAuth && response.status === 401) {
    clearWalletAuthSession()
    response = await fetch(`${env.NEXT_PUBLIC_BACKEND_BASE_URL}${input}`, {
      cache: 'no-store',
      headers: await buildHeaders(),
    })
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`API request failed ${response.status}: ${body}`)
  }

  const json = (await response.json()) as unknown
  return parser.parse(json)
}

const postJson = async <T>(
  input: string,
  body: unknown,
  parser: { parse: (value: unknown) => T },
  options: RequestOptions = {},
): Promise<T> => {
  const buildHeaders = async (): Promise<HeadersInit> => {
    const headers: HeadersInit = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    if (options.requiresWalletAuth) {
      Object.assign(headers, await getWalletApiAuthHeaders(options.account, env.NEXT_PUBLIC_BACKEND_BASE_URL))
    }
    return headers
  }

  let response = await fetch(`${env.NEXT_PUBLIC_BACKEND_BASE_URL}${input}`, {
    method: 'POST',
    cache: 'no-store',
    headers: await buildHeaders(),
    body: JSON.stringify(body),
  })

  if (!response.ok && options.requiresWalletAuth && response.status === 401) {
    clearWalletAuthSession()
    response = await fetch(`${env.NEXT_PUBLIC_BACKEND_BASE_URL}${input}`, {
      method: 'POST',
      cache: 'no-store',
      headers: await buildHeaders(),
      body: JSON.stringify(body),
    })
  }

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`API request failed ${response.status}: ${payload}`)
  }

  const json = (await response.json()) as unknown
  return parser.parse(json)
}

export const createApiClient = (account?: WalletAuthAccount) => ({
  getWalletCapabilities: () =>
    fetchJson('/auth/capabilities', walletCapabilitiesResponseSchema, { account, requiresWalletAuth: true }),
  getHealth: () => fetchJson('/health', backendHealthSchema),
  getOverview: (date: string) =>
    fetchJson(`/frontend/overview?date=${encodeURIComponent(date)}`, overviewSchema, { account, requiresWalletAuth: true }),
  getBatches: () => fetchJson('/frontend/batches', batchesResponseSchema, { account, requiresWalletAuth: true }),
  getBatch: (batchId: number) =>
    fetchJson(`/frontend/batches/${batchId}`, batchesResponseSchema, { account, requiresWalletAuth: true }),
  getPeriods: (params?: { batchId?: number; status?: 'VERIFIED' | 'UNVERIFIED'; cursor?: string }) => {
    const search = new URLSearchParams()
    if (params?.batchId !== undefined) search.set('batchId', String(params.batchId))
    if (params?.status) search.set('status', params.status)
    if (params?.cursor) search.set('cursor', params.cursor)
    const query = search.toString()
    return fetchJson(`/frontend/periods${query ? `?${query}` : ''}`, periodsResponseSchema, { account, requiresWalletAuth: true })
  },
  getPortfolio: (wallet: string) =>
    fetchJson(`/frontend/portfolio?wallet=${encodeURIComponent(wallet)}`, portfolioResponseSchema, { account, requiresWalletAuth: true }),
  getTx: (txHash: string) => fetchJson(`/frontend/tx/${encodeURIComponent(txHash)}`, txResponseSchema, { account, requiresWalletAuth: true }),
  getPaymentsDaily: (params: { merchantId: string; date: string; category?: string; item?: string }) => {
    const search = new URLSearchParams({
      merchantId: params.merchantId,
      date: params.date,
    })
    if (params.category) search.set('category', params.category)
    if (params.item) search.set('item', params.item)
    return fetchJson(`/square/payments/daily?${search.toString()}`, paymentsResponseSchema, { account, requiresWalletAuth: true })
  },
  getRefundsDaily: (params: { merchantId: string; date: string }) => {
    const search = new URLSearchParams({
      merchantId: params.merchantId,
      date: params.date,
    })
    return fetchJson(`/square/refunds/daily?${search.toString()}`, refundsResponseSchema, { account, requiresWalletAuth: true })
  },
  createComplianceReport: (params: { merchantIdHash: string; startDate: string; endDate: string }) =>
    postJson('/compliance/reports', params, createComplianceReportResponseSchema, { account, requiresWalletAuth: true }),
  getComplianceReport: (requestId: string) =>
    fetchJson(`/compliance/reports/${encodeURIComponent(requestId)}`, complianceReportStatusSchema, {
      account,
      requiresWalletAuth: true,
    }),
  getComplianceKycRequests: (params?: { status?: KycStatus; wallet?: string; cursor?: string; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.wallet) search.set('wallet', params.wallet)
    if (params?.cursor) search.set('cursor', params.cursor)
    if (params?.limit !== undefined) search.set('limit', String(params.limit))
    const query = search.toString()
    return fetchJson(`/compliance/kyc/requests${query ? `?${query}` : ''}`, complianceKycRequestsResponseSchema, {
      account,
      requiresWalletAuth: true,
    })
  },
  getComplianceReports: (params?: { status?: ComplianceReportStatus; merchantIdHash?: string; cursor?: string; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.merchantIdHash) search.set('merchantIdHash', params.merchantIdHash)
    if (params?.cursor) search.set('cursor', params.cursor)
    if (params?.limit !== undefined) search.set('limit', String(params.limit))
    const query = search.toString()
    return fetchJson(`/compliance/reports${query ? `?${query}` : ''}`, complianceReportRequestListResponseSchema, {
      account,
      requiresWalletAuth: true,
    })
  },
  getComplianceInvestors: (params?: { status?: KycStatus; cursor?: string; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.cursor) search.set('cursor', params.cursor)
    if (params?.limit !== undefined) search.set('limit', String(params.limit))
    const query = search.toString()
    return fetchJson(`/compliance/investors${query ? `?${query}` : ''}`, complianceInvestorWalletsResponseSchema, {
      account,
      requiresWalletAuth: true,
    })
  },
})

export const apiClient = createApiClient()
