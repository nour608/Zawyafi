import { env } from '@/lib/env'
import { getWalletAuthHeaders, type WalletAuthAccount } from '@/lib/api/wallet-auth'
import {
  backendHealthSchema,
  batchesResponseSchema,
  complianceReportStatusSchema,
  createComplianceReportResponseSchema,
  overviewSchema,
  paymentsResponseSchema,
  periodsResponseSchema,
  portfolioResponseSchema,
  refundsResponseSchema,
  txResponseSchema,
} from '@/lib/api/schemas'

interface RequestOptions {
  account?: WalletAuthAccount
  requiresWalletAuth?: boolean
}

const fetchJson = async <T>(
  input: string,
  parser: { parse: (value: unknown) => T },
  options: RequestOptions = {},
): Promise<T> => {
  const headers: HeadersInit = {
    Accept: 'application/json',
  }

  if (options.requiresWalletAuth) {
    Object.assign(headers, await getWalletAuthHeaders(options.account))
  }

  const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_BASE_URL}${input}`, {
    cache: 'no-store',
    headers,
  })

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
  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (options.requiresWalletAuth) {
    Object.assign(headers, await getWalletAuthHeaders(options.account))
  }

  const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_BASE_URL}${input}`, {
    method: 'POST',
    cache: 'no-store',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`API request failed ${response.status}: ${payload}`)
  }

  const json = (await response.json()) as unknown
  return parser.parse(json)
}

export const createApiClient = (account?: WalletAuthAccount) => ({
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
})

export const apiClient = createApiClient()
