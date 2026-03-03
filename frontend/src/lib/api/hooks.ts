'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { useActiveAccount } from 'thirdweb/react'
import { createApiClient } from '@/lib/api/client'
import type { WalletAuthAccount } from '@/lib/api/wallet-auth'

const useApiClient = () => {
  const account = useActiveAccount()

  const authAccount = useMemo<WalletAuthAccount | undefined>(() => {
    if (!account?.address || typeof account.signMessage !== 'function') {
      return undefined
    }

    return {
      address: account.address,
      signMessage: account.signMessage as WalletAuthAccount['signMessage'],
    }
  }, [account?.address, account?.signMessage])

  return useMemo(() => createApiClient(authAccount), [authAccount])
}

export const useBackendHealth = () => {
  const apiClient = useApiClient()
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30_000,
  })
}

export const useOverview = (date: string) => {
  const apiClient = useApiClient()
  return useQuery({
    queryKey: ['overview', date],
    queryFn: () => apiClient.getOverview(date),
  })
}

export const useBatches = (enabled = true) => {
  const apiClient = useApiClient()
  return useQuery({
    queryKey: ['batches'],
    queryFn: () => apiClient.getBatches(),
    enabled,
  })
}

export const usePeriods = (params?: { batchId?: number; status?: 'VERIFIED' | 'UNVERIFIED'; cursor?: string }) => {
  const apiClient = useApiClient()
  return useQuery({
    queryKey: ['periods', params],
    queryFn: () => apiClient.getPeriods(params),
  })
}

export const usePortfolio = (wallet?: string) => {
  const apiClient = useApiClient()
  return useQuery({
    queryKey: ['portfolio', wallet],
    queryFn: () => apiClient.getPortfolio(wallet as string),
    enabled: Boolean(wallet),
  })
}

export const usePaymentsDaily = (params: { merchantId: string; date: string; category?: string; item?: string }) => {
  const apiClient = useApiClient()
  return useQuery({
    queryKey: ['paymentsDaily', params],
    queryFn: () => apiClient.getPaymentsDaily(params),
  })
}

export const useRefundsDaily = (params: { merchantId: string; date: string }) => {
  const apiClient = useApiClient()
  return useQuery({
    queryKey: ['refundsDaily', params],
    queryFn: () => apiClient.getRefundsDaily(params),
  })
}

export const useCreateComplianceReport = () => {
  const apiClient = useApiClient()
  return useMutation({
    mutationFn: (params: { merchantIdHash: string; startDate: string; endDate: string }) =>
      apiClient.createComplianceReport(params),
  })
}

export const useComplianceReport = (requestId?: string) => {
  const apiClient = useApiClient()
  return useQuery({
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
}
