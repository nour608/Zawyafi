'use client'

import { useMemo } from 'react'
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react'
import { useWalletCapabilities } from '@/lib/api/hooks'
import { resolveCapabilities } from '@/lib/web3/roles'

export const useCapabilities = () => {
  const account = useActiveAccount()
  const connectionStatus = useActiveWalletConnectionStatus()
  const address = account?.address
  const isConnected = connectionStatus === 'connected' && Boolean(address)
  const walletCapabilitiesQuery = useWalletCapabilities(isConnected)

  const localCapabilities = useMemo(() => resolveCapabilities(address), [address])
  const capabilities = walletCapabilitiesQuery.data?.capabilities ?? localCapabilities

  return {
    address,
    isConnected,
    capabilities,
    isCapabilitiesLoading: isConnected && walletCapabilitiesQuery.isPending && !walletCapabilitiesQuery.data,
  }
}
