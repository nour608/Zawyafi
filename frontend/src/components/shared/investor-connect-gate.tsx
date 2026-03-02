'use client'

import React from 'react'
import type { ReactNode } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { Card } from '@/components/ui/card'
import { WalletActionButton } from '@/components/shared/wallet-action-button'

export interface InvestorConnectGateProps {
  title?: string
  description?: string
  children?: ReactNode
}

export const InvestorConnectGate = ({
  title = 'Connect wallet to continue',
  description = 'Log in with your wallet to access investor data and actions.',
  children,
}: InvestorConnectGateProps) => {
  const account = useActiveAccount()

  if (account?.address) {
    return <>{children ?? null}</>
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold text-text">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-textMuted">{description}</p>
      </div>
      <WalletActionButton labelDisconnected="Connect Wallet" variant="cc" />
    </Card>
  )
}
