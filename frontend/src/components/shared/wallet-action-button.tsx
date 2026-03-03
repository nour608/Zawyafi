'use client'

import React, { useMemo } from 'react'
import { Wallet, LogOut } from 'lucide-react'
import { sepolia } from 'thirdweb/chains'
import { useActiveAccount, useActiveWallet, useConnectModal, useDisconnect } from 'thirdweb/react'
import { Button } from '@/components/ui/button'
import { formatShortHash } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { clearWalletAuthSession } from '@/lib/api/wallet-auth'
import { thirdwebClient } from '@/lib/web3/client'

type WalletActionButtonProps = {
  labelDisconnected: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'cc' | 'cc-outline'
  className?: string
  showAddressWhenConnected?: boolean
}

export const WalletActionButton = ({
  labelDisconnected,
  variant = 'secondary',
  className,
  showAddressWhenConnected = true,
}: WalletActionButtonProps) => {
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const { connect, isConnecting } = useConnectModal()
  const { disconnect } = useDisconnect()

  const connectedLabel = useMemo(() => {
    if (!account?.address) {
      return 'Connected'
    }

    if (!showAddressWhenConnected) {
      return 'Connected'
    }

    return formatShortHash(account.address, 7, 5)
  }, [account?.address, showAddressWhenConnected])

  const handleConnect = async (): Promise<void> => {
    await connect({
      client: thirdwebClient,
      chain: sepolia,
      title: 'Connect your wallet',
      showThirdwebBranding: false,
      size: 'compact',
    }).catch(() => undefined)
  }

  const handleDisconnect = (): void => {
    if (!wallet) {
      return
    }

    clearWalletAuthSession()
    disconnect(wallet)
  }

  if (!account) {
    return (
      <Button variant={variant} className={className} onClick={handleConnect} disabled={isConnecting}>
        <Wallet className="mr-2 size-4" />
        {isConnecting ? 'Connecting...' : labelDisconnected}
      </Button>
    )
  }

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="inline-flex min-h-11 items-center rounded-xl border border-line bg-panel px-4 py-2 text-xs font-semibold tracking-wide text-text">
        {connectedLabel}
      </span>
      <Button variant="ghost" className="min-h-11 min-w-11 px-3" onClick={handleDisconnect} aria-label="Disconnect wallet">
        <LogOut className="size-4" />
      </Button>
    </div>
  )
}
