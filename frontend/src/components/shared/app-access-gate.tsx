'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useActiveWalletConnectionStatus } from 'thirdweb/react'
import { WalletActionButton } from '@/components/shared/wallet-action-button'
import { Card } from '@/components/ui/card'
import { useCapabilities } from '@/hooks/use-capabilities'
import type { RoleCapability } from '@/lib/types/frontend'

type AppAccessGateProps = {
  children: ReactNode
}

type AccessRequirement = 'authenticated' | 'merchant' | 'compliance' | 'admin'

const resolveAccessRequirement = (pathname: string): AccessRequirement => {
  if (pathname.startsWith('/admin')) {
    return 'admin'
  }

  if (pathname.startsWith('/merchant')) {
    return 'merchant'
  }

  if (pathname.startsWith('/compliance') && !pathname.startsWith('/compliance/kyc')) {
    return 'compliance'
  }

  return 'authenticated'
}

const hasAccess = (requirement: AccessRequirement, capabilities: RoleCapability): boolean => {
  if (requirement === 'authenticated') {
    return true
  }

  if (requirement === 'merchant') {
    return capabilities.canUseMerchant
  }

  if (requirement === 'compliance') {
    return capabilities.canUseCompliance
  }

  return capabilities.canUseAdmin
}

const blockedMessageByRequirement: Record<AccessRequirement, string> = {
  authenticated: 'This section requires an authenticated wallet session.',
  merchant: 'This section requires a merchant or admin wallet.',
  compliance: 'This section requires a compliance or admin wallet.',
  admin: 'This section requires an admin wallet.',
}

export const AppAccessGate = ({ children }: AppAccessGateProps) => {
  const pathname = usePathname() || '/'
  const connectionStatus = useActiveWalletConnectionStatus()
  const { isConnected, capabilities } = useCapabilities()

  const requirement = useMemo(() => resolveAccessRequirement(pathname), [pathname])

  if (connectionStatus === 'unknown' || connectionStatus === 'connecting') {
    return (
      <Card className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-text">Authentication required</h2>
          <p className="mt-2 text-sm text-textMuted">
            {connectionStatus === 'connecting'
              ? 'Connecting to your wallet...'
              : 'We are confirming your wallet session. If this takes too long, connect your wallet manually.'}
          </p>
        </div>
        <WalletActionButton labelDisconnected="Connect Wallet" variant="cc" />
      </Card>
    )
  }

  if (!isConnected) {
    return (
      <Card className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-text">Authentication required</h2>
          <p className="mt-2 max-w-2xl text-sm text-textMuted">Connect your wallet to access this section of the app.</p>
        </div>
        <WalletActionButton labelDisconnected="Connect Wallet" variant="cc" />
      </Card>
    )
  }

  if (!hasAccess(requirement, capabilities)) {
    return (
      <Card className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-text">Access denied</h2>
          <p className="mt-2 max-w-2xl text-sm text-textMuted">{blockedMessageByRequirement[requirement]}</p>
        </div>
        <WalletActionButton labelDisconnected="Connect Wallet" variant="secondary" />
      </Card>
    )
  }

  return <>{children}</>
}
