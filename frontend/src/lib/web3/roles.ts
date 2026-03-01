import type { RoleCapability } from '@/lib/types/frontend'
import { env } from '@/lib/env'

const isInAllowlist = (wallet: string | undefined, allowlist: string[]): boolean => {
  if (!wallet) {
    return false
  }

  return allowlist.includes(wallet.toLowerCase())
}

export const resolveCapabilities = (wallet?: string): RoleCapability => ({
  canUseMerchant: isInAllowlist(wallet, env.merchantAllowlist) || isInAllowlist(wallet, env.adminAllowlist),
  canUseCompliance: isInAllowlist(wallet, env.complianceAllowlist) || isInAllowlist(wallet, env.adminAllowlist),
  canUseAdmin: isInAllowlist(wallet, env.adminAllowlist),
})
