'use client'

import { useMemo } from 'react'
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react'
import { resolveCapabilities } from '@/lib/web3/roles'

export const useCapabilities = () => {
  const account = useActiveAccount()
  const connectionStatus = useActiveWalletConnectionStatus()
  const address = account?.address
  const isConnected = connectionStatus === 'connected' && Boolean(address)

  const capabilities = useMemo(() => resolveCapabilities(address), [address])

  return {
    address,
    isConnected,
    capabilities,
  }
}
