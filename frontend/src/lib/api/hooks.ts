'use client'

import { useQuery } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export const useBackendHealth = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30_000,
  })

export const useOverview = (date: string) =>
  useQuery({
    queryKey: ['overview', date],
    queryFn: () => apiClient.getOverview(date),
  })

export const useBatches = (enabled = true) =>
  useQuery({
    queryKey: ['batches'],
    queryFn: () => apiClient.getBatches(),
    enabled,
  })

export const usePeriods = (params?: { batchId?: number; status?: 'VERIFIED' | 'UNVERIFIED'; cursor?: string }) =>
  useQuery({
    queryKey: ['periods', params],
    queryFn: () => apiClient.getPeriods(params),
  })

export const usePortfolio = (wallet?: string) =>
  useQuery({
    queryKey: ['portfolio', wallet],
    queryFn: () => apiClient.getPortfolio(wallet as string),
    enabled: Boolean(wallet),
  })

export const usePaymentsDaily = (params: { merchantId: string; date: string; category?: string; item?: string }) =>
  useQuery({
    queryKey: ['paymentsDaily', params],
    queryFn: () => apiClient.getPaymentsDaily(params),
  })

export const useRefundsDaily = (params: { merchantId: string; date: string }) =>
  useQuery({
    queryKey: ['refundsDaily', params],
    queryFn: () => apiClient.getRefundsDaily(params),
  })

export const useCreateComplianceReport = () =>
  useMutation({
    mutationFn: (params: { merchantIdHash: string; startDate: string; endDate: string }) =>
      apiClient.createComplianceReport(params),
  })

export const useComplianceReport = (requestId?: string) =>
  useQuery({
    queryKey: ['complianceReport', requestId],
    queryFn: () => apiClient.getComplianceReport(requestId as string),
    enabled: Boolean(requestId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'QUEUED' || status === 'PROCESSING') {
        return 2000
      }
      return false
    },
  })
