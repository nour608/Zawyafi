import { env } from '@/lib/env'
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

const fetchJson = async <T>(input: string, parser: { parse: (value: unknown) => T }): Promise<T> => {
  const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_BASE_URL}${input}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
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
): Promise<T> => {
  const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_BASE_URL}${input}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`API request failed ${response.status}: ${payload}`)
  }

  const json = (await response.json()) as unknown
  return parser.parse(json)
}

export const apiClient = {
  getHealth: () => fetchJson('/health', backendHealthSchema),
  getOverview: (date: string) => fetchJson(`/frontend/overview?date=${encodeURIComponent(date)}`, overviewSchema),
  getBatches: () => fetchJson('/frontend/batches', batchesResponseSchema),
  getBatch: (batchId: number) => fetchJson(`/frontend/batches/${batchId}`, batchesResponseSchema),
  getPeriods: (params?: { batchId?: number; status?: 'VERIFIED' | 'UNVERIFIED'; cursor?: string }) => {
    const search = new URLSearchParams()
    if (params?.batchId !== undefined) search.set('batchId', String(params.batchId))
    if (params?.status) search.set('status', params.status)
    if (params?.cursor) search.set('cursor', params.cursor)
    const query = search.toString()
    return fetchJson(`/frontend/periods${query ? `?${query}` : ''}`, periodsResponseSchema)
  },
  getPortfolio: (wallet: string) =>
    fetchJson(`/frontend/portfolio?wallet=${encodeURIComponent(wallet)}`, portfolioResponseSchema),
  getTx: (txHash: string) => fetchJson(`/frontend/tx/${encodeURIComponent(txHash)}`, txResponseSchema),
  getPaymentsDaily: (params: { merchantId: string; date: string; category?: string; item?: string }) => {
    const search = new URLSearchParams({
      merchantId: params.merchantId,
      date: params.date,
    })
    if (params.category) search.set('category', params.category)
    if (params.item) search.set('item', params.item)
    return fetchJson(`/square/payments/daily?${search.toString()}`, paymentsResponseSchema)
  },
  getRefundsDaily: (params: { merchantId: string; date: string }) => {
    const search = new URLSearchParams({
      merchantId: params.merchantId,
      date: params.date,
    })
    return fetchJson(`/square/refunds/daily?${search.toString()}`, refundsResponseSchema)
  },
  createComplianceReport: (params: { merchantIdHash: string; startDate: string; endDate: string }) =>
    postJson('/compliance/reports', params, createComplianceReportResponseSchema),
  getComplianceReport: (requestId: string) =>
    fetchJson(`/compliance/reports/${encodeURIComponent(requestId)}`, complianceReportStatusSchema),
}
